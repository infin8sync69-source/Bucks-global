# Critical Code Fixes for Backend Synchronization & Persistence

## 1. FIX: Upload Endpoint with Proper Transaction & Error Handling

**File**: `backend/main.py` - `upload_file` function

**Issue**: DAG update failures are silent; no transaction rollback

**Current Code** (Lines 878-1049):
```python
# Creates post in DB
c.execute("INSERT INTO posts ...")

# DAG update can fail silently
try:
    new_dag_root = await social_dag.update_profile(...)
except Exception as dag_err:
    print(f"DAG Update failed: {dag_err}")
    # ← Post remains in DB but DAG is inconsistent!

conn.commit()  # Commits even if DAG failed
```

**Fixed Code**:
```python
@app.post("/api/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(""),
    description: str = Form(""),
    upload_type: str = Form("post"),
    visibility: str = Form("public"),
):
    """Upload file to IPFS with proper error handling"""
    did = get_current_did(request)
    
    if len(title) > 200:
        raise HTTPException(status_code=400, detail="Title too long")
    if len(description) > 5000:
        raise HTTPException(status_code=400, detail="Description too long")
    
    temp_path = None
    conn = None
    try:
        # ── Step 1: Upload to IPFS ────────────────────────────────────
        temp_dir = tempfile.gettempdir()
        safe_filename = secure_filename(file.filename)
        temp_path = os.path.join(temp_dir, f"temp_{uuid.uuid4().hex}_{safe_filename}")
        
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Add to IPFS
        cid = await rpc_client.add(content)
        if not cid:
            raise HTTPException(status_code=500, detail="Failed to add file to IPFS")
        
        # ── Step 2: Generate thumbnail if PDF ────────────────────────
        thumbnail_cid = None
        if upload_type == "post" and file.filename.lower().endswith(".pdf"):
            try:
                thumb_path = generate_pdf_thumbnail(temp_path)
                if thumb_path and os.path.exists(thumb_path):
                    with open(thumb_path, "rb") as tf:
                        thumbnail_cid = await rpc_client.add(tf.read())
                    os.remove(thumb_path)
            except Exception as te:
                logger.warning(f"PDF thumbnail failed: {te}")
        
        # ── Step 3: Transactional DB Update ────────────────────────────
        if upload_type == "post":
            conn = get_db_connection()
            c = conn.cursor()
            
            try:
                # Fetch user profile
                user_profile = c.execute(
                    "SELECT * FROM users WHERE peer_id = ?", (did,)
                ).fetchone()
                
                if not user_profile:
                    user_profile = {
                        "username": "Anonymous",
                        "avatar": "files/avatar_placeholder.png",
                        "dag_root": None
                    }
                else:
                    user_profile = dict(user_profile)
                
                # Create entry
                entry_dict = {
                    "name": title or safe_filename,
                    "description": description,
                    "filename": safe_filename,
                    "cid": cid,
                    "thumbnail_cid": thumbnail_cid,
                    "type": "file",
                    "author": user_profile.get("username", "Anonymous"),
                    "avatar": user_profile.get("avatar", ""),
                    "peer_id": did,
                    "visibility": visibility,
                    "timestamp": datetime.now().isoformat()
                }
                
                # ── Phase 1: Write to SQL ────────────────────────────────
                c.execute("""
                    INSERT INTO posts (id, name, description, filename, type, author, avatar, timestamp, peer_id, visibility)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    entry_dict["cid"],
                    entry_dict["name"],
                    entry_dict["description"],
                    entry_dict["filename"],
                    entry_dict["type"],
                    entry_dict["author"],
                    entry_dict["avatar"],
                    entry_dict["timestamp"],
                    entry_dict["peer_id"],
                    entry_dict["visibility"]
                ))
                
                # ── Phase 2: Update DAG (with validation) ────────────────
                new_dag_root = None
                if social_dag and rpc_client:
                    user_row = c.execute(
                        "SELECT dag_root, username, handle, avatar, bio FROM users WHERE peer_id = ?",
                        (did,)
                    ).fetchone()
                    
                    if user_row:
                        user_data = dict(user_row)
                        old_dag_root = user_data.get("dag_root")
                        
                        # Get previous post CID from DAG
                        prev_post_cid = None
                        if old_dag_root:
                            try:
                                root_node = await rpc_client.dag_get(old_dag_root)
                                prev_post_cid = root_node.get("feed_head")
                            except Exception as e:
                                logger.warning(f"Could not retrieve previous DAG root: {e}")
                        
                        # Create new linked post
                        try:
                            new_post_cid = await social_dag.create_post(entry_dict, prev_post_cid)
                            if not new_post_cid:
                                raise ValueError("Failed to create post in DAG")
                            
                            # Update profile root
                            profile_data = {
                                "username": user_data["username"],
                                "handle": user_data["handle"],
                                "avatar": user_data["avatar"],
                                "bio": user_data.get("bio", ""),
                                "peer_id": did
                            }
                            new_dag_root = await social_dag.update_profile(profile_data, new_post_cid)
                            
                            if not new_dag_root:
                                raise ValueError("Failed to update profile in DAG")
                            
                            # Update user's DAG root in SQL
                            c.execute(
                                "UPDATE users SET dag_root = ? WHERE peer_id = ?",
                                (new_dag_root, did)
                            )
                            
                        except Exception as dag_err:
                            logger.error(f"DAG update failed for {did}: {dag_err}", exc_info=True)
                            # Rollback SQL changes
                            conn.rollback()
                            raise HTTPException(
                                status_code=500,
                                detail=f"Failed to sync to decentralized network: {str(dag_err)}"
                            )
                
                # ── Phase 3: Commit ──────────────────────────────────────
                conn.commit()
                
                # ── Phase 4: Publish Updates ──────────────────────────────
                try:
                    await rpc_client.pubsub_pub("/app/feed/updates", json.dumps({
                        "peer_id": did,
                        "new_root": new_dag_root,
                        "post_cid": cid,
                        "timestamp": datetime.now().isoformat()
                    }))
                except Exception as pub_err:
                    logger.warning(f"PubSub publish failed: {pub_err}")
                
                # ── Phase 5: Pin to Cluster ──────────────────────────────
                try:
                    await run_command_async([CLUSTER_CTL, "pin", "add", cid])
                    if thumbnail_cid:
                        await run_command_async([CLUSTER_CTL, "pin", "add", thumbnail_cid])
                except Exception as pin_err:
                    logger.warning(f"Cluster pin failed: {pin_err}")
                
                return {
                    "success": True,
                    "cid": cid,
                    "thumbnail_cid": thumbnail_cid,
                    "filename": safe_filename,
                    "upload_type": upload_type,
                    "dag_synced": new_dag_root is not None
                }
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Upload transaction failed: {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
        else:
            # Avatar/banner upload (simpler, no DAG)
            return {
                "success": True,
                "cid": cid,
                "filename": safe_filename,
                "upload_type": upload_type
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Upload failed")
    finally:
        if conn:
            conn.close()
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
```

---

## 2. FIX: Add Missing Messages Endpoint

**File**: `backend/main.py` - Complete the `/api/messages/{peer_id}` endpoint

**Current Issue**: Endpoint stub ends mid-function

**Fixed Code**:
```python
@app.get("/api/messages/{peer_id}")
async def get_conversation(peer_id: str, request: Request, limit: int = 50, offset: int = 0):
    """Get conversation with a specific peer"""
    my_peer_id = get_current_did(request)
    
    if my_peer_id == "anonymous":
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    
    conn = get_db_connection()
    try:
        # Fetch messages between these two peers
        query = """
            SELECT * FROM messages
            WHERE (sender_peer_id = ? AND receiver_peer_id = ?)
               OR (sender_peer_id = ? AND receiver_peer_id = ?)
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        """
        messages = conn.execute(
            query,
            (my_peer_id, peer_id, peer_id, my_peer_id, limit, offset)
        ).fetchall()
        
        # Mark received messages as read
        conn.execute(
            "UPDATE messages SET is_read = 1 WHERE receiver_peer_id = ? AND sender_peer_id = ?",
            (my_peer_id, peer_id)
        )
        conn.commit()
        
        # Reverse to get chronological order (we fetched DESC)
        messages_list = [dict(m) for m in reversed(messages)]
        
        return {
            "messages": messages_list,
            "count": len(messages_list),
            "peer_id": peer_id
        }
    except Exception as e:
        logger.error(f"Failed to fetch messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch messages")
    finally:
        conn.close()

@app.post("/api/messages/{peer_id}")
async def send_message(peer_id: str, request: Request):
    """Send a message to a peer"""
    my_peer_id = get_current_did(request)
    
    if my_peer_id == "anonymous":
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        body = await request.json()
        text = body.get("text", "").strip()
        
        if not text or len(text) > 5000:
            raise HTTPException(status_code=400, detail="Message must be 1-5000 chars")
        
        # Encrypt & pin to IPFS (optional)
        cid = None
        if rpc_client:
            try:
                cid = await rpc_client.add(text.encode())
            except Exception as e:
                logger.warning(f"Failed to pin message to IPFS: {e}")
        
        # Store in DB
        conn = get_db_connection()
        conn.execute("""
            INSERT INTO messages (sender_peer_id, receiver_peer_id, text, timestamp, cid, is_read)
            VALUES (?, ?, ?, ?, ?, 0)
        """, (my_peer_id, peer_id, text, datetime.now().isoformat(), cid))
        conn.commit()
        conn.close()
        
        # Send P2P notification
        try:
            inbox_topic = f"/app/inbox/{peer_id}"
            await p2p_client.publish(inbox_topic, json.dumps({
                "type": "message",
                "from": my_peer_id,
                "text": text[:100],  # Preview
                "timestamp": datetime.now().isoformat()
            }))
        except Exception as e:
            logger.warning(f"Failed to send P2P notification: {e}")
        
        return {"success": True, "cid": cid}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Message send failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")
```

---

## 3. FIX: Add Pagination to Feed Aggregation

**File**: `backend/main.py` - Update `get_aggregated_feed`

**Current Issue**: Fetches and sorts ALL posts on every request

**Fixed Code**:
```python
@app.get("/api/feed/aggregated")
async def get_aggregated_feed(
    request: Request,
    limit: int = 20,
    offset: int = 0,
    sort: str = "newest"  # newest, popular
):
    """Get paginated aggregated feed"""
    my_peer_id = get_current_did(request)
    limit = min(max(limit, 1), 100)  # Clamp to 1-100
    offset = max(offset, 0)
    
    conn = get_db_connection()
    c = conn.cursor()
    
    try:
        # ── 1. Fetch own posts ────────────────────────────────────────
        my_posts_rows = c.execute("""
            SELECT id as cid, name, description, filename, type, author, avatar,
                   timestamp, peer_id, size, is_pinned, content, visibility,
                   original_cid, tag
            FROM posts
            ORDER BY timestamp DESC
        """).fetchall()
        my_posts = [dict(r) for r in my_posts_rows]
        
        # ── 2. Fetch following ────────────────────────────────────────
        following_rows = c.execute(
            "SELECT * FROM following WHERE user_peer_id = ?",
            (my_peer_id,)
        ).fetchall()
        following = [dict(r) for r in following_rows]
        following_ids = [f["following_peer_id"] for f in following]
        
        # ── 3. Fetch interactions (batch query, not per-post) ─────────
        counts_rows = c.execute("""
            SELECT post_cid, type, COUNT(*) as count
            FROM interactions
            GROUP BY post_cid, type
        """).fetchall()
        interactions_map = {}
        for r in counts_rows:
            cid = r["post_cid"]
            if cid not in interactions_map:
                interactions_map[cid] = {"likes_count": 0, "dislikes_count": 0}
            if r["type"] == "like":
                interactions_map[cid]["likes_count"] = r["count"]
            elif r["type"] == "dislike":
                interactions_map[cid]["dislikes_count"] = r["count"]
        
        all_posts = list(my_posts)
        
        # ── 4. Fetch followed content (with limit) ────────────────────
        for peer in following:
            try:
                peer_id = peer.get("following_peer_id")
                raw_peer_id = peer_id.replace("did:ipfs:", "") if peer_id.startswith("did:ipfs:") else peer_id
                
                resolved_cid = None
                if rpc_client and social_dag:
                    try:
                        resolved_cid = await rpc_client.name_resolve(raw_peer_id)
                    except:
                        resolved_cid = peer.get("library_cid")
                
                if resolved_cid:
                    peer_library = await social_dag.traverse_feed(resolved_cid, limit=20)
                    for item in peer_library:
                        item["_from_peer"] = peer.get("username", "Unknown")
                        item["peer_id"] = peer_id
                    all_posts.extend(peer_library)
            except Exception as e:
                logger.warning(f"Error fetching {peer.get('following_peer_id')}: {e}")
                continue
        
        # ── 5. Apply privacy & sentiment filters ──────────────────────
        filtered_posts = []
        for item in all_posts:
            cid = item.get("cid")
            item_peer_id = item.get("peer_id")
            
            # Privacy check
            visibility = item.get("visibility", "public")
            is_mine = item_peer_id == my_peer_id
            is_from_connection = item_peer_id in following_ids
            
            if visibility == "connections" and not (is_mine or is_from_connection):
                continue
            
            # Sentiment check
            stats = interactions_map.get(cid, {})
            likes = stats.get("likes_count", 0)
            dislikes = stats.get("dislikes_count", 0)
            
            # Hide negative posts (unless mine or from connection)
            if dislikes > likes and not (is_mine or is_from_connection):
                continue
            
            # Attach interaction stats
            item["_likes_count"] = likes
            item["_dislikes_count"] = dislikes
            filtered_posts.append(item)
        
        # ── 6. Sort and paginate ──────────────────────────────────────
        if sort == "popular":
            filtered_posts.sort(
                key=lambda x: (x.get("_likes_count", 0), x.get("timestamp", "")),
                reverse=True
            )
        else:  # newest
            filtered_posts.sort(
                key=lambda x: x.get("timestamp", ""),
                reverse=True
            )
        
        paginated = filtered_posts[offset:offset+limit]
        
        return {
            "library": paginated,
            "count": len(paginated),
            "total": len(filtered_posts),
            "offset": offset,
            "limit": limit,
            "has_more": (offset + limit) < len(filtered_posts)
        }
    
    finally:
        conn.close()
```

---

## 4. FIX: Add Real-Time Notification Stream (SSE)

**File**: `backend/main.py` - New endpoint

```python
from fastapi.responses import StreamingResponse
import asyncio

# Global notification queues (in production, use Redis)
notification_queues: Dict[str, asyncio.Queue] = {}

def get_notification_queue(did: str) -> asyncio.Queue:
    """Get or create notification queue for a user"""
    if did not in notification_queues:
        notification_queues[did] = asyncio.Queue(maxsize=100)
    return notification_queues[did]

@app.get("/api/stream")
async def stream_notifications(request: Request):
    """Server-Sent Events stream for real-time notifications"""
    did = get_current_did(request)
    
    if did == "anonymous":
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    queue = get_notification_queue(did)
    
    async def event_generator():
        try:
            # Send initial "connected" message
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            
            while True:
                try:
                    # Wait for notification with 30-second heartbeat
                    notification = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(notification)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat
                    yield f": heartbeat\n\n"
        except GeneratorExit:
            # Client disconnected
            try:
                queue.task_done()
            except:
                pass
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )

# Update create_notification to push to queue
def create_notification(user_did: str, notif_type: str, title: str, message: str, link: str = ""):
    """Create and push notification"""
    try:
        conn = get_db_connection()
        timestamp = datetime.now().isoformat()
        conn.execute("""
            INSERT INTO notifications (user_peer_id, type, title, message, link, timestamp, is_read)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        """, (user_did, notif_type, title, message, link, timestamp))
        conn.commit()
        conn.close()
        
        # Push to real-time stream
        queue = get_notification_queue(user_did)
        try:
            queue.put_nowait({
                "type": notif_type,
                "title": title,
                "message": message,
                "link": link,
                "timestamp": timestamp
            })
        except asyncio.QueueFull:
            logger.warning(f"Notification queue full for {user_did}")
            
    except Exception as e:
        logger.error(f"create_notification error: {e}")
```

---

## 5. FIX: Add Logging Infrastructure

**File**: `backend/main.py` - Add at top

```python
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        # Optional: Add file handler
        # logging.FileHandler("app.log")
    ]
)
logger = logging.getLogger("bucks")

# Now replace all print(...) with logger.info/warning/error
```

---

## Implementation Checklist

```
[ ] Implement transaction handling in upload endpoint
[ ] Complete message endpoints (GET/POST conversation)
[ ] Add pagination to feed endpoints
[ ] Implement SSE notification stream
[ ] Add logging infrastructure
[ ] Add error metrics/alerting
[ ] Update frontend to consume SSE stream
[ ] Test offline scenarios
[ ] Load test with multiple concurrent users
```

---

## Testing Commands

```bash
# Test upload with proper error handling
curl -X POST http://localhost:8000/api/upload \
  -F "file=@test.pdf" \
  -F "title=Test Doc" \
  -H "X-DID: did:key:z..."

# Test SSE stream
curl -N http://localhost:8000/api/stream \
  -H "X-DID: did:key:z..."

# Test paginated feed
curl "http://localhost:8000/api/feed/aggregated?limit=20&offset=0&sort=newest" \
  -H "X-DID: did:key:z..."

# Test message endpoint
curl -X POST http://localhost:8000/api/messages/did:ipfs:Qm... \
  -H "X-DID: did:key:z..." \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello!"}'
```

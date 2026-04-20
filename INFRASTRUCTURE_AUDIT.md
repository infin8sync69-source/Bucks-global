# Bucks Global - Backend & Database Infrastructure Audit

**Date:** April 20, 2026  
**Scope:** End-to-end user flow, data persistence, sync mechanisms, and user-centric features

---

## Executive Summary

The Bucks Global infrastructure is **largely functional but has critical gaps** in data persistence, real-time syncing, and user feedback loops. The system supports the core MVP flow but needs improvements in:

1. **Data Consistency**: DAG vs SQL database sync issues
2. **User Feedback**: Missing real-time updates and notifications  
3. **Offline Resilience**: No service worker or local caching
4. **Error Handling**: Silent failures in critical operations
5. **Data Validation**: Weak input validation across endpoints

---

## User Flow Analysis (End-to-End)

### ✅ WORKING FLOWS

#### 1. Identity & Profile Creation
- **Endpoint**: `POST /api/auth/generate-identity` + `POST /api/users`
- **Data Path**: Generate DID → Store in users table → Create DAG root
- **Status**: ✅ Functional
- **Concern**: Avatar truncation (64KB) is good, but no image validation

#### 2. Content Upload & Registration  
- **Endpoints**: `POST /api/upload`, `POST /api/register_content`
- **Data Path**: File → IPFS (RPC) → CID stored in posts table → DAG link → Manifest update
- **Status**: ✅ Mostly functional
- **Issues**: 
  - DAG update can fail silently (`except Exception: pass`)
  - No upload progress feedback to user
  - No retry logic if IPFS unavailable

#### 3. Social Graph (Follow/Unfollow)
- **Endpoints**: `POST /api/follow/{peer_id}`, `POST /api/unfollow/{peer_id}`
- **Data Path**: Store in following table → Resolve IPNS → Traverse DAG → Pin content
- **Status**: ✅ Functional with warnings
- **Issues**:
  - IPNS resolution fallback is silent
  - DAG traversal can return stale data if IPNS not updated
  - No validation that followed peer actually exists

#### 4. Feed Aggregation
- **Endpoint**: `GET /api/feed/aggregated`
- **Data Path**: Own posts + followed peers' posts + interaction stats
- **Status**: ✅ Functional but inefficient
- **Issues**:
  - Fetches ALL interactions every time (no pagination/caching)
  - Privacy filtering may be too strict or too loose
  - No mechanism to update feed in real-time

#### 5. Interactions (Like/Dislike/Comment)
- **Endpoints**: `/api/interactions/{cid}/like`, `/api/interactions/{cid}/dislike`, `/api/interactions/{cid}/comment`
- **Data Path**: Insert into interactions/comments table → Update manifest
- **Status**: ✅ Functional
- **Issues**:
  - No optimistic UI updates (requires POST before feedback)
  - Comment deletion by index is fragile (depends on sort order)
  - No notification when someone interacts with your post

### ⚠️ PARTIALLY WORKING FLOWS

#### 6. Real-Time Updates & Notifications
- **Endpoints**: `GET /api/notifications`, P2P pubsub
- **Data Path**: PubSub message → handle_inbox_message → create_notification → store in DB
- **Status**: ⚠️ Partially implemented
- **Issues**:
  - ❌ **No frontend polling** → User won't see new notifications until refresh
  - ❌ **No SSE/WebSocket** → Falling back to polling or nothing
  - ❌ **P2P pubsub works but unreliable** for notifications
  - P2P subscription topics may not be reached properly
  - Notification table exists but may not be populated for all actions

#### 7. Direct Messaging
- **Endpoints**: `GET /api/messages`, messaging system
- **Data Path**: Message → IPFS/PubSub → messages table
- **Status**: ⚠️ Stub implementation
- **Issues**:
  - `GET /api/messages/{peer_id}` endpoint incomplete (ends mid-function)
  - Messages stored in DB but no guarantee of delivery
  - No end-to-end encryption documented
  - Unread count logic is incomplete

#### 8. Search
- **Endpoint**: `POST /api/search`
- **Data Path**: Query posts + users tables
- **Status**: ✅ Works but UX issue
- **Issues**:
  - No full-text search index (LIKE queries are slow)
  - Search results include both posts and users (confusing UX)
  - No pagination support

### ❌ MISSING/BROKEN FLOWS

#### 9. Text-Only Posts
- **Status**: ❌ Not implemented
- **Requirement**: Allow posts without file attachment
- **Impact**: Users must upload a file to post

#### 10. Mobile Navigation
- **Status**: ⚠️ Bottom nav created but may not be fully integrated
- **Issue**: Only hamburger drawer currently visible

#### 11. Pull-to-Refresh & Infinite Scroll
- **Status**: ❌ Not implemented
- **Impact**: Poor mobile UX

#### 12. Social Recovery (Shamir Secrets)
- **Endpoint**: `/api/recovery/...` (exists in code but not fully hooked up)
- **Status**: ⚠️ Database schema ready but endpoints missing
- **Impact**: Users can't recover lost identities

---

## Database Infrastructure Analysis

### Schema Overview

| Table | Columns | Purpose | Status |
|-------|---------|---------|--------|
| `posts` | 15 cols | Store content (CID, metadata) | ✅ Complete |
| `users` | 11 cols | User profiles & DID | ✅ Complete |
| `interactions` | 5 cols | Likes, dislikes, views | ✅ Complete |
| `comments` | 6 cols | Post comments | ✅ Complete |
| `messages` | 8 cols | Direct messages | ⚠️ Incomplete |
| `following` | 8 cols | Social graph | ✅ Complete |
| `notifications` | 8 cols | User notifications | ✅ Complete |
| `discovered_peers` | 6 cols | Peer registry | ⚠️ Not populated |
| `guardians` | 2 cols | Recovery guardians | ✅ Present |
| `recovery_*` | Various | Social recovery | ⚠️ Schema ready, no logic |
| `connections` | 3 cols | User connections | ⚠️ Not integrated |

### 🔴 CRITICAL DATABASE ISSUES

#### 1. Duplicate Data Sources
**Problem**: Posts stored in **both** SQL database AND IPFS DAG
- **Cause**: Two systems (legacy SQL + new DAG architecture)
- **Risk**: Data divergence - user A sees post in DAG, user B doesn't see it in SQL
- **Example**: Upload creates post in SQL, but DAG update fails → inconsistent state

**Solution**: 
```
Choose primary source:
- For performance: SQL (current) + async DAG sync
- For decentralization: DAG (future) + SQL as cache
```

#### 2. No Transaction Support
**Problem**: Multi-step operations (upload + DAG + manifest) can partially fail
- **Example**: Post added to DB, DAG update fails, manifest never updated
- **Result**: Post visible locally but not synced to followers

**Required Fix**:
```python
# Current (broken):
conn.execute("INSERT INTO posts...")
new_dag_root = await social_dag.update_profile(...)  # ← Can fail
conn.execute("UPDATE users SET dag_root...")  # ← Won't happen

# Fixed:
try:
    conn.execute("INSERT INTO posts...")
    new_dag_root = await social_dag.update_profile(...)
    conn.execute("UPDATE users SET dag_root...")
    conn.commit()
except Exception:
    conn.rollback()
    raise
```

#### 3. No Pagination/Limits
**Problem**: `GET /api/feed/aggregated` fetches ALL posts every time
- **Query**: `SELECT * FROM posts` (no LIMIT)
- **Then**: Joins with ALL following relationships
- **Result**: Slow API, high memory usage, poor mobile experience

#### 4. Missing Indexes on Key Queries
**Current Indexes**:
- `idx_posts_peer_id` ✅
- `idx_interactions_user_post` ✅

**Missing**:
- `idx_posts_timestamp DESC` (feed sorted by timestamp)
- `idx_interactions_type` (queries by 'like'/'dislike')
- `idx_following_timestamp DESC` (for sync ordering)

#### 5. Foreign Key Integrity Issues
**Problem**: SQLite foreign keys are disabled by default
- **Current**: Only `SET PRAGMA foreign_keys = ON` for SQLite
- **Postgres**: Foreign keys are active but no CASCADE DELETE except in schema

**Risk**: Delete a post → orphaned interactions/comments

#### 6. Avatar Blob Storage Anti-Pattern
**Problem**: Large avatar data stored inline in users table
- **Current**: Truncate to 64KB, store directly
- **Better**: Store in IPFS, only keep CID in DB

#### 7. Inconsistent Timestamp Formats
**Problem**: Mix of formats:
- `"%Y-%m-%d %H:%M:%S"` (posts, messages)
- `".isoformat()"` (notifications, DAG)
- `"%.js"` (frontend)

**Risk**: Time-based queries fail, sorting breaks

### 🟡 DATABASE SYNC ISSUES

#### Migration Safety
**Current**: Auto-migrations in `init_db()` with `CREATE TABLE IF NOT EXISTS`
- ✅ Good: Doesn't break existing data
- ❌ Bad: Adding new columns via `ALTER TABLE` is fragile

**Example**:
```python
# These can fail if column exists, causing next CREATE INDEX to fail
try:
    c.execute(f"ALTER TABLE users ADD COLUMN {col} {coltype}")
except Exception:
    pass  # Column already exists
```

#### Postgres Compatibility
**Issue**: SQL translation layer is minimal
- String types: `TEXT` in both SQLite and Postgres ✅
- AUTOINCREMENT: `BIGSERIAL` in Postgres vs `INTEGER AUTOINCREMENT` in SQLite ⚠️
- Blob handling: None (all text)

---

## Data Persistence Issues

### ❌ Missing Data Persistence Mechanisms

#### 1. No Offline-First Architecture
**Current State**:
- All data fetched from backend API
- No service worker
- No local DB (IndexedDB)
- No sync queue

**User Impact**:
- User uploads content while online
- Network drops
- User can't see upload status
- When network returns, nothing syncs

#### 2. No Optimistic Updates
**Current State**:
```typescript
// Frontend waits for POST response before updating UI
await toggleLike(cid);
setLiked(true);  // ← Only after server responds
```

**Better Approach**:
```typescript
// Optimistic update
setLiked(true);  // Immediate feedback
try {
    await toggleLike(cid);
} catch {
    setLiked(false);  // Revert on failure
}
```

#### 3. No Sync Queue
**Current State**: If user uploads while syncing, new upload is lost
**Solution**: Queue uploads locally, process in order

#### 4. No Retention Policy
**Current State**: All data kept forever
**Concern**: Unbounded database growth
**Solution**: Archive old posts to IPFS, prune local DB

---

## Sync Mechanism Issues

### IPFS/DAG Synchronization

#### Problem 1: IPNS Resolution Race Condition
```python
# User A updates profile → publishes new IPNS root
# User B follows User A
# User B's feed request:
resolved_cid = await rpc_client.name_resolve(peer_id)  # Gets OLD CID
peer_library = await social_dag.traverse_feed(resolved_cid)  # Old data
```

**Solution**: Add ETags or cache busting

#### Problem 2: Silent Fallbacks Hide Errors
```python
try:
    resolved_cid = await rpc_client.name_resolve(raw_peer_id)
    if resolved_cid:
        peer_library = await social_dag.traverse_feed(resolved_cid)
except Exception as e:
    pass  # User gets empty feed, no error message
```

#### Problem 3: No Verification of DAG Integrity
**Current**: Trust DAG data as-is
**Better**: Verify signatures on posts

---

## Real-Time Update Mechanism

### Current Implementation

#### P2P PubSub (Partially Wired)
```python
# Backend:
await p2p_client.subscribe("/app/feed/updates", discovery_hub.handle_feed_update)

# Frontend: NOTHING
```

**Issue**: Frontend doesn't listen to PubSub events

#### Missing SSE Stream
**Recommended**:
```python
@app.get("/api/stream")
async def stream_updates(request: Request):
    """Server-Sent Events stream for real-time updates"""
    did = get_current_did(request)
    queue = asyncio.Queue()
    
    async def event_generator():
        while True:
            item = await queue.get()
            yield f"data: {json.dumps(item)}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

## User-Centric Feature Alignment

### ✅ Features Aligned with User Flow

1. **Identity** - Users can create & recover identities
2. **Profile** - Users can customize profile, see other profiles
3. **Content** - Users can upload and share content
4. **Social** - Users can follow, like, and comment
5. **Discovery** - Users can find content and people

### ❌ Features Missing for User Experience

1. **Feedback** - No indication of sync status
2. **Notifications** - No push/real-time notifications
3. **Search** - Basic, no semantic search
4. **Recommendations** - Stub implementation (just likes)
5. **Privacy** - No privacy controls on comments/shares
6. **Moderation** - No content moderation tools
7. **Mobile** - No mobile optimization
8. **Offline** - No offline support

---

## Recommendations (Priority Order)

### 🔴 CRITICAL (Do Now)

#### 1. Fix Data Consistency Issues
```python
# Add explicit error handling in upload endpoint
try:
    conn.execute("INSERT INTO posts...")
    new_dag_root = await social_dag.update_profile(...)
    if not new_dag_root:
        raise ValueError("DAG update failed")
    conn.execute("UPDATE users SET dag_root...")
    conn.commit()
except Exception as e:
    conn.rollback()
    create_notification(did, "upload_error", "Upload failed", str(e))
    raise HTTPException(status_code=500, detail="Upload failed")
```

#### 2. Complete Direct Messaging Endpoint
```python
@app.get("/api/messages/{peer_id}")
async def get_conversation(peer_id: str, request: Request):
    my_peer_id = get_current_did(request)
    conn = get_db_connection()
    messages = conn.execute(
        "SELECT * FROM messages WHERE (sender_peer_id=? AND receiver_peer_id=?) OR (sender_peer_id=? AND receiver_peer_id=?) ORDER BY timestamp",
        (my_peer_id, peer_id, peer_id, my_peer_id)
    ).fetchall()
    conn.close()
    return {"messages": [dict(m) for m in messages]}
```

#### 3. Add Proper Pagination
```python
# Change aggregated feed to paginate
@app.get("/api/feed/aggregated")
async def get_aggregated_feed(request: Request, limit: int = 20, offset: int = 0):
    ...
    filtered_posts.sort(...)
    return {
        "library": filtered_posts[offset:offset+limit],
        "count": len(filtered_posts),
        "total": len(all_posts),
        "offset": offset
    }
```

#### 4. Add Real Error Logging
```python
import logging
logger = logging.getLogger("bucks")

# Replace all "except Exception: pass" with:
except Exception as e:
    logger.error(f"DAG update failed for {did}: {e}", exc_info=True)
```

### 🟡 HIGH PRIORITY (Next Sprint)

1. **Implement SSE Stream** for real-time notifications
2. **Add Offline Support** - Service worker + IndexedDB
3. **Implement Text-Only Posts** - Already designed, just need backend flag
4. **Add Upload Progress** - Stream file upload with progress callback
5. **Implement Proper Search** - FTS indexing or Elasticsearch

### 🟢 MEDIUM PRIORITY

1. **Mobile UI Enhancements** - Bottom nav, pull-to-refresh
2. **Social Recovery** - Wire up Guardian approval flow
3. **Performance Optimization** - Query optimization, caching
4. **Analytics** - Track user engagement, system health

---

## Testing Checklist

### End-to-End User Flow Test
```
[ ] User creates identity
[ ] User uploads content
[ ] Content appears in own feed
[ ] User follows another user
[ ] Followed user's content appears in aggregated feed
[ ] User likes a post
[ ] Like count updates immediately
[ ] Like persists after refresh
[ ] User sends message
[ ] Message is received
[ ] Messages persist after restart
[ ] User sees notifications for interactions
```

### Data Consistency Test
```
[ ] Upload post via one client
[ ] Follow from second client
[ ] Post appears in second client's feed
[ ] Post is in both SQL and DAG
[ ] Like on one client syncs to all clients
[ ] Comment appears within 5 seconds on all clients
```

### Failure Handling Test
```
[ ] Stop IPFS daemon
[ ] Try to upload (should fail gracefully)
[ ] Try to view feed (should use cached data)
[ ] Restart IPFS
[ ] Uploads should retry automatically
[ ] Feed should refresh automatically
```

---

## Summary

**Overall Status**: ⚠️ **FUNCTIONAL BUT FRAGILE**

- ✅ Core user flows work (upload, follow, like, comment)
- ⚠️ Data persistence is incomplete (no offline, no sync queue)
- ❌ Real-time updates don't exist (no SSE, limited PubSub)
- ❌ Error handling is weak (silent failures, no user feedback)
- ⚠️ Mobile UX is incomplete (no bottom nav integration, no refresh)

**Action Items**:
1. Fix DAG/SQL sync inconsistencies
2. Add transaction support to critical operations
3. Implement real-time notification stream
4. Add proper error handling and user feedback
5. Complete missing endpoints (messages, recovery)

**Estimated Timeline**:
- Critical fixes: 2-3 days
- Real-time updates: 3-4 days  
- Offline support: 5-7 days
- Total: 1-2 weeks for production readiness

# Bucks Global — v1.0 Implementation Plan
> Phased, step-by-step roadmap from current MVP to full Bucks 1.0 release
> Based on design vision (Figma: Bucks-1.0 / node 1-8470) + current codebase audit

---

## Current State Snapshot

| Area | Status | Notes |
|------|--------|-------|
| Identity (DID / keypair) | ✅ Done | Generate + import, UUID7, localStorage |
| IPFS upload (images, video, docs) | ✅ Done | CID tracking, multipart upload |
| Social feed | ✅ Done | Aggregated, global, following, filters |
| Profile (own + peer) | ✅ Done | Bio, avatar, stats, content grid |
| Follow / unfollow | ✅ Done | Full social graph |
| P2P Messaging | ✅ Done | Encrypted pubsub chat threads |
| Likes / comments | ✅ Done | Toggleable, threaded |
| Social recovery (Shamir) | ✅ Done | Guardians + shard threshold |
| Peer discovery (DHT) | ✅ Done | Discovery hub + pubsub |
| Search | ✅ Done | Full-text IPFS swarm |
| Recommendations | ⚠️ Stub | Basic weighting only |
| Notifications | ⚠️ Partial | Data exists; UI integration incomplete |
| QR scan | ⚠️ Stub | UI placeholder, backend ready |
| Mobile nav | ⚠️ Poor | Only hamburger drawer, no bottom bar |
| Real-time updates | ⚠️ Polling | Pubsub works but no WS push to browser |
| PWA / offline | ❌ Missing | No service worker |
| Text-only posts | ❌ Missing | All posts require file attachment |

---

## Design Principles for v1.0

1. **Mobile-first** — majority of users will be on phones; every screen must feel native
2. **Glass + dark** — keep the liquid-glass aesthetic, dark background, purple primary accent
3. **Instant feedback** — optimistic UI updates everywhere; never block on network
4. **Progressive disclosure** — show simple actions first, reveal advanced (IPFS/DID) only in Settings
5. **Offline resilient** — local cache for viewed content; clear offline indicators
6. **Incremental delivery** — each phase ships independently and is usable on its own

---

## Phase 1 — Mobile UX Foundation (1–2 days)

**Goal:** Make the app feel native on mobile. Zero breaking changes.

### 1A. Bottom Navigation Bar (mobile)
Replace the hamburger drawer with a persistent bottom nav tab bar.

**File:** `frontend/components/BottomNav.tsx` (new)

```
Tabs:  🏠 Feed  |  🔍 Search  |  ➕ Create  |  💬 Messages  |  👤 Profile
```

- Show badge on Messages tab (existing `unread` count logic from Sidebar)
- Active tab: filled icon + primary color
- Use `G.nav` glass style (already in Glass.tsx)
- Wire into `ClientLayout.tsx` — render `<BottomNav />` below main content on mobile (`md:hidden`)
- Remove hamburger button on mobile once BottomNav is in place

### 1B. Pull-to-Refresh on Feed
Add pull-to-refresh gesture on `/feed` using a lightweight touch handler.

```tsx
// frontend/app/feed/page.tsx — add useRef + touch events
const PULL_THRESHOLD = 72; // px
// on touchstart/touchmove/touchend: if pulled > threshold → re-run loadData()
```

### 1C. Infinite Scroll on Feed
Replace the static list with cursor-based pagination.

**Backend change (small):** Add `?offset=N&limit=20` params to `GET /api/feed/aggregated`
**Frontend:** IntersectionObserver on a sentinel div at bottom → append next page

### 1D. Upload Progress Bar
Add `onUploadProgress` callback to the `POST /api/upload` axios call in `lib/api.ts`.

```tsx
// In create/page.tsx — show a progress bar while uploading
const [progress, setProgress] = useState(0);
api.post('/upload', form, { onUploadProgress: e => setProgress(e.loaded/e.total*100) })
```

**Deliverables:** BottomNav, pull-to-refresh, infinite scroll, upload progress

---

## Phase 2 — Text Posts + Composer Upgrade (1 day)

**Goal:** Allow text-only posts so users without files can participate.

### 2A. Text Post Support

**Backend:** `POST /api/upload` — accept `content` field (text body) with no file
```python
# If no file but content is present → store as text post
# Set filename = None, type = "text", cid = hash of content
```

**Frontend `/create/page.tsx` — tabbed composer:**

```
[ 📝 Post ]  [ 📷 Photo ]  [ 🎥 Video ]  [ 📎 File ]
```

- **Post tab:** Textarea (280 chars), optional image attachment
- **Photo tab:** Camera / gallery picker with preview
- **Video tab:** Video picker with duration limit warning
- **File tab:** Current file picker

### 2B. PostCard Text Layout
Update `PostCard.tsx` to render text content beautifully when `item.type === "text"`:
- Full text visible (not truncated) up to ~6 lines
- Expand button for longer posts
- No media placeholder for text-only posts

### 2C. Hashtag Support
- Parse `#hashtag` patterns in post text at upload time → store as `tags[]` array
- Feed filter bar gains a Tags filter option
- Clicking a tag on a post navigates to `?tag=hashtag` filtered feed

**Deliverables:** Text posts, tabbed composer, hashtag indexing

---

## Phase 3 — Notifications & Real-Time (2 days)

**Goal:** Complete the notification system and add live updates.

### 3A. Complete Notification Integration

**Backend notifications already created for:** follow, like, comment, connection request, message, recovery approval

**Frontend `/notifications/page.tsx` — group by type:**
```
TODAY
  🔔 @alice liked your post "..."
  👥 @bob sent you a connection request  [Accept] [Decline]
  💬 @carol mentioned you in a comment
YESTERDAY
  ...
```

**TopRightActions.tsx** — wire the notification bell badge to `GET /api/notifications` count (currently hardcoded).

### 3B. Server-Sent Events (SSE) for Live Updates
Instead of WebSockets or polling, use SSE — easiest to add to FastAPI.

**Backend:**
```python
@app.get("/api/events")
async def event_stream(request: Request):
    async def generator():
        while True:
            if await request.is_disconnected(): break
            events = get_pending_events(did)  # new likes, messages, notifs
            if events: yield f"data: {json.dumps(events)}\n\n"
            await asyncio.sleep(3)
    return EventSourceResponse(generator())
```

**Frontend:** `lib/events.ts` — EventSource client that dispatches to a Zustand/context store
- On new message event → update `/messages` badge
- On new notification → show toast + update bell badge

### 3C. Message Real-Time Updates
`/messages/[peer_id]/ChatPageClient.tsx` — subscribe to SSE stream → append new messages without polling.

**Deliverables:** Complete notifications, SSE real-time, live message updates, live badge counts

---

## Phase 4 — Discovery & Recommendations (1–2 days)

**Goal:** Make the app feel alive with surfaced content and people.

### 4A. Improved Recommendation Algorithm

**Backend `GET /api/feed/recommended` — scoring formula:**
```python
score = (
    likes_count * 3 +
    comments_count * 5 +
    shares_count * 4 +
    recency_decay(timestamp) * 2   # exponential decay over 48h
    + topic_affinity(did, tags) * 6  # boost posts matching user's interests
)
```

### 4B. People You May Know
New endpoint: `GET /api/users/suggested`
- Peers followed by the people you follow (FOF)
- Recently active peers not yet followed
- Frontend: horizontal scrollable card row on `/recommended` page

### 4C. Trending Section
New endpoint: `GET /api/trending`
- Top hashtags by post count in last 24h
- Top CIDs by interaction count in last 24h
- Frontend: `/recommended` page gains "Trending" tab

### 4D. Complete QR Scan Flow
`/qr-scan/page.tsx` — integrate `html5-qrcode` library:
```bash
npm install html5-qrcode
```
- Scan → decode peer UUID7 → POST `/api/connections/request`
- Success → navigate to peer profile

**Deliverables:** Better recommendations, People You May Know, Trending, working QR scan

---

## Phase 5 — Profile & Settings Polish (1 day)

**Goal:** Make profiles feel social-media-grade.

### 5A. Profile Header Upgrade
`/profile/page.tsx` and `/profile/[id]/page.tsx`:
```
┌──────────────────────────────────────┐
│  [banner image — full width, 3:1]    │
│        [avatar — overlapping]        │
│   Username · @handle                 │
│   Bio text                           │
│   📍 Location                        │
│   [Posts N]  [Following N]  [Followers N]  │
│   [Edit Profile]  [Share QR]  [•••]  │
└──────────────────────────────────────┘
```

**Backend:** `POST /api/profile` already accepts `banner` field; just needs frontend UI.

### 5B. Profile Content Tabs
```
[Posts] [Liked] [Media]
```
- Posts: existing content grid
- Liked: `GET /api/profile/{peer_id}/likes` → already exists
- Media: filter Posts to images/videos only

### 5C. Settings Tab Completion
Current settings tabs: Profile · Security · Network

**Remaining wires:**
- Network tab → live peer count from `GET /api/network-info` (currently hardcoded "12")
- Security tab → DID export as JSON download
- Add "Appearance" tab: Light/Dark/System theme toggle (Tailwind `dark:` classes)

**Deliverables:** Banner support, liked tab, live peer count, theme toggle

---

## Phase 6 — PWA & Offline Support (1 day)

**Goal:** App works offline, installs on home screen.

### 6A. PWA Manifest
`frontend/public/manifest.json`:
```json
{
  "name": "Bucks Global",
  "short_name": "Bucks",
  "theme_color": "#6A00FF",
  "background_color": "#0a0a12",
  "display": "standalone",
  "start_url": "/feed",
  "icons": [...]
}
```

### 6B. Service Worker (Next.js)
Use `next-pwa` or manual service worker:
```bash
npm install next-pwa
```
Cache strategy:
- Shell (HTML/JS/CSS) → CacheFirst
- API responses for feed/profile → StaleWhileRevalidate (5 min)
- IPFS gateway images → CacheFirst with 7-day expiry
- POST/mutations → NetworkOnly (no offline writes)

### 6C. Offline State Banner
`ClientLayout.tsx` — listen to `navigator.onLine`:
```
📡 You're offline — showing cached content
```

**Deliverables:** Installable PWA, cached feed/profiles, offline banner

---

## Phase 7 — Bucks Economy Layer (Future / optional)

**Goal:** Introduce the "Bucks" value layer — tipping, content rewards.

> This is speculative based on the product name "Bucks Global". Confirm with the Figma design before implementing.

### 7A. Bucks Tipping
- Users can send "Bucks" (on-chain or in-app credits) with a post like
- `POST /api/tip` `{ to: peer_id, amount: N, cid: post_cid }`
- TipButton on PostCard beside Like button

### 7B. Creator Stats
- Profile page gains an "Earnings" card: Bucks received this month
- Dashboard with top performing posts by tips + likes

### 7C. Boosted Posts
- Pay Bucks to boost a post into the Recommended feed
- `POST /api/library/{cid}/boost` `{ budget: N }`
- Boosted posts shown with subtle "Boosted" badge

---

## Phased Delivery Summary

| Phase | Scope | Effort | Value |
|-------|-------|--------|-------|
| **1** | Mobile nav + infinite scroll + upload progress | 1–2 days | High (UX) |
| **2** | Text posts + tabbed composer + hashtags | 1 day | High (engagement) |
| **3** | Complete notifications + SSE real-time | 2 days | High (stickiness) |
| **4** | Recommendations + QR scan + trending | 1–2 days | Medium (discovery) |
| **5** | Profile banner + tabs + settings polish | 1 day | Medium (polish) |
| **6** | PWA + offline + installable | 1 day | Medium (distribution) |
| **7** | Bucks economy layer | 3–5 days | TBD (product direction) |

**Total to launch-ready v1.0: ~8–10 days of focused development**

---

## File Change Map

### New files to create
```
frontend/components/BottomNav.tsx          Phase 1A
frontend/components/EventsProvider.tsx     Phase 3B
frontend/lib/events.ts                     Phase 3B
frontend/public/manifest.json              Phase 6A
frontend/public/sw.js                      Phase 6B
```

### Files to modify
```
frontend/components/ClientLayout.tsx       Phase 1A (add BottomNav)
frontend/app/feed/page.tsx                 Phase 1B, 1C
frontend/app/create/page.tsx               Phase 2A, 2B
frontend/components/PostCard.tsx           Phase 2B, 2C
frontend/app/notifications/page.tsx        Phase 3A
frontend/components/TopRightActions.tsx    Phase 3A
frontend/app/messages/[peer_id]/Chat*.tsx  Phase 3C
frontend/app/recommended/page.tsx          Phase 4B, 4C
frontend/app/qr-scan/page.tsx              Phase 4D
frontend/app/profile/page.tsx              Phase 5A, 5B
frontend/app/profile/[id]/*.tsx            Phase 5A, 5B
frontend/app/settings/page.tsx             Phase 5C
frontend/next.config.ts                    Phase 6A
```

### Backend files to modify
```
backend/main.py                            Phase 2A (text posts)
                                           Phase 3B (SSE endpoint)
                                           Phase 4A (better scoring)
                                           Phase 4B (suggested users)
                                           Phase 4C (trending endpoint)
```

---

## Start Here: Phase 1A Step-by-Step

**Immediate first commit — BottomNav component:**

1. Create `frontend/components/BottomNav.tsx`:
   - 5 tabs: Feed (`/feed`), Search (`/search`), Create (`/create`), Messages (`/messages`), Profile (`/profile`)
   - Use existing `G.nav` glass style
   - Import unread count hook (same logic as Sidebar.tsx line 27–39)
   - `md:hidden` — only shows on mobile

2. Open `frontend/components/ClientLayout.tsx`
   - Import `<BottomNav />`
   - Add `<BottomNav />` after the main `<div>` content block
   - Add `pb-20 md:pb-0` to main content wrapper to clear the nav

3. In `frontend/components/Sidebar.tsx`
   - Keep desktop sidebar as-is
   - The hamburger on mobile can be removed once BottomNav is confirmed

4. Test: resize browser to mobile, verify tabs navigate correctly, badge appears on Messages

This alone is a significant UX improvement with ~60 lines of new code.

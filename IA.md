# Bucks Global — Information Architecture

## App Overview

Bucks Global is a decentralized social feed application built on IPFS (InterPlanetary File System). Users own their identity via cryptographic key pairs (DID/peer_id), publish content directly to the IPFS swarm, and interact with peers on the network without centralized servers. Features include a chat-style AI agent search interface, social following, peer-to-peer encrypted messaging, content recommendations, and social recovery (Shamir's Secret Sharing for identity backup via trusted guardians).

---

## Sitemap

| # | Path | Description | Auth Required |
|---|------|-------------|---------------|
| 1 | `/` | Home — AI agent search interface with IPFS swarm query, command hints, chat history | No (public shell, commands need identity) |
| 2 | `/login` | Login / Identity generation — generate new keypair or restore via mnemonic | No |
| 3 | `/feed` | Content feed — aggregated posts from followed peers and IPFS swarm | Yes |
| 4 | `/create` | Upload / Create post — upload file or write post, set title, description, visibility | Yes |
| 5 | `/profile` | Own profile — bio, stats (syncs, contacts, posts, likes), content library | Yes |
| 6 | `/profile/[id]` | Peer profile — view another user's public profile, follow/unfollow, view their posts | No |
| 7 | `/recommended` | Recommended content — algorithmically suggested posts with search and filter tabs | Yes |
| 8 | `/messages` | Messages inbox — list of active conversations with peers | Yes |
| 9 | `/messages/[peer_id]` | Message thread — encrypted P2P chat with a specific peer | Yes |
| 10 | `/notifications` | Notifications — list of messages, connection requests, mentions, follow events | Yes |
| 11 | `/search` | Search page — full-page content search across the IPFS swarm | No |
| 12 | `/settings` | Settings — profile editing, security (guardians, DID), network (peer ID, sync) | Yes |
| 13 | `/recover` | Social recovery — restore identity using guardian-approved secret shards | No |
| 14 | `/qr-scan` | QR scanner — scan another peer's invite QR code to connect | Yes |
| 15 | `/services` | Services — available network services and node status | Yes |
| 16 | `/api` | API explorer — FastAPI auto-generated docs at `/docs` (development only) | No |

---

## User Flows (Critical Paths)

### 1. Onboarding Flow (New User)

```
Visit app (/) 
  → No identity detected → Redirect to /login
  → /login: Click "Generate New Identity"
  → Backend POST /api/auth/generate-identity → returns peer_id, did, mnemonic
  → Store peer_id + identity_secret in localStorage
  → Display mnemonic for backup (one-time)
  → Redirect to /settings?onboarding=true
  → /settings: Fill display name, handle, bio, location → Click "Finish Setup"
  → POST /api/profile (multipart form) → profile saved
  → Redirect to /feed
  → (Optional) Visit /settings → Security tab → Manage guardians via GuardianManager
```

### 2. Post Creation Flow

```
Authenticated user at /feed or /profile
  → Click "Create" / "+" button → Navigate to /create
  → /create: Choose file via file picker (image, video, document) OR write text post
  → Fill title, description, set visibility (public/private)
  → Click "Upload"
  → uploadFile() called:
      If Electron (window.bucksAPI.ipfsPublish): native IPFS publish via IPC → POST /api/register_content
      Else: POST /api/upload (multipart) → backend pins to IPFS → returns CID
  → Success toast → CID displayed
  → Content appears in /feed and /profile
```

### 3. Messaging Flow

```
User at /messages or /profile/[id]
  → Click "Message" on peer profile OR click compose in /messages
  → NewChatModal: enter peer_id or select from contacts
  → Navigate to /messages/[peer_id]
  → GET /api/messages/[peer_id] → load existing thread
  → Type message → click Send
  → POST /api/messages/send { to: peer_id, content: text }
  → Message encrypted, published to IPFS pubsub
  → Thread updates in real time (polling or pubsub)
  → Notification created for recipient → appears in /notifications
```

### 4. Social Recovery Flow

```
User loses access to device / identity
  → Visit /recover
  → Enter username or peer_id to identify account
  → POST /api/recovery/request → notifies guardians
  → Guardians (trusted contacts) receive notification
  → Each guardian visits their own /settings → approves recovery
  → POST /api/recovery/approve (each guardian) → submits their shard
  → When threshold (e.g. 4/7) shards collected:
      POST /api/recovery/restore { shards: [...] } → combines via Shamir's Secret Sharing
  → Private key reconstructed → new identity stored in localStorage
  → User redirected to /settings to update profile
```

### 5. Discovery Flow

```
User at /recommended or using / search
  → GET /api/feed/recommended → returns items weighted by recommendation count
  → Filter by: All / Trending / Posts / Videos
  → Search bar filters by name/description client-side
  → Click "See more" → loads next 10 items (pagination)
  → Click a post → opens PostCard detail / navigates to /feed?cid=[cid]
  → Click author name → navigates to /profile/[peer_id]
  → Click Follow → POST /api/follow/[peer_id]
  → Followed peer's content appears in /feed aggregated feed
```

---

## Component Hierarchy

```
layout.tsx (root)
├── ClientLayout
│   ├── AuthGuard                    — redirects unauthenticated users to /login
│   ├── Sidebar                      — desktop left nav (Home, Feed, Create, Messages, etc.)
│   ├── TopRightActions             — notifications bell, profile avatar, sync button
│   └── Toast (provider)            — global toast notification system
│
├── / (page.tsx)
│   ├── StarField                   — animated background
│   └── [command hints panel]       — inline, shown when query starts with /
│
├── /login (page.tsx)
│   └── [identity generation form]
│
├── /feed (page.tsx)
│   ├── StoryCircles                — horizontal peer story/avatar row
│   ├── SyncButton                  — manual IPFS sync trigger
│   └── PostCard (×n)
│       ├── Avatar
│       ├── EngagementBar           — like, dislike, comment, share
│       └── Comments
│
├── /create (page.tsx)
│   └── [upload form with file picker]
│
├── /profile (page.tsx)
│   ├── Avatar
│   ├── InviteQR                    — shareable QR code
│   └── PostCard (×n)
│
├── /profile/[id] (page.tsx)
│   ├── Avatar
│   └── PostCard (×n)
│
├── /recommended (page.tsx)
│   ├── DiscoveryGuide              — empty state helper
│   └── PostCard (×n)
│
├── /messages (page.tsx)
│   ├── NewChatModal                — start new conversation
│   └── [conversation list items]
│
├── /messages/[peer_id] (page.tsx)
│   └── [message bubbles + input]
│
├── /notifications (page.tsx)
│   └── [notification list items]
│
├── /search (page.tsx)
│   └── SearchInput
│       └── PostCard (×n)
│
├── /settings (page.tsx)
│   ├── Avatar
│   ├── GuardianManager             — Security tab (conditionally shown)
│   └── InviteQR                    — Network tab
│
├── /recover (page.tsx)
│   └── [recovery form]
│
└── /qr-scan (page.tsx)
    └── [QR camera reader]
```

---

## Backend API Map

### Auth
| Method | Route | Description | Used By |
|--------|-------|-------------|---------|
| POST | `/api/auth/generate-identity` | Generate new DID keypair, return peer_id + mnemonic | `/login` page |

### Profile
| Method | Route | Description | Used By |
|--------|-------|-------------|---------|
| GET | `/api/profile` | Get own profile (uses X-DID header) | `settings/page.tsx`, `profile/page.tsx`, `fetchProfile()` |
| POST | `/api/profile` | Update own profile (multipart: username, handle, bio, location, avatar, banner) | `settings/page.tsx`, `updateProfile()` |
| GET | `/api/profile/{peer_id}` | Get any peer's public profile | `profile/[id]/page.tsx`, `fetchUserProfile()` |
| GET | `/api/profile/{peer_id}/likes` | Get list of CIDs liked by a peer | `PostCard`, `fetchUserLikes()` |

### Content
| Method | Route | Description | Used By |
|--------|-------|-------------|---------|
| GET | `/api/library` | List own uploaded content | `profile/page.tsx`, `fetchLibrary()` |
| GET | `/api/library/{cid}` | Get single post by CID | `PostCard`, `fetchPost()` |
| POST | `/api/upload` | Upload file to IPFS (multipart: file, title, description, upload_type, visibility) | `create/page.tsx`, `uploadFile()` |
| POST | `/api/register_content` | Register externally pinned CID (Electron native path) | `uploadFile()` (Electron branch) |
| PUT | `/api/library/{cid}` | Update post title/description | `PostCard` edit flow, `updatePost()` |
| DELETE | `/api/library/{cid}` | Delete post from library | `PostCard`, `deletePost()` |

### Social / Feed
| Method | Route | Description | Used By |
|--------|-------|-------------|---------|
| GET | `/api/feed/aggregated` | Get aggregated feed from followed peers | `feed/page.tsx`, `fetchAggregatedFeed()` |
| GET | `/api/feed/user/{peer_id}` | Get a specific peer's feed | `profile/[id]/page.tsx`, `fetchUserFeed()` |
| GET | `/api/feed/recommended` | Get algorithmically recommended content | `recommended/page.tsx` |
| POST | `/api/follow/{peer_id}` | Follow a peer | `profile/[id]/page.tsx`, `followPeer()` |
| POST | `/api/unfollow/{peer_id}` | Unfollow a peer | `profile/[id]/page.tsx`, `unfollowPeer()` |
| GET | `/api/following` | List peers the current user follows | `profile/page.tsx`, `fetchFollowing()` |
| GET | `/api/connections` | Get accepted peer connections | `messages/page.tsx`, `fetchConnections()` |
| POST | `/api/connections/request` | Send connection request to a peer | `qr-scan/page.tsx`, `sendConnectionRequest()` |
| POST | `/api/connections/accept` | Accept incoming connection request | `notifications/page.tsx`, `acceptConnectionRequest()` |
| POST | `/api/sync-peers` | Manually trigger peer sync | `SyncButton` component |
| GET | `/api/peers/discover` | Discover new peers on the swarm | `discoverPeers()` |
| GET | `/api/discovery` | Full discovery hub data | `services/page.tsx` |

### Interactions
| Method | Route | Description | Used By |
|--------|-------|-------------|---------|
| GET | `/api/interactions` | Get all interactions (likes/comments) map | `feed/page.tsx`, `fetchAllInteractions()` |
| GET | `/api/interactions/{cid}` | Get interactions for a specific post | `PostCard`, `fetchInteractions()` |
| POST | `/api/interactions/{cid}/like` | Toggle like on a post | `EngagementBar`, `toggleLike()` |
| POST | `/api/interactions/{cid}/dislike` | Toggle dislike on a post | `EngagementBar`, `toggleDislike()` |
| POST | `/api/interactions/{cid}/comment` | Add comment to a post | `Comments`, `addComment()` |
| DELETE | `/api/interactions/{cid}/comment/{index}` | Delete a comment by index | `Comments`, `deleteComment()` |

### Messaging
| Method | Route | Description | Used By |
|--------|-------|-------------|---------|
| GET | `/api/messages` | List all message threads (inbox) | `messages/page.tsx` |
| GET | `/api/messages/{peer_id}` | Get full message thread with a peer | `messages/[peer_id]/page.tsx` |
| POST | `/api/messages/send` | Send message to a peer | `messages/[peer_id]/page.tsx` |
| POST | `/api/contacts/add` | Add a contact by peer_id | `NewChatModal` |

### Recovery
| Method | Route | Description | Used By |
|--------|-------|-------------|---------|
| GET | `/api/guardians` | List configured guardians | `GuardianManager` component |
| POST | `/api/guardians/add` | Add a guardian (peer_id) | `GuardianManager` component |
| POST | `/api/recovery/setup` | Configure recovery shards (Shamir split) | `settings/page.tsx` (via GuardianManager) |
| POST | `/api/recovery/restore` | Restore identity from collected shards | `recover/page.tsx` |
| POST | `/api/recovery/request` | Request recovery (notify guardians) | `recover/page.tsx` |
| POST | `/api/recovery/approve` | Guardian approves recovery request with shard | `notifications/page.tsx` |

### Search
| Method | Route | Description | Used By |
|--------|-------|-------------|---------|
| POST | `/api/search` | Full-text IPFS swarm search; also handles agent commands | `page.tsx` (home), `search/page.tsx`, `fetchAgentResponse()` |

### Network / Health
| Method | Route | Description | Used By |
|--------|-------|-------------|---------|
| GET | `/` | API root, server info | — |
| GET | `/health` | Health check (DB + IPFS status) | Deployment monitoring |
| GET | `/api/network-info` | Local node peer_id, addresses, IPFS status | `settings/page.tsx` (Network tab) |
| GET | `/api/cluster/status` | IPFS cluster status | `services/page.tsx` |
| GET | `/api/cluster/peers` | List cluster peers | `services/page.tsx` |

### Notifications
| Method | Route | Description | Used By |
|--------|-------|-------------|---------|
| GET | `/api/notifications` | List all notifications | `notifications/page.tsx`, `fetchNotifications()` |
| POST | `/api/notifications/{notif_id}/read` | Mark single notification read | `notifications/page.tsx`, `markNotificationsRead()` |
| POST | `/api/notifications/read-all` | Mark all notifications read | `notifications/page.tsx`, `markNotificationsRead()` |

---

## Gap Analysis — Resolved & Remaining

### Fixed in this session

| # | Location | Issue | Fix Applied |
|---|----------|-------|-------------|
| 1 | `settings/page.tsx` — Security tab | "Manage" button on Active Guardians card had no handler | Added `showGuardians` state; button toggles it; `<GuardianManager onClose=.../>` renders inline below cards |
| 2 | `settings/page.tsx` — Security tab | DID Identity showed hardcoded `did:key:z6MkpTHR...v4E` | Now reads `profile?.did \|\| profile?.peer_id`, truncated as `slice(0,8)...slice(-6)` |
| 3 | `settings/page.tsx` — Security tab | "Copy" button on DID row had no handler | Now runs `navigator.clipboard.writeText(...)` and shows success toast |
| 4 | `settings/page.tsx` — Security tab | Active Guardians count hardcoded to "7" | Now shows `"0"` as placeholder (real count managed by GuardianManager); description updated to "Manage trusted contacts for identity recovery" |
| 5 | `recommended/page.tsx` | "See more" button had no handler; showed when `library.length > 5` regardless of how many were displayed | Added `visibleCount` state (init 10); `filteredLibrary` sliced to `visibleCount`; button increments by 10; only shown when more items exist |
| 6 | `page.tsx` (Home) | Typing `/` in the search box did nothing | Added `showCommandHints` computed var; command hints panel with 5 commands renders above the form |
| 7 | `page.tsx` (Home) | Agent commands `/feed`, `/profile`, `/upload` made network calls instead of navigating | Added local command handling in `handleSearch` before `fetchAgentResponse`; uses `useRouter` for client-side navigation |

### Remaining / Future Work

| # | Location | Issue | Recommendation |
|---|----------|-------|----------------|
| 1 | `settings/page.tsx` — Network tab | "Connected to 12 IPFS peers" is hardcoded | Wire to `GET /api/network-info` for live peer count |
| 2 | `messages/[peer_id]/page.tsx` | Messages likely use polling; no real-time push | Implement IPFS pubsub WebSocket subscription for live updates |
| 3 | `recover/page.tsx` | Recovery UI flow untested end-to-end | Full integration test with guardian approval round-trip |
| 4 | `feed/page.tsx` | No infinite scroll or pagination | Add cursor-based pagination to `GET /api/feed/aggregated` |
| 5 | `notifications/page.tsx` | No push notifications (browser or mobile) | Implement Web Push API via service worker |
| 6 | Authentication | `AuthGuard` relies on `localStorage` flag; no server-side session | Consider short-lived JWT or signed challenge for API security |
| 7 | `search/page.tsx` | Full-text search relies on `POST /api/search`; no IPFS DHT content routing | Integrate IPFS DHT provider search for true decentralized discovery |
| 8 | `/qr-scan` | QR scanning requires camera permissions; no fallback for desktop | Add manual peer_id paste fallback |
| 9 | `create/page.tsx` | No progress indicator for large file uploads | Add `onUploadProgress` via axios config |
| 10 | Global | No offline support | Add service worker + cache strategy for viewed content |

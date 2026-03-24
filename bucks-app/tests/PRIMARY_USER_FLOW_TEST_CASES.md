# Bucks Browser - Primary User Flow Test Cases

## Scope

This suite validates the highest-priority user journeys:

- Identity onboarding/unlock
- Feed loading and filtering
- Create/publish post with file upload to IPFS
- Profile edit/update
- Messaging (text + file)
- Settings, bootstrap config, export, sign out
- Hamburger menu navigation

## Preconditions

- App launched with `npm run launch:browser`
- URL: `http://localhost:1420`
- Browser allows IndexedDB and clipboard
- For messaging tests, use two app sessions (or two machines) with different identities and reachable peer IDs

## Test Cases

### TC-01: Hamburger Menu Navigation

- Steps:
1. Open `/`.
2. Click hamburger icon.
3. Click `Global Feed`, `Services`, `Messages`, `Notifications`, `Profile`.
- Expected:
1. Overlay opens/closes correctly.
2. Navigation works for each item.
3. New active internal tab is selected in the top tab strip.

### TC-02: First-Time Identity Creation

- Steps:
1. Navigate to `/login` with no existing identity.
2. Enter password and confirm password.
3. Submit.
- Expected:
1. Identity is generated and persisted in IndexedDB.
2. App redirects to `/feed`.
3. Refresh keeps identity in `locked` state until unlocked.

### TC-03: Identity Unlock

- Steps:
1. Reload app.
2. On `/login`, enter the correct password.
3. Submit.
- Expected:
1. Identity status becomes `unlocked`.
2. Redirect to `/feed`.
3. Node status widget eventually shows peer information.

### TC-04: Wrong Password Handling

- Steps:
1. Go to `/login`.
2. Enter incorrect password.
3. Submit.
- Expected:
1. Unlock fails.
2. Error text is shown.
3. User remains on `/login`.

### TC-05: Feed Load + Filters

- Steps:
1. Open `/feed` while unlocked.
2. Wait until feed loads.
3. Switch filters: `All`, `Images`, `Videos`, `Files`.
4. Change source and sort selectors.
- Expected:
1. Loading state appears initially.
2. Posts list renders after load.
3. Filter/sort controls update visible list order/content.

### TC-06: Create Text-Only Post

- Steps:
1. Open `/create`.
2. Step 1: leave file empty, enter text-only draft, continue.
3. Step 2: ensure caption is present.
4. Click `Publish to IPFS`.
- Expected:
1. Publish progress appears.
2. Post is signed and added to OrbitDB posts DB.
3. Success message displayed.

### TC-07: Create File Post (Image/Video/Doc)

- Steps:
1. Open `/create`.
2. Step 1: drag/drop a valid file (`image/*`, `video/*`, `.pdf`, `.txt`, `.md`).
3. Verify preview appears.
4. Continue to Step 2 and publish.
- Expected:
1. Upload spinner/message shown.
2. File bytes are added to Helia UnixFS.
3. CID is shown after publish.
4. Copy CID action works.

### TC-08: Invalid File Rejection

- Steps:
1. On `/create`, attempt unsupported file type (for example `.exe`).
- Expected:
1. File is rejected.
2. User-facing warning/toast shown.
3. Flow remains usable.

### TC-09: Profile Update

- Steps:
1. Open `/profile`.
2. Click `Edit Profile`.
3. Update name and bio.
4. Save.
- Expected:
1. Updated profile renders in UI.
2. Subsequent profile load shows updated values.

### TC-10: Export Identity Backup

- Steps:
1. Open `/settings` -> `Identity`.
2. Click `Download Encrypted Backup`.
3. Enter export password.
- Expected:
1. Encrypted backup file downloads.
2. Backup payload is non-empty and not plain identity JSON.

### TC-11: Sign Out

- Steps:
1. Open `/settings` -> `Identity`.
2. Click `Sign Out & Delete Local Identity`.
3. Confirm dialog.
- Expected:
1. Identity is removed from IndexedDB.
2. Redirect to `/login`.
3. Guarded routes (`/create`, `/feed`) redirect back to `/login`.

### TC-12: Network Bootstrap Node Save

- Steps:
1. Open `/settings` -> `Network`.
2. Paste one or more bootstrap lines.
3. Reload page.
- Expected:
1. Values persist via `localStorage`.
2. New node init picks updated bootstrap list on next start.

### TC-13: Messages List Screen

- Steps:
1. Open `/messages` while unlocked.
2. Enter peer ID manually and click `Open`.
- Expected:
1. Conversation list screen renders.
2. Navigation to `/messages/[peerId]` succeeds.

### TC-14: Send Encrypted Text Message

- Steps:
1. On `/messages/[peerId]`, enter text.
2. Click `Send`.
- Expected:
1. Message appears in chat history.
2. Session is created (X3DH) if peer bundle exists.
3. Errors are displayed when peer bundle/session is unavailable.

### TC-15: Send File in Chat

- Steps:
1. On `/messages/[peerId]`, attach a file and send.
- Expected:
1. File is uploaded to IPFS.
2. CID is included in message.
3. Attachment link opens an IPFS gateway URL.

### TC-16: Notifications/Services Route Availability

- Steps:
1. Open `/notifications`.
2. Open `/services`.
- Expected:
1. Both pages load.
2. No route-level crash or blank screen.

## Exit Criteria

- All test cases pass without console exceptions that break flows.
- No dead-end navigation from main menu.
- Identity, post publish, and messaging paths complete with expected success states (or explicit actionable errors).

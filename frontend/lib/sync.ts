/**
 * sync.ts — reliable backend registration + cross-device connection restore.
 *
 * Why this file exists:
 *   - User data (identity, connections) lives in localStorage on the originating device.
 *   - The shared backend (Railway) is the source-of-truth for discovery & cross-device sync.
 *   - Registrations were previously fire-and-forget; failed silently → users invisible in search.
 *   - Connections were never pulled from backend on new-device login → synced list appeared empty.
 */

import api from './api';
import { getConnections, addConnection, type Identity, type Connection } from './identity';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Register (or re-register) the current identity with the shared backend.
 * Retries up to `maxAttempts` times with exponential back-off.
 * Returns true when the backend confirms the record.
 */
export async function ensureRegistered(
    identity: Pick<Identity, 'did' | 'uuid7' | 'username' | 'avatar' | 'bio'>,
    maxAttempts = 5,
): Promise<boolean> {
    // Avatars are base64 JPEGs (~30-60 KB). Truncate to 64 KB to keep the payload safe.
    const AVATAR_LIMIT = 64 * 1024;
    const avatar =
        identity.avatar && identity.avatar.length > AVATAR_LIMIT
            ? identity.avatar.slice(0, AVATAR_LIMIT)
            : identity.avatar;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            await api.post('/users', {
                did: identity.did,
                uuid7: identity.uuid7,
                username: identity.username,
                avatar,
                bio: identity.bio,
            });
            console.log(`[sync] ✅ Registered ${identity.username} (${identity.uuid7})`);
            return true;
        } catch (err: any) {
            const status = err?.response?.status;
            const detail = err?.response?.data?.detail ?? err?.message ?? 'unknown';
            console.warn(`[sync] Registration attempt ${attempt + 1}/${maxAttempts} failed — status=${status} detail=${detail}`);

            // Don't retry on client errors (4xx) — they won't resolve with retries
            if (status && status >= 400 && status < 500) break;

            if (attempt < maxAttempts - 1) {
                await delay(1000 * Math.pow(2, attempt)); // 1 s, 2 s, 4 s, 8 s…
            }
        }
    }
    console.error(`[sync] ❌ Failed to register ${identity.username} after ${maxAttempts} attempts — user won't appear in search until next login`);
    return false;
}

/**
 * Pull the connections this user has recorded in the backend and merge them
 * into localStorage.  Call this once on login / app mount so a user logging
 * in on a new device recovers their sync list automatically.
 */
export async function restoreConnectionsFromBackend(myUuid7: string): Promise<void> {
    try {
        const res = await api.get<{ connections: any[] }>(`/users/${myUuid7}/connections`);
        const remote: any[] = res.data.connections ?? [];

        const localMap = new Map<string, Connection>(
            getConnections().map(c => [c.uuid7, c]),
        );

        let added = 0;
        for (const r of remote) {
            if (!r.uuid7 || !r.username) continue; // incomplete record
            if (localMap.has(r.uuid7)) continue;   // already present locally

            addConnection({
                uuid7: r.uuid7,
                did: r.did ?? '',
                username: r.username,
                avatar: r.avatar ?? '',
                bio: r.bio ?? '',
                syncedAt: new Date().toISOString(),
            });
            added++;
        }
        if (added > 0) console.log(`[sync] ✅ Restored ${added} connection(s) from backend`);
    } catch (err: any) {
        console.warn('[sync] Could not restore connections from backend:', err?.message ?? err);
        // Backend unavailable — keep local data as-is, no error thrown
    }
}

/**
 * Push a single sync connection to the backend.
 * Retries once on transient failure. Local store is always the primary record.
 */
export async function pushSyncToBackend(fromUuid7: string, toUuid7: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await api.post(`/users/${toUuid7}/sync`, { from_uuid7: fromUuid7 });
            console.log(`[sync] ✅ Connection pushed: ${fromUuid7} → ${toUuid7}`);
            return;
        } catch (err: any) {
            const status = err?.response?.status;
            console.warn(`[sync] pushSyncToBackend attempt ${attempt + 1}/3 failed — status=${status}`);
            if (status && status >= 400 && status < 500) return; // client error, don't retry
            if (attempt < 2) await delay(1500 * (attempt + 1));
        }
    }
}

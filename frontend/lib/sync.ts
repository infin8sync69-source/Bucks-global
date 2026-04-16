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
    maxAttempts = 3,
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
            return true;
        } catch {
            if (attempt < maxAttempts - 1) {
                await delay(800 * (attempt + 1)); // 0.8 s, 1.6 s …
            }
        }
    }
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
        }
    } catch {
        // Backend unavailable — keep local data as-is, no error thrown
    }
}

/**
 * Push a single sync connection to the backend.
 * Silent on failure — the local store is always the primary record.
 */
export async function pushSyncToBackend(fromUuid7: string, toUuid7: string): Promise<void> {
    try {
        await api.post(`/users/${toUuid7}/sync`, { from_uuid7: fromUuid7 });
    } catch {
        // swallow — local connection already saved
    }
}

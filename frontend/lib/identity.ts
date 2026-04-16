/**
 * Identity & connection management — localStorage-first.
 * All writes also update legacy keys so AuthGuard keeps working.
 */

export interface Identity {
    did: string;
    uuid7: string;
    secret: string;
    username: string;
    avatar: string; // emoji character
    bio: string;
    createdAt: string;
}

export interface Connection {
    uuid7: string;
    did: string;
    username: string;
    avatar: string;
    bio: string;
    syncedAt: string;
}

const IDENTITY_KEY = 'bucks_identity_v2';
const CONNECTIONS_KEY = 'bucks_connections_v2';

// ── Identity ─────────────────────────────────────────────────────────────────

export function getIdentity(): Identity | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
}

export function saveIdentity(identity: Identity): void {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    // Keep legacy keys in sync so AuthGuard / api.ts interceptor still work
    localStorage.setItem('bucks_peer_id', identity.did);
    localStorage.setItem('bucks_identity_secret', identity.secret);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('bucks_user_profile', JSON.stringify({
        username: identity.username,
        avatar: identity.avatar,
        bio: identity.bio,
        did: identity.did,
        peer_id: identity.did,
        uuid7: identity.uuid7,
        stats: { syncs: 0, contacts: 0, posts: 0, likes: 0 },
    }));
}

export function updateIdentity(patch: Partial<Pick<Identity, 'username' | 'avatar' | 'bio'>>): void {
    const existing = getIdentity();
    if (!existing) return;
    const updated = { ...existing, ...patch };
    saveIdentity(updated);
}

export function clearIdentity(): void {
    localStorage.removeItem(IDENTITY_KEY);
    localStorage.removeItem('bucks_peer_id');
    localStorage.removeItem('bucks_identity_secret');
    localStorage.removeItem('bucks_user_profile');
    localStorage.removeItem('isAuthenticated');
}

// ── Connections ───────────────────────────────────────────────────────────────

export function getConnections(): Connection[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(CONNECTIONS_KEY);
    return raw ? (JSON.parse(raw) as Connection[]) : [];
}

export function addConnection(conn: Connection): void {
    const list = getConnections();
    if (!list.find(c => c.uuid7 === conn.uuid7)) {
        list.push(conn);
        localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(list));
    }
}

export function removeConnection(uuid7: string): void {
    const list = getConnections().filter(c => c.uuid7 !== uuid7);
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(list));
}

export function isSynced(uuid7: string): boolean {
    return getConnections().some(c => c.uuid7 === uuid7);
}

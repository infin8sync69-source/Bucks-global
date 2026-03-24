
import { get } from 'svelte/store';
import { dbStore } from './db';
import { identityStore } from './identity';

export async function followPeer(did: string) {
    const db = get(dbStore).db;
    const identity = get(identityStore).identity;
    if (!db || !identity) return;

    // We store the follow relationship in our own 'following' db
    if (typeof db.following.set === 'function') {
        await db.following.set(did, { followedAt: Date.now() });
    } else {
        await db.following.put(did, { followedAt: Date.now() });
    }
    console.log(`Following ${did}`);

    // Optionally, we could try to subscribe to their feed if they use ACLs
}

export async function unfollowPeer(did: string) {
    const db = get(dbStore).db;
    if (!db) return;

    if (typeof (db.following as any).del === 'function') {
        await (db.following as any).del(did);
    } else {
        await db.following.put(did, null);
    }
    console.log(`Unfollowed ${did}`);
}

export async function isFollowing(did: string): Promise<boolean> {
    const db = get(dbStore).db;
    if (!db) return false;
    
    const record = await db.following.get(did);
    return !!record;
}


import { writable, get } from 'svelte/store';
import { identityStore, type IdentityStore } from './identity';
import { getBucksDB, type BucksDB } from '$lib/ipfs/orbitdb';
import type { Identity } from '$lib/crypto/identity';

export interface DbStore {
    loading: boolean;
    db: BucksDB | null;
    error: string | null;
}

function createDbStore() {
    const { subscribe, set } = writable<DbStore>({
        loading: false,
        db: null,
        error: null
    });
    let state: DbStore = { loading: false, db: null, error: null };

    function setState(next: DbStore) {
        state = next;
        set(next);
    }

    async function initialize() {
        setState({ loading: true, db: null, error: null });
        
        const currentIdentity = get(identityStore).identity;

        if (!currentIdentity) {
            const err = 'Cannot initialize DB without an unlocked identity.';
            setState({ loading: false, db: null, error: err });
            console.error(err);
            return;
        }

        try {
            const db = await getBucksDB(currentIdentity);
            setState({ loading: false, db, error: null });
        } catch (e: any) {
            setState({ loading: false, db: null, error: e.message || 'Failed to initialize database.' });
        }
    }

    // React to identity changes
    identityStore.subscribe(async (store: IdentityStore) => {
        if (store.status === 'unlocked' && !state.db) {
            await initialize();
        } else if (store.status !== 'unlocked') {
            // Potentially close DB connections when locked/signed out
            setState({ loading: false, db: null, error: null });
        }
    });

    return {
        subscribe,
        initialize
    };
}

export const dbStore = createDbStore();

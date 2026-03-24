
import { writable } from 'svelte/store';
import {
	loadIdentity as loadFromDB,
	decryptIdentity,
	deleteIdentity,
	type Identity
} from '$lib/crypto/identity';

export type IdentityStatus = 'loading' | 'locked' | 'unlocked' | 'none';

export interface IdentityStore {
	status: IdentityStatus;
	identity: Identity | null;
	error: string | null;
}

function createIdentityStore() {
	const { subscribe, set, update } = writable<IdentityStore>({
		status: 'loading',
		identity: null,
		error: null
	});

	async function loadInitialState() {
		try {
			const encryptedIdentity = await loadFromDB();
			if (encryptedIdentity) {
				set({ status: 'locked', identity: null, error: null });
			} else {
				set({ status: 'none', identity: null, error: null });
			}
		} catch (e: any) {
			set({ status: 'none', identity: null, error: 'Could not load identity from storage.' });
		}
	}

	async function unlock(password: string) {
		update((s) => ({ ...s, status: 'loading', error: null }));
		try {
			const encryptedIdentity = await loadFromDB();
			if (!encryptedIdentity) {
				throw new Error('No identity found in storage.');
			}
			const identity = await decryptIdentity(encryptedIdentity, password);
			set({ status: 'unlocked', identity, error: null });
            return identity;
		} catch (e: any) {
			set({ status: 'locked', identity: null, error: e.message || 'Failed to unlock identity.' });
            return null;
		}
	}

    function lock() {
        set({ status: 'locked', identity: null, error: null });
    }

	async function signOut() {
		await deleteIdentity();
		set({ status: 'none', identity: null, error: null });
	}

	return {
		subscribe,
		loadInitialState,
		unlock,
        lock,
		signOut
	};
}

export const identityStore = createIdentityStore();

// Automatically load the initial state when the store is imported.
identityStore.loadInitialState();

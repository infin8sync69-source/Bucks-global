
import { writable, get } from 'svelte/store';
import { dbStore, type DbStore } from './db';
import { identityStore } from './identity';

export interface UserProfile {
    did: string;
    displayName?: string;
    bio?: string;
    avatar?: string; // IPFS CID
}

export interface ProfileStore {
    loading: boolean;
    profiles: Record<string, UserProfile>; // DID -> Profile
    error: string | null;
}

function createProfileStore() {
    const { subscribe, set, update } = writable<ProfileStore>({
        loading: false,
        profiles: {},
        error: null
    });
    let currentState: ProfileStore = { loading: false, profiles: {}, error: null };

    subscribe((value) => {
        currentState = value;
    });

    async function getProfile(did: string): Promise<UserProfile | undefined> {
        const existing = currentState.profiles[did];
        if (existing) return existing;

        const db = get(dbStore).db;
        if (!db) return;

        const profile = await db.users.get(did) as UserProfile | undefined;
        if (profile && typeof profile.did === 'string') {
            update(s => ({...s, profiles: { ...s.profiles, [did]: profile }}));
            return profile;
        }
        return undefined;
    }

    async function updateProfile(profile: Partial<UserProfile>) {
        const db = get(dbStore).db;
        const identity = get(identityStore).identity;
        if (!db || !identity) return;

        const did = identity.did;
        const currentProfile = await getProfile(did) || { did };
        const newProfile = { ...currentProfile, ...profile };

        if (typeof db.users.set === 'function') {
            await db.users.set(did, newProfile);
        } else {
            await db.users.put(did, newProfile);
        }
        update(s => ({...s, profiles: { ...s.profiles, [did]: newProfile }}));
    }

    return {
        subscribe,
        getProfile,
        updateProfile
    };
}

export const profileStore = createProfileStore();

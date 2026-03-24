
import { readable, writable } from 'svelte/store';
import {
    generateIdentity,
    encryptIdentity,
    decryptIdentity,
    loadIdentity as loadFromDB,
    saveIdentity as saveToDB,
    type Identity
} from '$lib/crypto/identity';
import { goto } from '$app/navigation';

type IdentityStatus = 'unlocked' | 'locked' | 'none' | 'generating';

interface IdentityStore {
    status: IdentityStatus;
    identity: Identity | null;
    encryptedIdentity: string | null;
    error: string | null;
}

function createIdentityStore() {
    const { subscribe, set, update } = writable<IdentityStore>({
        status: 'none',
        identity: null,
        encryptedIdentity: null,
        error: null,
    });

    async function init() {
        const encrypted = await loadFromDB();
        if (encrypted) {
            set({
                status: 'locked',
                identity: null,
                encryptedIdentity: encrypted,
                error: null,
            });
        }
    }

    async function unlock(password: string) {
        update(s => ({ ...s, error: null }));
        const encrypted = (await loadFromDB())!;
        try {
            const identity = await decryptIdentity(encrypted, password);
            set({
                status: 'unlocked',
                identity,
                encryptedIdentity: encrypted,
                error: null,
            });
            goto('/feed');
        } catch (e) {
            update(s => ({ ...s, error: 'Invalid password.' }));
            throw e;
        }
    }

    function lock() {
        update(s => ({
            ...s,
            status: s.encryptedIdentity ? 'locked' : 'none',
            identity: null,
        }));
    }

    async function signOut() {
        await saveToDB(''); // Clear DB
        set({
            status: 'none',
            identity: null,
            encryptedIdentity: null,
            error: null,
        });
    }

    async function createAndSave(password: string, profile: { displayName: string; bio?: string, avatar?: string }) {
        update(s => ({ ...s, status: 'generating' }));
        const newIdentity = await generateIdentity();
        
        // In a real app, user profile data would be stored in a users DB (like the one in orbitdb.ts)
        // For now, we'll just proceed with encryption.
        const identityWithProfile = { ...newIdentity, profile };

        const encrypted = await encryptIdentity(identityWithProfile, password);
        await saveToDB(encrypted);
        set({
            status: 'unlocked',
            identity: identityWithProfile,
            encryptedIdentity: encrypted,
            error: null,
        });
        goto('/feed');
    }
    
    async function importAndSave(jsonBackup: string, password: string) {
        update(s => ({...s, error: null}));
        try {
            // We are assuming the jsonBackup is the encrypted string.
            // A more robust implementation would handle different formats.
            const identity = await decryptIdentity(jsonBackup, password);
            await saveToDB(jsonBackup);
            set({
                status: 'unlocked',
                identity,
                encryptedIdentity: jsonBackup,
                error: null,
            });
            goto('/feed');
        } catch (e) {
            update(s => ({ ...s, error: 'Failed to decrypt identity. Check backup and password.' }));
            throw e;
        }
    }


    init();

    return {
        subscribe,
        unlock,
        lock,
        signOut,
        createAndSave,
        importAndSave,
    };
}

export const identityStore = createIdentityStore();

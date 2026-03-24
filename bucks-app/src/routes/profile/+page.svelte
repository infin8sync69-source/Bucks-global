
<script lang="ts">
    import { identityStore } from '$lib/stores/identity';
    import { feedStore } from '$lib/stores/feed';
    import { profileStore, type UserProfile } from '$lib/stores/profile';
    import { confirmStore } from '$lib/stores/confirm';
    import { toastStore } from '$lib/stores/toast';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import PostCard from '$lib/components/PostCard.svelte';
    import { loadIdentity } from '$lib/crypto/identity';

    let ownProfile = $state<UserProfile | null>(null);
    let isEditing = $state(false);
    let savingProfile = $state(false);
    let exportingIdentity = $state(false);

    let editDisplayName = $state('');
    let editBio = $state('');
    let ownPosts = $state<typeof $feedStore.posts>([]);

    onMount(async () => {
        if ($identityStore.status !== 'unlocked' || !$identityStore.identity) {
            goto('/login');
            return;
        }
        const profile = await profileStore.getProfile($identityStore.identity.did);
        ownProfile = profile || { did: $identityStore.identity.did };
        editDisplayName = ownProfile.displayName || '';
        editBio = ownProfile.bio || '';
    });

    $effect(() => {
        if (!$identityStore.identity) {
            ownPosts = [];
            return;
        }
        ownPosts = $feedStore.posts.filter(p => p.author === $identityStore.identity!.did);
    });

    async function handleSaveProfile() {
        if (!$identityStore.identity || savingProfile) {
            return;
        }
        savingProfile = true;
        try {
            await profileStore.updateProfile({
                displayName: editDisplayName,
                bio: editBio
            });
            const profile = await profileStore.getProfile($identityStore.identity.did);
            ownProfile = profile!;
            isEditing = false;
            toastStore.success('Profile updated.');
        } catch (error) {
            toastStore.error(
                error instanceof Error ? error.message : 'Failed to update profile.',
            );
        } finally {
            savingProfile = false;
        }
    }

    async function handleExportIdentity() {
        if (exportingIdentity) {
            return;
        }
        const confirmed = await confirmStore.request({
            title: 'Export Identity',
            message: 'This will download your encrypted identity backup file.',
            confirmText: 'Export',
            cancelText: 'Cancel',
        });
        if (!confirmed) {
            return;
        }
        exportingIdentity = true;
        try {
            const encryptedIdentity = await loadIdentity();
            if (encryptedIdentity) {
                const blob = new Blob([encryptedIdentity], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bucks-identity-backup.json`;
                a.click();
                URL.revokeObjectURL(url);
                toastStore.success('Identity backup exported.');
            } else {
                toastStore.error('No identity found to export.');
            }
        } catch (error) {
            toastStore.error(
                error instanceof Error ? error.message : 'Failed to export identity.',
            );
        } finally {
            exportingIdentity = false;
        }
    }
</script>

<div class="profile-page">
    <div class="banner"></div>
    <div class="profile-header">
        <div class="avatar-large"></div>
        {#if ownProfile}
            {#if isEditing}
                <div class="edit-form">
                    <input type="text" bind:value={editDisplayName} placeholder="Display Name" />
                    <textarea bind:value={editBio} placeholder="Your Bio"></textarea>
                    <button onclick={handleSaveProfile} disabled={savingProfile}>
                        {savingProfile ? 'Saving...' : 'Save'}
                    </button>
                    <button class="secondary" onclick={() => isEditing = false} disabled={savingProfile}>Cancel</button>
                </div>
            {:else}
                <h1>{ownProfile.displayName || 'Unnamed'}</h1>
                <p class="did-text">{ownProfile.did}</p>
                <p class="bio">{ownProfile.bio}</p>
                <button onclick={() => isEditing = true}>Edit Profile</button>
            {/if}
        {/if}
    </div>
    
    <div class="stats-row">
        <div><span>{ownPosts.length}</span> Posts</div>
        <div><span>0</span> Following</div>
        <div><span>0</span> Peers</div>
    </div>

    <div class="profile-actions">
        <button onclick={handleExportIdentity} disabled={exportingIdentity}>
            {exportingIdentity ? 'Exporting...' : 'Export Identity'}
        </button>
    </div>

    <div class="post-grid">
        {#each ownPosts as post}
            <PostCard {post} />
        {/each}
    </div>
</div>

<style>
    .banner {
        height: 200px;
        background: linear-gradient(90deg, var(--primary-accent), var(--secondary-accent));
    }
    .profile-header {
        text-align: center;
        margin-top: -50px;
        padding: 0 2rem;
    }
    .avatar-large {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background-color: #333;
        border: 4px solid var(--background-dark);
        margin: 0 auto 1rem;
    }
    .stats-row {
        display: flex;
        justify-content: center;
        gap: 2rem;
        padding: 1rem;
        border-top: 1px solid rgba(255,255,255,0.1);
        border-bottom: 1px solid rgba(255,255,255,0.1);
        margin: 2rem 0;
    }
    .profile-actions {
        text-align: center;
        margin-bottom: 2rem;
    }
    .post-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1rem;
        padding: 0 2rem;
    }
</style>

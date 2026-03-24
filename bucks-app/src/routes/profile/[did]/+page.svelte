
<script lang="ts">
    import { page } from '$app/stores';
    import { identityStore } from '$lib/stores/identity';
    import { feedStore } from '$lib/stores/feed';
    import { profileStore, type UserProfile } from '$lib/stores/profile';
    import { followPeer, unfollowPeer, isFollowing } from '$lib/stores/social';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import PostCard from '$lib/components/PostCard.svelte';

    let peerProfile = $state<UserProfile | null>(null);
    let amFollowing = $state(false);
    let peerPosts = $state<typeof $feedStore.posts>([]);
    const did = $page.params.did ?? '';

    onMount(async () => {
        if ($identityStore.status !== 'unlocked') {
            goto('/login');
            return;
        }
        if (did === $identityStore.identity?.did) {
            goto('/profile'); // Redirect to own profile page
            return;
        }

        const profile = await profileStore.getProfile(did);
        peerProfile = profile || { did };
        amFollowing = await isFollowing(did);
    });

    $effect(() => {
        peerPosts = $feedStore.posts.filter(p => p.author === did);
    });

    async function handleFollow() {
        await followPeer(did);
        amFollowing = true;
    }

    async function handleUnfollow() {
        await unfollowPeer(did);
        amFollowing = false;
    }
</script>

<div class="profile-page">
    <div class="banner"></div>
    <div class="profile-header">
        <div class="avatar-large"></div>
        {#if peerProfile}
            <h1>{peerProfile.displayName || 'Unnamed'}</h1>
            <p class="did-text">{peerProfile.did}</p>
            <p class="bio">{peerProfile.bio}</p>
            {#if amFollowing}
                <button class="secondary" onclick={handleUnfollow}>Unfollow</button>
            {:else}
                <button onclick={handleFollow}>Follow</button>
            {/if}
            <button onclick={() => goto(`/messages/${did}`)}>Message</button>
        {/if}
    </div>
    
    <div class="stats-row">
        <div><span>{peerPosts.length}</span> Posts</div>
        <!-- Following/follower count would require more complex DB queries -->
        <div><span>?</span> Following</div> 
        <div><span>?</span> Followers</div>
    </div>

    <div class="post-grid">
        {#each peerPosts as post}
            <PostCard {post} />
        {/each}
    </div>
</div>

<style>
    /* Styles are assumed to be similar to own profile page */
    .profile-page {
        padding-bottom: 2rem;
    }
    .banner {
        height: 200px;
        background: linear-gradient(90deg, #444, #666);
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
    .post-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1rem;
        padding: 0 2rem;
    }
    button {
		padding: 0.75rem 1.5rem;
		margin: 0.5rem;
		border-radius: 0.5rem;
		border: 1px solid var(--primary-accent);
		background: var(--primary-accent);
		color: var(--text-light);
        cursor: pointer;
	}
    button.secondary {
        background: transparent;
    }
</style>

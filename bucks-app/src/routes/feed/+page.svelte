
<script lang="ts">
    import { feedStore, type Post } from '$lib/stores/feed';
    import { identityStore } from '$lib/stores/identity';
    import { dbStore } from '$lib/stores/db';
    import PostCard from '$lib/components/PostCard.svelte';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';

    // State for filtering
    let filterType = $state<'all' | 'images' | 'videos' | 'files'>('all');
    let filterSource = $state<'global' | 'following'>('global');
    let sortOrder = $state<'newest' | 'popular'>('newest');
    let filteredPosts = $state<Post[]>([]);

    // Check for identity on mount
    onMount(() => {
        if ($identityStore.status !== 'unlocked') {
            goto('/login');
        } else if (!$dbStore.db) {
            dbStore.initialize();
        }
    });

    $effect(() => {
        let posts = [...$feedStore.posts];

        // Filter by type
        if (filterType !== 'all') {
            posts = posts.filter(p => {
                if (filterType === 'images') return p.media?.type.startsWith('image/');
                if (filterType === 'videos') return p.media?.type.startsWith('video/');
                if (filterType === 'files') return !!p.media;
                return false;
            });
        }
        
        // TODO: Filter by source (following)
        // TODO: Sort by popularity

        filteredPosts = posts;
    });

</script>

<div class="feed-layout">
    <main class="feed-main">
        <div class="filter-bar">
            <div class="filter-group">
                <button class:active={filterType === 'all'} onclick={() => filterType = 'all'}>All</button>
                <button class:active={filterType === 'images'} onclick={() => filterType = 'images'}>Images</button>
                <button class:active={filterType === 'videos'} onclick={() => filterType = 'videos'}>Videos</button>
                <button class:active={filterType === 'files'} onclick={() => filterType = 'files'}>Files</button>
            </div>
            <div class="filter-group">
                <select bind:value={filterSource}>
                    <option value="global">Global Swarm</option>
                    <option value="following">Following</option>
                </select>
                <select bind:value={sortOrder}>
                    <option value="newest">Newest</option>
                    <option value="popular">Popular</option>
                </select>
            </div>
        </div>

        {#if $feedStore.loading}
            <p>Loading feed...</p>
        {:else if filteredPosts.length === 0}
            <div class="empty-state">
                <h2>No posts yet.</h2>
                <p>Follow peers or create your first post to see content here.</p>
            </div>
        {:else}
            {#each filteredPosts as post (post.id)}
                <PostCard {post} />
            {/each}
            <button onclick={() => feedStore.loadFeed($feedStore.posts.length + 50)}>Load More</button>
        {/if}
    </main>

    <aside class="feed-sidebar">
        <div class="sidebar-widget">
            <h3>Node Status</h3>
            {#if $dbStore.db}
                <p><strong>PeerID:</strong> {`${$identityStore.identity?.peerId.slice(0, 12)}...`}</p>
                <p><span class="status-dot online">●</span> Online</p>
                <!-- TODO: Add connected peers count -->
            {:else}
                <p><span class="status-dot offline">●</span> Offline</p>
            {/if}
        </div>

        <div class="sidebar-widget">
            <h3>Trending</h3>
            <ul>
                <li>#p2p</li>
                <li>#ipfs</li>
                <li>#decentralized</li>
            </ul>
        </div>
    </aside>
</div>

<style>
    .feed-layout {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 2rem;
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
    }
    .filter-bar {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        padding: 1rem;
        margin-bottom: 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .filter-group {
        display: flex;
        gap: 0.5rem;
    }
    .filter-group button {
        background: transparent;
        border: 1px solid var(--text-medium);
        color: var(--text-medium);
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        cursor: pointer;
    }
    .filter-group button.active {
        background: var(--primary-accent);
        border-color: var(--primary-accent);
        color: var(--text-light);
    }
    .filter-group select {
        background: rgba(0,0,0,0.2);
        color: var(--text-light);
        border: 1px solid var(--text-medium);
        border-radius: 0.5rem;
        padding: 0.5rem;
    }
    .sidebar-widget {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
    }
    .sidebar-widget h3 {
        margin-top: 0;
        color: var(--text-light);
    }
    .sidebar-widget p, .sidebar-widget li {
        color: var(--text-medium);
        font-size: 0.9rem;
    }
    .sidebar-widget ul {
        list-style: none;
        padding: 0;
    }
    .status-dot {
        font-size: 1.2rem;
    }
    .status-dot.online {
        color: #b9f6ca;
    }
    .status-dot.offline {
        color: #ff8a8a;
    }
    .empty-state {
        text-align: center;
        padding: 4rem;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 1rem;
    }
</style>

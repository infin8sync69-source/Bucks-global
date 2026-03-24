
<script lang="ts">
    import { feedStore } from '$lib/stores/feed';
    import PostCard from '$lib/components/PostCard.svelte';
    import { goto } from '$app/navigation';

    let searchMode: 'content' | 'peers' = $state('content');
    let searchTerm = $state('');
    let searchResults = $state<any[]>([]);

    function performSearch() {
        if (!searchTerm) {
            searchResults = [];
            return;
        }

        if (searchMode === 'content') {
            searchResults = $feedStore.posts.filter(p => 
                p.content.toLowerCase().includes(searchTerm.toLowerCase())
            );
        } else { // 'peers'
            // Basic DID validation
            if (searchTerm.startsWith('did:key:z')) {
                searchResults = [{ did: searchTerm }];
            } else {
                searchResults = [];
            }
        }
    }

    $effect(() => {
        performSearch();
    });
</script>

<div class="search-page">
    <div class="search-bar">
        <input type="search" bind:value={searchTerm} placeholder="Search for content or paste a DID..." />
        <div class="toggle-group">
            <button class:active={searchMode === 'content'} onclick={() => searchMode = 'content'}>Content</button>
            <button class:active={searchMode === 'peers'} onclick={() => searchMode = 'peers'}>Peers</button>
        </div>
    </div>

    <div class="results">
        {#if searchResults.length === 0}
            <p class="empty-state">
                {#if searchTerm}
                    No results found.
                {:else}
                    Enter a search term or paste a DID to find content or peers.
                {/if}
            </p>
        {:else if searchMode === 'content'}
            <div class="post-grid">
                {#each searchResults as post}
                    <PostCard {post} />
                {/each}
            </div>
        {:else} <!-- peers -->
             <div class="peer-grid">
                {#each searchResults as peer}
                    <div class="peer-card">
                        <h3>Peer Found</h3>
                        <p>{peer.did}</p>
                        <button onclick={() => goto(`/profile/${peer.did}`)}>View Profile</button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .search-page {
        padding: 2rem;
    }
    .search-bar {
        max-width: 800px;
        margin: 0 auto 2rem;
        text-align: center;
    }
    input[type="search"] {
        width: 100%;
        padding: 1rem;
        font-size: 1.2rem;
        border-radius: 0.5rem;
        border: 1px solid rgba(255, 255, 255, 0.2);
		background: rgba(0, 0, 0, 0.2);
		color: var(--text-light);
    }
    .toggle-group {
        margin-top: 1rem;
    }
    .toggle-group button {
        background: transparent;
        border: 1px solid var(--primary-accent);
        color: var(--primary-accent);
        padding: 0.5rem 1rem;
        cursor: pointer;
    }
    .toggle-group button.active {
        background: var(--primary-accent);
        color: var(--text-light);
    }
    .post-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1rem;
    }
    .peer-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        padding: 1.5rem;
        text-align: center;
    }
    .peer-card p {
        word-break: break-all;
    }
    .empty-state {
        text-align: center;
        margin-top: 4rem;
        color: var(--text-medium);
    }
</style>

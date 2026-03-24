<!-- src/lib/components/TrendingTags.svelte -->
<script lang="ts">
    const tags = ['#p2p', '#ipfs', '#decentralized', '#privacy', '#crypto', '#web3'];
</script>

<div class="widget-card">
    <h3 class="widget-title">Trending Tags</h3>
    <div class="tags-container">
        {#each tags as tag}
            <a href={`/search?q=${tag.substring(1)}`} class="tag">{tag}</a>
        {/each}
    </div>
</div>

<style>
    .widget-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 1rem;
        font-size: 0.9em;
    }
    .widget-title {
        margin: 0 0 1rem 0;
        font-weight: 600;
        color: #fff;
    }
    .tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .tag {
        background: rgba(255, 255, 255, 0.1);
        color: #ddd;
        padding: 0.3rem 0.6rem;
        border-radius: 6px;
        text-decoration: none;
        transition: background 0.2s ease;
    }
    .tag:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
    }
</style>


<script lang="ts">
    import { Heart, MessageCircle, Share2 } from 'lucide-svelte';

    const {
        likes = 0,
        comments = 0,
        ipfsCid = ''
    }: {
        likes?: number;
        comments?: number;
        ipfsCid?: string;
    } = $props();

    function handleLike() {
        // TODO: Implement toggleLike from social.ts
        console.log("Liked!");
    }

    function handleComment() {
        // TODO: This should probably dispatch an event to the parent
        console.log("Toggle comments!");
    }

    function handleShare() {
        if (navigator.clipboard && ipfsCid) {
            navigator.clipboard.writeText(ipfsCid);
            alert("Copied IPFS CID to clipboard!");
        }
    }
</script>

<div class="engagement-bar">
    <button onclick={handleLike}>
        <Heart size={18} />
        <span>{likes}</span>
    </button>
    <button onclick={handleComment}>
        <MessageCircle size={18} />
        <span>{comments}</span>
    </button>
    <button onclick={handleShare}>
        <Share2 size={18} />
    </button>
</div>

<style>
    .engagement-bar {
        display: flex;
        gap: 1rem;
        margin-top: 1rem;
        color: var(--text-medium);
    }
    button {
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: inherit;
        padding: 0;
    }
    button:hover {
        color: var(--primary-accent);
    }
</style>

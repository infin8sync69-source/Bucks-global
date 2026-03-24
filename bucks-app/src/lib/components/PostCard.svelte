
<script lang="ts">
    import type { Post } from '$lib/stores/feed';
    import EngagementBar from './EngagementBar.svelte';
    import { formatRelativeTime } from '$lib/utils/time';
    import { verifyContent, type Signed } from '$lib/crypto/signing';
    import { onMount } from 'svelte';

    const { post }: { post: Post } = $props();

    type PostContent = Omit<Post, 'id' | 'author' | 'signature'>;

    let isVerified = $state(false);
    let avatarColor = $state('#000');

    function truncateDID(did: string) {
        if (!did) return '';
        return `${did.slice(0, 12)}...${did.slice(-4)}`;
    }

    function generateAvatarColor(did: string) {
        if (!did) return '#222';
        const hash = did.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    onMount(async () => {
        isVerified = await verifyContent<PostContent>(post as Signed<PostContent>);
        avatarColor = generateAvatarColor(post.author);
    });
</script>

<div class="post-card">
    <div class="header">
        <div class="avatar" style="background-color: {avatarColor}">
            {post.author.charAt(10) || ''}
        </div>
        <div class="author-info">
            <span class="author-did">{truncateDID(post.author)}</span>
            <span class="timestamp">{formatRelativeTime(post.timestamp)}</span>
        </div>
        <div class="signature-badge">
            {#if isVerified}
                <span title="Signature is valid">✓ Verified</span>
            {:else}
                <span title="Signature is invalid">⚠ Unverified</span>
            {/if}
        </div>
    </div>
    <div class="content">
        <p>{post.content}</p>
        {#if post.media}
            <div class="media-preview">
                {#if post.media.type.startsWith('image/')}
                    <img src={`https://ipfs.io/ipfs/${post.media.cid}`} alt="IPFS content" />
                {:else if post.media.type.startsWith('video/')}
                    <video controls src={`https://ipfs.io/ipfs/${post.media.cid}`}>
                        <track kind="captions" />
                    </video>
                {/if}
            </div>
        {/if}
    </div>
    <EngagementBar likes={0} comments={0} ipfsCid={post.media?.cid ?? ''} />
</div>

<style>
    .post-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
    }
    .header {
        display: flex;
        align-items: center;
        margin-bottom: 1rem;
    }
    .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        margin-right: 1rem;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: bold;
        color: white;
        text-transform: uppercase;
    }
    .author-info {
        display: flex;
        flex-direction: column;
    }
    .author-did {
        font-weight: bold;
        color: var(--text-light);
    }
    .timestamp {
        color: var(--text-medium);
        font-size: 0.8rem;
    }
    .signature-badge {
        margin-left: auto;
        font-size: 0.8rem;
        padding: 0.2rem 0.5rem;
        border-radius: 0.5rem;
        background: rgba(0,0,0,0.2);
    }
    .signature-badge span[title="Signature is valid"] {
        color: #b9f6ca;
    }
    .signature-badge span[title="Signature is invalid"] {
        color: #ff8a8a;
    }
    .content p {
        color: var(--text-light);
        white-space: pre-wrap;
    }
    .media-preview img, .media-preview video {
        max-width: 100%;
        border-radius: 0.5rem;
        margin-top: 1rem;
    }
</style>

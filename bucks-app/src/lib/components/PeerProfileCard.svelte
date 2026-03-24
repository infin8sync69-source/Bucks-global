<!-- src/lib/components/PeerProfileCard.svelte -->
<script lang="ts">
    import { goto } from '$app/navigation';
    export let did: string;

    // In a real app, you'd fetch this profile data
    const peer = {
        name: `Peer...${did.slice(-4)}`,
        bio: 'A user on the decentralized web.'
    }
</script>

<div class="peer-card">
    <div class="avatar">{peer.name.charAt(0)}</div>
    <div class="info">
        <span class="name">{peer.name}</span>
        <span class="did">{did}</span>
    </div>
    <div class="actions">
        <button onclick={() => goto(`/profile/${did}`)}>View</button>
        <button class="primary">Follow</button>
    </div>
</div>

<style>
    .peer-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
    }
    .avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #7a55ff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 1.5rem;
    }
    .info {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }
    .name {
        font-weight: 600;
    }
    .did {
        font-family: monospace;
        color: #aaa;
        font-size: 0.9em;
    }
    .actions {
        display: flex;
        gap: 0.5rem;
    }
    .actions button {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s ease;
    }
    .actions button.primary {
        background: #fff;
        color: #111;
    }
</style>

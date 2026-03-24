<!-- src/lib/components/NodeStatus.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { identityStore } from '$lib/stores/identity';

    let peerId = $state('Loading...');
    let connectedPeers = $state(0); // This would be updated from a libp2p store
    let status: 'online' | 'connecting' | 'offline' = $state('connecting');

    onMount(() => {
        peerId = $identityStore.identity?.peerId || 'Not unlocked';
        setTimeout(() => {
            status = 'online';
            connectedPeers = Math.floor(Math.random() * 150) + 50;
        }, 2000);
    });
    
    function truncate(id: string, len = 16) {
        if(id.length <= len) return id;
        return `${id.slice(0, len-6)}...${id.slice(-6)}`;
    }

</script>

<div class="widget-card">
    <h3 class="widget-title">Node Status</h3>
    <div class="status-line">
        <span class="status-dot" class:online={status === 'online'} class:connecting={status === 'connecting'}></span>
        <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
    </div>
    <div class="info-line">
        <strong>Peer ID:</strong>
        <span title={peerId}>{truncate(peerId)}</span>
    </div>
    <div class="info-line">
        <strong>Connected Peers:</strong>
        <span>{connectedPeers}</span>
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
    .info-line {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }
    .info-line strong {
        color: #bbb;
        font-weight: 500;
    }
    .info-line span {
        color: #eee;
        font-family: monospace;
        font-size: 0.95em;
    }
    .status-line {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }
    .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: #ff4545;
    }
    .status-dot.connecting {
        background-color: #ffcc00;
        animation: pulse 1.5s infinite;
    }
    .status-dot.online {
        background-color: #44dd88;
    }
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
    }
</style>

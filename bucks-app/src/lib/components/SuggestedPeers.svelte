<!-- src/lib/components/SuggestedPeers.svelte -->
<script lang="ts">
    import { peersStore } from '$lib/stores/peers';
    import type { Peer } from '$lib/stores/peers';
    
    let peers: Peer[] = $state([]);
    
    peersStore.subscribe(value => {
        peers = value;
    });

    function truncateDID(did: string): string {
        if (did.length < 20) return did;
        return `${did.slice(0, 10)}...${did.slice(-3)}`;
    }
</script>

<div class="widget-card">
    <h3 class="widget-title">Suggested Peers</h3>
    <div class="peers-list">
        {#each peers as peer}
            <div class="peer-item">
                <div class="peer-avatar">{peer.avatar}</div>
                <div class="peer-info">
                    <span class="peer-name">{peer.name}</span>
                    <span class="peer-did">{truncateDID(peer.did)}</span>
                </div>
                <button class="follow-button">+</button>
            </div>
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
    .peers-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .peer-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    .peer-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background-color: #7a55ff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
    }
    .peer-info {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }
    .peer-name {
        font-weight: 500;
        color: #eee;
    }
    .peer-did {
        font-size: 0.85em;
        color: #aaa;
    }
    .follow-button {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 1.2rem;
        line-height: 1;
        padding: 0;
        transition: background 0.2s ease;
    }
    .follow-button:hover {
        background: rgba(255, 255, 255, 0.2);
    }
</style>

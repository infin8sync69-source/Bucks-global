<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { identityStore } from "$lib/stores/identity";
  import { getConversations, initChat } from "$lib/chat/engine";

  type Conversation = {
    peer_id: string;
    last_message: string;
    timestamp: string;
    unread_count: number;
    encrypted: boolean;
    hasSession: boolean;
  };

  let loading = $state(true);
  let error = $state("");
  let conversations = $state<Conversation[]>([]);
  let manualPeer = $state("");

  async function loadConversations(): Promise<void> {
    conversations = getConversations().conversations as Conversation[];
  }

  onMount(async () => {
    try {
      await identityStore.loadInitialState();
      if ($identityStore.status !== "unlocked" || !$identityStore.identity) {
        goto("/login");
        return;
      }

      await initChat();
      await loadConversations();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to initialize chat";
    } finally {
      loading = false;
    }
  });
</script>

<main class="messages-shell">
  <header>
    <h1>Messages</h1>
    <p>Your encrypted conversations</p>
  </header>

  <section class="card">
    <div class="start-row">
      <input
        type="text"
        bind:value={manualPeer}
        placeholder="Enter peerId to start chat"
      />
      <button
        onclick={() => manualPeer.trim() && goto(`/messages/${encodeURIComponent(manualPeer.trim())}`)}
      >
        Open
      </button>
    </div>

    {#if loading}
      <p>Loading conversations...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if conversations.length === 0}
      <p>No conversations yet. Start a chat using a peerId.</p>
    {:else}
      <div class="list">
        {#each conversations as convo (convo.peer_id)}
          <button class="row" onclick={() => goto(`/messages/${encodeURIComponent(convo.peer_id)}`)}>
            <div>
              <strong>{convo.peer_id}</strong>
              <p>{convo.last_message || "No messages yet"}</p>
            </div>
            <div class="meta">
              <span>{convo.unread_count > 0 ? `${convo.unread_count} unread` : "Read"}</span>
              <small>{convo.hasSession ? "Session active" : "No session"}</small>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </section>
</main>

<style>
  .messages-shell {
    max-width: 900px;
    margin: 0 auto;
    padding: 7rem 1rem 2rem;
    display: grid;
    gap: 1rem;
  }

  .card {
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(11, 11, 13, 0.82);
    padding: 1rem;
    display: grid;
    gap: 1rem;
  }

  .start-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.6rem;
  }

  input {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    color: #fff;
    padding: 0.6rem;
  }

  button {
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: #fff;
    padding: 0.55rem 0.8rem;
    background: rgba(53, 97, 222, 0.55);
    cursor: pointer;
  }

  .list {
    display: grid;
    gap: 0.6rem;
  }

  .row {
    text-align: left;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.8rem;
    align-items: center;
    background: rgba(255, 255, 255, 0.04);
  }

  .row p {
    margin: 0.3rem 0 0;
    color: #c6c6cf;
  }

  .meta {
    display: grid;
    justify-items: end;
    color: #e0e0e5;
  }

  .meta small {
    color: #b2b2bc;
  }

  .error {
    color: #ff8da0;
  }
</style>

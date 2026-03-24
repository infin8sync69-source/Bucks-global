<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { identityStore } from "$lib/stores/identity";
  import {
    getChatHistory,
    initChat,
    markAsRead,
    sendFile,
    sendMessage,
    setOnMessageCallback,
    type ChatMessage,
  } from "$lib/chat/engine";

  let peerId = $derived($page.params.peerId ?? "");

  let loading = $state(true);
  let sending = $state(false);
  let uploading = $state(false);
  let error = $state("");
  let text = $state("");
  let history = $state<ChatMessage[]>([]);

  async function loadHistory(): Promise<void> {
    if (!peerId) return;
    const data = await getChatHistory(peerId);
    history = data.history;
    await markAsRead(peerId);
  }

  async function submitMessage(): Promise<void> {
    if (sending || !peerId || !text.trim()) return;
    sending = true;
    error = "";
    try {
      const result = await sendMessage(peerId, text.trim());
      if (!result.success) {
        throw new Error(result.error ?? "Failed to send message");
      }
      text = "";
      await loadHistory();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to send message";
    } finally {
      sending = false;
    }
  }

  async function onFileSelected(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !peerId) return;

    uploading = true;
    error = "";
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await sendFile(peerId, bytes, file.name);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to send file");
      }
      await loadHistory();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to send file";
    } finally {
      uploading = false;
      input.value = "";
    }
  }

  onMount(async () => {
    try {
      await identityStore.loadInitialState();
      if ($identityStore.status !== "unlocked" || !$identityStore.identity) {
        goto("/login");
        return;
      }
      if (!peerId) {
        goto("/messages");
        return;
      }

      await initChat();
      await loadHistory();
      setOnMessageCallback((payload) => {
        if (payload.peerId === peerId) {
          void loadHistory();
        }
      });
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to initialize chat";
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    setOnMessageCallback(null);
  });
</script>

<main class="chat-shell">
  <header>
    <button class="back" onclick={() => goto("/messages")}>Back</button>
    <h1>Chat with {peerId}</h1>
  </header>

  <section class="chat-card">
    {#if loading}
      <p>Loading chat...</p>
    {:else}
      <div class="messages">
        {#if history.length === 0}
          <p class="empty">No messages yet.</p>
        {:else}
          {#each history as message (message.id)}
            <article class="bubble {message.from === $identityStore.identity?.peerId ? 'me' : 'them'}">
              <p>{message.content || "(attachment)"}</p>
              {#if message.cid}
                <a href={`https://ipfs.io/ipfs/${message.cid}`} target="_blank" rel="noopener noreferrer">
                  Open attachment
                </a>
              {/if}
              <small>{new Date(message.timestamp).toLocaleString()}</small>
            </article>
          {/each}
        {/if}
      </div>

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <form
        class="composer"
        onsubmit={(e) => {
          e.preventDefault();
          void submitMessage();
        }}
      >
        <input
          type="text"
          bind:value={text}
          placeholder="Write a secure message..."
          disabled={sending || uploading}
        />
        <label class="file-btn">
          {uploading ? "Uploading..." : "Attach"}
          <input
            type="file"
            onchange={(e) => {
              void onFileSelected(e);
            }}
            disabled={sending || uploading}
          />
        </label>
        <button type="submit" disabled={sending || uploading || !text.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    {/if}
  </section>
</main>

<style>
  .chat-shell {
    max-width: 980px;
    margin: 0 auto;
    padding: 7rem 1rem 2rem;
    display: grid;
    gap: 1rem;
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }

  .back {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    border-radius: 8px;
    padding: 0.4rem 0.8rem;
    cursor: pointer;
  }

  .chat-card {
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(12, 12, 15, 0.84);
    padding: 1rem;
    display: grid;
    gap: 1rem;
    min-height: 520px;
  }

  .messages {
    display: grid;
    gap: 0.7rem;
    align-content: start;
    max-height: 420px;
    overflow: auto;
    padding-right: 0.3rem;
  }

  .bubble {
    max-width: min(72%, 600px);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 0.7rem;
    background: rgba(255, 255, 255, 0.05);
    display: grid;
    gap: 0.4rem;
  }

  .bubble.me {
    justify-self: end;
    background: rgba(53, 97, 224, 0.22);
    border-color: rgba(86, 126, 255, 0.45);
  }

  .bubble p {
    margin: 0;
  }

  .bubble small {
    color: #c3c3ce;
  }

  .composer {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 0.6rem;
  }

  input[type="text"] {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 9px;
    color: #fff;
    padding: 0.65rem 0.8rem;
  }

  button {
    background: rgba(53, 97, 224, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 9px;
    color: #fff;
    padding: 0.55rem 0.9rem;
    cursor: pointer;
  }

  .file-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 9px;
    color: #fff;
    padding: 0.55rem 0.9rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
  }

  .file-btn input {
    display: none;
  }

  .error {
    color: #ff8ea2;
    margin: 0;
  }

  .empty {
    color: #bdbdc8;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { identityStore } from '$lib/stores/identity';
  import { generateIdentity, encryptIdentity, saveIdentity } from '$lib/crypto/identity';

  type Mode = 'unlock' | 'create';

  let mode = $state<Mode>('unlock');
  let password = $state('');
  let confirmPassword = $state('');
  let loading = $state(false);
  let error = $state('');

  function syncMode(): void {
    mode = $identityStore.status === 'none' ? 'create' : 'unlock';
  }

  async function submit(): Promise<void> {
    if (loading) return;
    if (!password) { error = 'Password is required.'; return; }

    loading = true;
    error = '';
    try {
      if (mode === 'create') {
        if (password.length < 8) throw new Error('Use at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const identity = await generateIdentity();
        const encrypted = await encryptIdentity(identity, password);
        await saveIdentity(encrypted);
      }

      const unlocked = await identityStore.unlock(password);
      if (!unlocked) throw new Error('Invalid password.');
      goto('/messages');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Authentication failed';
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    await identityStore.loadInitialState();
    syncMode();
    if ($identityStore.status === 'unlocked') goto('/messages');
  });

  $effect(() => { syncMode(); });
</script>

<main class="login-shell">
  <section class="login-card">
    <div class="logo">
      <span class="logo-icon">💬</span>
      <h1>Bucks Chat</h1>
    </div>

    <p class="subtitle">
      {mode === 'create'
        ? 'Create your local Ed25519 identity to start chatting.'
        : 'Enter your password to unlock your identity.'}
    </p>

    <form onsubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label>
        Password
        <input
          type="password"
          bind:value={password}
          placeholder="Enter password"
          autocomplete={mode === 'create' ? 'new-password' : 'current-password'}
          disabled={loading}
        />
      </label>

      {#if mode === 'create'}
        <label>
          Confirm Password
          <input
            type="password"
            bind:value={confirmPassword}
            placeholder="Confirm password"
            autocomplete="new-password"
            disabled={loading}
          />
        </label>
      {/if}

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <button type="submit" disabled={loading}>
        {loading ? 'Please wait...' : mode === 'create' ? 'Create Identity' : 'Unlock'}
      </button>
    </form>
  </section>
</main>

<style>
  .login-shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 2rem 1rem;
  }

  .login-card {
    width: min(480px, 100%);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(11, 11, 15, 0.88);
    backdrop-filter: blur(12px);
    padding: 2rem 1.75rem;
    display: grid;
    gap: 1.1rem;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .logo-icon {
    font-size: 1.6rem;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .subtitle {
    margin: 0;
    color: #9898a6;
    font-size: 0.9rem;
  }

  form {
    display: grid;
    gap: 0.9rem;
  }

  label {
    display: grid;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: #c8c8d2;
  }

  input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 10px;
    color: #fff;
    padding: 0.7rem 0.8rem;
    font-size: 0.95rem;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }

  input:focus {
    border-color: rgba(88, 160, 255, 0.7);
  }

  .error {
    color: #ff8a9d;
    font-size: 0.85rem;
    margin: 0;
  }

  button {
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    color: #fff;
    background: rgba(54, 97, 224, 0.65);
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  button:hover:not(:disabled) {
    background: rgba(54, 97, 224, 0.85);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

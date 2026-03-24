<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { identityStore } from "$lib/stores/identity";
  import {
    generateIdentity,
    encryptIdentity,
    saveIdentity,
  } from "$lib/crypto/identity";

  let mode = $state<"unlock" | "create">("unlock");
  let password = $state("");
  let confirmPassword = $state("");
  let loading = $state(false);
  let error = $state("");

  function syncMode(): void {
    mode = $identityStore.status === "none" ? "create" : "unlock";
  }

  async function submit(): Promise<void> {
    if (loading) return;
    if (!password) {
      error = "Password is required.";
      return;
    }

    loading = true;
    error = "";
    try {
      if (mode === "create") {
        if (password.length < 8) {
          throw new Error("Use at least 8 characters.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const identity = await generateIdentity();
        const encrypted = await encryptIdentity(identity, password);
        await saveIdentity(encrypted);
      }

      const unlocked = await identityStore.unlock(password);
      if (!unlocked) {
        throw new Error("Invalid password.");
      }
      goto("/feed");
    } catch (e) {
      error = e instanceof Error ? e.message : "Authentication failed";
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    await identityStore.loadInitialState();
    syncMode();
    if ($identityStore.status === "unlocked") {
      goto("/feed");
    }
  });

  $effect(() => {
    syncMode();
  });
</script>

<main class="login-shell">
  <section class="login-card">
    <h1>{mode === "create" ? "Create Identity" : "Unlock Identity"}</h1>
    <p>
      {mode === "create"
        ? "Create your local Ed25519 identity to access Bucks Browser."
        : "Unlock your existing local identity to continue."}
    </p>

    <form
      onsubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label>
        Password
        <input
          type="password"
          bind:value={password}
          placeholder="Enter password"
          autocomplete="current-password"
        />
      </label>

      {#if mode === "create"}
        <label>
          Confirm Password
          <input
            type="password"
            bind:value={confirmPassword}
            placeholder="Confirm password"
            autocomplete="new-password"
          />
        </label>
      {/if}

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <button type="submit" disabled={loading}>
        {loading
          ? "Please wait..."
          : mode === "create"
            ? "Create Identity"
            : "Unlock"}
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
    width: min(520px, 100%);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(11, 11, 13, 0.84);
    padding: 1.5rem;
    display: grid;
    gap: 1rem;
  }

  h1 {
    margin: 0;
  }

  p {
    margin: 0;
    color: #c8c8cf;
  }

  form {
    display: grid;
    gap: 0.9rem;
  }

  label {
    display: grid;
    gap: 0.4rem;
    color: #dbdbe2;
  }

  input {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    color: #fff;
    padding: 0.7rem 0.8rem;
    outline: none;
  }

  input:focus {
    border-color: rgba(88, 160, 255, 0.8);
  }

  .error {
    color: #ff8a9d;
  }

  button {
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    padding: 0.7rem 0.9rem;
    color: #fff;
    background: rgba(54, 97, 224, 0.6);
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
</style>

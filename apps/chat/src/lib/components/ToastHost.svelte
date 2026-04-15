<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { toastStore, type ToastItem } from "$lib/stores/toast";

  const tones: Record<ToastItem["kind"], string> = {
    info: "border-blue-400/40 bg-blue-500/10 text-blue-100",
    success: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    error: "border-rose-400/40 bg-rose-500/10 text-rose-100",
  };
</script>

<div class="toast-shell" aria-live="polite" aria-atomic="true">
  {#each $toastStore as toast (toast.id)}
    <article
      class={`toast-item ${tones[toast.kind]}`}
      transition:fly={{ y: -14, duration: 220 }}
      out:fade={{ duration: 150 }}
    >
      <p>{toast.message}</p>
      <button type="button" onclick={() => toastStore.dismiss(toast.id)} aria-label="Dismiss notification">
        ×
      </button>
    </article>
  {/each}
</div>

<style>
  .toast-shell {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 250;
    width: min(380px, calc(100vw - 2rem));
    display: grid;
    gap: 0.6rem;
    pointer-events: none;
  }

  .toast-item {
    pointer-events: auto;
    border: 1px solid;
    border-radius: 12px;
    backdrop-filter: blur(12px);
    padding: 0.7rem 0.75rem;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.6rem;
    align-items: start;
  }

  .toast-item p {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.35;
  }

  .toast-item button {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0.1rem 0.25rem;
  }
</style>

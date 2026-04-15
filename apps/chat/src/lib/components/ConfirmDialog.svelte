<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { confirmStore } from "$lib/stores/confirm";

  function onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      confirmStore.reject();
    }
  }
</script>

{#if $confirmStore.open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="confirm-overlay"
    role="button"
    tabindex="0"
    onclick={() => confirmStore.reject()}
    onkeydown={onOverlayKeydown}
    transition:fade={{ duration: 140 }}
  >
    <section
      class="confirm-panel"
      role="dialog"
      aria-modal="true"
      aria-label={$confirmStore.title}
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.stopPropagation()}
      transition:scale={{ duration: 170, start: 0.96, easing: cubicOut }}
    >
      <h2>{$confirmStore.title}</h2>
      <p>{$confirmStore.message}</p>
      <div class="actions">
        <button type="button" class="secondary" onclick={() => confirmStore.reject()}>
          {$confirmStore.cancelText}
        </button>
        <button
          type="button"
          class:danger={$confirmStore.destructive}
          onclick={() => confirmStore.accept()}
        >
          {$confirmStore.confirmText}
        </button>
      </div>
    </section>
  </div>
{/if}

<style>
  .confirm-overlay {
    position: fixed;
    inset: 0;
    z-index: 240;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    display: grid;
    place-items: center;
    padding: 1rem;
  }

  .confirm-panel {
    width: min(520px, 100%);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(12, 12, 14, 0.9);
    padding: 1rem;
    display: grid;
    gap: 0.8rem;
  }

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  p {
    margin: 0;
    color: #c9cad3;
    line-height: 1.5;
    font-size: 0.95rem;
  }

  .actions {
    margin-top: 0.2rem;
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
  }

  button {
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    padding: 0.5rem 0.85rem;
    cursor: pointer;
    background: rgba(56, 102, 233, 0.56);
  }

  button.secondary {
    background: rgba(255, 255, 255, 0.08);
  }

  button.danger {
    background: rgba(230, 66, 91, 0.66);
    border-color: rgba(245, 140, 154, 0.6);
  }
</style>

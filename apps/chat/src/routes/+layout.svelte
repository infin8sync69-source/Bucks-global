<script lang="ts">
  import '../app.css';
  import ToastHost from '$lib/components/ToastHost.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { identityStore } from '$lib/stores/identity';
  import { nodeStore } from '$lib/stores/node';

  let { children } = $props();

  // Start IPFS node automatically when identity is unlocked
  $effect(() => {
    if ($identityStore.status === 'unlocked' && $nodeStore.status === 'stopped') {
      nodeStore.initNode();
    }
  });
</script>

<ToastHost />
<ConfirmDialog />

<div class="min-h-screen bg-[#0a0a0d] text-white font-sans antialiased overflow-x-hidden">
  {@render children()}
</div>

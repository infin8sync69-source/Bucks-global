<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { identityStore } from '$lib/stores/identity';

  onMount(async () => {
    await identityStore.loadInitialState();
    if ($identityStore.status === 'unlocked') {
      goto('/messages');
    } else {
      goto('/login');
    }
  });
</script>

<div class="min-h-screen grid place-items-center">
  <p class="text-white/40 text-sm">Loading...</p>
</div>

<script lang="ts">
    import '../app.css';
    import SwarmCanvas from '$lib/SwarmCanvas.svelte';
    import ToastHost from '$lib/components/ToastHost.svelte';
    import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
    import "$lib/ipfs/node";
    
    let { children } = $props();
</script>

<SwarmCanvas />
<ToastHost />
<ConfirmDialog />

<div class="min-h-screen bg-transparent text-white font-sans antialiased overflow-x-hidden">
    {@render children()}
</div>

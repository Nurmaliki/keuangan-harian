<script lang="ts">
  import '../styles.css';
  import AppShell from '$lib/components/AppShell.svelte';
  import { onMount } from 'svelte';
  import { initTheme } from '$lib/stores/theme';
  import { seedDatabase } from '$lib/db/database';
  let { children } = $props();
  onMount(async () => { initTheme(); await seedDatabase(); });
</script>
<svelte:head><title>Keuangan Harian</title><meta name="description" content="Aplikasi pencatatan keuangan local-first" /></svelte:head>
<AppShell>{@render children()}</AppShell>

<script lang="ts">
  import { Home, ReceiptText, ScanLine, BarChart3, Settings, Plus, Moon, Sun } from 'lucide-svelte';
  import { page } from '$app/stores';
  import { setTheme } from '$lib/stores/theme';
  import { onMount } from 'svelte';
  let { children } = $props();
  let online = $state(true);
  let installEvent = $state<BeforeInstallPromptEvent | null>(null);
  let updateReady = $state(false);
  let waitingWorker = $state<ServiceWorker | null>(null);
  const menus = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/transaksi', label: 'Transaksi', icon: ReceiptText },
    { href: '/scan', label: 'Scan OCR', icon: ScanLine },
    { href: '/laporan', label: 'Laporan', icon: BarChart3 },
    { href: '/pengaturan', label: 'Pengaturan', icon: Settings }
  ];
  function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'dark' ? 'light' : 'dark');
  }
  async function installApp() { await installEvent?.prompt(); installEvent = null; }
  function applyUpdate() { waitingWorker?.postMessage('SKIP_WAITING'); }
  onMount(() => {
    online = navigator.onLine;
    const updateOnline = () => online = navigator.onLine;
    const captureInstall = (event: Event) => { event.preventDefault(); installEvent = event as BeforeInstallPromptEvent; };
    window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline); window.addEventListener('beforeinstallprompt', captureInstall);
    const reload = () => location.reload();
    navigator.serviceWorker?.addEventListener('controllerchange', reload);
    navigator.serviceWorker?.ready.then((registration) => { waitingWorker = registration.waiting; updateReady = Boolean(waitingWorker); registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', () => { waitingWorker = registration.waiting; updateReady = Boolean(waitingWorker); })); });
    return () => { window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); window.removeEventListener('beforeinstallprompt', captureInstall); navigator.serviceWorker?.removeEventListener('controllerchange', reload); };
  });
</script>

<div class="shell">
  <aside class="sidebar">
    <div class="brand">💰 <span>Keuangan Harian</span></div>
    <nav>
      {#each menus as item}
        <a class:active={$page.url.pathname === item.href} href={item.href}>
          <item.icon size={19} /> <span>{item.label}</span>
        </a>
      {/each}
    </nav>
    <button class="theme-btn" onclick={toggleTheme}><Sun size={18}/><Moon size={18}/><span>Ganti Tema</span></button>
  </aside>
  <main>
    <header class="topbar">
      <div><strong>Keuangan Harian</strong><small>Local-first • data tersimpan di perangkat</small></div>
      <a class="primary compact" href="/transaksi?new=1"><Plus size={18}/> Tambah</a>
    </header>
    {#if !online}<div class="offline-banner">Anda sedang offline — data lokal tetap dapat digunakan.</div>{/if}
    {#if updateReady}<button class="update-banner" onclick={applyUpdate}>Versi baru tersedia. Muat ulang</button>{/if}
    {#if installEvent}<button class="install-banner" onclick={installApp}>Instal aplikasi di perangkat</button>{/if}
    <div class="content">{@render children()}</div>
  </main>
  <nav class="bottom-nav">
    {#each menus.slice(0,4) as item}
      <a class:active={$page.url.pathname === item.href} href={item.href}><item.icon size={20}/><span>{item.label}</span></a>
    {/each}
  </nav>
</div>

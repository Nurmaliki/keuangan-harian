<script lang="ts">
  import { Home, ReceiptText, ScanLine, BarChart3, Settings, Plus, Moon, Sun, WalletCards, CloudOff } from 'lucide-svelte';
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
    <div class="brand"><span class="brand-mark"><WalletCards size={21}/></span><span>Dompet<span class="brand-accent">Ku</span></span></div>
    <div class="nav-label">MENU UTAMA</div>
    <nav>
      {#each menus as item}
        <a class:active={$page.url.pathname === item.href} href={item.href}>
          <item.icon size={19} /> <span>{item.label}</span>
        </a>
      {/each}
    </nav>
    <div class="sidebar-foot">
      <div class="privacy-note"><CloudOff size={17}/><span>Data tersimpan aman<br/>di perangkat Anda</span></div>
      <button class="theme-btn" onclick={toggleTheme}><Sun size={18}/><Moon size={18}/><span>Ganti Tema</span></button>
    </div>
  </aside>
  <main>
    <header class="topbar">
      <div class="topbar-copy"><strong>Keuangan Harian</strong><small>Kelola uang dengan lebih cerdas</small></div>
      <a class="mobile-brand" href="/" aria-label="DompetKu, kembali ke dashboard">
        <span class="brand-mark"><WalletCards size={21}/></span>
        <span>Dompet<span class="brand-accent">Ku</span></span>
      </a>
      <a class="primary compact" href="/transaksi?new=1"><Plus size={18}/> Tambah transaksi</a>
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

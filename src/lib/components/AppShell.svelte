<script lang="ts">
  import { Home, ReceiptText, ScanLine, BarChart3, Settings, Plus, Moon, Sun } from 'lucide-svelte';
  import { page } from '$app/stores';
  import { setTheme } from '$lib/stores/theme';
  let { children } = $props();
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
    <div class="content">{@render children()}</div>
  </main>
  <nav class="bottom-nav">
    {#each menus.slice(0,4) as item}
      <a class:active={$page.url.pathname === item.href} href={item.href}><item.icon size={20}/><span>{item.label}</span></a>
    {/each}
  </nav>
</div>

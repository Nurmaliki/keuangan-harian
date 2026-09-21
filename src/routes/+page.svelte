<script lang="ts">
  import { onMount } from 'svelte';
  import { liveQuery } from 'dexie';
  import { db } from '$lib/db/database';
  import type { Account, Budget, Category, Transaction } from '$lib/db/types';
  import { calculateAccountBalances, summarizeTransactions } from '$lib/services/finance';
  import { rupiah, formatDate } from '$lib/utils/format';
  import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, ReceiptText, ChevronRight, Plus, ShieldCheck } from 'lucide-svelte';
  let summary = { income: 0, expense: 0, balance: 0, count: 0 };
  let latest: any[] = [];
  let categoryRows: {name:string,total:number,pct:number}[] = [];
  let budgetAlerts: {name:string,spent:number,limit:number,pct:number}[] = [];

  function updateDashboard(txs: Transaction[], accounts: Account[], cats: Category[], budgets: Budget[]) {
    const totalsSummary = summarizeTransactions(txs);
    summary = { income: totalsSummary.income, expense: totalsSummary.expense, balance: [...calculateAccountBalances(accounts, txs).values()].reduce((sum, value) => sum + value, 0), count: txs.length };
    latest = [...txs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const expenses = txs.filter((tx) => tx.type === 'expense');
    const totals = new Map<string,number>();
    expenses.forEach(x => totals.set(x.categoryId || '', (totals.get(x.categoryId || '') || 0) + x.amount));
    const max = Math.max(...totals.values(),1);
    categoryRows = cats.filter(c => c.type==='expense').map(c => ({name:`${c.icon||''} ${c.name}`, total:totals.get(c.id)||0, pct:((totals.get(c.id)||0)/max)*100})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total).slice(0,6);
    const month = new Date().toISOString().slice(0, 7);
    budgetAlerts = budgets.filter((budget) => budget.month === month).map((budget) => { const spent = expenses.filter((tx) => tx.categoryId === budget.categoryId && tx.date.slice(0, 7) === month).reduce((sum, tx) => sum + tx.amount, 0); return { name: cats.find((cat) => cat.id === budget.categoryId)?.name || '-', spent, limit: budget.limit, pct: Math.round(spent / budget.limit * 100) }; }).filter((row) => row.pct >= 80).sort((a, b) => b.pct - a.pct);
    if ('Notification' in window && Notification.permission === 'granted') for (const alert of budgetAlerts) { const key = `budget-alert:${month}:${alert.name}:${alert.pct >= 100 ? 100 : 80}`; if (!localStorage.getItem(key)) { new Notification(`Anggaran ${alert.name}`, { body: `${alert.pct}% anggaran telah terpakai.` }); localStorage.setItem(key, 'sent'); } }
  }
  onMount(() => { const subscription = liveQuery(() => Promise.all([db.transactions.toArray(), db.accounts.toArray(), db.categories.toArray(), db.budgets.toArray()])).subscribe(([txs, accounts, cats, budgets]) => updateDashboard(txs, accounts, cats, budgets)); return () => subscription.unsubscribe(); });
</script>

<section class="dashboard-hero"><div><div class="eyebrow"><ShieldCheck size={14}/> Ringkasan keuangan pribadi</div><h1>Selamat datang kembali 👋</h1><p>Ini ringkasan kondisi keuangan Anda hari ini.</p></div><a class="primary hero-action" href="/transaksi?new=1"><Plus size={18}/> Catat transaksi</a></section>
<div class="grid cards">
  <div class="card metric-card balance-card"><div class="metric-top"><span class="metric-icon"><Wallet size={20}/></span><span class="metric-badge">Saat ini</span></div><div class="metric-label">Saldo Bersih</div><div class="metric">{rupiah(summary.balance)}</div><div class="metric-foot">Total saldo seluruh akun</div></div>
  <div class="card metric-card"><div class="metric-top"><span class="metric-icon income-icon"><TrendingUp size={20}/></span><span class="trend good"><ArrowUpRight size={14}/> Masuk</span></div><div class="metric-label">Total Pemasukan</div><div class="metric good">{rupiah(summary.income)}</div><div class="metric-foot">Akumulasi seluruh transaksi</div></div>
  <div class="card metric-card"><div class="metric-top"><span class="metric-icon expense-icon"><TrendingDown size={20}/></span><span class="trend danger"><ArrowDownRight size={14}/> Keluar</span></div><div class="metric-label">Total Pengeluaran</div><div class="metric danger">{rupiah(summary.expense)}</div><div class="metric-foot">Akumulasi seluruh transaksi</div></div>
  <div class="card metric-card"><div class="metric-top"><span class="metric-icon transaction-icon"><ReceiptText size={20}/></span><span class="metric-badge">Aktivitas</span></div><div class="metric-label">Jumlah Transaksi</div><div class="metric">{summary.count}</div><div class="metric-foot">Transaksi yang tercatat</div></div>
</div>
{#if budgetAlerts.length}<div class="card budget-alerts"><h3>Peringatan Anggaran</h3>{#each budgetAlerts as alert}<div class="notice" class:danger-notice={alert.pct >= 100}><strong>{alert.name}</strong>: {alert.pct}% terpakai ({rupiah(alert.spent)} dari {rupiah(alert.limit)})</div>{/each}</div>{/if}

<div class="grid two-col" style="margin-top:18px">
  <div class="card dashboard-panel">
    <div class="panel-heading"><div><h3>Transaksi Terbaru</h3><p>Aktivitas keuangan terakhir Anda</p></div><a href="/transaksi">Lihat semua <ChevronRight size={16}/></a></div>
    {#if latest.length}
      <div class="table-wrap"><table class="table responsive-table"><thead><tr><th>Tanggal</th><th>Merchant</th><th>Jenis</th><th>Nominal</th></tr></thead><tbody>
      {#each latest as tx}<tr><td data-label="Tanggal">{formatDate(tx.date)}</td><td data-label="Merchant">{tx.merchant || '-'}</td><td data-label="Jenis"><span class="pill">{tx.type}</span></td><td data-label="Nominal" class:danger={tx.type==='expense'} class:good={tx.type==='income'}>{tx.type==='expense' ? '-' : '+'}{rupiah(tx.amount)}</td></tr>{/each}
      </tbody></table></div>
    {:else}<div class="empty"><span class="empty-icon"><ReceiptText size={25}/></span><strong>Belum ada transaksi</strong><span>Mulai catat pemasukan atau pengeluaran Anda.</span><a class="primary compact" href="/transaksi?new=1"><Plus size={16}/> Tambah transaksi</a></div>{/if}
  </div>
  <div class="card dashboard-panel"><div class="panel-heading"><div><h3>Pengeluaran per Kategori</h3><p>Distribusi pengeluaran terbesar</p></div></div>{#if categoryRows.length}{#each categoryRows as row}<div class="category-row"><div><span>{row.name}</span><strong>{rupiah(row.total)}</strong></div><div class="bar"><span style={`width:${row.pct}%`}></span></div></div>{/each}{:else}<div class="empty"><span class="empty-icon"><TrendingDown size={25}/></span><strong>Belum ada pengeluaran</strong><span>Data kategori akan tampil di sini.</span></div>{/if}</div>
</div>

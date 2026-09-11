<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db/database';
  import { dashboardSummary } from '$lib/services/finance';
  import { rupiah, formatDate } from '$lib/utils/format';
  let summary = { income: 0, expense: 0, balance: 0, count: 0 };
  let latest: any[] = [];
  let categoryRows: {name:string,total:number,pct:number}[] = [];

  async function load() {
    summary = await dashboardSummary();
    latest = await db.transactions.orderBy('date').reverse().limit(8).toArray();
    const cats = await db.categories.toArray();
    const expenses = await db.transactions.where('type').equals('expense').toArray();
    const totals = new Map<string,number>();
    expenses.forEach(x => totals.set(x.categoryId || '', (totals.get(x.categoryId || '') || 0) + x.amount));
    const max = Math.max(...totals.values(),1);
    categoryRows = cats.filter(c => c.type==='expense').map(c => ({name:`${c.icon||''} ${c.name}`, total:totals.get(c.id)||0, pct:((totals.get(c.id)||0)/max)*100})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total).slice(0,6);
  }
  onMount(load);
</script>

<div class="page-title"><div><h1>Dashboard</h1><div class="muted">Ringkasan kondisi keuangan Anda</div></div></div>
<div class="grid cards">
  <div class="card"><div class="metric-label">Saldo Bersih</div><div class="metric">{rupiah(summary.balance)}</div></div>
  <div class="card"><div class="metric-label">Total Pemasukan</div><div class="metric good">{rupiah(summary.income)}</div></div>
  <div class="card"><div class="metric-label">Total Pengeluaran</div><div class="metric danger">{rupiah(summary.expense)}</div></div>
  <div class="card"><div class="metric-label">Jumlah Transaksi</div><div class="metric">{summary.count}</div></div>
</div>

<div class="grid two-col" style="margin-top:18px">
  <div class="card">
    <h3>Transaksi Terbaru</h3>
    {#if latest.length}
      <div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Merchant</th><th>Jenis</th><th>Nominal</th></tr></thead><tbody>
      {#each latest as tx}<tr><td>{formatDate(tx.date)}</td><td>{tx.merchant || '-'}</td><td><span class="pill">{tx.type}</span></td><td class:danger={tx.type==='expense'} class:good={tx.type==='income'}>{tx.type==='expense' ? '-' : '+'}{rupiah(tx.amount)}</td></tr>{/each}
      </tbody></table></div>
    {:else}<div class="empty">Belum ada transaksi. Tambahkan transaksi pertama Anda.</div>{/if}
  </div>
  <div class="card"><h3>Pengeluaran per Kategori</h3>{#if categoryRows.length}{#each categoryRows as row}<div style="margin:16px 0"><div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:7px"><span>{row.name}</span><strong>{rupiah(row.total)}</strong></div><div class="bar"><span style={`width:${row.pct}%`}></span></div></div>{/each}{:else}<div class="empty">Belum ada data pengeluaran.</div>{/if}</div>
</div>

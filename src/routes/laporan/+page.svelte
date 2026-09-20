<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db/database';
  import type { Category, Transaction } from '$lib/db/types';
  import { summarizeTransactions } from '$lib/services/finance';
  import { rupiah } from '$lib/utils/format';
  import { exportCSV, exportExcel, exportJSON } from '$lib/services/export';
  let transactions: Transaction[] = [], categories: Category[] = [], period = 'month', from = '', to = '';
  function bounds(offset = 0) { const now = new Date(); let start: Date, end: Date; if (period === 'week') { const day = (now.getDay() + 6) % 7; start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + offset * 7); end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7); } else if (period === 'year') { start = new Date(now.getFullYear() + offset, 0, 1); end = new Date(now.getFullYear() + offset + 1, 0, 1); } else if (period === 'custom') { start = new Date(`${from}T00:00:00`); end = new Date(`${to}T23:59:59.999`); if (offset) { const duration = end.getTime() - start.getTime(); end = new Date(start.getTime()); start = new Date(start.getTime() - duration); } } else { start = new Date(now.getFullYear(), now.getMonth() + offset, 1); end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1); } return { start, end }; }
  function inPeriod(tx: Transaction, offset = 0) { const { start, end } = bounds(offset); const date = new Date(tx.date); return date >= start && date < end; }
  $: filtered = transactions.filter((tx) => period !== 'custom' || (from && to) ? inPeriod(tx) : false);
  $: current = summarizeTransactions(filtered);
  $: previous = summarizeTransactions(transactions.filter((tx) => inPeriod(tx, -1)));
  function aggregate(txs: Transaction[]) {
    const byCategory = new Map<string, { total: number; count: number }>();
    const byMerchant = new Map<string, number>();
    const byDay = new Map<string, { date: string; income: number; expense: number }>();
    for (const tx of txs) {
      const day = tx.date.slice(0, 10);
      const daily = byDay.get(day) || { date: day, income: 0, expense: 0 };
      if (tx.type === 'income' || tx.type === 'expense') daily[tx.type] += tx.amount;
      byDay.set(day, daily);
      if (tx.type !== 'expense') continue;
      if (tx.categoryId) { const row = byCategory.get(tx.categoryId) || { total: 0, count: 0 }; row.total += tx.amount; row.count++; byCategory.set(tx.categoryId, row); }
      if (tx.merchant) byMerchant.set(tx.merchant, (byMerchant.get(tx.merchant) || 0) + tx.amount);
    }
    return { byCategory, byMerchant, dailyRows: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14) };
  }
  $: aggregateResult = aggregate(filtered);
  $: rows = categories.filter((category) => category.type === 'expense').map((category) => ({ name: `${category.icon || ''} ${category.name}`, ...(aggregateResult.byCategory.get(category.id) || { total: 0, count: 0 }) })).filter((row) => row.count).sort((a, b) => b.total - a.total);
  $: merchants = [...aggregateResult.byMerchant].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5);
  $: maxCategory = Math.max(1, ...rows.map((row) => row.total));
  $: dailyRows = aggregateResult.dailyRows;
  $: maxDaily = Math.max(1, ...dailyRows.flatMap((row) => [row.income, row.expense]));
  $: expenseChange = previous.expense ? ((current.expense - previous.expense) / previous.expense) * 100 : 0;
  onMount(() => { const load = async () => { [transactions, categories] = await Promise.all([db.transactions.toArray(), db.categories.toArray()]); }; load(); window.addEventListener('finance-data-updated', load); return () => window.removeEventListener('finance-data-updated', load); });
</script>
<div class="page-title"><div><h1>Laporan & Export</h1><div class="muted">Analisis berdasarkan periode yang Anda pilih</div></div></div>
<div class="card report-filter"><div class="field"><label for="period">Periode</label><select id="period" bind:value={period}><option value="week">Minggu ini</option><option value="month">Bulan ini</option><option value="year">Tahun ini</option><option value="custom">Rentang tanggal</option></select></div>{#if period === 'custom'}<div class="field"><label for="from">Dari</label><input id="from" type="date" bind:value={from}/></div><div class="field"><label for="to">Sampai</label><input id="to" type="date" bind:value={to}/></div>{/if}</div>
<div class="grid cards report-cards"><div class="card"><div class="metric-label">Pemasukan</div><div class="metric good">{rupiah(current.income)}</div></div><div class="card"><div class="metric-label">Pengeluaran</div><div class="metric danger">{rupiah(current.expense)}</div><small class="muted">{expenseChange >= 0 ? '+' : ''}{expenseChange.toFixed(0)}% dari periode lalu</small></div><div class="card"><div class="metric-label">Saldo</div><div class="metric">{rupiah(current.balance)}</div></div><div class="card"><div class="metric-label">Saving Rate</div><div class="metric">{Math.round(current.savingRate)}%</div></div></div>
<div class="grid two-col report-grid"><div class="card"><h3>Pengeluaran per Kategori</h3>{#each rows as row}<div class="chart-row"><div><span>{row.name}</span><strong>{rupiah(row.total)}</strong></div><div class="bar"><span style={`width:${row.total / maxCategory * 100}%`}></span></div></div>{/each}{#if !rows.length}<div class="empty">Belum ada data pada periode ini.</div>{/if}</div><div class="card"><h3>Merchant Terbesar</h3><ol>{#each merchants as merchant}<li><span>{merchant.name}</span><strong>{rupiah(merchant.total)}</strong></li>{/each}</ol>{#if !merchants.length}<div class="empty">Belum ada data merchant.</div>{/if}</div></div>
<div class="card report-grid"><h3>Tren Harian (maksimal 14 hari aktif terakhir)</h3><div class="daily-chart">{#each dailyRows as row}<div class="daily-column" title={`${row.date}: masuk ${rupiah(row.income)}, keluar ${rupiah(row.expense)}`}><div class="daily-bars"><span class="income-bar" style={`height:${row.income/maxDaily*100}%`}></span><span class="expense-bar" style={`height:${row.expense/maxDaily*100}%`}></span></div><small>{row.date.slice(5)}</small></div>{/each}</div>{#if !dailyRows.length}<div class="empty">Belum ada tren untuk ditampilkan.</div>{/if}<div class="legend"><span class="good">● Pemasukan</span><span class="danger">● Pengeluaran</span></div></div>
<div class="card report-export"><h3>Export & Backup</h3><p class="muted">Excel dan CSV untuk analisis; JSON merupakan backup lengkap seluruh database.</p><div class="actions"><button class="primary" onclick={exportExcel}>Export Excel</button><button class="secondary" onclick={exportCSV}>Export CSV</button><button class="secondary" onclick={() => exportJSON()}>Backup JSON</button></div></div>

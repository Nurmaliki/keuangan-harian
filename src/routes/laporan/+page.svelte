<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db/database';
  import { rupiah } from '$lib/utils/format';
  import { exportCSV, exportExcel, exportJSON } from '$lib/services/export';
  let rows:{name:string,total:number,count:number}[]=[];let income=0;let expense=0;
  onMount(async()=>{const txs=await db.transactions.toArray();const cats=await db.categories.toArray();income=txs.filter(x=>x.type==='income').reduce((a,b)=>a+b.amount,0);expense=txs.filter(x=>x.type==='expense').reduce((a,b)=>a+b.amount,0);rows=cats.filter(c=>c.type==='expense').map(c=>{const list=txs.filter(t=>t.categoryId===c.id&&t.type==='expense');return{name:`${c.icon||''} ${c.name}`,total:list.reduce((a,b)=>a+b.amount,0),count:list.length}}).filter(x=>x.count).sort((a,b)=>b.total-a.total);});
</script>
<div class="page-title"><div><h1>Laporan & Export</h1><div class="muted">Analisis sederhana dan keluarkan data kapan saja</div></div></div>
<div class="grid cards"><div class="card"><div class="metric-label">Pemasukan</div><div class="metric good">{rupiah(income)}</div></div><div class="card"><div class="metric-label">Pengeluaran</div><div class="metric danger">{rupiah(expense)}</div></div><div class="card"><div class="metric-label">Saldo</div><div class="metric">{rupiah(income-expense)}</div></div><div class="card"><div class="metric-label">Saving Rate</div><div class="metric">{income?Math.round(((income-expense)/income)*100):0}%</div></div></div>
<div class="grid two-col" style="margin-top:18px"><div class="card"><h3>Pengeluaran per Kategori</h3><div class="table-wrap"><table class="table"><thead><tr><th>Kategori</th><th>Transaksi</th><th>Total</th></tr></thead><tbody>{#each rows as r}<tr><td>{r.name}</td><td>{r.count}</td><td>{rupiah(r.total)}</td></tr>{/each}</tbody></table></div></div><div class="card"><h3>Export Data</h3><p class="muted">Excel untuk analisis, CSV untuk interoperabilitas, JSON untuk backup lengkap.</p><div class="actions"><button class="primary" onclick={exportExcel}>Export Excel</button><button class="secondary" onclick={exportCSV}>Export CSV</button><button class="secondary" onclick={exportJSON}>Backup JSON</button></div></div></div>

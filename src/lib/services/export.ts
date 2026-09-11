import { db } from '$lib/db/database';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportJSON() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: await db.transactions.toArray(),
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    budgets: await db.budgets.toArray(),
    settings: await db.settings.toArray()
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `backup-keuangan-${Date.now()}.json`);
}

export async function exportCSV() {
  const txs = await db.transactions.toArray();
  const accounts = await db.accounts.toArray();
  const categories = await db.categories.toArray();
  const accountMap = new Map(accounts.map((x) => [x.id, x.name]));
  const categoryMap = new Map(categories.map((x) => [x.id, x.name]));
  const rows = [
    ['Tanggal','Jenis','Nominal','Akun','Kategori','Merchant','Catatan','Sumber'],
    ...txs.map((x) => [x.date,x.type,String(x.amount),accountMap.get(x.accountId) || '',categoryMap.get(x.categoryId || '') || '',x.merchant || '',x.notes || '',x.source])
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `transaksi-${Date.now()}.csv`);
}

export async function exportExcel() {
  const XLSX = await import('xlsx');
  const txs = await db.transactions.toArray();
  const accounts = await db.accounts.toArray();
  const categories = await db.categories.toArray();
  const accountMap = new Map(accounts.map((x) => [x.id, x.name]));
  const categoryMap = new Map(categories.map((x) => [x.id, x.name]));
  const data = txs.map((x) => ({
    Tanggal: x.date,
    Jenis: x.type,
    Nominal: x.amount,
    Akun: accountMap.get(x.accountId) || '',
    Kategori: categoryMap.get(x.categoryId || '') || '',
    Merchant: x.merchant || '',
    Catatan: x.notes || '',
    Sumber: x.source
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
  XLSX.writeFile(wb, `transaksi-${Date.now()}.xlsx`);
}

export async function restoreBackup(file: File) {
  const parsed = JSON.parse(await file.text());
  if (!parsed || parsed.version !== 1) throw new Error('Format backup tidak dikenali.');
  await db.transaction('rw', [db.transactions, db.accounts, db.categories, db.budgets, db.settings], async () => {
    await Promise.all([db.transactions.clear(), db.accounts.clear(), db.categories.clear(), db.budgets.clear(), db.settings.clear()]);
    if (parsed.transactions?.length) await db.transactions.bulkAdd(parsed.transactions);
    if (parsed.accounts?.length) await db.accounts.bulkAdd(parsed.accounts);
    if (parsed.categories?.length) await db.categories.bulkAdd(parsed.categories);
    if (parsed.budgets?.length) await db.budgets.bulkAdd(parsed.budgets);
    if (parsed.settings?.length) await db.settings.bulkAdd(parsed.settings);
  });
}

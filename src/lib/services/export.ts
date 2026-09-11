import { db } from '$lib/db/database';
import type { BackupPayload } from '$lib/db/types';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createBackupPayload(): Promise<BackupPayload> {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    transactions: await db.transactions.toArray(),
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    budgets: await db.budgets.toArray(),
    settings: await db.settings.toArray()
  };
}

export async function exportJSON(prefix = 'backup-keuangan') {
  const payload = await createBackupPayload();
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `${prefix}-${Date.now()}.json`);
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

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }

export async function inspectBackup(file: File) {
  const parsed: unknown = JSON.parse(await file.text());
  if (!isRecord(parsed) || ![1, 2].includes(Number(parsed.version))) throw new Error('Format backup tidak dikenali.');
  for (const key of ['transactions', 'accounts', 'categories', 'budgets', 'settings']) if (!Array.isArray(parsed[key])) throw new Error(`Data ${key} pada backup tidak valid.`);
  const transactions = parsed.transactions as unknown[];
  if (transactions.some((item) => !isRecord(item) || typeof item.id !== 'string' || !['income', 'expense', 'transfer'].includes(String(item.type)) || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0)) throw new Error('Backup berisi transaksi yang tidak valid.');
  return parsed as unknown as BackupPayload;
}

export async function restoreBackup(file: File, mode: 'replace' | 'merge' = 'replace') {
  const parsed = await inspectBackup(file);
  await db.transaction('rw', [db.transactions, db.accounts, db.categories, db.budgets, db.settings], async () => {
    if (mode === 'replace') await Promise.all([db.transactions.clear(), db.accounts.clear(), db.categories.clear(), db.budgets.clear(), db.settings.clear()]);
    if (parsed.transactions?.length) await db.transactions.bulkPut(parsed.transactions);
    if (parsed.accounts?.length) await db.accounts.bulkPut(parsed.accounts);
    if (parsed.categories?.length) await db.categories.bulkPut(parsed.categories);
    if (parsed.budgets?.length) await db.budgets.bulkPut(parsed.budgets);
    if (parsed.settings?.length) await db.settings.bulkPut(parsed.settings);
  });
}

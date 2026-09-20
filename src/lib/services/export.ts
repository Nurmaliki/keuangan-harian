import { db } from '$lib/db/database';
import type { BackupPayload, SerializedBackup, Transaction } from '$lib/db/types';
import { validateTransactionReferences } from './finance';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Foto struk gagal dibaca.'));
    reader.readAsDataURL(blob);
  });
}

async function serializeBackup(payload: BackupPayload): Promise<SerializedBackup> {
  const transactions = await Promise.all(payload.transactions.map(async ({ receiptImage, ...tx }) => ({
    ...tx,
    ...(receiptImage instanceof Blob ? { receiptImage: await blobToDataUrl(receiptImage) } : {})
  })));
  return { ...payload, version: 4, transactions };
}

function dataUrlToBlob(value: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
  if (!match || !match[2]) throw new Error('Format foto struk pada backup tidak valid.');
  try {
    const bytes = Uint8Array.from(atob(match[3]), (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: match[1] || 'application/octet-stream' });
  } catch {
    throw new Error('Data foto struk pada backup rusak.');
  }
}

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
    settings: await db.settings.toArray(),
    recurringRules: await db.recurringRules.toArray()
  };
}

export async function exportJSON(prefix = 'backup-keuangan') {
  const payload = await serializeBackup(await createBackupPayload());
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
  if (!isRecord(parsed) || ![1, 2, 3, 4].includes(Number(parsed.version))) throw new Error('Format backup tidak dikenali.');
  for (const key of ['transactions', 'accounts', 'categories', 'budgets', 'settings']) if (!Array.isArray(parsed[key])) throw new Error(`Data ${key} pada backup tidak valid.`);
  const backup = parsed as unknown as BackupPayload;
  if (parsed.version === 4 && !Array.isArray(backup.recurringRules)) throw new Error('Aturan berulang pada backup tidak valid.');
  if (backup.accounts.some((item) => !isRecord(item) || typeof item.id !== 'string') || backup.categories.some((item) => !isRecord(item) || typeof item.id !== 'string' || !['income', 'expense'].includes(String(item.type)))) throw new Error('Akun atau kategori pada backup tidak valid.');
  const transactions: Transaction[] = backup.transactions.map((item) => {
    if (!isRecord(item) || typeof item.id !== 'string') throw new Error('Backup berisi transaksi yang tidak valid.');
    const tx = { ...item } as unknown as Transaction;
    if ((parsed.version === 3 || parsed.version === 4) && tx.receiptImage !== undefined) {
      if (typeof tx.receiptImage !== 'string') throw new Error('Format foto struk pada backup tidak valid.');
      tx.receiptImage = dataUrlToBlob(tx.receiptImage);
    } else if (tx.receiptImage !== undefined) {
      // Backup lama menyimpan Blob sebagai objek kosong; jangan masukkan objek itu ke IndexedDB.
      delete tx.receiptImage;
    }
    try { validateTransactionReferences(tx, backup.accounts, backup.categories); }
    catch (error) { throw new Error(`Transaksi ${tx.id}: ${(error as Error).message}`); }
    return tx;
  });
  for (const rule of backup.recurringRules || []) {
    if (!isRecord(rule) || typeof rule.id !== 'string' || typeof rule.nextDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rule.nextDate) || !Number.isInteger(rule.day) || rule.day < 1 || rule.day > 31) throw new Error('Aturan berulang pada backup tidak valid.');
    validateTransactionReferences({ type: rule.type, amount: rule.amount, date: rule.nextDate, accountId: rule.accountId, categoryId: rule.categoryId, source: 'manual' }, backup.accounts, backup.categories);
  }
  return { ...backup, transactions };
}

export async function restoreBackup(file: File, mode: 'replace' | 'merge' = 'replace') {
  const parsed = await inspectBackup(file);
  await db.transaction('rw', [db.transactions, db.accounts, db.categories, db.budgets, db.settings, db.recurringRules], async () => {
    if (mode === 'replace') await Promise.all([db.transactions.clear(), db.accounts.clear(), db.categories.clear(), db.budgets.clear(), db.settings.clear(), db.recurringRules.clear()]);
    if (parsed.transactions?.length) await db.transactions.bulkPut(parsed.transactions);
    if (parsed.accounts?.length) await db.accounts.bulkPut(parsed.accounts);
    if (parsed.categories?.length) await db.categories.bulkPut(parsed.categories);
    if (parsed.budgets?.length) await db.budgets.bulkPut(parsed.budgets);
    if (parsed.settings?.length) await db.settings.bulkPut(parsed.settings);
    if (parsed.recurringRules?.length) await db.recurringRules.bulkPut(parsed.recurringRules);
  });
}

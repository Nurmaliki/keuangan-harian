import { db } from '$lib/db/database';
import type { BackupPayload, SerializedBackup, Transaction } from '$lib/db/types';
import { validateTransactionReferences } from './finance';

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

export async function serializeBackup(payload: BackupPayload): Promise<SerializedBackup> {
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
    version: 4,
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

function requireUnique<T>(items: T[], key: keyof T, label: string) {
  const ids = items.map((item) => item[key]);
  if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) throw new Error(`${label} pada backup memiliki ID kosong atau duplikat.`);
}

export async function inspectBackup(file: File) {
  const parsed: unknown = JSON.parse(await file.text());
  if (!isRecord(parsed) || ![1, 2, 3, 4].includes(Number(parsed.version))) throw new Error('Format backup tidak dikenali.');
  for (const key of ['transactions', 'accounts', 'categories', 'budgets', 'settings']) if (!Array.isArray(parsed[key])) throw new Error(`Data ${key} pada backup tidak valid.`);
  const backup = parsed as unknown as BackupPayload;
  if (parsed.version === 4 && !Array.isArray(backup.recurringRules)) throw new Error('Aturan berulang pada backup tidak valid.');
  if (backup.accounts.some((item) => !isRecord(item) || typeof item.name !== 'string' || !['cash', 'bank', 'ewallet', 'other'].includes(String(item.type)) || typeof item.initialBalance !== 'number' || !Number.isFinite(item.initialBalance) || typeof item.createdAt !== 'string') || backup.categories.some((item) => !isRecord(item) || typeof item.name !== 'string' || !['income', 'expense'].includes(String(item.type)))) throw new Error('Akun atau kategori pada backup tidak valid.');
  if (backup.budgets.some((item) => !isRecord(item) || typeof item.categoryId !== 'string' || typeof item.month !== 'string' || !/^\d{4}-\d{2}$/.test(item.month) || typeof item.limit !== 'number' || !Number.isFinite(item.limit) || item.limit <= 0 || !backup.categories.some((category) => category.id === item.categoryId && category.type === 'expense'))) throw new Error('Anggaran pada backup tidak valid.');
  if (backup.settings.some((item) => !isRecord(item) || typeof item.value !== 'string')) throw new Error('Pengaturan pada backup tidak valid.');
  requireUnique(backup.accounts, 'id', 'Akun');
  requireUnique(backup.categories, 'id', 'Kategori');
  requireUnique(backup.budgets, 'id', 'Anggaran');
  requireUnique(backup.settings, 'key', 'Pengaturan');
  if (new Set(backup.budgets.map((item) => `${item.categoryId}:${item.month}`)).size !== backup.budgets.length) throw new Error('Anggaran pada backup memiliki kategori dan bulan duplikat.');
  const transactions: Transaction[] = backup.transactions.map((item) => {
    if (!isRecord(item) || typeof item.id !== 'string') throw new Error('Backup berisi transaksi yang tidak valid.');
    const tx = { ...item } as unknown as Transaction;
    if (!['manual', 'ocr'].includes(String(tx.source)) || typeof tx.createdAt !== 'string' || typeof tx.updatedAt !== 'string' || (tx.merchant !== undefined && typeof tx.merchant !== 'string') || (tx.notes !== undefined && typeof tx.notes !== 'string')) throw new Error(`Transaksi ${tx.id}: metadata tidak valid.`);
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
  requireUnique(transactions, 'id', 'Transaksi');
  for (const rule of backup.recurringRules || []) {
    if (!isRecord(rule) || typeof rule.id !== 'string' || typeof rule.nextDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rule.nextDate) || !Number.isInteger(rule.day) || rule.day < 1 || rule.day > 31 || (rule.paused !== undefined && typeof rule.paused !== 'boolean')) throw new Error('Aturan berulang pada backup tidak valid.');
    validateTransactionReferences({ type: rule.type, amount: rule.amount, date: rule.nextDate, accountId: rule.accountId, categoryId: rule.categoryId, source: 'manual' }, backup.accounts, backup.categories);
  }
  requireUnique(backup.recurringRules || [], 'id', 'Aturan berulang');
  return { ...backup, transactions };
}

export async function restoreBackup(file: File, mode: 'replace' | 'merge' = 'replace') {
  const parsed = await inspectBackup(file);
  const skipped: Record<string, number> = {};
  await db.transaction('rw', [db.transactions, db.accounts, db.categories, db.budgets, db.settings, db.recurringRules], async () => {
    if (mode === 'replace') {
      await Promise.all([db.transactions.clear(), db.accounts.clear(), db.categories.clear(), db.budgets.clear(), db.settings.clear(), db.recurringRules.clear()]);
      await db.accounts.bulkPut(parsed.accounts);
      await db.categories.bulkPut(parsed.categories);
      await db.transactions.bulkPut(parsed.transactions);
      await db.budgets.bulkPut(parsed.budgets);
      await db.settings.bulkPut(parsed.settings);
      await db.recurringRules.bulkPut(parsed.recurringRules || []);
      return;
    }
    // Mode gabung mempertahankan data lokal saat ID sama, sehingga restore tidak menimpa edit pengguna.
    const merge = async <T extends { id: string }>(label: string, incoming: T[], get: (id: string) => Promise<T | undefined>, add: (items: T[]) => Promise<unknown>, rejectChanged = false) => {
      const existing = await Promise.all(incoming.map((item) => get(item.id)));
      if (rejectChanged) {
        const conflict = incoming.find((item, index) => existing[index] && JSON.stringify(existing[index]) !== JSON.stringify(item));
        if (conflict) throw new Error(`Konflik ${label} dengan ID ${conflict.id}. Gunakan mode ganti atau perbaiki backup.`);
      }
      const fresh = incoming.filter((_, index) => !existing[index]);
      skipped[label] = incoming.length - fresh.length;
      if (fresh.length) await add(fresh);
    };
    await merge('akun', parsed.accounts, (id) => db.accounts.get(id), (items) => db.accounts.bulkAdd(items), true);
    await merge('kategori', parsed.categories, (id) => db.categories.get(id), (items) => db.categories.bulkAdd(items), true);
    await merge('transaksi', parsed.transactions, (id) => db.transactions.get(id), (items) => db.transactions.bulkAdd(items));
    const existingBudgets = await db.budgets.toArray();
    const budgetKeys = new Set(existingBudgets.map((item) => `${item.categoryId}:${item.month}`));
    const freshBudgets = parsed.budgets.filter((item) => !budgetKeys.has(`${item.categoryId}:${item.month}`) && !existingBudgets.some((existing) => existing.id === item.id));
    skipped.anggaran = parsed.budgets.length - freshBudgets.length;
    if (freshBudgets.length) await db.budgets.bulkAdd(freshBudgets);
    const settings = await db.settings.bulkGet(parsed.settings.map((item) => item.key));
    const freshSettings = parsed.settings.filter((_, index) => !settings[index]);
    skipped.pengaturan = parsed.settings.length - freshSettings.length;
    if (freshSettings.length) await db.settings.bulkAdd(freshSettings);
    await merge('aturan', parsed.recurringRules || [], (id) => db.recurringRules.get(id), (items) => db.recurringRules.bulkAdd(items));
  });
  return { skipped };
}

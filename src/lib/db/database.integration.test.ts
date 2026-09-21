import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from './database';
import type { Account, Category, Transaction } from './types';
import { createBackupPayload, inspectBackup, restoreBackup, serializeBackup } from '$lib/services/export';
import { generateDueTransactions, skipRecurringOccurrence } from '$lib/services/recurring';
import { transactionPage } from '$lib/services/transactions';

const account: Account = { id: 'cash', name: 'Cash', type: 'cash', initialBalance: 0, createdAt: '2026-01-01' };
const category: Category = { id: 'food', name: 'Food', type: 'expense' };
const transaction = (id: string, date: string, amount = 1000): Transaction => ({ id, date, amount, type: 'expense', accountId: 'cash', categoryId: 'food', source: 'manual', createdAt: date, updatedAt: date });

describe('IndexedDB integration', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await db.accounts.add(account); await db.categories.add(category); });
  afterEach(async () => { db.close(); await db.delete(); });

  it('menyimpan dan memulihkan foto beserta aturan berulang', async () => {
    await db.transactions.add({ ...transaction('receipt', '2026-09-21T12:00:00.000Z'), receiptImage: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) });
    await db.recurringRules.add({ id: 'monthly', type: 'expense', amount: 1000, accountId: 'cash', categoryId: 'food', nextDate: '2026-10-01', day: 1 });
    const serialized = await serializeBackup(await createBackupPayload());
    expect(serialized.version).toBe(4);
    const file = new File([JSON.stringify(serialized)], 'backup.json');
    await db.transactions.clear(); await db.recurringRules.clear();
    await restoreBackup(file);
    const restored = await db.transactions.get('receipt');
    expect([...new Uint8Array(await restored!.receiptImage!.arrayBuffer())]).toEqual([1, 2, 3]);
    expect((await db.recurringRules.get('monthly'))?.day).toBe(1);
  });

  it('mode gabung mempertahankan transaksi lokal dengan ID sama', async () => {
    await db.transactions.add(transaction('same', '2026-09-21T12:00:00.000Z', 5000));
    const backup = await serializeBackup({ ...(await createBackupPayload()), transactions: [transaction('same', '2026-09-21T12:00:00.000Z', 1000)] });
    const result = await restoreBackup(new File([JSON.stringify(backup)], 'backup.json'), 'merge');
    expect((await db.transactions.get('same'))?.amount).toBe(5000);
    expect(result.skipped.transaksi).toBe(1);
  });

  it('jadwal dibuat sekali, dapat dijeda dan dilewati', async () => {
    await db.recurringRules.add({ id: 'monthly', type: 'expense', amount: 1000, accountId: 'cash', categoryId: 'food', nextDate: '2026-01-31', day: 31 });
    await generateDueTransactions(new Date(2026, 1, 28));
    await generateDueTransactions(new Date(2026, 1, 28));
    expect(await db.transactions.count()).toBe(2);
    expect((await db.recurringRules.get('monthly'))?.nextDate).toBe('2026-03-31');
    await skipRecurringOccurrence('monthly');
    expect((await db.recurringRules.get('monthly'))?.nextDate).toBe('2026-04-30');
    await db.recurringRules.update('monthly', { paused: true });
    await generateDueTransactions(new Date(2026, 4, 31));
    expect(await db.transactions.count()).toBe(2);
  });

  it('membaca satu halaman dengan filter tanggal dan jenis', async () => {
    await db.transactions.bulkAdd([transaction('a', '2026-09-20T12:00:00.000Z'), transaction('b', '2026-09-21T12:00:00.000Z')]);
    expect((await transactionPage({ type: 'expense', from: '2026-09-21', to: '2026-09-21' })).items.map((item) => item.id)).toEqual(['b']);
  });

  it('membaca halaman lanjut tanpa mengulang transaksi', async () => {
    await db.transactions.bulkAdd(Array.from({ length: 55 }, (_, index) => transaction(`tx-${index}`, new Date(Date.UTC(2026, 8, 1 + index, 12)).toISOString())));
    const first = await transactionPage({ type: 'all' });
    const second = await transactionPage({ type: 'all' }, first.nextCursor);
    expect(first.items).toHaveLength(50);
    expect(second.items).toHaveLength(5);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(55);
  });

  it('menolak konflik akun saat merge agar transaksi tidak berpindah makna', async () => {
    const payload = await serializeBackup({ ...(await createBackupPayload()), accounts: [{ ...account, name: 'Akun lain' }] });
    await expect(restoreBackup(new File([JSON.stringify(payload)], 'backup.json'), 'merge')).rejects.toThrow('Konflik akun');
    expect((await db.accounts.get('cash'))?.name).toBe('Cash');
  });

  it('migrasi skema lama mempertahankan transaksi', async () => {
    db.close(); await db.delete();
    const old = new Dexie('keuangan_harian_db');
    old.version(2).stores({ transactions: 'id, type, date, accountId, destinationAccountId, categoryId, merchant, source, createdAt', accounts: 'id, name, type', categories: 'id, name, type', budgets: 'id, categoryId, month, &[categoryId+month]', settings: 'key' });
    await old.open();
    await old.table('transactions').add(transaction('old', '2026-01-01T12:00:00.000Z'));
    old.close();
    await db.open();
    expect((await db.transactions.get('old'))?.amount).toBe(1000);
    expect(db.verno).toBe(4);
  });
});

describe('backup validation', () => {
  it('menolak anggaran dengan kategori hilang', async () => {
    const payload = { version: 4, exportedAt: '', accounts: [account], categories: [category], transactions: [], budgets: [{ id: 'budget', categoryId: 'missing', month: '2026-09', limit: 1000 }], settings: [], recurringRules: [] };
    await expect(inspectBackup(new File([JSON.stringify(payload)], 'bad.json'))).rejects.toThrow('Anggaran');
  });
});

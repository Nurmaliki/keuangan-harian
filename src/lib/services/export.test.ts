import { describe, expect, it } from 'vitest';
import { inspectBackup } from './export';

const backup = {
  version: 4, exportedAt: '',
  accounts: [{ id: 'cash', name: 'Cash', type: 'cash', initialBalance: 0, createdAt: '' }],
  categories: [{ id: 'food', name: 'Food', type: 'expense' }], budgets: [], settings: [], recurringRules: [],
  transactions: [{ id: 'one', type: 'expense', amount: 1000, date: '2026-09-21', accountId: 'cash', categoryId: 'food', source: 'manual', createdAt: '', updatedAt: '', receiptImage: 'data:image/png;base64,AQID' }]
};

describe('backup', () => {
  it('memulihkan foto struk sebagai Blob', async () => {
    const parsed = await inspectBackup(new File([JSON.stringify(backup)], 'backup.json'));
    expect(parsed.transactions[0].receiptImage).toBeInstanceOf(Blob);
    expect([...new Uint8Array(await parsed.transactions[0].receiptImage!.arrayBuffer())]).toEqual([1, 2, 3]);
  });
  it('menolak transaksi dengan kategori tidak dikenal', async () => {
    const invalid = { ...backup, transactions: [{ ...backup.transactions[0], categoryId: 'missing' }] };
    await expect(inspectBackup(new File([JSON.stringify(invalid)], 'backup.json'))).rejects.toThrow('Kategori');
  });
});

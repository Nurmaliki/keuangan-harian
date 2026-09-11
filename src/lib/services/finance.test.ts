import { describe, expect, it } from 'vitest';
import type { Account, Transaction, TransactionInput } from '$lib/db/types';
import { calculateAccountBalances, summarizeTransactions, validateTransaction } from './finance';

const base: TransactionInput = { type: 'expense', amount: 25_000, date: '2026-09-11T10:00:00.000Z', accountId: 'cash', categoryId: 'food', source: 'manual' };
const transaction = (input: Partial<Transaction>): Transaction => ({ ...base, id: crypto.randomUUID(), createdAt: '', updatedAt: '', ...input } as Transaction);

describe('finance domain', () => {
  it('mengabaikan transfer dari ringkasan pemasukan dan pengeluaran', () => {
    const result = summarizeTransactions([transaction({ type: 'income', amount: 100_000 }), transaction({ type: 'expense', amount: 40_000 }), transaction({ type: 'transfer', amount: 30_000 })]);
    expect(result).toMatchObject({ income: 100_000, expense: 40_000, balance: 60_000, savingRate: 60 });
  });
  it('memindahkan saldo antar akun', () => {
    const accounts: Account[] = [{ id: 'cash', name: 'Cash', type: 'cash', initialBalance: 100_000, createdAt: '' }, { id: 'bank', name: 'Bank', type: 'bank', initialBalance: 0, createdAt: '' }];
    const result = calculateAccountBalances(accounts, [transaction({ type: 'transfer', amount: 30_000, accountId: 'cash', destinationAccountId: 'bank', categoryId: undefined })]);
    expect(result.get('cash')).toBe(70_000); expect(result.get('bank')).toBe(30_000);
  });
  it('menolak transfer tanpa akun tujuan', () => { expect(() => validateTransaction({ ...base, type: 'transfer', categoryId: undefined })).toThrow('Akun tujuan'); });
  it('menolak nominal nol', () => { expect(() => validateTransaction({ ...base, amount: 0 })).toThrow('Nominal'); });
});

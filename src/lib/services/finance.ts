import { db } from '$lib/db/database';
import type { Account, Transaction, TransactionInput } from '$lib/db/types';

export function validateTransaction(data: TransactionInput) {
  if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) throw new Error('Nominal harus lebih dari 0.');
  if (!data.accountId) throw new Error('Akun wajib dipilih.');
  if (Number.isNaN(new Date(data.date).getTime())) throw new Error('Tanggal transaksi tidak valid.');
  if (data.type === 'transfer') {
    if (!data.destinationAccountId) throw new Error('Akun tujuan wajib dipilih.');
    if (data.destinationAccountId === data.accountId) throw new Error('Akun asal dan tujuan harus berbeda.');
  } else if (!data.categoryId) {
    throw new Error('Kategori wajib dipilih.');
  }
}

export async function getAllTransactions() {
  return db.transactions.orderBy('date').reverse().toArray();
}

export async function addTransaction(data: TransactionInput) {
  validateTransaction(data);
  const now = new Date().toISOString();
  const item: Transaction = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await db.transactions.add(item);
  return item;
}

export async function updateTransaction(id: string, data: TransactionInput) {
  validateTransaction(data);
  const current = await db.transactions.get(id);
  if (!current) throw new Error('Transaksi tidak ditemukan.');
  const item: Transaction = { ...data, id, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
  await db.transactions.put(item);
  return item;
}

export async function deleteTransaction(id: string) {
  await db.transactions.delete(id);
}

export async function dashboardSummary() {
  const txs = await db.transactions.toArray();
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.type === 'income') income += tx.amount;
    if (tx.type === 'expense') expense += tx.amount;
  }
  return { income, expense, balance: income - expense, count: txs.length };
}

export function summarizeTransactions(txs: Transaction[]) {
  const income = txs.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const expense = txs.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  return { income, expense, balance: income - expense, count: txs.length, savingRate: income ? ((income - expense) / income) * 100 : 0 };
}

export function calculateAccountBalances(accounts: Account[], txs: Transaction[]) {
  const balances = new Map(accounts.map((account) => [account.id, account.initialBalance]));
  for (const tx of txs) {
    const origin = balances.get(tx.accountId) ?? 0;
    if (tx.type === 'income') balances.set(tx.accountId, origin + tx.amount);
    else balances.set(tx.accountId, origin - tx.amount);
    if (tx.type === 'transfer' && tx.destinationAccountId) {
      balances.set(tx.destinationAccountId, (balances.get(tx.destinationAccountId) ?? 0) + tx.amount);
    }
  }
  return balances;
}

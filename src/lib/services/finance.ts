import { db } from '$lib/db/database';
import type { Account, Category, Transaction, TransactionInput } from '$lib/db/types';

/** Validasi data transaksi. */
export function validateTransaction(data: TransactionInput) {
  if (!['income', 'expense', 'transfer'].includes(data.type)) throw new Error('Jenis transaksi tidak valid.');
  if (typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0) throw new Error('Nominal harus lebih dari 0.');
  if (!data.accountId) throw new Error('Akun wajib dipilih.');
  if (!data.date || Number.isNaN(new Date(data.date).getTime())) throw new Error('Tanggal transaksi tidak valid.');
  if (data.type === 'transfer') {
    if (!data.destinationAccountId) throw new Error('Akun tujuan wajib dipilih.');
    if (data.destinationAccountId === data.accountId) throw new Error('Akun asal dan tujuan harus berbeda.');
  } else if (!data.categoryId) {
    throw new Error('Kategori wajib dipilih.');
  }
}

export function validateTransactionReferences(data: TransactionInput, accounts: Account[], categories: Category[]) {
  validateTransaction(data);
  if (!accounts.some((account) => account.id === data.accountId)) throw new Error('Akun tidak ditemukan.');
  if (data.type === 'transfer') {
    if (!accounts.some((account) => account.id === data.destinationAccountId)) throw new Error('Akun tujuan tidak ditemukan.');
  } else if (!categories.some((category) => category.id === data.categoryId && category.type === data.type)) {
    throw new Error('Kategori tidak sesuai dengan jenis transaksi.');
  }
}

async function validateStoredTransaction(data: TransactionInput) {
  const [accounts, categories] = await Promise.all([db.accounts.toArray(), db.categories.toArray()]);
  validateTransactionReferences(data, accounts, categories);
}

/** Mengambil semua transaksi dari database. */
export async function getAllTransactions() {
  return db.transactions.orderBy('date').reverse().toArray();
}

/** Menambahkan transaksi baru dengan validasi. */
export async function addTransaction(data: TransactionInput) {
  await validateStoredTransaction(data);
  const now = new Date().toISOString();
  const item: Transaction = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await db.transactions.add(item);
  return item;
}

/** Memperbarui transaksi berdasarkan ID dengan validasi. */
export async function updateTransaction(id: string, data: TransactionInput) {
  await validateStoredTransaction(data);
  const current = await db.transactions.get(id);
  if (!current) throw new Error('Transaksi tidak ditemukan.');
  const item: Transaction = { ...data, id, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
  await db.transactions.put(item);
  return item;
}

/** Menghapus transaksi berdasarkan ID. */
export async function deleteTransaction(id: string) {
  await db.transactions.delete(id);
}

/** Menghitung total transaksi dan saldo seluruh akun, termasuk saldo awal. */
export async function dashboardSummary() {
  const [txs, accounts] = await Promise.all([db.transactions.toArray(), db.accounts.toArray()]);
  const summary = summarizeTransactions(txs);
  const balance = [...calculateAccountBalances(accounts, txs).values()].reduce((sum, value) => sum + value, 0);
  return { income: summary.income, expense: summary.expense, balance, count: summary.count };
}

/** Menghitung ringkasan pemasukan dan pengeluaran untuk suatu periode. */
export function summarizeTransactions(txs: Transaction[]) {
  const income = txs.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const expense = txs.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  return { income, expense, balance: income - expense, count: txs.length, savingRate: income ? ((income - expense) / income) * 100 : 0 };
}

/** Menghitung saldo akun berdasarkan transaksi. */
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

import { db } from '$lib/db/database';
import type { Transaction } from '$lib/db/types';

export async function getAllTransactions() {
  return db.transactions.orderBy('date').reverse().toArray();
}

export async function addTransaction(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  const item: Transaction = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await db.transactions.add(item);
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

import { db } from '$lib/db/database';
import type { RecurringRule, Transaction } from '$lib/db/types';
import { validateTransactionReferences } from './finance';

export function nextMonthlyDate(date: string, day: number) {
  const [year, month] = date.split('-').map(Number);
  const next = new Date(year, month, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export async function addRecurringRule(input: Omit<RecurringRule, 'id' | 'day'>) {
  const [accounts, categories] = await Promise.all([db.accounts.toArray(), db.categories.toArray()]);
  validateTransactionReferences({ ...input, date: input.nextDate, source: 'manual' }, accounts, categories);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.nextDate)) throw new Error('Tanggal mulai tidak valid.');
  const [year, month, day] = input.nextDate.split('-').map(Number);
  const checked = new Date(year, month - 1, day);
  if (checked.getFullYear() !== year || checked.getMonth() !== month - 1 || checked.getDate() !== day) throw new Error('Tanggal mulai tidak valid.');
  const rule: RecurringRule = { ...input, id: crypto.randomUUID(), day: Number(input.nextDate.slice(8, 10)) };
  await db.recurringRules.add(rule);
  return rule;
}

export async function generateDueTransactions(today = new Date()) {
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  await db.transaction('rw', db.recurringRules, db.transactions, async () => {
    const rules = await db.recurringRules.toArray();
    for (const rule of rules) {
      let due = rule.nextDate;
      let generated = 0;
      while (due <= localToday && generated < 120) {
        const id = `${rule.id}:${due}`;
        const existing = await db.transactions.get(id);
        if (!existing) {
          const now = new Date().toISOString();
          const tx: Transaction = { id, type: rule.type, amount: rule.amount, date: new Date(`${due}T12:00:00`).toISOString(), accountId: rule.accountId, categoryId: rule.categoryId, merchant: rule.merchant, notes: rule.notes, source: 'manual', createdAt: now, updatedAt: now };
          await db.transactions.add(tx);
        }
        due = nextMonthlyDate(due, rule.day);
        generated++;
      }
      if (due !== rule.nextDate) await db.recurringRules.update(rule.id, { nextDate: due });
    }
  });
}

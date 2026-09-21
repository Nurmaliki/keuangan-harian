import { db } from '$lib/db/database';
import type { Transaction, TransactionType } from '$lib/db/types';

export const TRANSACTION_PAGE_SIZE = 50;
export type TransactionCursor = { date: string; id: string };
export interface TransactionFilter {
  type: TransactionType | 'all';
  from?: string;
  to?: string;
  query?: string;
}

export async function transactionPage(filter: TransactionFilter, cursor?: TransactionCursor) {
  const start = filter.from ? new Date(`${filter.from}T00:00:00`).toISOString() : '';
  const endDate = filter.to ? new Date(`${filter.to}T00:00:00`) : null;
  if (endDate) endDate.setDate(endDate.getDate() + 1);
  const end = endDate?.toISOString() || '9999';
  const type = filter.type;
  const lower = type === 'all' ? [start, ''] : [type, start, ''];
  const dateUpper = type === 'all' ? [end, ''] : [type, end, ''];
  const cursorUpper = cursor ? (type === 'all' ? [cursor.date, cursor.id] : [type, cursor.date, cursor.id]) : null;
  const upper = cursorUpper && JSON.stringify(cursorUpper) < JSON.stringify(dateUpper) ? cursorUpper : dateUpper;
  const index = type === 'all' ? '[date+id]' : '[type+date+id]';
  const query = (filter.query || '').trim().toLowerCase();
  const rows = await db.transactions.where(index).between(lower, upper, true, false).reverse()
    .filter((tx) => !query || `${tx.merchant || ''} ${tx.notes || ''}`.toLowerCase().includes(query))
    .limit(TRANSACTION_PAGE_SIZE + 1).toArray();
  const items: Transaction[] = rows.slice(0, TRANSACTION_PAGE_SIZE);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > TRANSACTION_PAGE_SIZE && last ? { date: last.date, id: last.id } : undefined };
}

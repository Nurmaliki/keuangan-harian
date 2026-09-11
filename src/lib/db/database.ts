import Dexie, { type Table } from 'dexie';
import type { Account, AppSetting, Budget, Category, Transaction } from './types';

class FinanceDB extends Dexie {
  transactions!: Table<Transaction, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  budgets!: Table<Budget, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('keuangan_harian_db');
    this.version(1).stores({
      transactions: 'id, type, date, accountId, categoryId, merchant, source, createdAt',
      accounts: 'id, name, type',
      categories: 'id, name, type',
      budgets: 'id, categoryId, month',
      settings: 'key'
    });
  }
}

export const db = new FinanceDB();

export async function seedDatabase() {
  if ((await db.accounts.count()) === 0) {
    await db.accounts.bulkAdd([
      { id: crypto.randomUUID(), name: 'Cash', type: 'cash', initialBalance: 0, createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), name: 'Bank Utama', type: 'bank', initialBalance: 0, createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), name: 'E-Wallet', type: 'ewallet', initialBalance: 0, createdAt: new Date().toISOString() }
    ]);
  }

  if ((await db.categories.count()) === 0) {
    await db.categories.bulkAdd([
      { id: crypto.randomUUID(), name: 'Gaji', type: 'income', icon: '💼' },
      { id: crypto.randomUUID(), name: 'Bonus', type: 'income', icon: '🎁' },
      { id: crypto.randomUUID(), name: 'Makanan', type: 'expense', icon: '🍜' },
      { id: crypto.randomUUID(), name: 'Transportasi', type: 'expense', icon: '🚗' },
      { id: crypto.randomUUID(), name: 'Belanja', type: 'expense', icon: '🛒' },
      { id: crypto.randomUUID(), name: 'Tagihan', type: 'expense', icon: '🧾' },
      { id: crypto.randomUUID(), name: 'Kesehatan', type: 'expense', icon: '💊' },
      { id: crypto.randomUUID(), name: 'Anak & Keluarga', type: 'expense', icon: '👨‍👩‍👦' },
      { id: crypto.randomUUID(), name: 'Hiburan', type: 'expense', icon: '🎬' },
      { id: crypto.randomUUID(), name: 'Lainnya', type: 'expense', icon: '📦' }
    ]);
  }
}

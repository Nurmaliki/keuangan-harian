export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'ewallet' | 'other';
  initialBalance: number;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  accountId: string;
  destinationAccountId?: string;
  categoryId?: string;
  merchant?: string;
  paymentMethod?: string;
  notes?: string;
  tags?: string[];
  receiptImage?: Blob;
  source: 'manual' | 'ocr';
  createdAt: string;
  updatedAt: string;
}

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

export interface Budget {
  id: string;
  categoryId: string;
  month: string;
  limit: number;
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface BackupPayload {
  version: 2;
  exportedAt: string;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  settings: AppSetting[];
}

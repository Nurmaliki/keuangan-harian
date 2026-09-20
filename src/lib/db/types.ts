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

export interface RecurringRule {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  accountId: string;
  categoryId: string;
  merchant?: string;
  notes?: string;
  nextDate: string;
  day: number;
}

export interface BackupPayload {
  version: 1 | 2 | 3 | 4;
  exportedAt: string;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  settings: AppSetting[];
  recurringRules?: RecurringRule[];
}

export type BackupTransaction = Omit<Transaction, 'receiptImage'> & { receiptImage?: string };
export type SerializedBackup = Omit<BackupPayload, 'version' | 'transactions'> & { version: 4; transactions: BackupTransaction[] };

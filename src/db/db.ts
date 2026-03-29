import Dexie, { type Table } from 'dexie';

export interface Member {
  id?: number;
  name: string;
  fatherName: string;
  phone: string;
  address: string;
  joinDate: string;
  memberId: string;
  photo?: string; // Base64
}

export interface Borrower {
  id?: number;
  name: string;
  fatherName: string;
  phone: string;
  uid: string;
  address: string;
  guarantor: string;
  loanAmount: number;
  loanDate: string;
  paymentStatus: 'pending' | 'paid' | 'partial';
  photo?: string;
  notes?: string;
  customProfit?: number; // Manual override for profit
  memberId?: number; // Link to Member table if applicable
  formFee?: number; // Fee for the loan form
}

export interface Payment {
  id?: number;
  borrowerId: number;
  amount: number;
  date: string;
  remainingBalance: number;
  type: 'profit' | 'principal';
  month?: number; // 0-11
  year?: number;
}

export interface Expense {
  id?: number;
  title: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface Deposit {
  id?: number;
  memberId: number;
  amount: number;
  date: string;
}

export interface ManualAdjustment {
  id?: number;
  amount: number;
  type: 'add' | 'subtract';
  date: string;
  notes: string;
}

export interface AppSetting {
  key: string;
  value: any;
}

export interface Subscription {
  id?: number;
  memberId: number;
  amount: number;
  date: string;
  month: number; // 0-11
  year: number;
  penalty?: number;
}

export interface MfsTransaction {
  id?: number;
  source: 'bKash' | 'Nagad' | 'Rocket';
  amount: number;
  date: string;
  transactionId?: string;
  notes?: string;
  type?: 'subscription' | 'profit' | 'other';
  payerName?: string;
}

export class AppDatabase extends Dexie {
  members!: Table<Member>;
  borrowers!: Table<Borrower>;
  payments!: Table<Payment>;
  expenses!: Table<Expense>;
  deposits!: Table<Deposit>;
  subscriptions!: Table<Subscription>;
  adjustments!: Table<ManualAdjustment>;
  settings!: Table<AppSetting>;
  mfsTransactions!: Table<MfsTransaction>;

  constructor() {
    super('CooperativeDB');
    this.version(8).stores({
      members: '++id, name, phone, memberId',
      borrowers: '++id, name, loanDate, paymentStatus, memberId',
      payments: '++id, borrowerId, date, [borrowerId+month+year+type]',
      expenses: '++id, title, date',
      deposits: '++id, memberId, date',
      subscriptions: '++id, memberId, date, &[memberId+month+year]',
      adjustments: '++id, date',
      settings: 'key',
      mfsTransactions: '++id, source, date'
    });
  }
}

export const db = new AppDatabase();

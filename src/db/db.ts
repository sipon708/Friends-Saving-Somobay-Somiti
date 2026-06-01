import { refreshAllQueries } from '../hooks/useOnlineQuery';
import { supabase } from '../lib/supabase';

export interface Member {
  id?: string;
  name: string;
  fatherName: string;
  phone: string;
  address: string;
  joinDate: string;
  memberId: string;
  photo?: string;
  subscriptionAmount?: number;
  pin?: string;
  portalUserId?: string;
  portalPassword?: string;
}

export interface Borrower {
  id?: string;
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
  customProfit?: number;
  memberId?: string;
  formFee?: number;
  previousLoansTotal?: number;
  signature?: string;
  isConditional?: boolean;
  portalUserId?: string;
  portalPassword?: string;
}

export interface Payment {
  id?: string;
  borrowerId: string;
  amount: number;
  date: string;
  remainingBalance: number;
  type: 'profit' | 'principal';
  month?: number;
  year?: number;
}

export interface Expense {
  id?: string;
  title: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface Deposit {
  id?: string;
  memberId: string;
  amount: number;
  date: string;
}

export interface ManualAdjustment {
  id?: string;
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
  id?: string;
  memberId: string;
  amount: number;
  date: string;
  month: number;
  year: number;
  penalty?: number;
}

export interface MfsTransaction {
  id?: string;
  source: 'bKash' | 'Nagad' | 'Rocket';
  amount: number;
  date: string;
  transactionId?: string;
  notes?: string;
  type?: 'subscription' | 'profit' | 'other';
  payerName?: string;
  payerId?: string;
}

export interface TransactionLog {
  id?: string;
  amount: number;
  date: string;
  type: string;
  payerName: string;
  description: string;
  category: 'income' | 'expense';
}

export interface PortalMessage {
  id?: string;
  senderId: string;
  senderName: string;
  recipientId: string; // 'admin' or memberId
  message: string;
  timestamp: string;
  read: boolean;
  type: 'request' | 'reply'; // request from member, reply from admin
}

export interface PendingPayment {
  id?: string;
  memberId: string;
  amount: number;
  month: number;
  year: number;
  date: string;
  type: 'subscription' | 'loan_installment' | 'loan_profit';
  status: 'pending' | 'accepted' | 'rejected';
  submittedAt: string;
  notes?: string;
}

const isAuthorized = (tableName?: string) => {
  if (localStorage.getItem('isLoggedIn') === 'true' || !!localStorage.getItem('member_session') || !!localStorage.getItem('portal_user_id')) {
    return true;
  }
  // Allow fetching members, borrowers, and settings for portal login and basic info setup
  if (tableName === 'members' || tableName === 'borrowers' || tableName === 'settings') {
    return true;
  }
  return false;
};

const createTableProxy = <T = any>(tableName: string) => {
  return {
    toArray: async (): Promise<(T & { id: string })[]> => {
      // Allow fetching if authorized
      if (!isAuthorized(tableName)) return [];
      try {
        const { data, error } = await (supabase as any)
          .from(tableName)
          .select('*')
          .order('id', { ascending: true });

        if (error) throw error;
        return (data || []) as any;
      } catch (error) {
        console.error(`Supabase Fetch Error (${tableName}):`, error);
        return [];
      }
    },
    add: async (data: any) => {
      // Members can add to pendingPayments and portalMessages
      const canMemberAdd = tableName === 'pendingPayments' || tableName === 'portalMessages';
      if (!isAuthorized(tableName) && !canMemberAdd) return null;
      try {
        const { data: result, error } = await (supabase as any)
          .from(tableName)
          .insert([data])
          .select()
          .single();

        if (error) throw error;
        refreshAllQueries();
        return result?.id;
      } catch (error) {
        console.error(`Supabase Add Error (${tableName}):`, error);
        refreshAllQueries();
        return null;
      }
    },
    put: async (data: any) => {
      if (!isAuthorized(tableName)) return null;
      try {
        const { data: result, error } = await (supabase as any)
          .from(tableName)
          .upsert([data])
          .select()
          .single();

        if (error) throw error;
        refreshAllQueries();
        return result?.id || data.id;
      } catch (error) {
        console.error(`Supabase Put Error (${tableName}):`, error);
        refreshAllQueries();
        return data.id || null;
      }
    },
    update: async (id: any, data: any) => {
      if (!isAuthorized(tableName)) return false;
      try {
        const { error } = await (supabase as any)
          .from(tableName)
          .update(data)
          .eq('id', id);

        if (error) throw error;
        refreshAllQueries();
        return true;
      } catch (error) {
        console.error(`Supabase Update Error (${tableName}):`, error);
        return false;
      }
    },
    delete: async (id: any) => {
      if (!isAuthorized(tableName)) return false;
      try {
        const { error } = await (supabase as any)
          .from(tableName)
          .delete()
          .eq('id', id);

        if (error) throw error;
        refreshAllQueries();
        return true;
      } catch (error) {
        console.error(`Supabase Delete Error (${tableName}):`, error);
        return false;
      }
    },
    get: async (id: any) => {
      if (!isAuthorized(tableName)) return undefined;
      try {
        const { data, error } = await (supabase as any)
          .from(tableName)
          .select('*')
          .eq('id', id)
          .single();

        if (error) return undefined;
        return data;
      } catch (error) {
        return undefined;
      }
    },
    where: (clause: any) => {
      const q: any = {
        toArray: async (): Promise<(T & { id: string })[]> => {
          if (!isAuthorized(tableName)) return [];
          if (typeof clause === 'object') {
            const query = (supabase as any).from(tableName).select('*');
            Object.entries(clause).forEach(([k, v]) => {
              query.eq(k, v);
            });
            const { data, error } = await query;
            if (error) throw error;
            return (data || []) as any;
          }
          return [];
        },
        first: async (): Promise<(T & { id: string }) | undefined> => {
          const rows = await q.toArray();
          return rows[0];
        },
        equals: (val: any) => {
          return {
            toArray: async () => {
              const { data, error } = await (supabase as any)
                .from(tableName)
                .select('*')
                .eq(clause, val);
              if (error) throw error;
              return data as any;
            },
            first: async () => {
              const { data, error } = await (supabase as any)
                .from(tableName)
                .select('*')
                .eq(clause, val)
                .maybeSingle();
              if (error) return undefined;
              return data as any;
            },
            delete: async () => {
              const { error } = await (supabase as any)
                .from(tableName)
                .delete()
                .eq(clause, val);
              if (error) throw error;
              refreshAllQueries();
            }
          };
        },
        equalsIgnoreCase: (val: any) => {
          return {
            toArray: async () => {
              // Postgres iLike
              const { data, error } = await (supabase as any)
                .from(tableName)
                .select('*')
                .ilike(clause, val);
              if (error) throw error;
              return data as any;
            },
            first: async () => {
              const { data, error } = await (supabase as any)
                .from(tableName)
                .select('*')
                .ilike(clause, val)
                .maybeSingle();
              if (error) return undefined;
              return data as any;
            }
          };
        }
      };
      return q;
    },
    orderBy: (key: string) => {
      return {
        reverse: () => ({
          toArray: async (): Promise<(T & { id: string })[]> => {
            const { data, error } = await (supabase as any)
              .from(tableName)
              .select('*')
              .order(key, { ascending: false });
            if (error) throw error;
            return (data || []) as any;
          }
        }),
        toArray: async (): Promise<(T & { id: string })[]> => {
          const { data, error } = await (supabase as any)
            .from(tableName)
            .select('*')
            .order(key, { ascending: true });
          if (error) throw error;
          return (data || []) as any;
        }
      };
    },
    clear: async () => {
      // Dangerous
      const { error } = await (supabase as any).from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      refreshAllQueries();
    },
    bulkAdd: async (data: any[]) => {
      const { error } = await (supabase as any).from(tableName).insert(data);
      if (error) throw error;
      refreshAllQueries();
    }
  };
};

export const db = {
  transaction: async (mode: string, ...args: any[]) => {
    const callback = args[args.length - 1];
    return callback();
  },
  members: createTableProxy<Member>('members'),
  borrowers: createTableProxy<Borrower>('borrowers'),
  payments: createTableProxy<Payment>('payments'),
  expenses: createTableProxy<Expense>('expenses'),
  deposits: createTableProxy<Deposit>('deposits'),
  subscriptions: createTableProxy<Subscription>('subscriptions'),
  adjustments: createTableProxy<ManualAdjustment>('adjustments'),
  mfsTransactions: createTableProxy<MfsTransaction>('mfsTransactions'),
  transactionLogs: createTableProxy<TransactionLog>('transactionLogs'),
  pendingPayments: createTableProxy<PendingPayment>('pendingPayments'),
  portalMessages: createTableProxy<PortalMessage>('portalMessages'),
  settings: {
    toArray: async () => {
      if (!isAuthorized('settings')) return [];
      try {
        const { data, error } = await (supabase as any)
          .from('settings')
          .select('*');

        if (error) throw error;
        return (data || []).map((item: any) => ({
          key: item.key,
          value: item.value
        }));
      } catch (error) {
        console.error('Supabase Fetch Error (settings):', error);
        return [];
      }
    },
    get: async (key: string) => {
      try {
        const { data, error } = await (supabase as any)
          .from('settings')
          .select('*')
          .eq('key', key)
          .maybeSingle();

        if (error) return undefined;
        if (!data) return undefined;
        return { key: data.key, value: data.value };
      } catch (error) {
        return undefined;
      }
    },
    put: async (data: any) => {
      try {
        const { error } = await (supabase as any)
          .from('settings')
          .upsert([data], { onConflict: 'key' });

        if (error) throw error;
        refreshAllQueries();
        return true;
      } catch (error) {
        console.error('Supabase Put Error (settings):', error);
        refreshAllQueries();
        return false;
      }
    },
    delete: async (key: string) => false,
    clear: async () => false,
    bulkAdd: async (data: any[]) => {
      for (const item of data) {
        await db.settings.put(item);
      }
    }
  }
};

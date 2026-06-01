import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  User,
  UsersRound,
  UserCheck,
  ShieldCheck,
  HandCoins, 
  Wallet, 
  PieChart, 
  FileText, 
  CloudUpload, 
  Settings,
  Plus,
  Search,
  Camera,
  Trash2,
  Edit,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Download,
  Share2,
  Bell,
  Lock,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  LogOut,
  LogIn,
  Calculator,
  AlertCircle,
  Smartphone,
  Moon,
  Sun,
  Banknote,
  PlusCircle,
  Phone,
  MessageCircle,
  Clock,
  History,
  Send,
  Scale,
  Gavel,
  Layers,
  Activity,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './db/db';
import type { Member, Borrower, Expense, Payment, Deposit, ManualAdjustment, AppSetting, Subscription, MfsTransaction, TransactionLog, PendingPayment, PortalMessage } from './db/db';
import { useLiveQuery, refreshAllQueries } from './hooks/useOnlineQuery';
import { formatCurrency, formatBengaliNumber, bengaliToEnglishNumber, transliterateBengali, formatBengaliDate, formatMeetingDate, getMeetingDateISO, getTodayDate, getLocalISOString, generateMessage, calculateLoan, cn } from './utils/helpers';

import { jsPDF } from 'jspdf';
import autoTable, { applyPlugin } from 'jspdf-autotable';

// Apply plugin
applyPlugin(jsPDF);
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';


const BANGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// --- Globals ---
function MemberAdminPage({ onBack, members, borrowers, pendingPayments, portalMessages }: { onBack: () => void, members: Member[], borrowers: Borrower[], pendingPayments: PendingPayment[], portalMessages: PortalMessage[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'accounts' | 'payments' | 'messages'>('accounts');
  const [replyMsg, setReplyMsg] = useState<{ id: string, text: string } | null>(null);
  const [editingCreds, setEditingCreds] = useState<{ acc: any, userId: string, password: string } | null>(null);

  const credsData = useLiveQuery(() => db.settings.get('portalCreds'));
  const savedCredsMap = credsData?.value || {};

  const pendingByMember = members.map(m => {
    const memberPending = pendingPayments.filter(p => p.memberId === m.id);
    const borrower = borrowers.find(b => b.memberId === m.id);
    return { member: m, borrower, pending: memberPending };
  }).filter(item => 
    item.pending.length > 0 || 
    (searchTerm && (
      item.member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.member.memberId.toLowerCase().includes(searchTerm.toLowerCase())
    ))
  );

  const allAccounts = useMemo(() => {
    const merged = new Map<string, any>();

    // Add all members
    members.forEach(m => {
      const nameKey = m.name.trim();
      const fbU = savedCredsMap[`m_${m.id}`]?.userId;
      const fbP = savedCredsMap[`m_${m.id}`]?.password;
      if (!merged.has(nameKey)) {
        merged.set(nameKey, {
          ...m,
          portalUserId: fbU || m.portalUserId,
          portalPassword: fbP || m.portalPassword,
          type: 'member',
          memberRec: m,
          borrowerRec: borrowers.find(b => b.memberId === m.id || b.name.trim() === nameKey)
        });
      }
    });

    // Add borrowers who are not members/already added
    borrowers.forEach(b => {
      const nameKey = b.name.trim();
      const fbU = savedCredsMap[`b_${b.id}`]?.userId;
      const fbP = savedCredsMap[`b_${b.id}`]?.password;
      if (!merged.has(nameKey)) {
        merged.set(nameKey, {
          ...b,
          portalUserId: fbU || b.portalUserId,
          portalPassword: fbP || b.portalPassword,
          type: 'borrower',
          borrowerRec: b
        });
      } else {
        const existing = merged.get(nameKey);
        if (!existing.borrowerRec) {
          existing.borrowerRec = b;
          if (!existing.portalUserId && (fbU || b.portalUserId)) existing.portalUserId = fbU || b.portalUserId;
          if (!existing.portalPassword && (fbP || b.portalPassword)) existing.portalPassword = fbP || b.portalPassword;
        }
      }
    });

    return Array.from(merged.values()).filter(acc => 
      !searchTerm || 
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (acc as any).memberId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (acc as any).uid?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [members, borrowers, searchTerm, savedCredsMap]);

  const unreadMessages = portalMessages.filter(m => !m.read && m.recipientId === 'admin');

  const handleUpdateCreds = async () => {
    if (!editingCreds) return;
    try {
      const userId = editingCreds.userId.trim();
      const password = editingCreds.password.trim();

      if (!userId || !password) {
        alert('ইউজার আইডি এবং পাসওয়ার্ড উভয়ই প্রদান করুন');
        return;
      }

      // Try member/borrower DB rows first
      let mOk = true;
      let bOk = true;

      if (editingCreds.acc.memberRec && editingCreds.acc.memberRec.id) {
        mOk = await db.members.update(editingCreds.acc.memberRec.id, {
          portalUserId: userId,
          portalPassword: password
        });
      }
      
      if (editingCreds.acc.borrowerRec && editingCreds.acc.borrowerRec.id) {
        bOk = await db.borrowers.update(editingCreds.acc.borrowerRec.id, {
          portalUserId: userId,
          portalPassword: password
        });
      }

      // Fallback: save to settings table explicitly to guarantee success regardless of Supabase schema
      try {
         const credSetting = await db.settings.get('portalCreds');
         const credMap = credSetting?.value || {};
         if (editingCreds.acc.memberRec?.id) credMap[`m_${editingCreds.acc.memberRec.id}`] = { userId, password };
         if (editingCreds.acc.borrowerRec?.id) credMap[`b_${editingCreds.acc.borrowerRec.id}`] = { userId, password };
         await db.settings.put({ key: 'portalCreds', value: credMap });
         mOk = true; bOk = true; // Forgive row update failures if settings save worked
      } catch (err) {
         console.warn('Failed to save to settings fallback', err);
      }

      if (mOk && bOk) {
        alert('সফলভাবে সেভ হয়েছে!');
        setEditingCreds(null);
      } else {
        alert('সেভ করতে সমস্যা হয়েছে। দয়া করে পুনরায় চেষ্টা করুন বা ইন্টারনেট কানেকশন চেক করুন।');
      }
    } catch (e: any) {
      console.error(e);
      alert('সেভ করা যায়নি: ' + e.message);
    }
  };

  const handleAccept = async (paymentId: string) => {
    setIsProcessing(paymentId);
    try {
      const payment = pendingPayments.find(p => p.id === paymentId);
      if (!payment) return;

      const member = members.find(m => m.id === payment.memberId);
      const borrower = borrowers.find(b => b.id === payment.memberId || b.memberId === payment.memberId);

      if (payment.type === 'subscription') {
        const subId = await db.subscriptions.add({
          memberId: payment.memberId,
          amount: payment.amount,
          month: payment.month!,
          year: payment.year!,
          date: payment.date
        });
        if (subId) {
          // Success
        }
      } else if (payment.type === 'loan_installment' && borrower) {
        await db.payments.add({
          borrowerId: borrower.id!,
          amount: payment.amount,
          date: payment.date,
          type: 'principal',
          remainingBalance: (borrower.loanAmount || 0) - payment.amount
        });
        await db.borrowers.update(borrower.id!, { 
          loanAmount: (borrower.loanAmount || 0) - payment.amount 
        });
      } else if (payment.type === 'loan_profit' && borrower) {
        await db.payments.add({
          borrowerId: borrower.id!,
          amount: payment.amount,
          date: payment.date,
          type: 'profit',
          remainingBalance: borrower.loanAmount || 0
        });
      }

      await db.transactionLogs.add({
        amount: payment.amount,
        date: payment.date,
        type: payment.type === 'subscription' ? 'subscription' : 'payment',
        payerName: member?.name || borrower?.name || 'Unknown',
        description: `Approved Portal Payment - ${payment.type.replace('_', ' ')} for ${BANGLISH_MONTHS[payment.month!]} ${payment.year}`,
        category: 'income'
      });

      await db.pendingPayments.delete(paymentId);
      alert('পেমেন্ট সফলভাবে অনুমোদিত হয়েছে!');
    } catch (error) {
       alert('অ্যাপ্রুভ করতে সমস্যা হয়েছে');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (paymentId: string) => {
    if (window.confirm('আপনি কি এই পেমেন্টটি বাতিল করতে চান?')) {
      await db.pendingPayments.delete(paymentId);
    }
  };

  const handleReply = async (recipientId: string) => {
    if (!replyMsg?.text.trim()) return;
    try {
      await db.portalMessages.add({
        senderId: 'admin',
        senderName: 'অ্যাডমিন',
        recipientId: recipientId,
        message: replyMsg.text,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'response'
      });
      // Mark original as read
      const originalMsg = portalMessages.find(m => m.id === replyMsg.id);
      if (originalMsg?.id) {
        await db.portalMessages.update(originalMsg.id, { read: true });
      }
      setReplyMsg(null);
      alert('রিপ্লাই পাঠানো হয়েছে');
    } catch (e) { alert('ভুল হয়েছে'); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto p-4 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:scale-110 transition-transform">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                 <h1 className="text-xl font-black">Member Admin</h1>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Control Panel</p>
              </div>
           </div>
           <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl gap-1">
             <button onClick={() => setActiveTab('payments')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'payments' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
                পেমেন্ট ({pendingPayments.length})
             </button>
             <button onClick={() => setActiveTab('messages')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'messages' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
                মেসেজ
                {unreadMessages.length > 0 && <span className="w-2 h-2 bg-rose-500 rounded-full" />}
             </button>
             <button onClick={() => setActiveTab('accounts')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'accounts' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
                সদস্যগণ
             </button>
           </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {activeTab === 'accounts' ? (
          <div className="space-y-4">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="সদস্যর নাম বা আইডি দিয়ে খুঁজুন..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-50 dark:border-slate-800 focus:border-indigo-500 outline-none font-bold transition-all shadow-sm"
                />
             </div>

             <div className="grid gap-4">
                {allAccounts.map(acc => {
                  const isSetup = Boolean(acc.portalUserId && acc.portalPassword);
                  return (
                  <button 
                    key={acc.id || acc.name} 
                    onClick={() => {
                        if (!isSetup) {
                            setEditingCreds({ 
                              acc: acc, 
                              userId: acc.portalUserId || '', 
                              password: acc.portalPassword || '' 
                            });
                        }
                    }}
                    className={`w-full text-left bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all ${!isSetup ? 'hover:border-indigo-200 dark:hover:border-indigo-900/40 group cursor-pointer' : 'cursor-default'}`}
                  >
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className={`w-14 h-14 rounded-2xl ${!isSetup ? 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600' : 'bg-green-50 dark:bg-green-900/10 text-green-600'} flex items-center justify-center shadow-inner overflow-hidden border border-slate-100 dark:border-slate-800 ${!isSetup ? 'group-hover:scale-105 transition-transform' : ''}`}>
                              {acc.photo ? <img src={acc.photo} className="w-full h-full object-cover" /> : <User className="w-7 h-7" />}
                           </div>
                           <div>
                              <h4 className={`font-black text-lg ${!isSetup ? 'group-hover:text-indigo-600 transition-colors' : ''}`}>{acc.name}</h4>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {acc.memberRec && acc.borrowerRec ? 'সদস্য ও ঋণগ্রহীতা' : acc.memberRec ? 'সঞ্চয়কারী সদস্য' : 'ঋণগ্রহীতা সদস্য'} • ID: {(acc as any).memberId || (acc as any).uid}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">{acc.phone}</p>
                           </div>
                        </div>
                        {!isSetup ? (
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl">
                            <PlusCircle className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-green-500" />
                             <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Active</span>
                          </div>
                        )}
                     </div>
                     
                     {!isSetup && (
                       <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Portal User ID</p>
                             <p className="font-bold text-indigo-600 truncate">{acc.portalUserId || 'Not Set'}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Portal Password</p>
                             <p className="font-bold text-indigo-600">{acc.portalPassword || 'Not Set'}</p>
                          </div>
                       </div>
                     )}
                  </button>
                )})}
             </div>

             {editingCreds && (
               <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
                     <h3 className="text-xl font-black mb-6">পোর্টাল আইডি ও পাসওয়ার্ড সেট করুন</h3>
                     <div className="space-y-4">
                        <div>
                           <label className="text-xs font-black text-slate-400 uppercase ml-2 mb-1 block">User ID</label>
                           <input 
                             value={editingCreds.userId}
                             onChange={e => setEditingCreds({...editingCreds, userId: e.target.value})}
                             className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border-2 border-transparent focus:border-indigo-500 font-bold"
                             placeholder="UserID লিখুন"
                           />
                        </div>
                        <div>
                           <label className="text-xs font-black text-slate-400 uppercase ml-2 mb-1 block">Password</label>
                           <input 
                             type="text"
                             value={editingCreds.password}
                             onChange={e => setEditingCreds({...editingCreds, password: e.target.value})}
                             className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border-2 border-transparent focus:border-indigo-500 font-bold"
                             placeholder="Password লিখুন"
                           />
                        </div>
                        <div className="flex gap-2 pt-4">
                           <button 
                             onClick={() => setEditingCreds(null)}
                             className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors"
                           >
                             বাতিল
                           </button>
                           <button 
                             onClick={handleUpdateCreds}
                             className="flex-3 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none"
                           >
                             আপডেট করুন
                           </button>
                        </div>
                     </div>
                  </motion.div>
               </div>
             )}
          </div>
        ) : activeTab === 'payments' ? (
          <>
            <div className="relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <input 
                 type="text"
                 placeholder="সদস্যর নাম বা আইডি দিয়ে খুঁজুন..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-12 pr-6 py-4 bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-50 dark:border-slate-800 focus:border-indigo-500 outline-none font-bold transition-all shadow-sm"
               />
            </div>

            <div className="space-y-6">
              {pendingByMember.length > 0 ? (
                pendingByMember.map(({ member, borrower, pending }) => (
                  <div key={member.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                     <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-indigo-600 shadow-inner overflow-hidden border border-slate-100 dark:border-slate-800">
                              {member.photo ? <img src={member.photo} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-slate-300" />}
                           </div>
                           <div>
                              <h3 className="text-lg font-black">{member.name}</h3>
                              <p className="text-xs font-bold text-slate-400">ID: {member.memberId} • {member.phone}</p>
                           </div>
                        </div>
                        {pending.length > 0 && (
                          <div className="px-3 py-1 bg-amber-50 dark:bg-amber-900/10 rounded-full border border-amber-200 dark:border-amber-800">
                             <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Pending</span>
                          </div>
                        )}
                     </div>

                     <div className="space-y-3">
                       {pending.map(p => (
                         <div key={p.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                                 {p.type?.replace('_', ' ')}
                               </p>
                               <p className="text-xl font-black mt-1">{formatCurrency(p.amount)}</p>
                               <p className="text-[10px] text-slate-400 font-bold">{p.date}</p>
                            </div>
                            <div className="flex gap-2">
                               <button 
                                 disabled={isProcessing === p.id}
                                 onClick={() => handleAccept(p.id!)}
                                 className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-600 active:scale-95 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
                               >
                                  {isProcessing === p.id ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                  {isProcessing === p.id ? 'Prcoess' : 'Accept'}
                               </button>
                               <button 
                                 onClick={() => handleReject(p.id!)}
                                 className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-xl hover:bg-rose-100 transition-all"
                               >
                                  <Trash2 className="w-5 h-5" />
                               </button>
                            </div>
                         </div>
                       ))}
                     </div>
                  </div>
                ))
              ) : (
                <div className="bg-white dark:bg-slate-900 p-16 rounded-[3rem] text-center border-2 border-dashed border-slate-100 dark:border-slate-800">
                   <ShieldCheck className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                   <h2 className="text-xl font-black">No Operations Found</h2>
                   <p className="text-slate-400 font-bold text-sm">All set for now!</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
             {portalMessages.length > 0 ? (
               portalMessages.map(m => (
                 <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={m.id} className={`p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm ${m.senderId === 'admin' ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'bg-white dark:bg-slate-900'}`}>
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${m.senderId === 'admin' ? 'bg-slate-400' : 'bg-indigo-600'}`}>
                             {m.senderId === 'admin' ? <ShieldCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
                          </div>
                          <div>
                             <h4 className="font-black">{m.senderName}</h4>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(m.timestamp).toLocaleString()}</p>
                          </div>
                       </div>
                       {m.senderId !== 'admin' && !m.read && (
                         <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[9px] font-black rounded uppercase">Unread</span>
                       )}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium mb-4">{m.message}</p>
                    
                    {m.senderId !== 'admin' && (
                      <div className="flex justify-end pt-2 border-t border-slate-50 dark:border-slate-800">
                         {replyMsg?.id === m.id ? (
                           <div className="w-full space-y-2">
                              <textarea 
                                value={replyMsg.text} onChange={e => setReplyMsg({...replyMsg, text: e.target.value})}
                                placeholder="এখানে আপনার উত্তর লিখুন..."
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border-2 border-indigo-100 focus:border-indigo-500 font-bold"
                              />
                              <div className="flex justify-end gap-2">
                                 <button onClick={() => setReplyMsg(null)} className="px-4 py-2 text-xs font-bold text-slate-400">বাতিল</button>
                                 <button onClick={() => handleReply(m.senderId)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 dark:shadow-none">Reply Send</button>
                              </div>
                           </div>
                         ) : (
                           <button onClick={() => setReplyMsg({ id: m.id!, text: '' })} className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                              <MessageSquare className="w-4 h-4" /> রিপ্লাই দিন
                           </button>
                         )}
                      </div>
                    )}
                 </motion.div>
               ))
             ) : (
               <div className="text-center p-20 opacity-20">
                  <MessageCircle className="w-20 h-20 mx-auto mb-4" />
                  <p className="font-black text-xl">মেসেজ বক্স খালি</p>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}

function PortalLoginPage({ onLogin, onBack, members, borrowers }: { onLogin: (id: string, type: 'samity' | 'borrower') => void, onBack: () => void, members: Member[], borrowers: Borrower[] }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const settingsData = useLiveQuery(() => db.settings.get('portalCreds'));
  const credsMap = settingsData?.value || {};

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check members
    const member = members.find(m => {
       const u = credsMap[`m_${m.id}`]?.userId || m.portalUserId;
       const p = credsMap[`m_${m.id}`]?.password || m.portalPassword;
       return u && u === userId && p === password;
    });
    if (member) {
      onLogin(member.id!, 'samity');
      return;
    }

    // Check borrowers
    const borrower = borrowers.find(b => {
       const u = credsMap[`b_${b.id}`]?.userId || b.portalUserId;
       const p = credsMap[`b_${b.id}`]?.password || b.portalPassword;
       return u && u === userId && p === password;
    });
    if (borrower) {
      onLogin(borrower.id!, 'borrower');
      return;
    }

    setError('ভুল আইডি বা পাসওয়ার্ড! আবার চেষ্টা করুন।');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col p-6 items-center justify-center">
       <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 relative">
          <button onClick={onBack} className="absolute left-6 top-6 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl hover:scale-105 transition-all">
             <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-20 h-20 bg-primary-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-primary-100 dark:shadow-none rotate-3">
             <UserCheck className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-center mb-2">সদস্য লগইন</h2>
          <p className="text-center text-slate-400 font-bold text-xs mb-8 uppercase tracking-widest leading-none">Portal Access Control</p>

          <form onSubmit={handleLogin} className="space-y-4">
             <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-4">User ID</label>
                <div className="relative">
                   <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                   <input 
                     type="text" 
                     value={userId}
                     onChange={e => setUserId(e.target.value)}
                     className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border-2 border-transparent focus:border-primary-500 font-bold transition-all"
                     placeholder="আপনার আইডি দিন"
                     required
                   />
                </div>
             </div>

             <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Password</label>
                <div className="relative">
                   <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                   <input 
                     type="password" 
                     value={password}
                     onChange={e => setPassword(e.target.value)}
                     className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border-2 border-transparent focus:border-primary-500 font-bold transition-all"
                     placeholder="আপনার পাসওয়ার্ড দিন"
                     required
                   />
                </div>
             </div>

             {error && <p className="text-rose-500 text-[10px] font-black text-center animate-bounce">{error}</p>}

             <button type="submit" className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-primary-100 dark:shadow-none hover:translate-y-[-2px] transition-all active:scale-95 mt-4">
                প্রবেশ করুন
             </button>
          </form>
       </motion.div>
       <p className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-50">Friends Saving Management System v1.0</p>
    </div>
  );
}

function MemberPortalPage({ onBack, members, borrowers, subscriptions, payments, pendingPayments, dbSettings }: { 
  onBack: () => void, 
  members: Member[], 
  borrowers: Borrower[],
  subscriptions: Subscription[], 
  payments: Payment[],
  pendingPayments: PendingPayment[],
  dbSettings: AppSetting[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(localStorage.getItem('portal_user_id'));
  const [memberType, setMemberType] = useState<'samity' | 'borrower' | 'installment' | null>(localStorage.getItem('portal_user_type') as any);
  const [showPassbook, setShowPassbook] = useState(false);
  
  const handleLoginSuccess = (id: string, type: 'samity' | 'borrower') => {
    setSelectedId(id);
    setMemberType(type);
    localStorage.setItem('portal_user_id', id);
    localStorage.setItem('portal_user_type', type);
  };

  const handleLogout = () => {
    setSelectedId(null);
    setMemberType(null);
    localStorage.removeItem('portal_user_id');
    localStorage.removeItem('portal_user_type');
  };

  const [paymentAmount, setPaymentAmount] = useState('');
   const [paymentType, setPaymentType] = useState<'subscription' | 'loan_installment' | 'loan_profit'>('subscription');
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

   useEffect(() => {
     const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
     return () => clearInterval(timer);
   }, []);

  const samityName = dbSettings.find(s => s.key === 'app_name')?.value || 'ফ্রেন্ডস সেভিং সমবায় সমিতি';
  const meetingDate = dbSettings.find(s => s.key === 'meeting_date')?.value || '10';
  const marqueeText = dbSettings.find(s => s.key === 'marquee_text')?.value || 'আমাদের সমিতিতে স্বাগতম! নিয়মিত কিস্তি জমা দিন এবং সঞ্চয় বৃদ্ধি করুন।';

  const selectedMember = members.find(m => m.id === selectedId);
  const selectedBorrower = borrowers.find(b => b.id === selectedId || b.memberId === selectedId);

  const memberSubs = subscriptions.filter(s => s.memberId === selectedId);
  const memberPayments = selectedBorrower ? payments.filter(p => p.borrowerId === selectedBorrower.id) : [];
  const memberPending = pendingPayments.filter(p => p.memberId === selectedId);

  const totalSaved = memberSubs.reduce((sum, s) => sum + s.amount, 0);
  
  const loanStatus = selectedBorrower ? calculateLoan(
    selectedBorrower.loanAmount, 
    selectedBorrower.loanDate, 
    memberPayments,
    undefined,
    selectedBorrower.customProfit || 0.05,
    0.10,
    selectedBorrower.notes
  ) : null;

  // Monthly Dues Logic
  const getSubscriptionStatus = () => {
    if (!selectedMember) return null;
    const today = new Date();
    const currMonth = today.getMonth();
    const currYear = today.getFullYear();
    
    const alreadyPaid = memberSubs.find(s => s.month === currMonth && s.year === currYear);
    const pendingPaid = memberPending.find(p => p.month === currMonth && p.year === currYear && p.type === 'subscription');

    if (alreadyPaid) return { status: 'paid', amount: alreadyPaid.amount };
    if (pendingPaid) return { status: 'pending', amount: pendingPaid.amount };

    // Calculate Dues
    const subAmount = selectedMember.subscriptionAmount || 500;
    const meetingDay = parseInt(meetingDate) || 10;
    const isLate = today.getDate() > meetingDay;
    const penalty = isLate ? 50 : 0;

    // Unpaid previous months calculation
    const joinDate = new Date(selectedMember.joinDate);
    const totalMonths = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth()) + 1;
    const totalExpected = totalMonths * subAmount;
    const unpaidDues = Math.max(0, totalExpected - totalSaved);
    const finalAmount = subAmount + penalty + (unpaidDues > subAmount ? unpaidDues - subAmount : 0);

    return { status: 'due', amount: finalAmount, penalty, unpaidDues: Math.max(0, unpaidDues - subAmount) };
  };

  const subStatus = getSubscriptionStatus();

  // Dividend (Vag-bonton) Logic
  const calculateDividend = () => {
    if (!selectedMember) return 0;
    const totalAllSubs = subscriptions.reduce((sum, s) => sum + s.amount, 0) || 1;
    const totalProfits = payments.filter(p => p.type === 'profit').reduce((sum, p) => sum + p.amount, 0);
    return (totalSaved / totalAllSubs) * totalProfits;
  };

  const dividend = calculateDividend();

  useEffect(() => {
    // Auto-select amount for monthly subscription if due
    if (subStatus?.status === 'due' && !paymentAmount && paymentType === 'subscription' && memberType === 'samity') {
      setPaymentAmount(subStatus.amount.toString());
    }
    
    // Auto-select type for borrowers (Default to Profit)
    if (memberType === 'borrower' && paymentType === 'subscription') {
      setPaymentType('loan_profit');
    }
    
    // Auto-select amount for borrower profit
    if (memberType === 'borrower' && paymentType === 'loan_profit' && loanStatus && !paymentAmount) {
      setPaymentAmount(loanStatus.monthlyProfit.toString());
    }
  }, [subStatus?.status, subStatus?.amount, paymentAmount, paymentType, memberType, loanStatus?.monthlyProfit]);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !paymentAmount) return;

    setIsSubmitting(true);
    try {
      await db.pendingPayments.add({
        memberId: selectedId,
        amount: Number(paymentAmount),
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        date: getTodayDate(),
        type: paymentType,
        status: 'pending',
        submittedAt: new Date().toISOString()
      });
      setPaymentAmount('');
      alert('পেমেন্ট সফলভাবে সাবমিট হয়েছে! অ্যাডমিনের অনুমোদনের জন্য অপেক্ষা করুন।');
    } catch (error) {
      alert('পেমেন্ট পাঠাতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedId) {
    return <PortalLoginPage onLogin={handleLoginSuccess} onBack={onBack} members={members} borrowers={borrowers} />;
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 relative overflow-x-hidden transition-colors pb-[100px]">
      {/* Subtle background elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-100/20 dark:bg-primary-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100/20 dark:bg-blue-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="p-4 max-w-lg mx-auto pb-32">
        {/* Header matching Admin Dashboard */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-800 dark:to-primary-950 rounded-[2.5rem] p-8 shadow-xl mb-8 mt-4 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary-400/20 rounded-full blur-3xl" />
          
          <div className="absolute top-4 left-4 flex gap-2">
             <button className="p-2 bg-white/10 backdrop-blur-md text-white hover:bg-white/20 rounded-xl transition-all border border-white/10 relative">
               <Bell className="w-5 h-5" />
               {memberPending.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white dark:border-primary-950 animate-pulse" />}
             </button>
          </div>

          <div className="absolute top-4 right-4 flex gap-2">
            <button 
              onClick={handleLogout}
              className="p-2 bg-rose-500/20 backdrop-blur-md text-white hover:bg-rose-500/40 rounded-xl transition-all border border-rose-500/30"
              title="লগ আউট"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col items-center relative z-10">
            <div className="flex flex-col items-center justify-center gap-4 mb-4 mt-2">
               <div className="w-20 h-20 p-1 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-[0_8px_16px_rgba(0,0,0,0.2),_inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center overflow-hidden">
                  {selectedMember?.photo || selectedBorrower?.photo ? (
                    <img src={selectedMember?.photo || selectedBorrower?.photo} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <User className="w-10 h-10 text-white" />
                  )}
               </div>
              <div className="flex flex-col items-center text-center px-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-md">{selectedMember?.name || selectedBorrower?.name}</h1>
                <p className="text-primary-100 font-bold text-xs uppercase tracking-widest mt-2 px-3 py-1 bg-white/10 rounded-full">
                  {memberType === 'samity' ? 'সঞ্চয়কারী' : 'ঋণগ্রহীতা'} • ID: {selectedMember?.memberId || selectedBorrower?.uid}
                </p>
                <div className="mt-2 text-white/80 font-bold text-[10px] tracking-widest">
                   <p>{samityName}</p>
                   {currentTime}
                </div>
              </div>
            </div>
            
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-4" />
            
            <div className="w-full overflow-hidden whitespace-nowrap relative h-6">
              <motion.p 
                animate={{ x: [400, -800] }}
                transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                className="text-primary-50/80 text-sm font-medium absolute whitespace-nowrap"
              >
                📢 {marqueeText} • প্রতি মাসের {meetingDate} তারিখ মিটিং অনুষ্ঠিত হবে • নিয়মিত কিস্তি পরিশোধ করুন • 📢 {marqueeText}
              </motion.p>
            </div>
          </div>
        </div>

        {/* Main Cash Cards style */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <Wallet className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">মোট সঞ্চয়</p>
              </div>
              <h2 className="text-2xl font-black text-primary-600 dark:text-primary-400">{formatCurrency(totalSaved)}</h2>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">প্রাপ্য লভ্যাংশ</p>
              </div>
              <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(dividend)}</h2>
            </div>
          </motion.div>
        </div>

          {memberType === 'samity' && subStatus && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`p-6 rounded-[2.5rem] border-2 shadow-sm ${
              subStatus.status === 'paid' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 
              subStatus.status === 'pending' ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30' : 
              'bg-primary-50 border-primary-100 dark:bg-primary-900/10 dark:border-primary-900/30'
            }`}>
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-lg">চাঁদা অবস্থা</h3>
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${
                    subStatus.status === 'paid' ? 'bg-emerald-500 text-white' : 
                    subStatus.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-primary-600 text-white'
                  }`}>
                    {subStatus.status === 'paid' ? 'পরিশোধিত' : subStatus.status === 'pending' ? 'পেন্ডিং' : 'বকেয়া'}
                  </span>
               </div>
               {subStatus.status === 'paid' ? (
                 <p className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> আপনি এই মাসের চাঁদা জমা দিয়েছেন।</p>
               ) : subStatus.status === 'pending' ? (
                 <p className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-2"><Clock className="w-5 h-5" /> ড্যাশবোর্ডে অনুমোদনের অপেক্ষায় আছে।</p>
               ) : (
                 <div className="space-y-4">
                    <p className="text-slate-600 dark:text-slate-400 font-bold">এই মাসের চাঁদা এখনো জমা দেয়া হয়নি।</p>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-white/50 dark:bg-slate-800/50 p-3 rounded-2xl">
                          <p className="text-[9px] font-black text-slate-400 uppercase">মেইন চাঁদা</p>
                          <p className="font-black">{formatCurrency(selectedMember?.subscriptionAmount || 500)}</p>
                       </div>
                       <div className="bg-white/50 dark:bg-slate-800/50 p-3 rounded-2xl">
                          <p className="text-[9px] font-black text-slate-400 uppercase">জরিমানা + বকেয়া</p>
                          <p className="font-black text-rose-500">{formatCurrency(subStatus.penalty + subStatus.unpaidDues)}</p>
                       </div>
                    </div>
                 </div>
               )}
            </motion.div>
          )}

          <div className="mb-8 mt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest ml-2 flex items-center gap-2">
                <Calculator className="w-3" /> পূর্ণ হিসাব বিবরণী
              </h3>
              <button 
                onClick={() => setShowPassbook(true)}
                className="text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-full border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5" /> ডিজিটাল পাশবই
              </button>
            </div>
            
            {memberType === 'borrower' ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    { label: 'গৃহীত ঋণ', value: selectedBorrower?.loanAmount || 0, color: 'from-blue-500 to-blue-700', icon: HandCoins },
                    { label: 'মোট মুনাফা', value: loanStatus?.totalProfit || 0, color: 'from-orange-500 to-orange-700', icon: TrendingUp },
                    { label: 'জরিমানা', value: loanStatus?.penaltyAmount || 0, color: 'from-rose-500 to-rose-700', icon: AlertCircle },
                    { label: 'অফিস খরচ', value: selectedBorrower?.formFee || 0, color: 'from-slate-500 to-slate-700', icon: FileText },
                  ].map((stat, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "relative overflow-hidden p-3 rounded-2xl transition-all duration-200 group border-b-4",
                        "bg-gradient-to-br", stat.color,
                        "border-black/20 active:translate-y-1 active:border-b-0 active:mt-1",
                        "shadow-[0_8px_16px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,0.3)]"
                      )}
                    >
                      <div className="absolute -top-2 -right-2 w-12 h-12 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                      <div className="flex flex-col items-center text-center relative z-10">
                        <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md mb-2 shadow-inner border border-white/20">
                          <stat.icon className="w-4 h-4 text-white drop-shadow-sm" />
                        </div>
                        <p className="text-[10px] font-bold text-white/80 uppercase tracking-tighter mb-0.5">{stat.label}</p>
                        <p className="text-sm font-black text-white drop-shadow-md">{formatCurrency(stat.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-sm">
                  <span className="text-sm font-black uppercase text-primary-600 tracking-wider">মোট প্রদানের বাকি (Due)</span>
                  <span className="text-xl font-black">{formatCurrency(loanStatus?.remainingBalance || 0)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    { label: 'মোট জমা চাঁদা', value: totalSaved, color: 'from-blue-500 to-blue-700', icon: Wallet },
                    { label: 'অ্যাকাউন্টে লভ্যাংশ', value: dividend, color: 'from-emerald-500 to-emerald-700', icon: TrendingUp },
                  ].map((stat, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "relative overflow-hidden p-3 rounded-2xl transition-all duration-200 group border-b-4",
                        "bg-gradient-to-br", stat.color,
                        "border-black/20 active:translate-y-1 active:border-b-0 active:mt-1",
                        "shadow-[0_8px_16px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,0.3)]"
                      )}
                    >
                      <div className="absolute -top-2 -right-2 w-12 h-12 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                      <div className="flex flex-col items-center text-center relative z-10">
                        <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md mb-2 shadow-inner border border-white/20">
                          <stat.icon className="w-4 h-4 text-white drop-shadow-sm" />
                        </div>
                        <p className="text-[10px] font-bold text-white/80 uppercase tracking-tighter mb-0.5">{stat.label}</p>
                        <p className="text-sm font-black text-white drop-shadow-md">{formatCurrency(stat.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-sm">
                  <span className="text-sm font-black uppercase text-indigo-600 tracking-wider">মোট ব্যালেন্স</span>
                  <span className="text-xl font-black">{formatCurrency(totalSaved + dividend)}</span>
                </div>
              </>
            )}
          </div>

          <div className="bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-800 dark:to-primary-950 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
             <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform duration-500"><Banknote className="w-32 h-32 text-white" /></div>
             <h3 className="text-white text-xl font-black mb-6 flex items-center gap-2"><PlusCircle className="w-6 h-6" /> পেমেন্ট সাবমিট করুন</h3>
             
             {subStatus?.status === 'paid' && paymentType === 'subscription' ? (
                <div className="bg-white/20 backdrop-blur-md p-8 rounded-[2rem] text-center border border-white/30">
                   <CheckCircle2 className="w-12 h-12 text-white mx-auto mb-3" />
                   <p className="text-white font-bold">এই মাসের সঞ্চয় চাঁদা জমা দেয়া সম্পন্ন হয়েছে। ধন্যবাদ!</p>
                </div>
             ) : (
               <form onSubmit={handleSubmitPayment} className="space-y-5 relative z-10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary-100 uppercase ml-4">পেমেন্টের ধরণ</label>
                    <select 
                      value={paymentType}
                      onChange={e => setPaymentType(e.target.value as any)}
                      className="w-full p-5 bg-white/10 border-2 border-white/20 rounded-[1.5rem] text-white font-bold outline-none focus:bg-white/20 transition-all"
                    >
                       <option value="subscription" className="text-slate-900">মাসিক সঞ্চয় (চাঁদা)</option>
                       {memberType === 'borrower' && (
                         <>
                           <option value="loan_installment" className="text-slate-900">ঋণের কিস্তি (Principal)</option>
                           <option value="loan_profit" className="text-slate-900">ঋণের মুনাফা (Profit)</option>
                         </>
                       )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary-100 uppercase ml-4">টাকার পরিমাণ</label>
                    <div className="relative">
                      <input 
                        type="number" placeholder="টাকার পরিমাণ" value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        className="w-full px-8 py-6 bg-white/10 border-2 border-white/20 rounded-[1.5rem] text-3xl font-black text-white placeholder:text-white/30 outline-none focus:border-white/50 transition-all"
                      />
                      <span className="absolute right-8 top-1/2 -translate-y-1/2 text-2xl font-black text-white/50">৳</span>
                    </div>
                  </div>
                  <button 
                    disabled={isSubmitting}
                    className="w-full py-6 bg-white text-primary-600 rounded-[2rem] font-black text-xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    {isSubmitting ? 'প্রসেসিং...' : 'পেমেন্ট পাঠিয়ে দিন'}
                  </button>
               </form>
             )}
          </div>

          <div className="space-y-4">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-6 items-center flex gap-2"><History className="w-3 h-3" /> সাম্প্রতিক লেনদেন সমুহ</h3>
             {memberPending.map(p => (
               <div key={p.id} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-6 rounded-[2rem] flex items-center justify-between group">
                  <div>
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">
                       {p.type === 'subscription' ? 'মাসিক চাঁদা' : p.type === 'loan_installment' ? 'ঋণের কিস্তি' : 'ঋণের মুনাফা'}
                    </p>
                    <p className="font-black text-amber-900 dark:text-amber-200">অ্যাডমিন অনুমোদনের অপেক্ষায়</p>
                    <p className="text-[9px] text-amber-500 font-bold uppercase mt-1">Pending Approval</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-amber-600">{formatCurrency(p.amount)}</p>
                  </div>
               </div>
             ))}
             {memberSubs.slice().reverse().slice(0, 3).map(s => (
               <div key={s.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600">
                       <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">চাঁদা সাকসেসফুল</p>
                      <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">{s.date.split('T')[0]} • Success</p>
                    </div>
                  </div>
                  <p className="text-xl font-black">{formatCurrency(s.amount)}</p>
               </div>
             ))}
          </div>
       </div>
       {showPassbook && (
         <DigitalPassbookModal 
           member={selectedMember ? selectedMember : { ...selectedBorrower, id: selectedId }} 
           onClose={() => setShowPassbook(false)} 
         />
       )}
    </div>
  );
}

import SignatureCanvas from 'react-signature-canvas';

function SignaturePad({ onSave, onClear, initialData, height = 400, label = "স্বাক্ষর করুন" }: { onSave: (data: string) => void, onClear: () => void, initialData?: string, height?: number, label?: string }) {
  const sigCanvas = useRef<any>(null);

  const save = () => {
    if (!sigCanvas.current.isEmpty()) {
      onSave(sigCanvas.current.getCanvas().toDataURL('image/png'));
    }
  };

  const clear = () => {
    sigCanvas.current.clear();
    onClear();
  };

  useEffect(() => {
    if (initialData && sigCanvas.current && sigCanvas.current.isEmpty()) {
        sigCanvas.current.fromDataURL(initialData);
    }
  }, [initialData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <label className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">{label}</label>
        {initialData && (
          <button type="button" onClick={clear} className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-100 dark:border-rose-500/20 flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> স্বাক্ষর মুছুন
          </button>
        )}
      </div>
      <div className="border-4 border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden bg-white dark:bg-slate-900 shadow-inner group relative">
        <SignatureCanvas 
          ref={sigCanvas}
          penColor='black'
          onEnd={save}
          canvasProps={{
            height: height,
            className: 'sigCanvas w-full cursor-crosshair'
          }}
        />
        {!initialData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
             <Edit className="w-12 h-12 text-slate-400" />
          </div>
        )}
      </div>
    </div>
  );
}

function AdSenseBanner() {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const rawClientId = dbSettings.find((s: any) => s.key === 'adsense_client_id')?.value || '';
  const rawSlotId = dbSettings.find((s: any) => s.key === 'adsense_slot_id')?.value || '';

  // Extract client ID (handles ca-app-pub-XXX~YYY)
  let clientId = rawClientId.trim();
  if (clientId.includes('~')) clientId = clientId.split('~')[0];
  if (clientId.includes('/')) clientId = clientId.split('/')[0];
  clientId = clientId.replace('ca-app-pub-', 'ca-pub-');
  
  // Extract slot ID (handles ca-app-pub-XXX/YYY)
  let slotId = rawSlotId.trim();
  if (slotId.includes('/')) slotId = slotId.split('/').pop() || slotId;

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const adPushed = useRef(false);

  useEffect(() => {
    if (!clientId || clientId.length < 10) return;

    let script = document.querySelector(`script[src*="adsbygoogle.js"]`);
    if (!script) {
      script = document.createElement('script');
      (script as HTMLScriptElement).src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
      (script as HTMLScriptElement).async = true;
      (script as HTMLScriptElement).crossOrigin = "anonymous";
      document.head.appendChild(script);
      
      (script as HTMLScriptElement).onload = () => {
        setScriptLoaded(true);
      };
    } else {
      setScriptLoaded(true);
    }
  }, [clientId]);

  useEffect(() => {
    if (scriptLoaded && clientId && slotId && !adPushed.current) {
      try {
        adPushed.current = true;
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error("AdSense Error: ", e);
      }
    }
  }, [scriptLoaded, clientId, slotId]);

  if (!clientId || !slotId) {
    return null;
  }

  return (
    <div className="w-full overflow-hidden my-4 flex justify-center bg-transparent mt-8 min-h-[50px]">
      <ins 
        className="adsbygoogle"
        style={{ display: "inline-block", width: "320px", height: "50px" }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
      ></ins>
    </div>
  );
}

function OfflinePage() {
  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[1000] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-4">ইন্টারনেট সংযোগ নেই</h1>
      <p className="text-slate-600 dark:text-slate-400 max-w-sm mb-8">
        দুঃখিত, এই অ্যাপটি ব্যবহার করার জন্য আপনার একটি সক্রিয় ইন্টারনেট সংযোগ প্রয়োজন। দয়া করে আপনার ডাটা বা ওয়াইফাই কানেকশন চেক করুন।
      </p>
      <button 
        onClick={() => window.location.reload()} 
        className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all active:scale-95 flex items-center gap-2"
      >
        <History className="w-5 h-5" />
        আবার চেষ্টা করুন
      </button>
    </div>
  );
}

// --- Components ---

const Card = ({ title, icon: Icon, onClick, color }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "group relative flex flex-col items-center justify-center p-5 rounded-[2.2rem] transition-all duration-150 ease-out overflow-hidden outline-none",
      "bg-white dark:bg-slate-800 text-slate-800 dark:text-white",
      "border-2 border-slate-200 dark:border-slate-700",
      "shadow-[0_8px_0_0_#cbd5e1] dark:shadow-[0_8px_0_0_#0f172a]",
      "hover:-translate-y-1 hover:shadow-[0_12px_0_0_#cbd5e1] dark:hover:shadow-[0_12px_0_0_#0f172a]",
      "active:translate-y-[8px] active:shadow-[0_0px_0_0_#cbd5e1] dark:active:shadow-[0_0px_0_0_#0f172a]",
      "hover:border-transparent active:border-transparent"
    )}
  >
    {/* Snake Border Animation Layer */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 group-active:opacity-100 pointer-events-none z-0">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,#ff0000_310deg,#ffff00_330deg,#00ff00_340deg,#00ffff_350deg,#ff00ff_360deg)] animate-snake" />
    </div>
    
    {/* Middle Mask to keep content background clean */}
    <div className="absolute inset-[3px] rounded-[2rem] bg-white dark:bg-slate-800 z-1 opacity-0 group-hover:opacity-100 group-active:opacity-100" />

    <div className="relative z-10 flex flex-col items-center">
      <div className={cn(
        "p-4 rounded-2xl mb-3 bg-gradient-to-br transition-transform duration-100 group-active:scale-90", 
        "shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2),_0_5px_10px_rgba(0,0,0,0.1)]",
        color
      )}>
        <Icon className="w-7 h-7 text-white drop-shadow-md" />
      </div>
      <span className="font-bold text-sm text-slate-700 dark:text-slate-300 leading-tight select-none group-active:scale-95 transition-transform duration-100">{title}</span>
    </div>
  </button>
);

const PageHeader = ({ title, onBack }: any) => (
  <>
    <div className="flex items-center justify-between mb-6 sticky top-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md py-4 z-10">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-900 dark:text-white" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate max-w-[250px] sm:max-w-none">{title}</h1>
      </div>
    </div>
  </>
);

const AnimatedBottomNav = ({ currentPage, navigateTo }: { currentPage: string, navigateTo: (page: string) => void }) => {
  const NAV_ITEMS = [
    { id: 'members', icon: Users, label: 'Members' },
    { id: 'borrowers', icon: HandCoins, label: 'Borrowers' },
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'installment', icon: Banknote, label: 'Installments' },
    { id: 'calculator', icon: Calculator, label: 'Calculator' },
  ];

  const activeIndex = Math.max(0, NAV_ITEMS.findIndex(i => i.id === currentPage || (i.id === 'dashboard' && currentPage === '')));

  return (
    <div className="fixed bottom-0 left-0 w-full z-[100] pointer-events-none">
      <div className="w-full h-[72px] pb-[env(safe-area-inset-bottom)] pointer-events-auto relative">
        {/* Background Layer with Drop Shadow */}
        <div className="absolute top-0 left-0 w-full h-[72px] drop-shadow-[0_-4px_16px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_-4px_16px_rgba(0,0,0,0.5)] pointer-events-none text-white dark:text-slate-900 overflow-hidden">
            {/* The SVG animation container */}
            <motion.div
                initial={false}
                animate={{ left: `${(activeIndex * 20) + 10}%` }}
                transition={{ type: "spring", stiffness: 150, damping: 20, mass: 1 }}
                className="absolute top-0 h-[72px] z-0"
            >
                {/* Single continuous SVG to prevent any pixel gaps. Center is exactly at 2045px. */}
                <div className="absolute top-0 -ml-[2045px] w-[4090px] h-[72px] text-white dark:text-slate-900">
                    <svg width="4090" height="72" viewBox="0 0 4090 72" className="w-full h-full">
                        <path d="M0,0 L2000,0 C2015,0 2018,44 2045,44 C2072,44 2075,0 2090,0 L4090,0 L4090,72 L0,72 Z" fill="currentColor" />
                    </svg>
                </div>
            </motion.div>
        </div>

        {/* Buttons Layer */}
        <div className="w-full h-full flex relative z-10 transition-colors">
          {NAV_ITEMS.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className="relative flex-1 h-full flex flex-col items-center justify-center outline-none -webkit-tap-highlight-color-transparent group"
              >
                 <motion.div
                    animate={{ 
                      y: isActive ? -22 : 0,
                    }}
                    transition={{ type: "spring", stiffness: 150, damping: 20, mass: 1 }}
                    className="relative flex items-center justify-center drop-shadow-sm"
                 >
                    {isActive ? (
                       <div className="w-[58px] h-[58px] bg-white dark:bg-slate-800 rounded-full flex items-center justify-center border-[4px] border-[#a5b4fc] dark:border-indigo-500 shadow-md relative group-active:scale-95 transition-transform duration-100">
                          <item.icon className="w-7 h-7 text-slate-800 dark:text-slate-100" strokeWidth={2.5} />
                       </div>
                    ) : (
                       <item.icon className="w-6 h-6 text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors" strokeWidth={2} />
                    )}
                 </motion.div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

function DigitalClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const timeString = timeFormatter.format(time);
  const [timePart, ampmPart] = timeString.split(' ');
  const dateString = dateFormatter.format(time);

  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner mt-2 flex-wrap justify-center">
      <div className="text-xl font-black text-white tracking-wider whitespace-nowrap drop-shadow-sm">
        {dateString}
      </div>
      <div className="w-1.5 h-1.5 rounded-full bg-white/50 hidden sm:block shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
      <div className="flex items-center gap-1.5">
        <div className="text-xl font-black text-white tracking-wider font-mono drop-shadow-sm">
          {timePart}
        </div>
        <div className="text-xs font-bold text-primary-200 bg-primary-900/40 px-2 py-1 rounded-md uppercase tracking-widest flex-shrink-0">
          {ampmPart}
        </div>
      </div>
    </div>
  );
}

// Removed Firebase imports

const compressImage = (base64Str: string, maxWidth = 400, maxHeight = 400): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
};

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let checkInterval: any;
    const checkInternetConnection = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }
      try {
        await fetch('https://www.google.com/favicon.ico?_=' + new Date().getTime(), { mode: 'no-cors', cache: 'no-store' });
        setIsOnline(true);
      } catch (error) {
        setIsOnline(false);
      }
    };

    const handleOnline = () => checkInternetConnection();
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    checkInternetConnection();
    checkInterval = setInterval(checkInternetConnection, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(checkInterval);
    };
  }, []);

  const [showSplash, setShowSplash] = useState(true);
  const [transitionScreen, setTransitionScreen] = useState<'login' | 'logout' | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [themeConfig, setThemeConfig] = useState(() => {
    const saved = localStorage.getItem('themeConfig');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    const oldSaved = localStorage.getItem('darkMode');
    const isOldDark = oldSaved ? JSON.parse(oldSaved) : false;
    return { mode: isOldDark ? 'dark' : 'light', darkStart: '18:00', darkEnd: '06:00' };
  });

  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    localStorage.setItem('themeConfig', JSON.stringify(themeConfig));
    const checkTheme = () => {
      let isDark = false;
      if (themeConfig.mode === 'dark') {
        isDark = true;
      } else if (themeConfig.mode === 'light') {
        isDark = false;
      } else if (themeConfig.mode === 'schedule') {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startAr = (themeConfig.darkStart || '18:00').split(':').map(Number);
        const endAr = (themeConfig.darkEnd || '06:00').split(':').map(Number);
        const startMin = startAr[0] * 60 + (startAr[1] || 0);
        const endMin = endAr[0] * 60 + (endAr[1] || 0);
        
        if (startMin <= endMin) {
          isDark = currentMinutes >= startMin && currentMinutes < endMin;
        } else {
          isDark = currentMinutes >= startMin || currentMinutes < endMin;
        }
      }
      setDarkMode(isDark);
      
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    };
    
    checkTheme();
    if (themeConfig.mode === 'schedule') {
      const interval = setInterval(checkTheme, 60000);
      return () => clearInterval(interval);
    }
  }, [themeConfig]);

  const [navSearch, setNavSearch] = useState('');

  // Handle browser back button and gestures
  const navigateTo = (page: string, search: string = '') => {
    if (page === 'dashboard' && currentPageRef.current === 'dashboard') {
      return;
    }
    setNavSearch(search);
    setCurrentPage(page);
    window.history.pushState({ page }, '');
  };

  const currentPageRef = React.useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.page) {
        setCurrentPage(event.state.page);
      } else {
        setCurrentPage('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initial state
    if (!window.history.state || !window.history.state.page) {
      window.history.replaceState({ page: 'dashboard' }, '');
    } else {
      setCurrentPage(window.history.state.page);
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [meetingDay, setMeetingDay] = useState(1);

  const [isAuthReady, setIsAuthReady] = useState(true);
  const [showPinModal, setShowPinModal] = useState(() => localStorage.getItem('isLoggedIn') !== 'true');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem('isLoggedIn', 'true');
      setShowPinModal(false);
      refreshAllQueries();
    } else {
      localStorage.removeItem('isLoggedIn');
      setShowPinModal(true);
      refreshAllQueries();
    }
  }, [isAdmin]);

  const handleLogin = async () => {
    if (mobile.length !== 11) {
      setLoginError('মোবাইল নম্বর অবশ্যই ১১ ডিজিটের হতে হবে!');
      return;
    }

    if (password.length !== 6) {
      setLoginError('পাসওয়ার্ড অবশ্যই ৬ ডিজিটের হতে হবে!');
      return;
    }

    try {
      // Fetch saved phone and pin from settings
      const savedPhone = await db.settings.get('admin_phone');
      const savedPin = await db.settings.get('admin_pin');
      
      const adminMobile = (savedPhone && savedPhone.value) ? String(savedPhone.value) : '01700000000';
      const adminPass = (savedPin && savedPin.value) ? String(savedPin.value) : '123456';

      // Check against current settings
      if (mobile === adminMobile && password === adminPass) {
        setTransitionScreen('login');
        setTimeout(() => {
          setIsAdmin(true);
          setLoginError('');
          setTransitionScreen(null);
        }, 2000);
        return;
      }

      setLoginError('ভুল মোবাইল নম্বর অথবা পাসওয়ার্ড!');
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('লগইন করতে সমস্যা হচ্ছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
  };

  const handleLogout = async () => {
    setTransitionScreen('logout');
    setTimeout(() => {
      setIsAdmin(false);
      setMobile('');
      setPassword('');
      setTransitionScreen(null);
    }, 2000);
  };




  const [pin, setPin] = useState('');
  const [loginMode, setLoginMode] = useState<'admin' | 'member'>('admin');
  const [loginError, setLoginError] = useState('');
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotNewPin, setForgotNewPin] = useState('');
  const [forgotConfirmPin, setForgotConfirmPin] = useState('');
  const [forgotStep, setForgotStep] = useState(1);

  // Splash screen timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Data Queries
  const members = useLiveQuery<Member[]>(() => db.members.toArray(), [isAdmin], 'members') || [];
  const borrowers = useLiveQuery<Borrower[]>(() => db.borrowers.toArray(), [isAdmin], 'borrowers') || [];
  const expenses = useLiveQuery<Expense[]>(() => db.expenses.toArray(), [isAdmin], 'expenses') || [];
  const payments = useLiveQuery<Payment[]>(() => db.payments.toArray(), [isAdmin], 'payments') || [];
  const deposits = useLiveQuery<Deposit[]>(() => db.deposits.toArray(), [isAdmin], 'deposits') || [];
  const subscriptions = useLiveQuery<Subscription[]>(() => db.subscriptions.toArray(), [isAdmin], 'subscriptions') || [];
  const mfsTransactions = useLiveQuery<MfsTransaction[]>(() => db.mfsTransactions.toArray(), [isAdmin], 'mfsTransactions') || [];
  const transactionLogs = useLiveQuery<TransactionLog[]>(() => db.transactionLogs.orderBy('date').reverse().toArray(), [isAdmin], 'transactionLogs') || [];
  const portalMessages = useLiveQuery<PortalMessage[]>(() => db.portalMessages.orderBy('timestamp').reverse().toArray(), [isAdmin], 'portalMessages') || [];
  const pendingPayments = useLiveQuery<PendingPayment[]>(() => db.pendingPayments.toArray(), [], 'pendingPayments') || [];
  const dbSettings = useLiveQuery<AppSetting[]>(() => db.settings.toArray()) || [];
  
  const profitPercentage = (dbSettings.find(s => s.key === 'profit_percentage')?.value || 5) / 100;
  const compoundPercentage = (dbSettings.find(s => s.key === 'compound_percentage')?.value || 10) / 100;
  const dbMenuTitles = dbSettings.find(s => s.key === 'menu_titles')?.value || {};

  // Calculations
  const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
  const totalSubscriptions = subscriptions.reduce((sum, s) => sum + s.amount, 0);
  const totalPenalties = subscriptions.reduce((sum, s) => sum + (s.penalty || 0), 0);
  const totalMfs = mfsTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalLoansDistributed = borrowers.reduce((sum, b) => sum + Number(b.loanAmount || 0) + Number(b.previousLoansTotal || 0), 0);
  const totalFormFees = borrowers.reduce((sum, b) => sum + (b.formFee || 0), 0);
  
  // Actual Collected Profit
  const totalProfit = payments
    .filter(p => p.type === 'profit')
    .reduce((sum, p) => sum + p.amount, 0);

  // Installments and Compound 
  const installmentBorrowerIds = borrowers.filter(b => b.notes?.includes('FIXED_INSTALLMENT')).map(b => b.id);
  const totalInstallmentPayments = payments
    .filter(p => installmentBorrowerIds.includes(p.borrowerId))
    .reduce((sum, p) => sum + p.amount, 0);

  const totalLoanCompoundProfit = borrowers.reduce((sum, b) => {
    const bPayments = payments.filter(p => p && p.borrowerId === b.id && p.date >= b.loanDate);
    const loanData = calculateLoan(Number(b.loanAmount || 0), b.loanDate, bPayments, b.customProfit, profitPercentage, compoundPercentage, b.notes);
    return sum + (loanData.totalCompoundPaid || 0);
  }, 0);

  const totalCompoundCollected = totalPenalties + totalLoanCompoundProfit;
    
  const totalLoanRepayments = totalPayments - totalProfit;

  const adjustments = useLiveQuery<ManualAdjustment[]>(() => db.adjustments.toArray(), [isAdmin], 'adjustments') || [];

  const totalAdjustments = adjustments.reduce((sum, a) => a.type === 'add' ? sum + a.amount : sum - a.amount, 0);
  const calculatedCash = totalDeposits + totalSubscriptions + totalPenalties + totalFormFees + totalPayments - totalExpenses - totalLoansDistributed + totalAdjustments;
  const totalCash = (members.length === 0 && borrowers.length === 0) ? 0 : calculatedCash;

  const [notifications, setNotifications] = useState<any[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>(() => {
    const saved = localStorage.getItem('dismissedNotifications');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('dismissedNotifications', JSON.stringify(dismissedNotifications));
  }, [dismissedNotifications]);

  const dismissNotification = (id: string) => {
    setDismissedNotifications(prev => [...prev, id]);
  };

  useEffect(() => {
    const checkNotifications = () => {
      const alerts: any[] = [];
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const today = now.getDate();

      // Extract settings
      const subscriptionAmount = dbSettings.find(s => s.key === 'subscription_amount')?.value || 1000;
      const penaltyAmount = dbSettings.find(s => s.key === 'penalty_amount')?.value || 100;

      // 1. Borrower Notifications (Loan Profit Payments)
      borrowers.forEach(b => {
        const isProfitPaid = payments.some(p => 
          p.borrowerId === b.id && 
          p.type === 'profit' && 
          p.month === currentMonth && 
          p.year === currentYear
        );

        if (!isProfitPaid) {
          if (today >= meetingDay - 5) {
            const daysLeft = meetingDay - today;
            let title = "";
            let urgency = "normal";
            
            if (daysLeft > 0) {
              title = `${b.name} এর ঋণের লভ্যাংশ প্রদানের সময় সমাগত (বাকি ${daysLeft} দিন)`;
            } else if (daysLeft === 0) {
              title = `${b.name} এর ঋণের লভ্যাংশ প্রদানের আজই শেষ দিন!`;
              urgency = "high";
            } else {
              title = `${b.name} এর ঋণের লভ্যাংশ প্রদান বকেয়া রয়েছে (${Math.abs(daysLeft)} দিন পার)`;
              urgency = "extreme";
            }

            alerts.push({
              id: `loan-${b.id}-${currentMonth}-${currentYear}`,
              title,
              type: 'loan',
              urgency,
              targetName: b.name
            });
          }
        }
      });

      // 2. Member Notifications (Subscriptions & Penalties)
      members.forEach(m => {
        const isSubPaid = subscriptions.some(s => 
          s.memberId === m.id && 
          s.month === currentMonth && 
          s.year === currentYear
        );

        if (!isSubPaid) {
          if (today > meetingDay) {
            alerts.push({
              id: `sub-${m.id}-${currentMonth}-${currentYear}`,
              title: `${m.name} এর এই মাসের চাঁদা বকেয়া এবং জরিমানা (৳${penaltyAmount}) যোগ হয়েছে`,
              type: 'member',
              urgency: 'high',
              targetName: m.name
            });
          } else if (today >= meetingDay - 3) {
            const daysLeft = meetingDay - today;
            alerts.push({
              id: `sub-${m.id}-${currentMonth}-${currentYear}`,
              title: `${m.name} এর মাসিক চাঁদা জমা দেওয়ার সময় সমাগত (${daysLeft === 0 ? 'আজই শেষ দিন' : 'বাকি ' + daysLeft + ' দিন'})`,
              type: 'member',
              urgency: 'normal',
              targetName: m.name
            });
          }
        }
      });

      // 3. Unread Portal Messages
      const unreadMessages = portalMessages.filter(m => !m.read && m.recipientId === 'admin');
      unreadMessages.forEach(m => {
        alerts.push({
          id: `msg-${m.id}`,
          title: `নতুন মেসেজ (${m.senderName}): ${m.message.length > 30 ? m.message.substring(0, 30) + '...' : m.message}`,
          type: 'message',
          urgency: 'high',
          targetName: m.senderName
        });
      });

      setNotifications(alerts.filter(a => !dismissedNotifications.includes(a.id)));
    };

    if (borrowers.length > 0 || members.length > 0 || portalMessages.length > 0) {
      checkNotifications();
    }
  }, [
    JSON.stringify(borrowers), 
    JSON.stringify(members), 
    JSON.stringify(subscriptions), 
    JSON.stringify(payments), 
    JSON.stringify(portalMessages),
    meetingDay, 
    JSON.stringify(dbSettings),
    dismissedNotifications
  ]);

  const onNotificationClick = (notification: any) => {
    if (notification.type === 'loan') {
      navigateTo('borrowers', notification.targetName || '');
    } else if (notification.type === 'member') {
      navigateTo('members', notification.targetName || '');
    } else if (notification.type === 'message') {
      navigateTo('member_admin');
    }
  };

  const handleAdminLogin = async () => {
    const savedPin = await db.settings.get('admin_pin');
    const currentPin = (savedPin && savedPin.value) ? String(savedPin.value) : '1234';
    
    if (String(pin) === currentPin) {
      setIsAdmin(true);
      setShowPinModal(false);
      setLoginError('');
    } else {
      setLoginError('ভুল পিন! (ডিফল্ট পিন: 1234)');
    }
  };

  const handleForgotPhoneSubmit = async () => {
    const savedPhone = await db.settings.get('admin_phone');
    const phone = (savedPhone && savedPhone.value) ? String(savedPhone.value) : '01700000000';
    
    if (String(forgotPhone) === phone) {
      setForgotStep(2);
      setLoginError('');
    } else {
      setLoginError('ভুল মোবাইল নম্বর!');
    }
  };

  const handleForgotPinReset = async () => {
    if (forgotNewPin.length !== 6) {
      setLoginError('পাসওয়ার্ড অবশ্যই ৬ সংখ্যার হতে হবে!');
      return;
    }
    if (forgotNewPin !== forgotConfirmPin) {
      setLoginError('পাসওয়ার্ড ম্যাচ করছে না!');
      return;
    }

    if (window.confirm('আপনি কি নিশ্চিত যে আপনি পাসওয়ার্ড পরিবর্তন করতে চান?')) {
      await db.settings.put({ key: 'admin_pin', value: forgotNewPin });
      setShowForgotPin(false);
      setForgotStep(1);
      setForgotPhone('');
      setForgotNewPin('');
      setForgotConfirmPin('');
      setLoginError('');
      alert('Password changed successfully. Please login with new password.');
    }
  };

  const [appTitle, setAppTitle] = useState('যুব সমাজ সমবায় সমিতি');
  const [appSubtitle, setAppSubtitle] = useState('সঞ্চয় করুন, ভবিষ্যৎ গড়ুন।');
  const [appLogo, setAppLogo] = useState<string | null>(null);

  const logTransaction = async (data: {
    amount: number;
    type: string;
    payerName: string;
    description: string;
    category: 'income' | 'expense' | 'info';
  }) => {
    try {
      await db.transactionLogs.add({
        ...data,
        date: getLocalISOString(),
      });
    } catch (error) {
      console.error('Failed to log transaction:', error);
    }
  };
  
  useEffect(() => {
    const day = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
    setMeetingDay(Number(day));
  }, [JSON.stringify(dbSettings)]);

  const isTransactionAllowed = () => {
    const now = new Date();
    const todayDay = now.getDate();
    
    // Check if today matches the meeting day (e.g. if today is 25 and meetingDay is 25)
    return todayDay === meetingDay;
  };

  const getDaysRemainingText = () => {
    const now = new Date();
    const today = now.getDate();
    if (today === meetingDay) return '';
    
    let diff = 0;
    if (today < meetingDay) {
      diff = meetingDay - today;
    } else {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      diff = (daysInMonth - today) + meetingDay;
    }
    
    // Convert to Bengali numerals
    const bnNum = diff.toString().replace(/\d/g, (d: any) => '০১২৩৪৫৬৭৮৯'[d]);
    return `সমিতির কার্যক্রম শুরু হতে আর ${bnNum} দিন বাকি আছে`;
  };

  const meetingDate = formatMeetingDate(meetingDay);
  const [menuTitles, setMenuTitles] = useState({
    cash: 'মোট ক্যাশ',
    members: 'সদস্যগণের নাম',
    borrowers: 'ঋণগ্রহীতার নাম',
    expenses: 'খরচ',
    income_expense: 'আয় ব্যয়ের হিসাব',
    reports: 'রিপোর্ট',
    calculator: 'ক্যালকুলেটর',
    backup: 'ব্যাকআপ & রিস্টোর',
    settings: 'সেটিংস'
  });

  useEffect(() => {
    const loadSettings = async () => {
      const title = await db.settings.get('app_title');
      const subtitle = await db.settings.get('app_subtitle');
      const mDay = await db.settings.get('meeting_day');
      const mTitles = await db.settings.get('menu_titles');
      const logo = await db.settings.get('app_logo');
      
      setAppTitle(title?.value || 'যুব সমাজ সমবায় সমিতি');
      setAppSubtitle(subtitle?.value || 'সঞ্চয় করুন, ভবিষ্যৎ গড়ুন।');
      setMeetingDay(Number(mDay?.value || 1));
      if (mTitles && mTitles.value !== undefined) setMenuTitles(mTitles.value);
      setAppLogo(logo?.value || null);
    };
    loadSettings();
  }, [JSON.stringify(dbSettings)]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('ছবি ১০ এমবি-র বেশি হতে পারবে না!');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const compressed = await compressImage(base64, 500, 500);
        callback(compressed);
      } catch (error) {
        console.error('Image compression error:', error);
        callback(base64); // Fallback to original if compression fails
      }
    };
    reader.onerror = () => {
      alert('ছবি আপলোড করতে সমস্যা হয়েছে।');
    };
    reader.readAsDataURL(file);
  };

  const goHome = () => {
    navigateTo('dashboard');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'members': return <MembersPage onBack={goHome} goHome={goHome} handleImageUpload={handleImageUpload} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} initialSearch={navSearch} totalCash={totalCash} />;
      case 'borrowers': return <BorrowersPage onBack={goHome} goHome={goHome} handleImageUpload={handleImageUpload} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} initialSearch={navSearch} totalCash={totalCash} />;
      case 'expenses': return <ExpensesPage onBack={goHome} goHome={goHome} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} />;
      case 'reports': return <ReportsPage onBack={goHome} goHome={goHome} darkMode={darkMode} />;
      case 'all_names': return <AllNamesPage onBack={goHome} goHome={goHome} />;
      case 'calculator': return <CalculatorPage onBack={goHome} goHome={goHome} />;
      case 'backup': return (
        <BackupPage 
          onBack={goHome} 
          goHome={goHome} 
        />
      );
      case 'notifications': return <NotificationsPage onBack={goHome} goHome={goHome} notifications={notifications} onDelete={dismissNotification} onNotificationClick={onNotificationClick} />;
      case 'settings': return <SettingsLock onBack={goHome} goHome={goHome} themeConfig={themeConfig} setThemeConfig={setThemeConfig} logTransaction={logTransaction} navigateTo={navigateTo} />;
      case 'cash': return <CashPage onBack={goHome} goHome={goHome} totalCash={totalCash} isAllowed={isTransactionAllowed()} />;
      case 'dynamic_cash': return (
        <DynamicCashPage 
          onBack={goHome} 
          goHome={goHome} 
          totalSubscriptions={totalSubscriptions} 
          totalProfit={totalProfit} 
          totalDeposits={totalDeposits} 
          totalPenalties={totalPenalties} 
          totalFormFees={totalFormFees}
          totalExpenses={totalExpenses}
          totalAdjustments={totalAdjustments}
        />
      );
      case 'dividend': return (
        <DividendPage 
          onBack={goHome} 
          goHome={goHome} 
          members={members} 
          deposits={deposits} 
          totalActualCash={totalDeposits + totalSubscriptions + totalProfit + totalPenalties + totalFormFees - totalExpenses} 
          totalExpenses={totalExpenses} 
        />
      );
      case 'income_expense': return (
        <IncomeExpensePage 
          onBack={goHome} 
          goHome={goHome} 
          totalIncome={totalSubscriptions + totalProfit + totalPenalties + totalFormFees}
          totalExpense={totalExpenses}
        />
      );
      case 'mfs': return <MfsPage onBack={goHome} goHome={goHome} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} />;
      case 'installment': return <InstallmentPage onBack={goHome} goHome={goHome} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} handleImageUpload={handleImageUpload} totalCash={totalCash} />;
      case 'transactions': return <TransactionsPage onBack={goHome} goHome={goHome} transactionLogs={transactionLogs} />;
      case 'contacts': return <ContactsPage onBack={goHome} goHome={goHome} />;
      case 'performance': return <PerformancePage onBack={goHome} goHome={goHome} members={members} subscriptions={subscriptions} deposits={deposits} borrowers={borrowers} payments={payments} />;
      case 'loan_calculator': return <LoanCalculatorPage onBack={goHome} goHome={goHome} />;
      case 'member_admin': return <MemberAdminPage onBack={goHome} members={members} borrowers={borrowers} pendingPayments={pendingPayments} portalMessages={portalMessages} />;
      case 'member_portal': return <MemberPortalPage onBack={goHome} members={members} borrowers={borrowers} subscriptions={subscriptions} payments={payments} pendingPayments={pendingPayments} dbSettings={dbSettings || []} />;
      default: return (
        <div className="p-4 max-w-lg mx-auto pb-32">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-800 dark:to-primary-950 rounded-[2.5rem] p-8 shadow-xl mb-8 mt-4 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary-400/20 rounded-full blur-3xl" />
            
            <div className="absolute top-4 left-4 z-20">
              <button 
                onClick={() => navigateTo('notifications')}
                className="p-2 bg-white/10 backdrop-blur-md text-white hover:bg-white/20 rounded-xl transition-all border border-white/10 relative z-20"
                title="নোটিফিকেশন"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-[10px] font-black flex items-center justify-center rounded-full border-2 border-primary-600">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>
            </div>

            <div className="absolute top-4 right-4 flex gap-2 z-20">
              <button 
                onClick={() => setThemeConfig({ ...themeConfig, mode: darkMode ? 'light' : 'dark' })}
                className="p-2 bg-white/10 backdrop-blur-md text-white hover:bg-white/20 rounded-xl transition-all border border-white/10 relative z-20"
                title="ডার্ক মোড"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button 
                onClick={handleLogout}
                className="p-2 bg-rose-500/20 backdrop-blur-md text-white hover:bg-rose-500/40 rounded-xl transition-all border border-rose-500/30"
                title="লগ আউট"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center relative z-10">
              <div className="flex flex-col items-center justify-center gap-4 mb-4">
                {appLogo ? (
                  <div className="p-1 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-[0_8px_16px_rgba(0,0,0,0.2),_inset_0_2px_4px_rgba(255,255,255,0.4)] relative group cursor-pointer">
                    <img src={appLogo} alt="Logo" className="w-16 h-16 object-contain rounded-xl" />
                  </div>
                ) : (
                  <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-[0_8px_16px_rgba(0,0,0,0.2),_inset_0_2px_4px_rgba(255,255,255,0.4)] relative group cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-[0_12px_20px_rgba(0,0,0,0.2),_inset_0_2px_4px_rgba(255,255,255,0.5)]">
                    <LayoutDashboard className="w-8 h-8 text-white drop-shadow-md transition-transform group-hover:scale-110" />
                  </div>
                )}
                <div className="flex flex-col items-center text-center px-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-md">{appTitle}</h1>
                  <p className="text-primary-100 font-bold text-xs uppercase tracking-widest mt-2 px-3 py-1 bg-white/10 rounded-full">মিটিং এর তারিখ: {meetingDate}</p>
                  <DigitalClock />
                </div>
              </div>
              
              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-4" />
              
              <div className="w-full overflow-hidden whitespace-nowrap relative h-6">
                <motion.p 
                  animate={{ x: [400, -800] }}
                  transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                  className="text-primary-50/80 text-sm font-medium absolute whitespace-nowrap"
                >
                  {appSubtitle} • সঞ্চয় করুন, ভবিষ্যৎ গড়ুন • একতাই বল • সততাই মূলধন • {appSubtitle}
                </motion.p>
              </div>
              
              {/* Transaction Window Status */}
              <div className="mt-5 w-full flex flex-col items-center gap-2">
                <div className={cn(
                  "px-6 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-3 shadow-lg backdrop-blur-md transition-all border self-stretch",
                  isTransactionAllowed() 
                    ? "bg-white/20 text-white border-white/30" 
                    : "bg-red-500/20 text-red-100 border-red-500/30"
                )}>
                  <div className={cn(
                    "w-3 h-3 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] flex-shrink-0",
                    isTransactionAllowed() ? "bg-primary-400 animate-pulse" : "bg-red-500"
                  )} />
                  <span className="tracking-wider uppercase text-center flex-1">
                    {isTransactionAllowed() ? 'লেনদেন চালু আছে' : 'লেনদেন বন্ধ আছে'}
                  </span>
                </div>
                {!isTransactionAllowed() && (
                  <div className="px-4 py-2 bg-black/20 backdrop-blur-md rounded-xl border border-white/10 text-white/90 text-xs font-medium text-center shadow-inner">
                    {getDaysRemainingText()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Cash Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden cursor-pointer"
              onClick={() => navigateTo('cash')}
            >
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <Wallet className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">সর্বমোট ফান্ড</p>
                </div>
                <h2 className="text-2xl font-black text-primary-600 dark:text-primary-400">{formatCurrency(totalCash)}</h2>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden cursor-pointer"
              onClick={() => navigateTo('dynamic_cash')}
            >
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">প্রকৃত ক্যাশ</p>
                </div>
                <h2 className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(totalDeposits + totalSubscriptions + totalProfit + totalPenalties + totalFormFees - totalExpenses + totalAdjustments)}</h2>
              </div>
            </motion.div>
          </div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-purple-200/50 relative overflow-hidden cursor-pointer mb-8 flex items-center justify-between"
            onClick={() => navigateTo('dividend')}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1 opacity-80">
                <PieChart className="w-4 h-4" />
                <p className="text-xs font-bold uppercase tracking-wider">শেয়ার ও লভ্যাংশ</p>
              </div>
              <h2 className="text-xl font-black">লভ্যাংশ বন্টন দেখুন</h2>
            </div>
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <ChevronRight className="w-6 h-6" />
            </div>
            <PieChart className="absolute right-[-20px] bottom-[-20px] w-32 h-32 opacity-10" />
          </motion.div>

          {/* Stats Row */}
          <div className="mb-8">
            <h3 className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 ml-2">আর্থিক সারসংক্ষেপ</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'জমা চাঁদা', value: totalSubscriptions, color: 'from-blue-500 to-blue-700', icon: Wallet },
                { label: 'মোট মুনাফা', value: totalProfit, color: 'from-orange-500 to-orange-700', icon: TrendingUp },
                { label: 'মোট ঋণ বিতরণ', value: totalLoansDistributed, color: 'from-indigo-500 to-indigo-700', icon: HandCoins },
                { label: 'জরিমানা', value: totalPenalties, color: 'from-rose-500 to-rose-700', icon: AlertCircle },
                { label: 'ফরম ফি', value: totalFormFees, color: 'from-emerald-500 to-emerald-700', icon: FileText },
                { label: 'এম.এফ.এস', value: totalMfs, color: 'from-violet-500 to-violet-700', icon: CloudUpload },
                { label: 'মোট কিস্তি', value: totalInstallmentPayments, color: 'from-teal-500 to-teal-700', icon: Layers },
                { label: 'যৌগিক মুনাফা', value: totalCompoundCollected, color: 'from-fuchsia-500 to-fuchsia-700', icon: Activity },
              ].map((stat, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "relative overflow-hidden p-3 rounded-2xl transition-all duration-200 group border-b-4",
                    "bg-gradient-to-br", stat.color,
                    "border-black/20 active:translate-y-1 active:border-b-0 active:mt-1",
                    "shadow-[0_8px_16px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,0.3)]"
                  )}
                >
                  <div className="absolute -top-2 -right-2 w-12 h-12 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                  <div className="flex flex-col items-center relative z-10">
                    <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md mb-2 shadow-inner border border-white/20">
                      <stat.icon className="w-4 h-4 text-white drop-shadow-sm" />
                    </div>
                    <p className="text-[10px] font-bold text-white/80 uppercase tracking-tighter mb-0.5">{stat.label}</p>
                    <p className="text-sm font-black text-white drop-shadow-md">{formatCurrency(stat.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Menu Grid */}
          <div className="mb-4">
            <h3 className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4 ml-2">কুইক মেনু</h3>
            <div className="grid grid-cols-2 gap-4">
              <Card title={menuTitles?.cash || 'সর্বমোট ফান্ড'} icon={Wallet} color="from-blue-400 to-blue-600" onClick={() => navigateTo('cash')} />
              <Card title="এম.এফ.এস জমা (বিকাশ/নগদ)" icon={CloudUpload} color="from-pink-400 to-pink-600" onClick={() => navigateTo('mfs')} />
              <Card title="যোগাযোগের তালিকা" icon={Phone} color="from-green-400 to-green-600" onClick={() => navigateTo('contacts')} />
              <Card title="সদস্য ও ঋণগ্রহীতা" icon={Users} color="from-indigo-400 to-indigo-600" onClick={() => navigateTo('all_names')} />
              <Card title="লোন ক্যালকুলেটর" icon={Calculator} color="from-purple-400 to-purple-600" onClick={() => navigateTo('loan_calculator')} />
              <Card title="লেনদেনের ইতিহাস" icon={History} color="from-emerald-400 to-emerald-600" onClick={() => navigateTo('transactions')} />
              <Card title={menuTitles?.expenses || 'খরচের তালিকা'} icon={PieChart} color="from-red-400 to-red-600" onClick={() => navigateTo('expenses')} />
              <Card title={menuTitles?.settings || 'সেটিংস'} icon={Settings} color="from-slate-400 to-slate-600" onClick={() => navigateTo('settings')} />
            </div>
          </div>
          
          <AdSenseBanner />

          {/* Daily Collection Section */}
          <div className="pb-28">
            <DailyCollectionSection 
              subscriptions={subscriptions} 
              payments={payments} 
              mfsTransactions={mfsTransactions} 
              transactionLogs={transactionLogs}
            />
          </div>
        </div>
      );
    }
  };

  if (!isOnline) {
    return <OfflinePage />;
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 relative overflow-x-hidden transition-colors pb-[100px]">
      {/* Subtle background elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-100/20 dark:bg-primary-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100/20 dark:bg-blue-900/20 rounded-full blur-[120px]" />
      </div>

      <AnimatePresence>
        {transitionScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-primary-600 dark:bg-primary-900 z-[200] flex flex-col items-center justify-center p-4 text-center"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -20 }}
              animate={{ scale: 1.2, rotate: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 260, 
                damping: 20 
              }}
              className="text-8xl mb-8 drop-shadow-2xl"
            >
              {transitionScreen === 'login' ? '😊' : '👋'}
            </motion.div>
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-black text-white tracking-tight leading-tight px-4"
            >
              {transitionScreen === 'login' 
                ? `${appTitle} এ স্বাগতম!` 
                : 'ফেলে আসার জন্য ধন্যবাদ, টা টা!'}
            </motion.h2>
            <div className="mt-8">
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.3, 1, 0.3]
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                    className="w-3 h-3 bg-white rounded-full"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 bg-gradient-to-br from-primary-700 to-primary-900 z-[100] flex flex-col items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col items-center"
            >
              <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[3rem] shadow-[0_16px_40px_rgba(0,0,0,0.3),_inset_0_2px_10px_rgba(255,255,255,0.4)] mb-8 border border-white/20 transform transition-transform hover:-translate-y-2 group cursor-pointer">
                <div className="bg-white p-6 rounded-[2.5rem] shadow-[inset_0_-8px_12px_rgba(0,0,0,0.1),_0_8px_16px_rgba(0,0,0,0.1)] relative">
                  {appLogo ? (
                    <img src={appLogo} alt="Logo" className="w-24 h-24 object-contain" />
                  ) : (
                    <LayoutDashboard className="w-24 h-24 text-primary-700 drop-shadow-[0_8px_8px_rgba(0,0,0,0.2)] transition-transform group-hover:scale-105" />
                  )}
                </div>
              </div>
              <h1 className="text-5xl font-black text-white mb-3 tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.25)]">{appTitle}</h1>
              <p className="text-primary-100 text-xl font-medium tracking-wide opacity-90">{appSubtitle}</p>
              
              <div className="mt-16">
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.3, 1, 0.3],
                        y: [0, -5, 0]
                      }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                      className="w-3.5 h-3.5 bg-white rounded-full shadow-sm"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!showSplash && showPinModal && currentPage !== 'member_portal' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-[3rem] p-10 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-700 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex flex-col items-center mb-6">
                <div className="bg-primary-50 p-5 rounded-[2rem] mb-5 shadow-inner">
                  <Lock className="w-10 h-10 text-primary-600" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Admin Login</h2>
                <p className="text-slate-500 text-center mt-3 font-medium">Please login to use the app</p>
              </div>

              {loginError && (
                <motion.p 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-red-500 text-center mb-6 font-bold text-sm flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {loginError}
                </motion.p>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Mobile Number (11 Digits)</label>
                  <input 
                    type="tel" 
                    maxLength={11}
                    value={mobile}
                    onChange={(e) => setMobile(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-primary-500 focus:ring-0 transition-colors bg-slate-50"
                    placeholder="01XXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Password (6 Digits)</label>
                  <input 
                    type="password" 
                    maxLength={6}
                    value={password}
                    onChange={(e) => setPassword(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-primary-500 focus:ring-0 transition-colors bg-slate-50"
                    placeholder="******"
                  />
                </div>
              </div>

              <button 
                onClick={handleLogin}
                className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-primary-700 transition-colors mb-4 shadow-lg shadow-primary-200"
              >
                Login
              </button>

              <button 
                onClick={() => {
                  setLoginError('');
                  navigateTo('member_portal');
                }}
                className="w-full bg-indigo-50 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-slate-600 text-indigo-600 dark:text-indigo-300 py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-indigo-100 dark:border-slate-600 mb-6"
              >
                <Users className="w-4 h-4 text-indigo-500" /> সদস্য পোর্টাল লগইন
              </button>

              <button 
                onClick={() => setShowForgotPin(true)}
                className="w-full text-primary-600 font-bold hover:text-primary-700 transition-colors"
              >
                Forgot Password?
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForgotPin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-700"
            >
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-primary-600" />
                </div>
                <h2 className="text-2xl font-bold">Password Recovery</h2>
                <p className="text-slate-500 text-center mt-2">
                  {forgotStep === 1 ? 'Enter your mobile number' : 'Enter new password'}
                </p>
              </div>
              
              {forgotStep === 1 && (
                <>
                  <input 
                    type="tel" inputMode="numeric"
                    maxLength={11}
                    value={forgotPhone}
                    onChange={(e) => {
                      setForgotPhone(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''));
                      setLoginError('');
                    }}
                    className="w-full text-center text-xl py-4 border-2 border-slate-200 rounded-2xl focus:border-primary-500 focus:outline-none mb-2"
                    placeholder="Mobile Number"
                  />
                  {loginError && <p className="text-red-500 text-center mb-4 font-medium">{loginError}</p>}
                  <button 
                    onClick={handleForgotPhoneSubmit}
                    className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-primary-700 transition-colors mb-4"
                  >
                    Next Step
                  </button>
                </>
              )}

              {forgotStep === 2 && (
                <>
                  <div className="space-y-4 mb-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">New Password (6 Digits)</label>
                      <input 
                        type="password" inputMode="numeric"
                        maxLength={6}
                        value={forgotNewPin}
                        onChange={(e) => {
                          setForgotNewPin(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''));
                          setLoginError('');
                        }}
                        className="w-full text-center text-3xl tracking-[1em] py-4 border-2 border-slate-200 rounded-2xl focus:border-primary-500 focus:outline-none bg-slate-50"
                        placeholder="******"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">Confirm Password (6 Digits)</label>
                      <input 
                        type="password" inputMode="numeric"
                        maxLength={6}
                        value={forgotConfirmPin}
                        onChange={(e) => {
                          setForgotConfirmPin(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''));
                          setLoginError('');
                        }}
                        className="w-full text-center text-3xl tracking-[1em] py-4 border-2 border-slate-200 rounded-2xl focus:border-primary-500 focus:outline-none bg-slate-50"
                        placeholder="******"
                      />
                    </div>
                  </div>
                  {loginError && <p className="text-red-500 text-center mb-4 font-medium">{loginError}</p>}
                  <button 
                    onClick={handleForgotPinReset}
                    className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-primary-700 transition-colors mb-4 shadow-lg shadow-primary-200"
                  >
                    Reset Password
                  </button>
                </>
              )}
              
              <button 
                onClick={() => {
                  setShowForgotPin(false);
                  setForgotStep(1);
                  setForgotPhone('');
                  setForgotNewPin('');
                  setLoginError('');
                }}
                className="w-full text-slate-500 font-medium hover:text-slate-700 transition-colors"
              >
                বাতিল করুন
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {renderPage()}
      
      <AnimatePresence>
        {!showSplash && !showPinModal && (
          <AnimatedBottomNav currentPage={currentPage} navigateTo={navigateTo} />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Pages ---

function DeleteConfirmationModal({ onConfirm, onClose }: any) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    // Check admin_pin (Login Password) - User explicitly asked to use the login password
    const savedPin = await db.settings.get('admin_pin');
    const currentPin = (savedPin && savedPin.value) ? String(savedPin.value) : '123456';
    
    if (String(pin) === currentPin) {
      onConfirm();
      onClose();
    } else {
      setError('ভুল এডমিন পাসওয়ার্ড!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-700"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">ডিলিট নিশ্চিত করুন</h2>
          <p className="text-slate-500 dark:text-slate-400 text-center mt-2">ডিলিট করতে অ্যাডমিন পিন দিন</p>
        </div>
        <input 
          type="password" inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''))}
          className="w-full text-center text-3xl tracking-[1em] py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-red-500 focus:outline-none mb-2 text-slate-900 dark:text-white"
          placeholder="****"
        />
        {error && <p className="text-red-500 text-center text-sm mb-4">{error}</p>}
        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 text-slate-500 dark:text-slate-400 font-bold"
          >
            বাতিল
          </button>
          <button 
            onClick={handleConfirm}
            className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors"
          >
            ডিলিট করুন
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ConfirmPaymentModal({ onConfirm, onClose, message }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-700"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center">নিশ্চিত করুন</h2>
          <p className="text-slate-500 dark:text-slate-400 text-center mt-2">{message}</p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            বাতিল
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            সাবমিট করুন
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DigitalPassbookModal({ member, onClose }: any) {
  const subscriptions = useLiveQuery<Subscription[]>(() => db.subscriptions.where('memberId').equals(member.id).toArray()) || [];
  const deposits = useLiveQuery<Deposit[]>(() => db.deposits.where('memberId').equals(member.id).toArray()) || [];
  const borrowers = useLiveQuery<Borrower[]>(() => db.borrowers.where('memberId').equals(member.id).toArray()) || [];
  const allPayments = useLiveQuery<Payment[]>(() => db.payments.toArray()) || [];
  
  const memberBorrowerIds = borrowers.map(b => b.id);
  const payments = allPayments.filter((p: any) => memberBorrowerIds.includes(p.borrowerId));

  // Assemble transactions
  const transactions: any[] = [];

  subscriptions.forEach(sub => {
    transactions.push({
      date: sub.date,
      type: 'চাঁদা',
      amount: sub.amount,
      penalty: sub.penalty || 0,
      description: `${BANGLISH_MONTHS[sub.month]} ${sub.year} চাঁদা জমা`
    });
  });

  deposits.forEach(dep => {
    transactions.push({
      date: dep.date,
      type: 'জামানত',
      amount: dep.amount,
      description: 'ঋণ জামানত জমা'
    });
  });

  borrowers.forEach(b => {
    transactions.push({
      date: b.loanDate,
      type: 'ঋণ গ্রহণ',
      amount: b.loanAmount,
      isOut: true,
      description: 'নতুন ঋণ প্রদান'
    });
  });

  payments.forEach(p => {
    transactions.push({
      date: p.date,
      type: p.type === 'profit' ? 'ঋণের লাভ' : 'ঋণের আসল',
      amount: p.amount,
      description: p.type === 'profit' ? 'ঋণের লাভ জমা' : 'ঋণের কিস্তি জমা'
    });
  });

  // Sort by date descending
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const generatePDFOptions = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Digital Passbook", 105, 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Name: ${transliterateBengali(member.name)} (${member.memberId})`, 14, 30);
    doc.text(`Phone: ${member.phone || 'N/A'}`, 14, 36);
    doc.text(`Date of Report: ${new Date().toLocaleDateString()}`, 14, 42);

    let y = 50;

    // Table header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Date", 16, y + 7);
    doc.text("Type", 50, y + 7);
    doc.text("Description", 90, y + 7);
    doc.text("Amount In", 145, y + 7);
    doc.text("Amount Out", 175, y + 7);
    
    y += 12;
    doc.setFont("helvetica", "normal");

    let totalIn = 0;
    let totalOut = 0;

    transactions.forEach(t => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      const totalAmt = t.amount + (t.penalty || 0);

      doc.text(new Date(t.date).toLocaleDateString(), 16, y);
      doc.text(transliterateBengali(t.type), 50, y);
      doc.text(transliterateBengali(t.description), 90, y);
      
      if (t.isOut) {
        doc.text(totalAmt.toString(), 175, y);
        totalOut += totalAmt;
      } else {
        doc.text(totalAmt.toString(), 145, y);
        totalIn += totalAmt;
      }
      y += 8;
    });

    // Summary
    y += 10;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.text("Summary:", 14, y);
    doc.text(`Total In: BDT ${totalIn}`, 14, y + 8);
    doc.text(`Total Out: BDT ${totalOut}`, 14, y + 16);

    doc.save(`Passbook_${transliterateBengali(member.name)}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
      >
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ডিজিটাল পাশবই
            </h2>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">{member.name} ({member.memberId})</p>
          </div>
          <div className="flex gap-2">
            <button onClick={generatePDFOptions} className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-3 bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-xl shadow-sm transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {transactions.length === 0 ? (
            <div className="text-center py-10">
               <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
               <p className="text-slate-500 dark:text-slate-400 font-bold">কোনো লেনদেন পাওয়া যায়নি</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((t, index) => (
                <div key={index} className="flex gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                      t.isOut ? "bg-rose-100 dark:bg-rose-900/20 text-rose-600" : "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600"
                    )}>
                      {t.type === 'চাঁদা' ? <Activity className="w-5 h-5" /> :
                       t.type === 'জামানত' ? <Lock className="w-5 h-5" /> : 
                       t.type === 'ঋণ গ্রহণ' ? <Banknote className="w-5 h-5" /> : 
                       <History className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">{t.description}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {t.type}
                        </span>
                        <span className="text-xs font-bold text-slate-400 items-center flex gap-1"><Calendar className="w-3 h-3" /> {new Date(t.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "font-black text-lg",
                      t.isOut ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {t.isOut ? '-' : '+'}{formatCurrency(t.amount + (t.penalty || 0))}
                    </p>
                    {t.penalty ? (
                      <p className="text-[10px] text-rose-500 font-bold mt-0.5">(জরিমানা সহ)</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SubscriptionModal({ member, onClose, isTransactionAllowed, setMfsInitialData, logTransaction }: any) {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [confirmPayment, setConfirmPayment] = useState<any>(null);
  const [confirmPayAll, setConfirmPayAll] = useState(false);
  const [showPassbook, setShowPassbook] = useState(false);
  
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const penaltyAmount = dbSettings.find(s => s.key === 'penalty_amount')?.value || 200;
  const subscriptionAmount = dbSettings.find(s => s.key === 'subscription_amount')?.value || 1000;
  const isAllowed = isTransactionAllowed();

  const subscriptions = useLiveQuery<Subscription[]>(() => 
    db.subscriptions.where('memberId').equals(member.id).toArray()
  ) || [];

  const memberDeposits = useLiveQuery<Deposit[]>(() => 
    db.deposits.where('memberId').equals(member.id).toArray()
  ) || [];

  const months = BANGLISH_MONTHS;

  const isPaid = (m: number, y: number) => {
    return subscriptions.some(s => s.month === m && s.year === y);
  };

  const calculateDues = () => {
    const dues = [];
    const joinDate = new Date(member.joinDate);
    const now = new Date();
    
    let checkDate = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    while (checkDate <= currentMonthStart) {
      const m = checkDate.getMonth();
      const y = checkDate.getFullYear();
      
      const isJoinMonth = m === joinDate.getMonth() && y === joinDate.getFullYear();
      const hasDepositInJoinMonth = memberDeposits.some(d => {
        const dDate = new Date(d.date);
        return dDate.getMonth() === m && dDate.getFullYear() === y;
      });

      if (!isPaid(m, y)) {
        // If it's join month and has deposit, it's optional (not a due)
        if (!(isJoinMonth && hasDepositInJoinMonth)) {
          const isPastMonth = checkDate < currentMonthStart;
          const isPenaltyRequired = isPastMonth;
          dues.push({
            month: m,
            year: y,
            amount: isPenaltyRequired ? (subscriptionAmount + penaltyAmount) : subscriptionAmount,
            penalty: penaltyAmount,
            isPenaltyRequired: isPenaltyRequired
          });
        }
      }
      checkDate.setMonth(checkDate.getMonth() + 1);
    }
    return dues;
  };

  const dues = calculateDues();
  const totalDueAmount = dues.reduce((sum, d) => sum + d.amount, 0);
  const currentMonthPaid = isPaid(selectedMonth, selectedYear);
  const selectedMonthDue = dues.find(d => d.month === selectedMonth && d.year === selectedYear);

  const isJoinMonth = selectedMonth === new Date(member.joinDate).getMonth() && selectedYear === new Date(member.joinDate).getFullYear();
  const hasDepositInJoinMonth = memberDeposits.some(d => {
    const dDate = new Date(d.date);
    return dDate.getMonth() === selectedMonth && dDate.getFullYear() === selectedYear;
  });
  const isOptional = isJoinMonth && hasDepositInJoinMonth;

  const handlePay = async (month: number, year: number, amount: number, penalty: number) => {
    if (!isAllowed) {
      alert('Transaction window is closed!');
      return;
    }
    
    // Check if already paid to avoid ConstraintError
    const existing = await db.subscriptions
      .where('[memberId+month+year]')
      .equals([member.id, month, year])
      .first();
    
    if (existing) {
      alert('এই মাসের চাঁদা ইতিমধ্যে পরিশোধ করা হয়েছে।');
      return;
    }

    setConfirmPayment({ month, year, amount, penalty });
  };

  const executePayment = async () => {
    if (!confirmPayment) return;
    const { month, year, amount, penalty } = confirmPayment;
    setLoading(true);
    try {
      const subscription = {
        memberId: member.id,
        amount: amount,
        date: getLocalISOString(),
        month: month,
        year: year,
        penalty: penalty
      };
      
      await db.subscriptions.add(subscription);
      await logTransaction({
        amount: amount,
        type: 'সঞ্চয় চাঁদা',
        payerName: member.name,
        description: `${months[month]} ${year} মাসের চাঁদা ${penalty > 0 ? '(জরিমানা সহ)' : ''}`,
        category: 'income'
      });
      await generateReceipt(subscription);
    } catch (error) {
      console.error('Subscription error:', error);
      alert('চাঁদা জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
      setConfirmPayment(null);
    }
  };

  const handlePayAll = async () => {
    if (!isAllowed) {
      alert('Transaction window is closed!');
      return;
    }
    if (dues.length === 0) return;
    setConfirmPayAll(true);
  };

  const executePayAll = async () => {
    setLoading(true);
    
    try {
      await db.transaction('rw', [db.subscriptions], async () => {
        for (const due of dues) {
          // Check existence inside transaction for safety
          const existing = await db.subscriptions
            .where('[memberId+month+year]')
            .equals([member.id, due.month, due.year])
            .first();
          
          if (!existing) {
            await db.subscriptions.add({
              memberId: member.id,
              amount: due.amount,
              date: getLocalISOString(),
              month: due.month,
              year: due.year,
              penalty: due.isPenaltyRequired ? due.penalty : 0
            });
            await logTransaction({
              amount: due.amount,
              type: 'সঞ্চয় চাঁদা (বকেয়া)',
              payerName: member.name,
              description: `${months[due.month]} ${due.year} মাসের বকেয়া চাঁদা পরিশোধ`,
              category: 'income'
            });
          }
        }
      });
      alert('All dues cleared successfully.');
      onClose();
    } catch (error) {
      console.error('Pay all error:', error);
      alert('বকেয়া পরিশোধে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
      setConfirmPayAll(false);
    }
  };

  const handlePayLastAndCurrent = async () => {
    if (!isAllowed) {
      alert('Transaction window is closed!');
      return;
    }
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastYear = lastMonthDate.getFullYear();
 
    const lastMonthDue = dues.find(d => d.month === lastMonth && d.year === lastYear);
    const currentMonthDue = dues.find(d => d.month === currentMonth && d.year === currentYear);

    if (!lastMonthDue || !currentMonthDue) {
      alert('গত মাসের বকেয়া বা বর্তমান মাসের চাঁদা পাওয়া যায়নি।');
      return;
    }

    setLoading(true);
    try {
      await db.transaction('rw', [db.subscriptions], async () => {
        // Pay Last Month
        const existingLast = await db.subscriptions
          .where('[memberId+month+year]')
          .equals([member.id, lastMonth, lastYear])
          .first();
        
        if (!existingLast) {
          await db.subscriptions.add({
            memberId: member.id,
            amount: lastMonthDue.amount,
            date: getLocalISOString(),
            month: lastMonth,
            year: lastYear,
            penalty: lastMonthDue.isPenaltyRequired ? lastMonthDue.penalty : 0
          });
        }
        
        // Pay Current Month
        const existingCurrent = await db.subscriptions
          .where('[memberId+month+year]')
          .equals([member.id, currentMonth, currentYear])
          .first();
        
        if (!existingCurrent) {
          await db.subscriptions.add({
            memberId: member.id,
            amount: currentMonthDue.amount,
            date: getLocalISOString(),
            month: currentMonth,
            year: currentYear,
            penalty: currentMonthDue.isPenaltyRequired ? currentMonthDue.penalty : 0
          });
        }
      });
      alert('গত মাস ও বর্তমান মাসের চাঁদা সফলভাবে জমা হয়েছে।');
      onClose();
    } catch (error) {
      console.error('Pay last and current error:', error);
      alert('চাঁদা জমা দিতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const generateReceipt = async (sub: any) => {
    const doc = new jsPDF();
    const sig = await db.settings.get('authorized_signature');
    const receiptNameSetting = await db.settings.get('receipt_samity_name');
    const titleSetting = await db.settings.get('app_title');
    const samityNameRaw = receiptNameSetting?.value || titleSetting?.value || 'Yuba Samaj Samabay Samity';
    const samityName = transliterateBengali(samityNameRaw);
    const subtitleSetting = await db.settings.get('app_subtitle');
    const samitySubtitleRaw = subtitleSetting?.value || 'Save Today, Build Tomorrow';
    const samitySubtitle = transliterateBengali(samitySubtitleRaw);
    
    // Design
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(0, 0, 210, 297, 'F');
    
    doc.setDrawColor(16, 185, 129); // Emerald 500
    doc.setLineWidth(2);
    doc.rect(10, 10, 190, 277);
    
    doc.setFontSize(24);
    doc.setTextColor(16, 185, 129);
    doc.text(samityName, 105, 35, { align: 'center' });
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(30, 50, 180, 50);
    
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('SUBSCRIPTION RECEIPT', 105, 65, { align: 'center' });
    
    // Content Box
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(30, 75, 150, 100, 5, 5, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.roundedRect(30, 75, 150, 100, 5, 5, 'D');
    
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    
    let y = 95;
    const drawRow = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 45, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 110, y);
      y += 15;
    };

    drawRow('Member Name:', transliterateBengali(member.name));
    drawRow('Father\'s Name:', transliterateBengali(member.fatherName));
    drawRow('Member ID:', String(member.memberId));
    drawRow('Month:', `${months[sub.month]} ${sub.year}`);
    drawRow('Date:', new Date(sub.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    drawRow('Amount:', `${sub.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} Taka`);
    
    if (sub.penalty > 0) {
      drawRow('Note:', `${sub.penalty.toLocaleString('en-US', { minimumFractionDigits: 2 })} Taka Including Penalty`);
    }
    
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('This is a computer-generated official receipt.', 105, 200, { align: 'center' });
    
    if (sig?.value) {
      try {
        doc.addImage(sig.value, 'PNG', 140, 215, 40, 20);
      } catch (e) {
        console.error('Error adding signature to PDF', e);
      }
    }

    doc.setDrawColor(30, 41, 59);
    doc.line(140, 240, 180, 240);
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Authorized Signature', 160, 250, { align: 'center' });
    
    doc.save(`Receipt_Subscription_${transliterateBengali(member.name)}_${months[sub.month]}_${sub.year}.pdf`);
  };

  const generateProfileCard = () => {
    const doc = new jsPDF();
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 297, 'F');
    
    // Header background
    doc.setFillColor(37, 99, 235); // Blue 600
    doc.rect(10, 10, 190, 40, 'F');

    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text('Somiti Member ID Card', 105, 30, { align: 'center' });

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(20, 60, 170, 120, 5, 5, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(20, 60, 170, 120, 5, 5, 'S');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(transliterateBengali(member.name), 70, 80);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    
    let y = 100;
    const drawRow = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text(label, 70, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(value, 110, y);
      y += 15;
    };

    drawRow('Member ID:', String(member.memberId));
    drawRow('Phone:', member.phone || 'N/A');
    drawRow('Join Date:', member.joinDate);
    drawRow('Father\'s Name:', transliterateBengali(member.fatherName));

    if (member.photo) {
      try {
        doc.addImage(member.photo, 'JPEG', 30, 70, 30, 30);
      } catch (e) {
        console.error('Error adding photo to PDF', e);
      }
    }

    doc.save(`Member_Profile_${transliterateBengali(member.name)}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl my-8 max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700"
      >
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden shadow-[inset_0_-3px_5px_rgba(0,0,0,0.15)] ring-2 ring-white dark:ring-slate-800">
              {member.photo ? (
                <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <Users className="w-full h-full p-4 text-slate-300 dark:text-slate-600 drop-shadow-sm" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{member.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Father: {member.fatherName}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">ID: {member.memberId}</p>
            </div>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
            <button title="ডিজিটাল পাশবই" onClick={() => setShowPassbook(true)} className="px-3 py-1 flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors">
              <BookOpen className="w-5 h-5" />
            </button>
            <button title="প্রোফাইল প্রিন্ট" onClick={generateProfileCard} className="px-3 py-1 flex items-center justify-center bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="px-3 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl mb-6 space-y-4 border border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            চাঁদা জমা দিন
          </h3>
          
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">তারিখ</p>
            <div className="flex gap-2">
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm flex-1 text-slate-900 dark:text-white focus:outline-none focus:border-primary-500"
              >
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm flex-1 text-slate-900 dark:text-white focus:outline-none focus:border-primary-500"
              >
                {Array.from({ length: 20 }, (_, i) => 2024 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">টাকার পরিমাণ</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  ৳ {selectedMonthDue ? selectedMonthDue.amount.toLocaleString('bn-BD') : subscriptionAmount.toLocaleString('bn-BD')}
                </p>
                {isOptional && !currentMonthPaid && (
                  <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-lg border border-blue-100 dark:border-blue-800">
                    ক্লজিন মাসের চাঁদা
                  </span>
                )}
              </div>
              {selectedMonthDue?.penalty > 0 && (
                <span className={cn(
                  "text-xs block mt-1",
                  selectedMonthDue.isPenaltyRequired ? "text-red-500 dark:text-red-400" : "text-slate-400 dark:text-slate-500 line-through"
                )}>
                  জরিমানা: ৳ {selectedMonthDue.penalty.toLocaleString('bn-BD')} {selectedMonthDue.isPenaltyRequired ? 'সহ' : ''}
                </span>
              )}
            </div>
            
            {currentMonthPaid ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center gap-2 text-primary-600 dark:text-primary-400 font-bold bg-primary-50 dark:bg-primary-900/20 py-3 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                  পরিশোধিত
                </div>
                <button 
                  onClick={() => {
                    const sub = subscriptions.find(s => s.month === selectedMonth && s.year === selectedYear);
                    if (sub) generateReceipt(sub);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  রিসিট ডাউনলোড করুন
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={() => handlePay(selectedMonth, selectedYear, selectedMonthDue?.amount || subscriptionAmount, selectedMonthDue?.isPenaltyRequired ? selectedMonthDue.penalty : 0)}
                  disabled={loading || !isAllowed}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold transition-all disabled:opacity-50 text-sm",
                    isAllowed ? "bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200 dark:shadow-none" : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                  )}
                >
                  {loading ? 'প্রসেসিং...' : isAllowed ? 'নগদ জমা' : 'সময় শেষ'}
                </button>
                <button 
                  onClick={() => {
                    setMfsInitialData({
                      type: 'subscription',
                      payerId: member.id,
                      amount: selectedMonthDue?.amount || subscriptionAmount,
                      penaltyAmount: selectedMonthDue?.penalty || 0,
                      month: selectedMonth,
                      year: selectedYear
                    });
                  }}
                  disabled={!isAllowed}
                  className="flex-1 flex items-center justify-center gap-1 py-3 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 transition-colors disabled:opacity-50 shadow-lg shadow-pink-200 dark:shadow-none"
                >
                  <Smartphone className="w-4 h-4" />
                  বিকাশ/নগদ
                </button>
              </div>
            )}
          </div>
        </div>

        {dues.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl mb-6 border border-orange-100 dark:border-orange-800/50 space-y-3">
            <div className="flex justify-between items-center mb-1">
              <h4 className="font-bold text-orange-800 dark:text-orange-300 text-sm">বকেয়া চাঁদা ({dues.length} মাস)</h4>
              <p className="text-lg font-black text-orange-900 dark:text-orange-200">৳ {totalDueAmount.toLocaleString('bn-BD')}</p>
            </div>
            
            {/* Combined Payment Option (Last Month + Penalty + Current Month) */}
            {(() => {
              const now = new Date();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();
              const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
              const lastMonth = lastMonthDate.getMonth();
              const lastYear = lastMonthDate.getFullYear();
              
              const hasLastMonth = dues.some(d => d.month === lastMonth && d.year === lastYear);
              const hasCurrentMonth = dues.some(d => d.month === currentMonth && d.year === currentYear);
              
              if (hasLastMonth && hasCurrentMonth) {
                const lastMonthDue = dues.find(d => d.month === lastMonth && d.year === lastYear)!;
                const currentMonthDue = dues.find(d => d.month === currentMonth && d.year === currentYear)!;
                return (
                  <button 
                    onClick={handlePayLastAndCurrent}
                    disabled={loading || !isAllowed}
                    className={cn(
                      "w-full py-3 rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 border-2 border-orange-200 dark:border-orange-800/50 bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30",
                      !isAllowed && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Calculator className="w-4 h-4" />
                    গত মাস + জরিমানা + বর্তমান মাস (৳ {(lastMonthDue.amount + currentMonthDue.amount).toLocaleString('bn-BD')})
                  </button>
                );
              }
              return null;
            })()}

            <button 
              onClick={handlePayAll}
              disabled={loading || !isAllowed}
              className={cn(
                "w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-200 dark:shadow-none",
                isAllowed ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              )}
            >
              <Wallet className="w-4 h-4" />
              {isAllowed ? 'একত্রে সকল বকেয়া পরিশোধ করুন' : 'সময় শেষ'}
            </button>
          </div>
        )}

        <div>
          <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            চাঁদা প্রদানের ইতিহাস ({selectedYear})
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {months.map((m, i) => {
              const paid = isPaid(i, selectedYear);
              return (
                <div 
                  key={i}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all",
                    paid 
                      ? "bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800/50 text-primary-700 dark:text-primary-400" 
                      : "bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                  )}
                >
                  <p className="text-[10px] font-medium opacity-70">{m}</p>
                  {paid ? (
                    <div className="flex flex-col items-center gap-1 mt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <button 
                        onClick={() => {
                          const sub = subscriptions.find(s => s.month === i && s.year === selectedYear);
                          if (sub) generateReceipt(sub);
                        }}
                        className="p-1 hover:bg-primary-100 dark:hover:bg-primary-800/50 rounded-lg text-primary-600 dark:text-primary-400"
                        title="রিসিট ডাউনলোড"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setMfsInitialData({
                          type: 'subscription',
                          payerId: member.id,
                          amount: subscriptionAmount,
                          month: i,
                          year: selectedYear
                        });
                      }}
                      className="text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition-colors mt-1"
                    >
                      <Smartphone className="w-4 h-4 mx-auto" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {member.phone && (
          <button 
            onClick={() => {
              const msg = generateMessage('subscription', member.name, subscriptionAmount);
              window.open(`https://wa.me/88${member.phone}?text=${msg}`, '_blank');
            }}
            className="w-full mt-6 py-3 border-2 border-primary-100 text-primary-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-50"
          >
            <MessageSquare className="w-5 h-5" />
            মেসেজ পাঠান
          </button>
        )}
      </motion.div>
      {confirmPayment && (
        <ConfirmPaymentModal 
          message={`আপনি কি ${months[confirmPayment.month]} ${confirmPayment.year} এর চাঁদা জমা দিতে নিশ্চিত?`}
          onConfirm={executePayment}
          onClose={() => setConfirmPayment(null)}
        />
      )}
      {confirmPayAll && (
        <ConfirmPaymentModal 
          message={`আপনি কি সকল বকেয়া চাঁদা (${formatCurrency(totalDueAmount)}) জমা দিতে নিশ্চিত?`}
          onConfirm={executePayAll}
          onClose={() => setConfirmPayAll(false)}
        />
      )}
      {showPassbook && <DigitalPassbookModal member={member} onClose={() => setShowPassbook(false)} />}
    </div>
  );
}

function ContactsPage({ onBack, goHome }: any) {
  const members = useLiveQuery<Member[]>(() => db.members.toArray()) || [];
  const borrowers = useLiveQuery<Borrower[]>(() => db.borrowers.toArray()) || [];
  const [search, setSearch] = useState('');

  const allContacts = [
    ...members.map(m => ({ id: `m_${m.id}`, name: m.name, phone: m.phone, type: 'সদস্য', photo: m.photo })),
    ...borrowers.map(b => ({ id: `b_${b.id}`, name: b.name, phone: b.phone, type: 'ঋণগ্রহীতা', photo: b.photo }))
  ];

  const uniqueContacts = Array.from(new Map(allContacts.map(item => [item.phone, item])).values());

  const filteredContacts = uniqueContacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="p-4 max-w-lg mx-auto pb-32">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black">কন্টাক্ট লিস্ট</h1>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm mb-6 sticky top-4 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredContacts.map(contact => (
          <div key={contact.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              {contact.photo ? (
                <img src={contact.photo} alt={contact.name} className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg">
                  {contact.name.charAt(0)}
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{contact.name}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-md text-[10px] uppercase font-bold tracking-wider">{contact.type}</span>
                  <span>{contact.phone}</span>
                </div>
              </div>
            </div>
            
            <a 
              href={`tel:${contact.phone}`}
              className="p-3 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl hover:bg-primary-200 dark:hover:bg-primary-800/50 transition-colors active:scale-95 flex-shrink-0"
            >
              <Phone className="w-5 h-5" />
            </a>
          </div>
        ))}

        {filteredContacts.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            কোনো কন্টাক্ট পাওয়া যায়নি
          </div>
        )}
      </div>
    </div>
  );
}

function MembersPage({ onBack, goHome, handleImageUpload, isTransactionAllowed, logTransaction, initialSearch, totalCash }: any) {
  const members = useLiveQuery<Member[]>(() => db.members.toArray(), [], 'members') || [];
  const subscriptions = useLiveQuery<Subscription[]>(() => db.subscriptions.toArray(), [], 'subscriptions') || [];
  const dbSettings = useLiveQuery<AppSetting[]>(() => db.settings.toArray(), [], 'settings') || [];
  const penaltyAmount = dbSettings.find(s => s.key === 'penalty_amount')?.value || 200;
  const subscriptionAmount = dbSettings.find(s => s.key === 'subscription_amount')?.value || 1000;
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState(initialSearch || '');
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberToDelete, setMemberToDelete] = useState<any>(null);
  const [mfsInitialData, setMfsInitialData] = useState<any>(null);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const isAllowed = isTransactionAllowed();

  const filteredMembers = members.filter(m => 
    (m.name && m.name.toLowerCase().includes(search.toLowerCase())) || 
    (m.memberId && m.memberId.includes(search))
  );

  const handleDelete = async () => {
    if (memberToDelete) {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Member Exit Settlement Report", 14, 22);
      
      doc.setFontSize(11);
      doc.text(`Member Name: ${transliterateBengali(memberToDelete.name)}`, 14, 32);
      doc.text(`ID: ${memberToDelete.memberId}`, 14, 38);
      doc.text(`Phone: ${memberToDelete.phone}`, 14, 44);
      
      const mSubs = await db.subscriptions.where('memberId').equals(memberToDelete.id).toArray();
      const mDeps = await db.deposits.where('memberId').equals(memberToDelete.id).toArray();
      const months = BANGLISH_MONTHS;
      
      let totalSubs = 0;
      const subData = mSubs.map((s, idx) => {
         totalSubs += s.amount;
         return [idx+1, 'Subscription', `${months[s.month]} ${s.year}`, `${s.amount} Taka`];
      });
      
      let totalDeps = 0;
      const depData = mDeps.map((d, idx) => {
         totalDeps += d.amount;
         return [idx+1+subData.length, 'Savings', new Date(d.date).toLocaleDateString(), `${d.amount} Taka`];
      });
      
      autoTable(doc, {
        startY: 55,
        head: [['#', 'Type', 'Date/Month', 'Amount']],
        body: [...subData, ...depData],
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
      });
      
      doc.setFontSize(10);
      doc.setTextColor(0, 150, 0);
      doc.text(`Total Subscriptions: ${totalSubs} Taka`, 14, (doc as any).lastAutoTable.finalY + 10);
      doc.text(`Total Savings: ${totalDeps} Taka`, 14, (doc as any).lastAutoTable.finalY + 16);
      doc.text("Member record has been permanently deleted from the system.", 14, (doc as any).lastAutoTable.finalY + 26);
      
      doc.save(`Member_Exit_${transliterateBengali(memberToDelete.name).replace(/\s+/g, '_')}_${memberToDelete.phone}.pdf`);

      await db.transaction('rw', [db.members, db.subscriptions, db.deposits, db.mfsTransactions], async () => {
        await db.members.delete(memberToDelete.id);
        // Also delete related subscriptions, deposits, and MFS transactions
        await db.subscriptions.where('memberId').equals(memberToDelete.id).delete();
        await db.deposits.where('memberId').equals(memberToDelete.id).delete();
        await db.mfsTransactions.where('payerId').equals(memberToDelete.id).filter(t => t.type === 'subscription').delete();
      });
      setMemberToDelete(null);
      alert('সদস্য ইতিহাস ডিলিট এবং পিডিএফ ডাউনলোড সম্পন্ন হয়েছে।');
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-32">
      <PageHeader title="Member List" onBack={onBack} goHome={goHome} />
      <AdSenseBanner />
      
      {/* Total Cash Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-4 mb-6 shadow-lg shadow-blue-500/20 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-blue-100">Total Association Fund</p>
            <p className="text-xl font-black">{formatCurrency(totalCash || 0)}</p>
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Search member..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none shadow-sm transition-colors"
        />
      </div>

      <div className="space-y-4">
        {filteredMembers.map(member => {
          const paid = subscriptions.some(s => s && s.memberId === member.id && s.month === currentMonth && s.year === currentYear);
          const joinDate = new Date(member.joinDate);
          const isJoinMonth = currentMonth === joinDate.getMonth() && currentYear === joinDate.getFullYear();
          const showDue = !paid && !isJoinMonth;
          
          // Calculate penalty if not paid
          let calculatedPenalty = 0;
          if (showDue) {
            const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
            const lastMonth = lastMonthDate.getMonth();
            const lastYear = lastMonthDate.getFullYear();
            
            const joinMonthStart = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
            
            // Only check for penalty if last month was a valid membership month
            if (lastMonthDate >= joinMonthStart) {
              const lastPaid = subscriptions.some(s => s && s.memberId === member.id && s.month === lastMonth && s.year === lastYear);
              if (!lastPaid) {
                calculatedPenalty = penaltyAmount;
              }
            }
          }

          return (
            <div 
              key={member.id} 
              className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-pointer hover:border-primary-200 dark:hover:border-primary-400 transition-colors group relative overflow-hidden"
              onClick={() => setSelectedMember(member)}
            >
              {/* Payment Status Ribbon */}
              {(paid || showDue) && (
                <div className={cn(
                  "absolute top-0 right-0 px-3 py-1 text-[10px] font-bold rounded-bl-xl",
                  paid ? "bg-primary-500 text-white" : "bg-red-500 text-white"
                )}>
                  {paid ? 'পরিশোধিত' : 'বাকি'}
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 shadow-[inset_0_-3px_5px_rgba(0,0,0,0.15)] ring-2 ring-white dark:ring-slate-800">
                  {member.photo ? (
                    <img src={member.photo} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Users className="w-full h-full p-4 text-slate-300 dark:text-slate-600 drop-shadow-sm" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">{member.name}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-600/30">ID: {member.memberId}</p>
                    <p className="text-[10px] font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded-md border border-primary-100 dark:border-primary-800/50">চাঁদা: ৳ {subscriptionAmount.toLocaleString('bn-BD')}</p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{member.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end gap-2">
                  {paid ? (
                    <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded-full border border-primary-100 dark:border-primary-800/50">টাকা পরিশোধ</span>
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setMfsInitialData({
                          type: 'subscription',
                          payerId: member.id,
                          amount: subscriptionAmount,
                          penaltyAmount: calculatedPenalty,
                          month: currentMonth,
                          year: currentYear
                        });
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-pink-600 text-white rounded-full text-[10px] font-bold hover:bg-pink-700 transition-colors shadow-lg shadow-pink-200 dark:shadow-none"
                    >
                      <Smartphone className="w-3 h-3" />
                      বিকাশ/নগদ/রকেট
                    </button>
                  )}
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemberToDelete(member);
                      }}
                      className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button 
        onClick={() => setShowAdd(true)}
        disabled={!isAllowed}
        className={cn(
          "fixed bottom-24 right-4 sm:right-8 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all z-40",
          isAllowed ? "bg-primary-600 text-white hover:bg-primary-700 shadow-primary-200 dark:shadow-none" : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
        )}
      >
        <Plus className="w-8 h-8" />
      </button>

      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} handleImageUpload={handleImageUpload} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} />}
      {selectedMember && <SubscriptionModal member={selectedMember} onClose={() => setSelectedMember(null)} isTransactionAllowed={isTransactionAllowed} setMfsInitialData={setMfsInitialData} logTransaction={logTransaction} />}
      {memberToDelete && <DeleteConfirmationModal onConfirm={handleDelete} onClose={() => setMemberToDelete(null)} />}
      {mfsInitialData && <AddMfsModal initialData={mfsInitialData} onClose={() => setMfsInitialData(null)} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} />}
    </div>
  );
}

function AddMemberModal({ onClose, handleImageUpload, isTransactionAllowed, logTransaction }: any) {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const isAllowed = isTransactionAllowed ? isTransactionAllowed() : true;

  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    phone: '',
    address: '',
    memberId: '',
    photo: '',
    joinDate: getTodayDate(),
    initialDeposit: ''
  });

  useEffect(() => {
    const existingIds = members
      .map(m => parseInt(m.memberId))
      .filter(id => !isNaN(id))
      .sort((a, b) => a - b);
    
    let nextId = 1;
    for (const id of existingIds) {
      if (id === nextId) {
        nextId++;
      } else if (id > nextId) {
        break;
      }
    }
    setFormData(prev => ({ ...prev, memberId: String(nextId).padStart(3, '0') }));
  }, [JSON.stringify(members)]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!isAllowed) {
        alert('Transaction window is closed!');
        return;
      }

      if (!formData.name.trim()) {
        alert('Name is mandatory!');
        return;
      }

      if (!formData.photo) {
        alert('Member photo is mandatory!');
        return;
      }

      if (!/^\d{11}$/.test(formData.phone)) {
        alert('Mobile number must be 11 digits!');
        return;
      }
      
      // Duplicate check
      const existing = await db.members.where('name').equalsIgnoreCase(formData.name).first();
      if (existing) {
        alert('A member with this name already exists! Please use a different name.');
        return;
      }

      const { initialDeposit, ...memberData } = formData;
      const subAmount = dbSettings.find(s => s.key === 'subscription_amount')?.value || 1000;
      const newMemberId = await db.members.add({ ...memberData, subscriptionAmount: subAmount });
      
      if (initialDeposit && parseFloat(initialDeposit) > 0) {
        const depositAmount = parseFloat(initialDeposit);
        await db.deposits.add({
          memberId: newMemberId as string,
          amount: depositAmount,
          date: getLocalISOString()
        });
        await logTransaction({
          amount: depositAmount,
          type: 'প্রাথমিক আমানত',
          payerName: formData.name,
          description: `নতুন সদস্য হিসেবে প্রাথমিক আমানত জমা`,
          category: 'income'
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Error adding member:', error);
      alert('সদস্য যোগ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 pb-28 flex items-center justify-center overflow-y-auto">
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">নতুন সদস্য যোগ করুন</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <XCircle className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 relative overflow-hidden mb-3">
              {formData.photo ? (
                <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              )}
            </div>
            {!formData.photo ? (
              <div className="flex gap-2">
                <label className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100 dark:shadow-none active:scale-95">
                  <CloudUpload className="w-4 h-4" /> ছবি আপলোড করুন
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, (base64: string) => setFormData(prev => ({ ...prev, photo: base64 })))}
                    className="hidden" 
                  />
                </label>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, photo: '' }))}
                className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> ছবি মুছুন
              </button>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">সদস্যের নাম</label>
            <input 
              required
              placeholder="নাম লিখুন"
              value={formData.name}
              onChange={e => setFormData(prev => ({...prev, name: e.target.value}))}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">পিতার নাম</label>
            <input 
              required
              placeholder="পিতার নাম লিখুন"
              value={formData.fatherName}
              onChange={e => setFormData(prev => ({...prev, fatherName: e.target.value}))}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">মোবাইল নম্বর</label>
              <input 
                required
                type="tel"
                placeholder="১১ ডিজিটের নম্বর"
                value={formData.phone}
                onChange={e => {
                  const val = bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, '').slice(0, 11);
                  setFormData(prev => ({...prev, phone: val}));
                }}
                pattern="\d{11}"
                title="মোবাইল নম্বর অবশ্যই ১১ ডিজিটের হতে হবে"
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">সিরিয়াল নাম্বার</label>
              <input 
                required
                readOnly
                placeholder="সিরিয়াল নাম্বার"
                value={formData.memberId}
                className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-2xl border border-primary-100 dark:border-primary-800/50">
            <label className="text-xs font-bold text-primary-700 dark:text-primary-400 uppercase block mb-2">প্রাথমিক সঞ্চয় জমা (ঐচ্ছিক)</label>
            <input 
              type="text" inputMode="numeric"
              placeholder="৳ ০.০০"
              value={formData.initialDeposit}
              onChange={e => setFormData(prev => ({...prev, initialDeposit: bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, '')}))}
              className="w-full p-4 bg-white dark:bg-slate-800 rounded-xl border border-primary-200 dark:border-primary-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white font-bold"
            />
            <p className="text-[10px] text-primary-600 dark:text-primary-500 mt-2 italic">* প্রাথমিক সঞ্চয় জমা দিলে ওই মাসের চাঁদা ঐচ্ছিক হবে।</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">ঠিকানা</label>
            <textarea 
              required
              placeholder="ঠিকানা লিখুন"
              value={formData.address}
              onChange={e => setFormData(prev => ({...prev, address: e.target.value}))}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white h-24 resize-none"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-colors">বাতিল</button>
            <button 
              type="submit" 
              className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-200 dark:shadow-none transition-all"
            >
              সংরক্ষণ করুন
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function BorrowersPage({ onBack, goHome, handleImageUpload, isTransactionAllowed, logTransaction, initialSearch, totalCash }: any) {
  const borrowers = useLiveQuery<Borrower[]>(() => db.borrowers.toArray()) || [];
  const payments = useLiveQuery<Payment[]>(() => db.payments.toArray()) || [];
  const dbSettings = useLiveQuery<AppSetting[]>(() => db.settings.toArray()) || [];
  
  const profitPercentage = (dbSettings.find(s => s.key === 'profit_percentage')?.value || 5) / 100;
  const compoundPercentage = (dbSettings.find(s => s.key === 'compound_percentage')?.value || 10) / 100;

  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState(initialSearch || '');
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);
  const [borrowerToDelete, setBorrowerToDelete] = useState<any>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [mfsInitialData, setMfsInitialData] = useState<any>(null);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const isAllowed = isTransactionAllowed();

  const handleDelete = async () => {
    if (borrowerToDelete) {
      const allPayments = await db.payments.where('borrowerId').equals(borrowerToDelete.id).toArray();
      const activePayments = allPayments.filter(p => p.date >= borrowerToDelete.loanDate).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Rin-grohita Bidayer Hisab Biboroni", 14, 22);
      
      doc.setFontSize(11);
      doc.text(`Rin-grohitar Name: ${transliterateBengali(borrowerToDelete.name)}`, 14, 32);
      doc.text(`Phone: ${borrowerToDelete.phone}`, 14, 38);
      doc.text(`Loan Amount: ${borrowerToDelete.loanAmount} Taka`, 14, 44);
      doc.text(`Disbursement Date: ${borrowerToDelete.loanDate}`, 14, 50);
      
      const tableData = activePayments.map((p, idx) => [
        idx + 1,
        new Date(p.date).toLocaleDateString(),
        p.type === 'principal' ? 'Asol Taka' : (p.type === 'profit' ? 'Labh/Kisti' : p.type),
        `${p.amount} Taka`,
        p.remainingBalance !== undefined ? `${p.remainingBalance} Taka` : '-'
      ]);
      
      autoTable(doc, {
        startY: 60,
        head: [['#', 'Tarikh', 'Dhoron', 'Takar Poriman', 'Avoshisto Asol']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
      });
      
      doc.setFontSize(10);
      doc.setTextColor(0, 150, 0);
      doc.text("Rin-grohitar record chirothayi bhabe bondho kora hoyeche.", 14, (doc as any).lastAutoTable.finalY + 15);
      
      doc.save(`Bondho_Ringrohita_${transliterateBengali(borrowerToDelete.name).replace(/\s+/g, '_')}_${borrowerToDelete.phone}.pdf`);

      await db.transaction('rw', [db.borrowers, db.payments, db.mfsTransactions], async () => {
        await db.borrowers.delete(borrowerToDelete.id);
        // Also delete related payments and MFS transactions
        await db.payments.where('borrowerId').equals(borrowerToDelete.id).delete();
        await db.mfsTransactions.where('payerId').equals(borrowerToDelete.id).filter(t => t.type === 'profit').delete();
      });
      setBorrowerToDelete(null);
      alert('সদস্য ইতিহাস ডিলিট এবং পিডিএফ ডাউনলোড সম্পন্ন হয়েছে।');
    }
  };

  const filteredBorrowers = borrowers
    .filter(b => !b.notes?.includes('FIXED_INSTALLMENT'))
    .filter(b => 
      (b.name && b.name.toLowerCase().includes(search.toLowerCase())) || 
      (b.uid && b.uid.includes(search))
    );

  return (
    <div className="p-4 max-w-lg mx-auto pb-32">
      <PageHeader title="ঋণগ্রহীতার তালিকা" onBack={onBack} goHome={goHome} />
      <AdSenseBanner />
      
      {/* Total Cash Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-4 mb-6 shadow-lg shadow-blue-500/20 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-blue-100">সমিতির মোট ফান্ড</p>
            <p className="text-xl font-black">{formatCurrency(totalCash || 0)}</p>
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Search borrower..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none shadow-sm transition-colors"
        />
      </div>

      <div className="space-y-4">
        {filteredBorrowers.map(b => {
          const bPayments = payments.filter(p => p && p.borrowerId === b.id && p.date >= b.loanDate);
          const loanData = calculateLoan(b.loanAmount, b.loanDate, bPayments, b.customProfit, profitPercentage, compoundPercentage, b.notes);
          const profitPaidThisMonth = bPayments.some(p => p && p.type === 'profit' && p.month === currentMonth && p.year === currentYear);
          const showProfitDue = !profitPaidThisMonth && !loanData.isLoanMonth;
          const totalPrincipalPaid = bPayments.filter(p => p && p.type === 'principal').reduce((sum, p) => sum + p.amount, 0);
          const isFullyPaid = totalPrincipalPaid >= b.loanAmount;
          
          return (
            <div 
              key={b.id} 
              onClick={() => setSelectedBorrower(b)}
              className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center cursor-pointer hover:border-orange-200 dark:hover:border-orange-400 transition-colors group relative overflow-hidden"
            >
              {/* Profit Status Ribbon - Only show from the month AFTER loan */}
              {!loanData.isLoanMonth && (profitPaidThisMonth || showProfitDue) && (
                <div className={cn(
                  "absolute top-0 right-0 px-3 py-1 text-[10px] font-bold rounded-bl-xl",
                  profitPaidThisMonth ? "bg-primary-500 text-white" : "bg-orange-500 text-white"
                )}>
                  {profitPaidThisMonth ? 'লাভ পরিশোধিত' : 'লাভ বাকি'}
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 shadow-[inset_0_-3px_5px_rgba(0,0,0,0.15)] ring-2 ring-white dark:ring-slate-800">
                  {b.photo ? (
                    <img src={b.photo} alt={b.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <HandCoins className="w-full h-full p-3 text-slate-300 dark:text-slate-600 drop-shadow-sm" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">{b.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">ঋণের তারিখ: {formatBengaliDate(b.loanDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end gap-2">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {isFullyPaid ? <span className="text-sm text-primary-600 dark:text-primary-400">মূল টাকা পরিশোধ</span> : formatCurrency(b.loanAmount)}
                  </p>
                  {!profitPaidThisMonth && !isFullyPaid && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (loanData.isLoanMonth) {
                          alert('ঋণ গ্রহণের মাসে লাভের টাকা পরিশোধ করা যাবে না। আগামী মাস থেকে পরিশোধ করতে পারবেন।');
                          return;
                        }
                        setMfsInitialData({
                          type: 'profit',
                          payerId: b.id,
                          amount: loanData.monthlyProfit,
                          month: currentMonth,
                          year: currentYear
                        });
                      }}
                      className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors shadow-lg shadow-pink-200 dark:shadow-none",
                        loanData.isLoanMonth ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed" : "bg-pink-600 text-white hover:bg-pink-700"
                      )}
                    >
                      <Smartphone className="w-3 h-3" />
                      বিকাশ/নগদ/রকেট
                    </button>
                  )}
                  {profitPaidThisMonth && !loanData.isLoanMonth && (
                    <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded-full border border-primary-100 dark:border-primary-800/50">লাভ পরিশোধিত</span>
                  )}
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setBorrowerToDelete(b);
                  }}
                  className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button 
        onClick={() => setShowAdd(true)}
        disabled={!isAllowed}
        className={cn(
          "fixed bottom-24 right-4 sm:right-8 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all z-40",
          isAllowed ? "bg-orange-600 text-white hover:bg-orange-700 shadow-orange-200 dark:shadow-none" : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
        )}
      >
        <Plus className="w-8 h-8" />
      </button>

      {showAdd && <AddBorrowerModal onClose={() => setShowAdd(false)} handleImageUpload={handleImageUpload} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} totalCash={totalCash} />}
      {selectedBorrower && <LoanDetailsModal borrower={selectedBorrower} onClose={() => setSelectedBorrower(null)} isTransactionAllowed={isTransactionAllowed} setMfsInitialData={setMfsInitialData} logTransaction={logTransaction} totalCash={totalCash} />}
      {deleteWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl max-w-sm w-full border-2 border-red-500">
            <h3 className="text-lg font-bold text-red-600 mb-4">ডিলিট করা সম্ভব নয়</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">{deleteWarning}</p>
            <button onClick={() => setDeleteWarning(null)} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold">ঠিক আছে</button>
          </div>
        </div>
      )}
      {borrowerToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl max-w-sm w-full">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">ডিলিট নিশ্চিত করুন</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">আপনি কি নিশ্চিত যে আপনি এই ঋণগ্রহীতাকে ডিলিট করতে চান?</p>
            <div className="flex gap-4">
              <button onClick={() => setBorrowerToDelete(null)} className="flex-1 py-3 text-slate-500 font-bold">বাতিল</button>
              <button onClick={handleDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">ডিলিট করুন</button>
            </div>
          </div>
        </div>
      )}
      {mfsInitialData && <AddMfsModal initialData={mfsInitialData} onClose={() => setMfsInitialData(null)} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} />}
    </div>
  );
}

function AddBorrowerModal({ onClose, handleImageUpload, isTransactionAllowed, logTransaction, totalCash }: any) {
  const dbSettings = useLiveQuery<AppSetting[]>(() => db.settings.toArray(), [], 'settings') || [];
  const members = useLiveQuery<Member[]>(() => db.members.toArray(), [], 'members') || [];
  const borrowers = useLiveQuery<Borrower[]>(() => db.borrowers.toArray(), [], 'borrowers') || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const defaultLoanAmount = dbSettings.find(s => s.key === 'loan_amount')?.value || 10000;
  const isAllowed = isTransactionAllowed ? isTransactionAllowed() : true;

  const [borrowerType, setBorrowerType] = useState<'other' | 'member'>('other');
  const [guarantorIsMember, setGuarantorIsMember] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    phone: '',
    uid: '',
    address: '',
    guarantor: '',
    loanAmount: defaultLoanAmount.toString(),
    loanDate: getTodayDate(),
    formFee: '',
    notes: '',
    photo: '',
    memberId: '' as string | number
  });

  const parsedLoanAmount = Number(formData.loanAmount) || 0;
  const remainingCash = (totalCash || 0) - parsedLoanAmount;

  useEffect(() => {
    if (borrowerType === 'other') {
      const existingIds = borrowers
        .map(b => parseInt(b.uid))
        .filter(id => !isNaN(id))
        .sort((a, b) => a - b);
      
      let nextId = 1;
      for (const id of existingIds) {
        if (id === nextId) {
          nextId++;
        } else if (id > nextId) {
          break;
        }
      }
      setFormData(prev => ({ ...prev, uid: String(nextId).padStart(3, '0') }));
    }
  }, [borrowerType, JSON.stringify(borrowers)]);

  const resetForm = () => {
    setFormData({
      name: '',
      fatherName: '',
      phone: '',
      uid: '',
      address: '',
      guarantor: '',
      loanAmount: defaultLoanAmount.toString(),
      loanDate: getTodayDate(),
      formFee: '',
      notes: '',
      photo: '',
      memberId: ''
    });
    setGuarantorIsMember(false);
  };

  const handleTypeChange = (type: 'other' | 'member') => {
    setBorrowerType(type);
    resetForm();
  };

  const handleMemberSelect = (memberId: string) => {
    if (!memberId) {
      resetForm();
      return;
    }
    const member = members.find(m => String(m.id) === memberId);
    if (member) {
      setFormData({
        ...formData,
        name: member.name || '',
        fatherName: member.fatherName || '',
        phone: member.phone || '',
        uid: member.memberId || '',
        address: member.address || '',
        photo: member.photo || '',
        memberId: member.id || '',
        guarantor: '' // Reset guarantor when member is selected as borrower
      });
      setGuarantorIsMember(true); // Default to member guarantor for member borrowers
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!isAllowed) {
        alert('Transaction window is closed!');
        return;
      }

      if (!formData.name.trim()) {
        alert('Name is mandatory!');
        return;
      }

      if (!formData.photo) {
        alert('Borrower photo is mandatory!');
        return;
      }

      if (!/^\d{11}$/.test(formData.phone)) {
        alert('Mobile number must be 11 digits!');
        return;
      }

      // Duplicate check
      const existing = await db.borrowers.where('name').equalsIgnoreCase(formData.name).first();
      if (existing) {
        alert('A borrower with this name already exists! Please use a different name.');
        return;
      }

      await db.borrowers.add({
        name: formData.name,
        fatherName: formData.fatherName,
        phone: formData.phone,
        uid: formData.uid,
        address: formData.address,
        guarantor: formData.guarantor,
        loanAmount: Number(formData.loanAmount),
        loanDate: formData.loanDate,
        formFee: formData.formFee ? Number(formData.formFee) : 0,
        paymentStatus: 'pending',
        notes: formData.notes,
        photo: formData.photo,
        memberId: borrowerType === 'member' ? formData.memberId : undefined
      } as any);

      await logTransaction({
        amount: Number(formData.loanAmount),
        type: 'Loan Disbursement',
        payerName: formData.name,
        description: `New loan issued (${formData.uid})`,
        category: 'expense'
      });

      if (formData.formFee && Number(formData.formFee) > 0) {
        await logTransaction({
          amount: Number(formData.formFee),
          type: 'Form Fee',
          payerName: formData.name,
          description: `Form fee for new loan`,
          category: 'income'
        });
      }

      onClose();
    } catch (error) {
      console.error('Error adding borrower:', error);
      alert('Error adding borrower. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 pb-28 overflow-y-auto">
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add New Borrower</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <XCircle className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          </button>
        </div>
        
        {/* Borrower Type Selection */}
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl mb-6">
          <button 
            type="button"
            onClick={() => handleTypeChange('other')}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
              borrowerType === 'other' ? "bg-white dark:bg-slate-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400"
            )}
          >
            Other
          </button>
          <button 
            type="button"
            onClick={() => handleTypeChange('member')}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
              borrowerType === 'member' ? "bg-white dark:bg-slate-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400"
            )}
          >
            Member
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {borrowerType === 'member' && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600 dark:text-slate-400">Select Member</label>
              <select 
                required
                value={formData.memberId || ''}
                onChange={(e) => handleMemberSelect(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 text-slate-900 dark:text-white"
              >
                <option value="">Choose Member</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.memberId})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 relative overflow-hidden mb-3">
              {formData.photo ? (
                <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              )}
            </div>
            {!formData.photo ? (
              <div className="flex gap-2">
                <label className="px-6 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-orange-600 transition-all flex items-center gap-2 shadow-lg shadow-orange-100 dark:shadow-none active:scale-95">
                  <CloudUpload className="w-4 h-4" /> ছবি আপলোড করুন
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, (base64: string) => setFormData(prev => ({ ...prev, photo: base64 })))}
                    className="hidden" 
                  />
                </label>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, photo: '' }))}
                className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> ছবি মুছুন
              </button>
            )}
          </div>
          <input 
            required
            readOnly={borrowerType === 'member'}
            type="text"
            placeholder="ঋণগ্রহীতার নাম"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            className={cn(
              "w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 text-slate-900 dark:text-white",
              borrowerType === 'member' && "bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
            )}
          />
          <input 
            required
            readOnly={borrowerType === 'member'}
            type="text"
            placeholder="পিতার নাম"
            value={formData.fatherName}
            onChange={e => setFormData({...formData, fatherName: e.target.value})}
            className={cn(
              "w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 text-slate-900 dark:text-white",
              borrowerType === 'member' && "bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <input 
              required
              readOnly={borrowerType === 'member'}
              type="tel" inputMode="numeric"
              placeholder="১১ ডিজিটের মোবাইল নাম্বার"
              value={formData.phone}
              onChange={e => {
                const val = bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, '').slice(0, 11);
                setFormData({...formData, phone: val});
              }}
              pattern="\d{11}"
              title="মোবাইল নম্বর অবশ্যই ১১ ডিজিটের হতে হবে"
              className={cn(
                "w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 text-slate-900 dark:text-white",
                borrowerType === 'member' && "bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
              )}
            />
            <input 
              required
              readOnly
              type="text"
              placeholder="সিরিয়াল নাম্বার (UID)"
              value={formData.uid}
              className={cn(
                "w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed"
              )}
            />
          </div>
          <input 
            required
            readOnly={borrowerType === 'member'}
            type="text"
            placeholder="ঠিকানা"
            value={formData.address}
            onChange={e => setFormData({...formData, address: e.target.value})}
            className={cn(
              "w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 text-slate-900 dark:text-white",
              borrowerType === 'member' && "bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
            )}
          />
          
          <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
            <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">জামিনদার (Guarantor)</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setGuarantorIsMember(true);
                  setFormData({...formData, guarantor: ''});
                }}
                className={cn(
                  "flex-1 py-3 rounded-xl text-xs font-bold transition-all border",
                  guarantorIsMember 
                    ? "bg-orange-500 text-white border-orange-600 shadow-lg shadow-orange-200 dark:shadow-none" 
                    : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                )}
              >
                সদস্য
              </button>
              <button
                type="button"
                onClick={() => {
                  setGuarantorIsMember(false);
                  setFormData({...formData, guarantor: ''});
                }}
                className={cn(
                  "flex-1 py-3 rounded-xl text-xs font-bold transition-all border",
                  !guarantorIsMember 
                    ? "bg-orange-500 text-white border-orange-600 shadow-lg shadow-orange-200 dark:shadow-none" 
                    : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                )}
              >
                অন্যান্য
              </button>
            </div>
            {guarantorIsMember ? (
              <select 
                required
                value={formData.guarantor}
                onChange={e => setFormData({...formData, guarantor: e.target.value})}
                className="w-full p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 text-sm text-slate-900 dark:text-white"
              >
                <option value="">জামিনদার সদস্য নির্বাচন করুন</option>
                {members.map(m => (
                  <option key={m.id} value={`সদস্য: ${m.name} (${m.memberId})`}>
                    {m.name} ({m.memberId})
                  </option>
                ))}
              </select>
            ) : (
              <input 
                required
                type="text"
                placeholder="জামিনদারের নাম লিখুন"
                value={formData.guarantor}
                onChange={e => setFormData({...formData, guarantor: e.target.value})}
                className="w-full p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 text-sm text-slate-900 dark:text-white"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <input 
                required
                type="text" inputMode="numeric"
                placeholder="ঋণের পরিমাণ"
                value={formData.loanAmount}
                onChange={e => setFormData({...formData, loanAmount: bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, '')})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 text-slate-900 dark:text-white font-bold"
              />
              <p className={cn("text-[9px] mt-1.5 font-bold flex items-center justify-between", remainingCash < 0 ? "text-red-500" : "text-green-500")}>
                <span>বর্তমান ফান্ড: {formatCurrency(totalCash || 0)}</span>
                <span>অবশিষ্ট: {formatCurrency(remainingCash)}</span>
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">ঋণ গ্রহণের তারিখ</label>
              <input 
                required
                type="date"
                value={formData.loanDate}
                onChange={e => setFormData({...formData, loanDate: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <input 
            type="text" inputMode="numeric"
            placeholder="ফরমের টাকা (ঐচ্ছিক)"
            value={formData.formFee}
            onChange={e => setFormData({...formData, formFee: bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, '')})}
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 text-slate-900 dark:text-white"
          />
          <textarea 
            placeholder="নোট (ঐচ্ছিক)"
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400 text-slate-900 dark:text-white h-24 resize-none"
          />
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-colors">বাতিল</button>
            <button type="submit" className="flex-1 py-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 shadow-lg shadow-orange-200 dark:shadow-none transition-all">সংরক্ষণ করুন</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function LoanDetailsModal({ borrower, onClose, isTransactionAllowed, setMfsInitialData, logTransaction, totalCash }: any) {
  const payments = useLiveQuery<Payment[]>(() => db.payments.where('borrowerId').equals(borrower.id).toArray()) || [];
  const dbSettings = useLiveQuery<AppSetting[]>(() => db.settings.toArray()) || [];
  
  const profitPercentage = (dbSettings.find(s => s.key === 'profit_percentage')?.value || 5) / 100;
  const compoundPercentage = (dbSettings.find(s => s.key === 'compound_percentage')?.value || 10) / 100;
  
  const activePayments = payments.filter(p => p.date >= borrower.loanDate);
  const totalPaid = activePayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPrincipalPaid = activePayments.filter(p => p.type === 'principal').reduce((sum, p) => sum + p.amount, 0);
  const isFullyPaid = totalPrincipalPaid >= borrower.loanAmount;
  const loanData = calculateLoan(borrower.loanAmount, borrower.loanDate, activePayments, borrower.customProfit, profitPercentage, compoundPercentage, borrower.notes);
  const [showPayment, setShowPayment] = useState(false);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const [deleteConfirmPayment, setDeleteConfirmPayment] = useState<any>(null);
  
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const isAllowed = isTransactionAllowed();

  const handleDeletePayment = async () => {
    if (deleteConfirmPayment) {
      if (!isAllowed) {
        alert('Transaction window is closed!');
        return;
      }
      await db.payments.delete(deleteConfirmPayment.id);
      
      await logTransaction({
        amount: deleteConfirmPayment.amount,
        type: 'পেমেন্ট বাতিল',
        payerName: borrower.name,
        description: `${deleteConfirmPayment.type === 'profit' ? 'লাভের' : 'আসলের'} পেমেন্ট ডিলিট করা হয়েছে`,
        category: 'expense'
      });
      
      setDeleteConfirmPayment(null);
    }
  };

  const months = BANGLISH_MONTHS;

  const isProfitPaid = (m: number, y: number) => {
    return activePayments.some(p => p.type === 'profit' && p.month === m && p.year === y);
  };

  const generateReceipt = async (payment: any) => {
    const doc = new jsPDF();
    const isProfit = payment.type === 'profit';
    const sig = await db.settings.get('authorized_signature');
    const receiptNameSetting = await db.settings.get('receipt_samity_name');
    const titleSetting = await db.settings.get('app_title');
    const samityNameRaw = receiptNameSetting?.value || titleSetting?.value || 'Yuba Samaj Samabay Samity';
    const samityName = transliterateBengali(samityNameRaw);
    
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Emerald color
    doc.text(samityName, 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100, 116, 139); // Slate color
    doc.text(isProfit ? 'PROFIT PAYMENT RECEIPT' : 'INSTALLMENT PAYMENT RECEIPT', 105, 30, { align: 'center' });
    
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    
    let y = 50;
    const drawRow = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 80, y);
      y += 10;
    };

    drawRow('Borrower Name:', transliterateBengali(borrower.name));
    drawRow('Date:', new Date(payment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    drawRow('Payment Type:', isProfit ? 'Monthly Profit' : 'Principal Amount');
    if (isProfit) {
      drawRow('Month:', `${months[payment.month]} ${payment.year}`);
    }
    drawRow('Amount:', `${payment.amount.toLocaleString()} Taka`);
    
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('This is a computer-generated official receipt.', 105, y, { align: 'center' });
    
    if (sig?.value) {
      try {
        doc.addImage(sig.value, 'PNG', 140, 95, 40, 20);
      } catch (e) {
        console.error('Error adding signature to PDF', e);
      }
    }

    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Authorized Signature', 150, 120);
    doc.line(140, 115, 190, 115);
    
    const fileName = `Receipt_Loan_${transliterateBengali(borrower.name)}_${payment.date}`;
    doc.save(`${fileName}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700"
      >
        <div className="flex justify-between items-start mb-6">
          <div className="flex gap-4 items-center">
            {borrower.photo && (
              <img src={borrower.photo} alt={borrower.name} className="w-16 h-16 rounded-2xl object-cover shadow-[0_4px_8px_rgba(0,0,0,0.15)] ring-2 ring-white dark:ring-slate-800" />
            )}
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{borrower.name}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">UID: {borrower.uid || 'N/A'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <XCircle className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl mb-6 space-y-2 border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">পিতার নাম:</span>
            <span className="font-medium text-slate-900 dark:text-white">{borrower.fatherName || 'N/A'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">মোবাইল:</span>
            <span className="font-medium text-slate-900 dark:text-white">{borrower.phone || 'N/A'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">ঠিকানা:</span>
            <span className="font-medium text-slate-900 dark:text-white">{borrower.address || 'N/A'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">জামিনদার:</span>
            <span className="font-medium text-slate-900 dark:text-white">{borrower.guarantor || 'N/A'}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">মূল ঋণ</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(isFullyPaid ? 0 : loanData.loanAmount)}</p>
            </div>
            <button 
              onClick={() => setShowAddLoan(true)}
              disabled={isFullyPaid}
              className={`p-2 rounded-xl transition-colors ${
                isFullyPaid 
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed' 
                  : 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/40'
              }`}
              title={isFullyPaid ? "ঋণ পরিশোধিত" : "নতুন ঋণ যোগ করুন"}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl relative group border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">মোট লাভ ({Math.round(profitPercentage * 100)}%/{Math.round(compoundPercentage * 100)}%)</p>
            <div className="flex justify-between items-center">
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(isFullyPaid ? 0 : loanData.totalProfit)}</p>
            </div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/20">
            <p className="text-xs text-orange-400 dark:text-orange-500 mb-1">মাসিক লাভ ({Math.round(profitPercentage * 100)}%)</p>
            <p className="text-lg font-bold text-orange-700 dark:text-orange-400">{formatCurrency(isFullyPaid ? 0 : loanData.monthlyProfit)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">পরিশোধিত</p>
            <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{formatCurrency(isFullyPaid ? 0 : totalPaid)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">ফরমের টাকা</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(isFullyPaid ? 0 : (borrower.formFee || 0))}</p>
          </div>
        </div>

        {/* Profit History Grid */}
        <div className="mb-8 p-5 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Calendar className="w-5 h-5 text-orange-500" />
              Profit History
            </h3>
            <select 
              value={historyYear}
              onChange={e => setHistoryYear(Number(e.target.value))}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-900 dark:text-white"
            >
              {Array.from({ length: 51 }, (_, i) => 2024 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {months.map((m, i) => {
              const paid = isProfitPaid(i, historyYear);
              return (
                <div 
                  key={i} 
                  className={cn(
                    "p-2 rounded-xl border flex flex-col items-center gap-1 transition-all",
                    paid ? "bg-primary-50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-900/20" : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                  )}
                >
                  <span className={cn("text-[10px] font-bold", paid ? "text-primary-600 dark:text-primary-400" : "text-slate-400 dark:text-slate-500")}>{m}</span>
                  {paid ? (
                    <CheckCircle2 className="w-4 h-4 text-primary-500 dark:text-primary-400" />
                  ) : (
                    <button 
                      disabled={i === new Date(borrower.loanDate).getMonth() && historyYear === new Date(borrower.loanDate).getFullYear()}
                      onClick={() => {
                        setMfsInitialData({
                          type: 'profit',
                          payerId: borrower.id,
                          amount: loanData.monthlyProfit,
                          month: i,
                          year: historyYear
                        });
                      }}
                      className={cn(
                        "transition-all active:scale-95",
                        (i === new Date(borrower.loanDate).getMonth() && historyYear === new Date(borrower.loanDate).getFullYear()) 
                          ? "text-slate-100 dark:text-slate-800 cursor-not-allowed opacity-20" 
                          : "text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300"
                      )}
                    >
                      <Smartphone className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
            <TrendingUp className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Payment History
          </h3>
          <div className="space-y-3">
            {activePayments.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500 text-center py-4">No payment found</p>
            ) : (
              activePayments.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(p.amount)} {p.type === 'profit' && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full ml-2">লাভ</span>}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatBengaliDate(p.date)} {p.type === 'profit' && `(${months[p.month!]})`}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => await generateReceipt(p)} className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors" title="রিসিট ডাউনলোড">
                      <Download className="w-5 h-5" />
                    </button>
                    <button onClick={() => setDeleteConfirmPayment(p)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="মুছে ফেলুন">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {isFullyPaid && (
            <button
              onClick={() => setShowNewLoan(true)}
              disabled={!isAllowed}
              className={cn(
                "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                isAllowed
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none hover:bg-blue-700"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              )}
            >
              <PlusCircle className="w-5 h-5" />
              {isAllowed ? 'Do you want to take a new loan? Click here.' : 'Closed'}
            </button>
          )}
          <div className="flex gap-4">
            <button 
              onClick={() => setShowPayment(true)}
              disabled={!isAllowed || isFullyPaid || loanData.isLoanMonth}
              className={cn(
                "flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                (isAllowed && !isFullyPaid && !loanData.isLoanMonth)
                  ? "bg-primary-600 text-white shadow-lg shadow-primary-100 dark:shadow-none hover:bg-primary-700" 
                  : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              )}
            >
              <Wallet className="w-5 h-5" />
              {isFullyPaid ? 'Paid' : (loanData.isLoanMonth ? 'Next Month Payment' : (isAllowed ? 'Add Payment' : 'Closed'))}
            </button>
            <button 
              onClick={() => setShowAddLoan(true)}
              disabled={!isAllowed || isFullyPaid}
              className={cn(
                "flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                (isAllowed && !isFullyPaid)
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-100 dark:shadow-none hover:bg-orange-600" 
                  : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              )}
            >
              <Plus className="w-5 h-5" />
              {isFullyPaid ? 'Paid' : (isAllowed ? 'Extra Loan' : 'Closed')}
            </button>
          </div>
        </div>

        {showPayment && (
          <AddPaymentModal 
            borrower={borrower} 
            remaining={loanData.remainingBalance}
            monthlyProfit={loanData.monthlyProfit}
            onClose={() => setShowPayment(false)} 
            isTransactionAllowed={isTransactionAllowed}
            logTransaction={logTransaction}
          />
        )}

        {showAddLoan && (
          <AddLoanAmountModal 
            borrower={borrower}
            onClose={() => setShowAddLoan(false)}
            isTransactionAllowed={isTransactionAllowed}
            logTransaction={logTransaction}
            totalCash={totalCash}
          />
        )}

        {showNewLoan && (
          <NewLoanModal 
            borrower={borrower}
            onClose={() => setShowNewLoan(false)}
            isTransactionAllowed={isTransactionAllowed}
            logTransaction={logTransaction}
            totalCash={totalCash}
          />
        )}
        
        {deleteConfirmPayment && (
          <DeleteConfirmationModal onConfirm={handleDeletePayment} onClose={() => setDeleteConfirmPayment(null)} />
        )}
      </motion.div>
    </div>
  );
}

function NewLoanModal({ borrower, onClose, isTransactionAllowed, logTransaction, totalCash }: any) {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const [amount, setAmount] = useState('');
  const [formFee, setFormFee] = useState('');
  const isAllowed = isTransactionAllowed();

  const parsedAmount = Number(amount) || 0;
  const remainingCash = (totalCash || 0) - parsedAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowed) {
      alert('Transaction window is closed!');
      return;
    }
    const newAmount = Number(amount);
    const newFormFee = Number(formFee) || 0;
    if (newAmount <= 0) return;

    if (newAmount > (totalCash || 0)) {
      alert('দুঃখিত, ফান্ডে পর্যাপ্ত টাকা নেই!');
      return;
    }

    let newNotes = (borrower.notes ? borrower.notes + '\n' : '') + 
                     `নতুন ঋণ: ${newAmount} টাকা (${formatMeetingDate(meetingDay)})`;
    if (newFormFee > 0) {
      newNotes += ` (ফরমের টাকা: ${newFormFee})`;
    }
    
    await db.borrowers.update(borrower.id, { 
      previousLoansTotal: (borrower.previousLoansTotal || 0) + borrower.loanAmount,
      loanAmount: newAmount,
      loanDate: getTodayDate(),
      formFee: newFormFee,
      notes: newNotes,
      customProfit: undefined
    });

    await logTransaction({
      amount: newAmount,
      type: 'নতুন ঋণ প্রদান',
      payerName: borrower.name,
      description: `পুরাতন ঋণ পরিশোধের পর নতুন ঋণ প্রদান`,
      category: 'expense'
    });

    if (newFormFee > 0) {
      await logTransaction({
        amount: newFormFee,
        type: 'ফরম ফি',
        payerName: borrower.name,
        description: `নতুন ঋণের ফরম ফি`,
        category: 'income'
      });
    }
    
    alert('নতুন ঋণ সফলভাবে যোগ করা হয়েছে।');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700">
        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">নতুন ঋণ গ্রহণ করুন</h3>
        
        <div className="mb-4 flex flex-col gap-1 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>বর্তমান ফান্ড:</span>
            <span className="text-emerald-600">{formatCurrency(totalCash || 0)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>অবশিষ্ট:</span>
            <span className={cn(remainingCash < 0 ? "text-rose-600" : "text-blue-600")}>{formatCurrency(remainingCash)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input 
              required
              type="text" inputMode="numeric"
              placeholder="নতুন ঋণের পরিমাণ"
              value={amount}
              onChange={e => setAmount(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, ''))}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold">৳</span>
          </div>
          <div className="relative">
            <input 
              type="text" inputMode="numeric"
              placeholder="ফরমের টাকা (ঐচ্ছিক)"
              value={formFee}
              onChange={e => setFormFee(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, ''))}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 text-slate-900 dark:text-white"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold">৳</span>
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">বাতিল</button>
            <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 dark:shadow-none hover:bg-blue-700 transition-colors">যোগ করুন</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddLoanAmountModal({ borrower, onClose, isTransactionAllowed, logTransaction, totalCash }: any) {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const [amount, setAmount] = useState('');
  const [formFee, setFormFee] = useState('');
  const isAllowed = isTransactionAllowed();

  const parsedAmount = Number(amount) || 0;
  const remainingCash = (totalCash || 0) - parsedAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowed) {
      alert('Transaction window is closed!');
      return;
    }
    const additionalAmount = Number(amount);
    const additionalFormFee = Number(formFee) || 0;
    if (additionalAmount <= 0) return;

    if (additionalAmount > (totalCash || 0)) {
      alert('দুঃখিত, ফান্ডে পর্যাপ্ত টাকা নেই!');
      return;
    }

    const newTotal = borrower.loanAmount + additionalAmount;
    const newFormFee = (borrower.formFee || 0) + additionalFormFee;
    let newNotes = (borrower.notes ? borrower.notes + '\n' : '') + 
                     `অতিরিক্ত ঋণ যোগ: ${additionalAmount} টাকা (${formatMeetingDate(meetingDay)})`;
    if (additionalFormFee > 0) {
      newNotes += ` (ফরমের টাকা: ${additionalFormFee})`;
    }
    
    await db.borrowers.update(borrower.id, { 
      loanAmount: newTotal,
      formFee: newFormFee,
      notes: newNotes
    });

    await logTransaction({
      amount: additionalAmount,
      type: 'অতিরিক্ত ঋণ প্রদান',
      payerName: borrower.name,
      description: `চলতি ঋণে অতিরিক্ত অর্থ যোগ`,
      category: 'expense'
    });

    if (additionalFormFee > 0) {
      await logTransaction({
        amount: additionalFormFee,
        type: 'ফরম ফি',
        payerName: borrower.name,
        description: `অতিরিক্ত ঋণের ফরম ফি`,
        category: 'income'
      });
    }
    
    alert('নতুন ঋণ সফলভাবে যোগ করা হয়েছে এবং মোট ক্যাশ থেকে বিয়োগ করা হয়েছে।');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700">
        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">নতুন ঋণ যোগ করুন</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">বর্তমান ঋণ: {formatCurrency(borrower.loanAmount)}</p>
        
        <div className="mb-4 flex flex-col gap-1 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>বর্তমান ফান্ড:</span>
            <span className="text-emerald-600">{formatCurrency(totalCash || 0)}</span>
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>অবশিষ্ট:</span>
            <span className={cn(remainingCash < 0 ? "text-rose-600" : "text-orange-600")}>{formatCurrency(remainingCash)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input 
              required
              type="text" inputMode="numeric"
              placeholder="অতিরিক্ত ঋণের পরিমাণ"
              value={amount}
              onChange={e => setAmount(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, ''))}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 text-slate-900 dark:text-white"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold">৳</span>
          </div>
          <div className="relative">
            <input 
              type="text" inputMode="numeric"
              placeholder="ফরমের টাকা (ঐচ্ছিক)"
              value={formFee}
              onChange={e => setFormFee(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, ''))}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-orange-500 text-slate-900 dark:text-white"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold">৳</span>
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">বাতিল</button>
            <button type="submit" className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold shadow-lg shadow-orange-100 dark:shadow-none hover:bg-orange-700 transition-colors">যোগ করুন</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddPaymentModal({ borrower, remaining, onClose, monthlyProfit, isTransactionAllowed, logTransaction }: any) {
  const [amount, setAmount] = useState(monthlyProfit.toString());
  const [type, setType] = useState<'profit' | 'principal'>('profit');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [confirmPayment, setConfirmPayment] = useState(false);
  
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const isAllowed = isTransactionAllowed();

  const payments = useLiveQuery<Payment[]>(() => 
    db.payments.where('borrowerId').equals(borrower.id).toArray()
  ) || [];
  
  const activePayments = payments.filter(p => p.date >= borrower.loanDate);

  const months = BANGLISH_MONTHS;

  const isProfitPaid = (m: number, y: number) => {
    return activePayments.some(p => p.type === 'profit' && p.month === m && p.year === y);
  };

  const loanDateObj = new Date(borrower.loanDate);
  const isLoanMonth = (m: number, y: number) => {
    return loanDateObj.getMonth() === m && loanDateObj.getFullYear() === y;
  };

  const currentMonthPaid = type === 'profit' && isProfitPaid(selectedMonth, selectedYear);
  const currentMonthIsLoanMonth = type === 'profit' && isLoanMonth(selectedMonth, selectedYear);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowed) {
      alert('Transaction window is closed!');
      return;
    }
    if (currentMonthPaid) return;
    if (currentMonthIsLoanMonth) {
      alert('ঋণ নেওয়ার মাসে লাভের টাকা জমা দেওয়া যাবে না।');
      return;
    }
    setConfirmPayment(true);
  };

  const executePayment = async () => {
    const payAmount = Number(amount);
    const payment: any = {
      borrowerId: borrower.id,
      amount: payAmount,
      date: getLocalISOString(),
      remainingBalance: type === 'principal' ? Math.max(0, remaining - payAmount) : remaining,
      type: type
    };

    if (type === 'profit') {
      payment.month = selectedMonth;
      payment.year = selectedYear;
    }

    try {
      await db.payments.add(payment);

      await logTransaction({
        amount: payAmount,
        type: type === 'profit' ? 'ঋণের লাভ (Profit)' : 'আসল টাকা (Principal)',
        payerName: borrower.name,
        description: type === 'profit' 
          ? `${months[selectedMonth]} ${selectedYear} মাসের লাভ পরিশোধ` 
          : `ঋণের আসল টাকা পরিশোধ`,
        category: 'income'
      });
      
      if (type === 'principal') {
        if (remaining - payAmount <= 0) {
          await db.borrowers.update(borrower.id, { paymentStatus: 'paid' });
        } else {
          await db.borrowers.update(borrower.id, { paymentStatus: 'partial' });
        }
      }
      
      onClose();
    } catch (err) {
      alert('এই মাসের লাভের টাকা ইতিমধ্যে জমা দেওয়া হয়েছে।');
    } finally {
      setConfirmPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700">
        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">টাকা জমা নিন</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
            <button 
              type="button"
              onClick={() => {
                setType('profit');
                setAmount(monthlyProfit.toString());
              }}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                type === 'profit' 
                  ? "bg-white dark:bg-slate-800 shadow-sm text-primary-600 dark:text-primary-400" 
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              লাভ (Profit)
            </button>
            <button 
              type="button"
              onClick={() => {
                setType('principal');
                setAmount('');
              }}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                type === 'principal' 
                  ? "bg-white dark:bg-slate-800 shadow-sm text-primary-600 dark:text-primary-400" 
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              আসল (Principal)
            </button>
          </div>

          {type === 'principal' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-bold text-center border border-blue-100 dark:border-blue-900/40 mb-4">
              বর্তমান বকেয়া আসল: {formatCurrency(remaining)}
            </div>
          )}

          {type === 'profit' && (
            <div className="grid grid-cols-2 gap-2">
              <select 
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className={cn(
                  "p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border text-sm focus:outline-none text-slate-900 dark:text-white",
                  currentMonthPaid 
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" 
                    : "border-slate-200 dark:border-slate-700"
                )}
              >
                {months.map((m, i) => {
                  const paid = isProfitPaid(i, selectedYear);
                  const isLoanM = isLoanMonth(i, selectedYear);
                  return (
                    <option key={i} value={i} disabled={isLoanM} className="bg-white dark:bg-slate-800">
                      {m} {isLoanM ? '(প্রযোজ্য নয়)' : paid ? '✓' : ''}
                    </option>
                  );
                })}
              </select>
              <select 
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none"
              >
                {Array.from({ length: 51 }, (_, i) => 2024 + i).map(y => (
                  <option key={y} value={y} className="bg-white dark:bg-slate-800">{y}</option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <input 
              required
              type="text" inputMode="numeric"
              placeholder="টাকার পরিমাণ"
              value={amount}
              onChange={e => setAmount(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, ''))}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-primary-500"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold">৳</span>
          </div>

          {currentMonthPaid && (
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-xl text-xs font-bold text-center border border-primary-100 dark:border-primary-900/40">
              এই মাসের লাভের টাকা ইতিমধ্যে পরিশোধিত
            </div>
          )}

          {currentMonthIsLoanMonth && type === 'profit' && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold text-center border border-red-100 dark:border-red-900/40">
              ঋণ নেওয়ার মাসে লাভের টাকা জমা দেওয়া যাবে না।
            </div>
          )}

          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">বাতিল</button>
            {!currentMonthPaid && !currentMonthIsLoanMonth && remaining > 0 && (
              <button type="submit" className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors">জমা দিন</button>
            )}
            {(remaining <= 0 || currentMonthPaid || currentMonthIsLoanMonth) && (
              <div className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl font-bold text-center">
                {remaining <= 0 ? 'আসল টাকা পরিশোধিত' : 'জমা দেওয়া যাবে না'}
              </div>
            )}
          </div>
        </form>
      </div>
      {confirmPayment && (
        <ConfirmPaymentModal 
          message={`আপনি কি ${type === 'profit' ? `${months[selectedMonth]} ${selectedYear} এর লাভ` : 'আসল'} বাবদ ${formatCurrency(Number(amount))} জমা দিতে নিশ্চিত?`}
          onConfirm={executePayment}
          onClose={() => setConfirmPayment(false)}
        />
      )}
    </div>
  );
}

function ExpensesPage({ onBack, goHome, isTransactionAllowed, logTransaction }: any) {
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const [showAdd, setShowAdd] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<any>(null);

  const isAllowed = isTransactionAllowed();

  const handleDelete = async () => {
    if (expenseToDelete) {
      await db.expenses.delete(expenseToDelete.id);
      setExpenseToDelete(null);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="খরচের তালিকা" onBack={onBack} goHome={goHome} />
      
      <div className="space-y-4">
        {expenses.map(e => (
          <div key={e.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center transition-colors">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{e.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{formatBengaliDate(e.date)}</p>
              {e.notes && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{e.notes}</p>}
            </div>
            <div className="flex items-center gap-4">
              <p className="text-lg font-bold text-red-500 dark:text-red-400">{formatCurrency(e.amount)}</p>
              <button 
                onClick={() => setExpenseToDelete(e)}
                className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={() => setShowAdd(true)}
        disabled={!isAllowed}
        className={cn(
          "fixed bottom-24 right-4 sm:right-8 w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all z-10",
          isAllowed 
            ? "bg-red-500 text-white hover:bg-red-600 shadow-red-100 dark:shadow-none" 
            : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
        )}
      >
        <Plus className="w-8 h-8" />
      </button>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} />}
      {expenseToDelete && <DeleteConfirmationModal onConfirm={handleDelete} onClose={() => setExpenseToDelete(null)} />}
    </div>
  );
}

function AddExpenseModal({ onClose, isTransactionAllowed, logTransaction }: any) {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const isAllowed = isTransactionAllowed ? isTransactionAllowed() : true;

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    date: getMeetingDateISO(meetingDay).split('T')[0],
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowed) {
      alert('Transaction window is closed!');
      return;
    }
    if (!formData.title.trim() || !formData.amount || Number(formData.amount) <= 0) {
      alert('খরচের বিবরণ এবং সঠিক টাকার পরিমাণ দিন');
      return;
    }
    await db.expenses.add({
      title: formData.title,
      amount: Number(formData.amount),
      date: formData.date,
      notes: formData.notes
    });
    await logTransaction({
      amount: Number(formData.amount),
      type: 'সাধারণ খরচ',
      payerName: 'অফিস',
      description: formData.title,
      category: 'expense'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">নতুন খরচ যোগ করুন</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required placeholder="খরচের বিবরণ" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-red-500" />
          <input required type="text" inputMode="numeric" placeholder="টাকার পরিমাণ" value={formData.amount} onChange={e => setFormData({...formData, amount: bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, '')})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-red-500" />
          <input required readOnly type="date" value={formData.date} className="w-full p-4 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 cursor-not-allowed text-slate-500 dark:text-slate-400" />
          <textarea placeholder="নোট" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-red-500" />
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">বাতিল</button>
            <button type="submit" className="flex-1 py-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-100 dark:shadow-none">খরচ করুন</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ReportsPage({ onBack, goHome, darkMode }: any) {
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const payments = useLiveQuery(() => db.payments.toArray()) || [];
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const borrowers = useLiveQuery(() => db.borrowers.toArray()) || [];
  const deposits = useLiveQuery(() => db.deposits.toArray()) || [];
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray()) || [];

  const chartData = [
    { name: 'আয়', value: payments.reduce((sum, p) => sum + p.amount, 0), color: '#10b981' },
    { name: 'ব্যয়', value: expenses.reduce((sum, e) => sum + e.amount, 0), color: '#ef4444' },
  ];

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    csvContent += "সদস্য তালিকা\n";
    csvContent += "ID,Name,Phone\n";
    members.forEach(m => { csvContent += `${m.memberId},${m.name},${m.phone}\n`; });
    
    csvContent += "\nঋণ তালিকা\n";
    csvContent += "Name,Amount,Date,Status\n";
    borrowers.forEach(b => { csvContent += `${b.name},${b.loanAmount},${b.loanDate},${b.paymentStatus}\n`; });

    csvContent += "\nখরচের তালিকা\n";
    csvContent += "Title,Amount,Date,Notes\n";
    expenses.forEach((e: any) => { csvContent += `${e.title},${e.amount},${e.date},${e.notes}\n`; });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Somiti_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDFReport = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Somiti System Report", 14, 22);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 32);
    doc.text(`Total Members: ${members.length}`, 14, 38);
    doc.text(`Total Active Loans: ${borrowers.length}`, 14, 44);

    const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalDeposit = deposits.reduce((sum, d) => sum + d.amount, 0);
    const totalSub = subscriptions.reduce((sum, s) => sum + s.amount, 0);

    doc.text(`Total Loan Recovery: BDT ${totalIncome}`, 14, 54);
    doc.text(`Total Expenses: BDT ${totalExpense}`, 14, 60);
    doc.text(`Total Security Deposits: BDT ${totalDeposit}`, 14, 66);
    doc.text(`Total Subscriptions: BDT ${totalSub}`, 14, 72);

    doc.save(`Somiti_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <PageHeader title="রিপোর্ট ও পরিসংখ্যান" onBack={onBack} goHome={goHome} />
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6 transition-colors">
        <h3 className="font-bold mb-6 text-slate-900 dark:text-white">আয় বনাম ব্যয়</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#334155" : "#f1f5f9"} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  backgroundColor: darkMode ? '#1e293b' : 'white',
                  color: darkMode ? '#f1f5f9' : '#1e293b'
                }}
                itemStyle={{ color: darkMode ? '#f1f5f9' : '#1e293b' }}
                cursor={{ fill: darkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.5)' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={generatePDFReport} className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
          <Download className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-bold text-slate-900 dark:text-white">PDF রিপোর্ট</span>
        </button>
        <button onClick={exportToCSV} className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
          <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-bold text-slate-900 dark:text-white">Excel রিপোর্ট</span>
        </button>
      </div>
    </div>
  );
}

function CalculatorPage({ onBack, goHome }: any) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  const handleNumber = (num: string) => {
    if (display === '0') {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const calculate = () => {
    try {
      const fullEquation = equation + display;
      // Using Function constructor as a safer alternative to eval for simple math
      const result = new Function('return ' + fullEquation.replace(/×/g, '*').replace(/÷/g, '/'))();
      const resultStr = String(Number(result).toLocaleString('bn-BD'));
      const fullEqBn = fullEquation.replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
      
      setHistory([`${fullEqBn} = ${resultStr}`, ...history].slice(0, 10));
      setDisplay(String(result));
      setEquation('');
    } catch (e) {
      setDisplay('Error');
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
  };

  const buttons = [
    { label: 'C', onClick: clear, color: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400' },
    { label: '(', onClick: () => handleNumber('('), color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
    { label: ')', onClick: () => handleNumber(')'), color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
    { label: '÷', onClick: () => handleOperator('/'), color: 'bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' },
    { label: '৭', onClick: () => handleNumber('7'), color: 'bg-white dark:bg-slate-700' },
    { label: '৮', onClick: () => handleNumber('8'), color: 'bg-white dark:bg-slate-700' },
    { label: '৯', onClick: () => handleNumber('9'), color: 'bg-white dark:bg-slate-700' },
    { label: '×', onClick: () => handleOperator('*'), color: 'bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' },
    { label: '৪', onClick: () => handleNumber('4'), color: 'bg-white dark:bg-slate-700' },
    { label: '৫', onClick: () => handleNumber('5'), color: 'bg-white dark:bg-slate-700' },
    { label: '৬', onClick: () => handleNumber('6'), color: 'bg-white dark:bg-slate-700' },
    { label: '-', onClick: () => handleOperator('-'), color: 'bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' },
    { label: '১', onClick: () => handleNumber('1'), color: 'bg-white dark:bg-slate-700' },
    { label: '২', onClick: () => handleNumber('2'), color: 'bg-white dark:bg-slate-700' },
    { label: '৩', onClick: () => handleNumber('3'), color: 'bg-white dark:bg-slate-700' },
    { label: '+', onClick: () => handleOperator('+'), color: 'bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' },
    { label: '০', onClick: () => handleNumber('0'), color: 'bg-white dark:bg-slate-700' },
    { label: '.', onClick: () => handleNumber('.'), color: 'bg-white dark:bg-slate-700' },
    { label: '⌫', onClick: () => setDisplay(display.length > 1 ? display.slice(0, -1) : '0'), color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
    { label: '=', onClick: calculate, color: 'bg-primary-600 text-white col-span-1' },
  ];

  const toBengali = (str: string) => {
    return str.replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-48">
      
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden mb-6">
        {/* Display */}
        <div className="p-6 bg-slate-900 dark:bg-black text-right min-h-[140px] flex flex-col justify-end">
          <p className="text-primary-400 text-sm mb-1 font-mono h-6">
            {toBengali(equation)}
          </p>
          <h2 className="text-4xl font-bold text-white font-mono break-all">
            {toBengali(display)}
          </h2>
        </div>

        {/* Keypad */}
        <div className="p-4 grid grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/50">
          {buttons.map((btn, idx) => (
            <motion.button
              key={idx}
              whileTap={{ scale: 0.95 }}
              onClick={btn.onClick}
              className={cn(
                "h-16 rounded-2xl text-xl font-bold shadow-sm flex items-center justify-center transition-all",
                btn.color,
                (btn.color.includes('bg-white') || btn.color.includes('dark:bg-slate-700')) ? "hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-white" : ""
              )}
            >
              {btn.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
          <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          সাম্প্রতিক হিসাব
        </h3>
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-center py-4">কোনো ইতিহাস নেই</p>
          ) : (
            history.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300 font-medium">{item}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function BackupPage({ onBack, goHome }: any) {
  const [loading, setLoading] = useState(false);

  const handleBackup = async () => {
    setLoading(true);
    try {
      // Export all data
      const data = {
        members: await db.members.toArray(),
        borrowers: await db.borrowers.toArray(),
        payments: await db.payments.toArray(),
        expenses: await db.expenses.toArray(),
        deposits: await db.deposits.toArray(),
        subscriptions: await db.subscriptions.toArray(),
        adjustments: await db.adjustments.toArray(),
        settings: await db.settings.toArray()
      };

      const fileContent = JSON.stringify(data, null, 2);
      const blob = new Blob([fileContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Cooperative_Backup_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert('ব্যাকআপ ফাইলটি ডাউনলোড হয়েছে। এটি নিরাপদ স্থানে সংরক্ষণ করুন।');
    } catch (error) {
      alert('ব্যাকআপ নিতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('আপনি কি নিশ্চিত যে আপনি এই ব্যাকআপটি রিস্টোর করতে চান? এটি বর্তমান সকল তথ্য মুছে ফেলবে।')) {
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target?.result as string);
          
          await db.transaction('rw', [db.members, db.borrowers, db.payments, db.expenses, db.deposits, db.subscriptions, db.adjustments, db.settings], async () => {
            // Clear current data
            await db.members.clear();
            await db.borrowers.clear();
            await db.payments.clear();
            await db.expenses.clear();
            await db.deposits.clear();
            await db.subscriptions.clear();
            await db.adjustments.clear();
            await db.settings.clear();

            // Restore data
            if (backupData.members) await db.members.bulkAdd(backupData.members);
            if (backupData.borrowers) await db.borrowers.bulkAdd(backupData.borrowers);
            if (backupData.payments) await db.payments.bulkAdd(backupData.payments);
            if (backupData.expenses) await db.expenses.bulkAdd(backupData.expenses);
            if (backupData.deposits) await db.deposits.bulkAdd(backupData.deposits);
            if (backupData.subscriptions) await db.subscriptions.bulkAdd(backupData.subscriptions);
            if (backupData.adjustments) await db.adjustments.bulkAdd(backupData.adjustments);
            if (backupData.settings) await db.settings.bulkAdd(backupData.settings);
          });

          alert('রিস্টোর সফল হয়েছে!');
          goHome();
        } catch (err) {
          alert('ফাইলটি সঠিক নয় বা করাপ্টেড।');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      alert('রিস্টোর করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="ব্যাকআপ ও রিস্টোর" onBack={onBack} goHome={goHome} />
      
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-700 text-center">
          <div className="w-20 h-20 bg-cyan-100 dark:bg-cyan-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CloudUpload className="w-10 h-10 text-cyan-600 dark:text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">ডেটা ব্যাকআপ</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">আপনার সমিতির সকল তথ্য একটি ফাইল হিসেবে ডাউনলোড করে নিরাপদ স্থানে রাখুন।</p>
          
          <button 
            onClick={handleBackup}
            disabled={loading}
            className="w-full py-5 bg-cyan-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-cyan-100 dark:shadow-none flex items-center justify-center gap-3 hover:bg-cyan-700 transition-all disabled:opacity-50"
          >
            {loading ? 'প্রসেসিং...' : <><Download className="w-6 h-6" /> ব্যাকআপ ডাউনলোড করুন</>}
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-700 text-center">
          <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CloudUpload className="w-10 h-10 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">ডেটা রিস্টোর</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">পূর্বে ডাউনলোড করা ব্যাকআপ ফাইলটি সিলেক্ট করে তথ্য রিস্টোর করুন।</p>
          
          <label className="block w-full py-5 bg-primary-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary-100 dark:shadow-none flex items-center justify-center gap-3 hover:bg-primary-700 transition-all cursor-pointer">
            <CloudUpload className="w-6 h-6" /> ফাইল সিলেক্ট করুন
            <input 
              type="file" 
              accept=".json" 
              onChange={handleRestore} 
              className="hidden" 
              disabled={loading}
            />
          </label>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>সতর্কতা:</strong> রিস্টোর করলে বর্তমান সকল তথ্য মুছে গিয়ে ব্যাকআপ ফাইলের তথ্যগুলো যুক্ত হবে। রিস্টোর করার আগে বর্তমান তথ্যের একটি ব্যাকআপ নিয়ে রাখা ভালো।
          </p>
        </div>
      </div>
    </div>
  );
}

function SettingsLock({ onBack, goHome, themeConfig, setThemeConfig, logTransaction, navigateTo }: any) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState('1234');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPin = async () => {
      const sp = await db.settings.get('settings_pin');
      if (sp && sp.value) {
        setSavedPin(String(sp.value));
      } else {
        const ap = await db.settings.get('admin_pin');
        setSavedPin(ap && ap.value ? String(ap.value) : '1234');
      }
    };
    loadPin();
  }, []);

  const handleUnlock = () => {
    if (String(pin) === String(savedPin)) {
      setIsUnlocked(true);
      setError('');
    } else {
      setError('ভুল পিন!');
      setPin('');
    }
  };

  if (isUnlocked) {
    return <SettingsPage onBack={onBack} goHome={goHome} themeConfig={themeConfig} setThemeConfig={setThemeConfig} logTransaction={logTransaction} navigateTo={navigateTo} />;
  }

  return (
    <div className="p-4 max-w-lg mx-auto min-h-[80vh] flex flex-col items-center justify-center">
      <PageHeader title="সেটিংস লক" onBack={onBack} goHome={goHome} />
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full shadow-xl border border-slate-100 dark:border-slate-700">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-full mb-4">
            <Lock className="w-8 h-8 text-slate-600 dark:text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">সেটিংস পিন</h2>
          <p className="text-slate-500 dark:text-slate-400 text-center mt-2">সেটিংসে প্রবেশ করতে আলাদা পিন দিন</p>
        </div>
        <input 
          type="password" inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            setPin(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''));
            setError('');
          }}
          className="w-full text-center text-3xl tracking-[1em] py-4 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none mb-2 bg-transparent text-slate-900 dark:text-white"
          placeholder="****"
        />
        {error && <p className="text-red-500 dark:text-red-400 text-center mb-4 font-medium">{error}</p>}
        <button 
          onClick={handleUnlock}
          className="w-full bg-slate-800 dark:bg-primary-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-900 dark:hover:bg-primary-700 transition-colors"
        >
          আনলক করুন
        </button>
      </div>
    </div>
  );
}

function SettingsEditMembers({ onClose }: any) {
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const [selectedMember, setSelectedMember] = useState<any>(null);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">সদস্যদের তথ্য পরিবর্তন</h2>
          <button onClick={onClose}><XCircle className="w-6 h-6 text-slate-400 hover:text-red-500 transition-colors" /></button>
        </div>
        
        {!selectedMember ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {members.map(member => (
              <div 
                key={member.id} 
                onClick={() => setSelectedMember(member)}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-transparent hover:border-primary-100 dark:hover:border-primary-900/30 transition-all"
              >
                {member.photo ? (
                  <img src={member.photo} alt={member.name} className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                ) : (
                  <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{member.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">ID: {member.memberId}</p>
                </div>
              </div>
            ))}
            {members.length === 0 && <p className="text-center text-slate-500 py-4">কোনো সদস্য নেই</p>}
          </div>
        ) : (
          <EditMemberForm member={selectedMember} onBack={() => setSelectedMember(null)} />
        )}
      </div>
    </div>
  );
}

function EditMemberForm({ member, onBack }: any) {
  const [formData, setFormData] = useState({
    name: member.name || '',
    fatherName: member.fatherName || '',
    phone: member.phone || '',
    address: member.address || '',
    memberId: member.memberId || '',
    photo: member.photo || '',
    portalUserId: member.portalUserId || '',
    portalPassword: member.portalPassword || ''
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('ছবি ৫ এমবি-র বেশি হতে পারবে না!');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, photo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.members.update(member.id, formData);
    
    // Sync to portalCreds settings
    const credSetting = await db.settings.get('portalCreds');
    const credMap = credSetting?.value || {};
    credMap[`m_${member.id}`] = { userId: formData.portalUserId, password: formData.portalPassword };
    await db.settings.put({ key: 'portalCreds', value: credMap });

    alert('সদস্যের তথ্য সফলভাবে আপডেট করা হয়েছে');
    onBack();
  };

  const handleDelete = async () => {
    try {
      // 1. Calculate Profit Share before deletion
      const allMembers = await db.members.toArray();
      const memberCount = allMembers.length;
      
      const allPayments = await db.payments.toArray();
      const totalProfit = allPayments
        .filter(p => p.type === 'profit')
        .reduce((sum, p) => sum + p.amount, 0);
        
      const allSubscriptions = await db.subscriptions.toArray();
      const totalPenalties = allSubscriptions.reduce((sum, s) => sum + (s.penalty || 0), 0);
      
      const allBorrowers = await db.borrowers.toArray();
      const totalFormFees = allBorrowers.reduce((sum, b) => sum + (b.formFee || 0), 0);
      
      const totalDistributable = totalProfit + totalPenalties + totalFormFees;
      const profitShare = memberCount > 0 ? Math.floor(totalDistributable / memberCount) : 0;
      
      // 2. Calculate Member's Contribution (Principal)
      const memberSubs = await db.subscriptions.where('memberId').equals(member.id).toArray();
      const memberDeps = await db.deposits.where('memberId').equals(member.id).toArray();
      
      const contribution = memberSubs.reduce((sum, s) => sum + s.amount, 0) + 
                           memberDeps.reduce((sum, d) => sum + d.amount, 0);
                           
      const totalPayout = contribution + profitShare;

      if (confirm(`সদস্যকে ডিলিট করার আগে পাওনা হিসাব:\n\n` +
                  `১. মোট জমা (চাঁদা + সঞ্চয়): ৳ ${contribution.toLocaleString('bn-BD')}\n` +
                  `২. লভ্যাংশ অংশ (লাভ + জরিমানা + ফরম ফি): ৳ ${profitShare.toLocaleString('bn-BD')}\n` +
                  `----------------------------------\n` +
                  `মোট প্রদানযোগ্য টাকা: ৳ ${totalPayout.toLocaleString('bn-BD')}\n\n` +
                  `আপনি কি নিশ্চিত যে আপনি এই সদস্যকে ডিলিট করতে চান? এটি তার সকল তথ্য মুছে ফেলবে এবং লভ্যাংশ সমন্বয় করবে।`)) {
        
        await db.transaction('rw', [db.members, db.subscriptions, db.deposits, db.mfsTransactions, db.adjustments], async () => {
          // Delete member records
          await db.members.delete(member.id);
          await db.subscriptions.where('memberId').equals(member.id).delete();
          await db.deposits.where('memberId').equals(member.id).delete();
          await db.mfsTransactions.where('payerId').equals(member.id).filter(t => t.type === 'subscription').delete();
          
          // Record the profit share payout as a manual adjustment (subtract)
          // The principal (contribution) is already removed from totalCash 
          // by deleting the subscription/deposit records above.
          if (profitShare > 0) {
            await db.adjustments.add({
              amount: profitShare,
              type: 'subtract',
              date: getLocalISOString(),
              notes: `সদস্য বিদায় লভ্যাংশ প্রদান: ${member.name}`
            });
          }
        });
        
        alert('সদস্য সফলভাবে ডিলিট করা হয়েছে এবং লভ্যাংশ সমন্বয় করা হয়েছে।');
        onBack();
      }
    } catch (error) {
      console.error('Delete member error:', error);
      alert('সদস্য ডিলিট করতে সমস্যা হয়েছে।');
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={onBack} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>
        <h3 className="font-bold text-lg text-slate-800 dark:text-white">তথ্য সম্পাদনা</h3>
      </div>
      
      <div className="flex flex-col items-center mb-4">
        <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 relative overflow-hidden mb-3">
          {formData.photo ? (
            <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-8 h-8 text-slate-400 dark:text-slate-600" />
          )}
        </div>
        {!formData.photo ? (
          <div className="flex gap-2">
            <label className="px-6 py-2 bg-primary-600 text-white rounded-xl text-sm font-black cursor-pointer hover:bg-primary-700 transition-all flex items-center gap-2 shadow-lg shadow-primary-100 dark:shadow-none active:scale-95">
              <CloudUpload className="w-4 h-4" /> ছবি আপলোড করুন
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden" 
              />
            </label>
          </div>
        ) : (
          <button 
            type="button"
            onClick={() => setFormData({ ...formData, photo: '' })}
            className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> ছবি মুছুন
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        <input 
          required
          placeholder="সদস্যের নাম"
          value={formData.name}
          onChange={e => setFormData(prev => ({...prev, name: e.target.value}))}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
        <input 
          required
          placeholder="পিতার নাম"
          value={formData.fatherName}
          onChange={e => setFormData(prev => ({...prev, fatherName: e.target.value}))}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
        <input 
          required
          type="text" inputMode="numeric"
          placeholder="ফোন নম্বর"
          value={formData.phone}
          onChange={e => setFormData(prev => ({...prev, phone: bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, '').slice(0, 11)}))}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
        <input 
          required
          type="text" inputMode="numeric"
          placeholder="সদস্য আইডি"
          value={formData.memberId}
          onChange={e => setFormData(prev => ({...prev, memberId: bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, '')}))}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
        <textarea 
          placeholder="ঠিকানা"
          value={formData.address}
          onChange={e => setFormData(prev => ({...prev, address: e.target.value}))}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white min-h-[100px]"
        />
        <input 
          placeholder="Portal User ID"
          value={formData.portalUserId}
          onChange={e => setFormData(prev => ({...prev, portalUserId: e.target.value}))}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
        <input 
          placeholder="Portal Password"
          value={formData.portalPassword}
          onChange={e => setFormData(prev => ({...prev, portalPassword: e.target.value}))}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
      </div>
      <button type="submit" className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none">
        আপডেট করুন
      </button>
      </form>
      <button 
        type="button" 
        onClick={handleDelete}
        className="w-full py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-100 dark:border-red-900/30"
      >
        সদস্য ডিলিট করুন
      </button>
    </div>
  );
}

function SettingsEditBorrowers({ onClose }: any) {
  const borrowers = useLiveQuery(() => db.borrowers.toArray()) || [];
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">ঋণদাতার তথ্য পরিবর্তন</h2>
          <button onClick={onClose}><XCircle className="w-6 h-6 text-slate-400 hover:text-red-500 transition-colors" /></button>
        </div>
        
        {!selectedBorrower ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {borrowers.map(borrower => (
              <div 
                key={borrower.id} 
                onClick={() => setSelectedBorrower(borrower)}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-transparent hover:border-primary-100 dark:hover:border-primary-900/30 transition-all"
              >
                {borrower.photo ? (
                  <img src={borrower.photo} alt={borrower.name} className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                ) : (
                  <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <HandCoins className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{borrower.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">ID: {borrower.uid}</p>
                </div>
              </div>
            ))}
            {borrowers.length === 0 && <p className="text-center text-slate-500 py-4">কোনো ঋণদাতা নেই</p>}
          </div>
        ) : (
          <EditBorrowerForm borrower={selectedBorrower} onBack={() => setSelectedBorrower(null)} />
        )}
      </div>
    </div>
  );
}

function EditBorrowerForm({ borrower, onBack }: any) {
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const [guarantorIsMember, setGuarantorIsMember] = useState(borrower.guarantor?.startsWith('সদস্য:'));
  const [formData, setFormData] = useState({
    name: borrower.name || '',
    fatherName: borrower.fatherName || '',
    phone: borrower.phone || '',
    address: borrower.address || '',
    uid: borrower.uid || '',
    guarantor: borrower.guarantor || '',
    photo: borrower.photo || '',
    loanAmount: borrower.loanAmount || 10000,
    portalUserId: borrower.portalUserId || '',
    portalPassword: borrower.portalPassword || ''
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('ছবি ৫ এমবি-র বেশি হতে পারবে না!');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, photo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.borrowers.update(borrower.id, { ...formData, loanAmount: Number(formData.loanAmount) });
    
    // Sync to portalCreds settings
    const credSetting = await db.settings.get('portalCreds');
    const credMap = credSetting?.value || {};
    credMap[`b_${borrower.id}`] = { userId: formData.portalUserId, password: formData.portalPassword };
    await db.settings.put({ key: 'portalCreds', value: credMap });

    alert('ঋণদাতার তথ্য সফলভাবে আপডেট করা হয়েছে');
    onBack();
  };

  const handleDelete = async () => {
    const allPayments = await db.payments.where('borrowerId').equals(borrower.id).toArray();
    const activePayments = allPayments.filter(p => p.date >= borrower.loanDate);
    const totalPrincipalPaid = activePayments.filter(p => p.type === 'principal').reduce((sum, p) => sum + p.amount, 0);
    const remainingPrincipal = borrower.loanAmount - totalPrincipalPaid;

    if (remainingPrincipal > 0) {
      alert(`এই ঋণগ্রহীতার এখনো ৳${remainingPrincipal.toLocaleString('bn-BD')} আসল টাকা বাকি আছে, তাই ডিলিট করা যাবে না!`);
      return;
    }

    if (confirm('আপনি কি নিশ্চিত যে আপনি এই ঋণদাতাকে ডিলিট করতে চান? এটি তার সকল পেমেন্ট তথ্যও মুছে ফেলবে।')) {
      await db.transaction('rw', [db.borrowers, db.payments, db.mfsTransactions], async () => {
        await db.borrowers.delete(borrower.id);
        await db.payments.where('borrowerId').equals(borrower.id).delete();
        await db.mfsTransactions.where('payerId').equals(borrower.id).filter(t => t.type === 'profit').delete();
      });
      alert('ঋণদাতা ডিলিট করা হয়েছে');
      onBack();
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={onBack} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>
        <h3 className="font-bold text-lg text-slate-800 dark:text-white">তথ্য সম্পাদনা</h3>
      </div>
      
      <div className="flex flex-col items-center mb-4">
        <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 relative overflow-hidden mb-3">
          {formData.photo ? (
            <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-8 h-8 text-slate-400 dark:text-slate-600" />
          )}
        </div>
        {!formData.photo ? (
          <div className="flex gap-2">
            <label className="px-6 py-2 bg-orange-600 text-white rounded-xl text-sm font-black cursor-pointer hover:bg-orange-700 transition-all flex items-center gap-2 shadow-lg shadow-orange-100 dark:shadow-none active:scale-95">
              <CloudUpload className="w-4 h-4" /> ছবি আপলোড করুন
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden" 
              />
            </label>
          </div>
        ) : (
          <button 
            type="button"
            onClick={() => setFormData({ ...formData, photo: '' })}
            className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> ছবি মুছুন
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        <input 
          required
          placeholder="ঋণদাতার নাম"
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
        <input 
          required
          placeholder="পিতার নাম"
          value={formData.fatherName}
          onChange={e => setFormData({...formData, fatherName: e.target.value})}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
        <input 
          required
          type="text" inputMode="numeric"
          placeholder="ফোন নম্বর"
          value={formData.phone}
          onChange={e => setFormData({...formData, phone: bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, '').slice(0, 11)})}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
        <input 
          required
          type="text" inputMode="numeric"
          placeholder="ঋণদাতা আইডি"
          value={formData.uid}
          onChange={e => setFormData({...formData, uid: bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, '')})}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">ঋণের পরিমাণ</label>
          <input 
            required
            type="text" inputMode="numeric"
            placeholder="ঋণের পরিমাণ"
            value={formData.loanAmount}
            onChange={e => setFormData({...formData, loanAmount: Number(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, ''))})}
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
          />
        </div>
        <input 
          placeholder="Portal User ID"
          value={formData.portalUserId}
          onChange={e => setFormData(prev => ({...prev, portalUserId: e.target.value}))}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
        <input 
          placeholder="Portal Password"
          value={formData.portalPassword}
          onChange={e => setFormData(prev => ({...prev, portalPassword: e.target.value}))}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
        />
        
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">জামিনদার (Guarantor)</label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                setGuarantorIsMember(true);
                setFormData({...formData, guarantor: ''});
              }}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-bold transition-all border",
                guarantorIsMember 
                  ? "bg-primary-500 text-white border-primary-600 dark:border-primary-500 shadow-lg shadow-primary-200 dark:shadow-none" 
                  : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              )}
            >
              সদস্য
            </button>
            <button
              type="button"
              onClick={() => {
                setGuarantorIsMember(false);
                setFormData({...formData, guarantor: ''});
              }}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-bold transition-all border",
                !guarantorIsMember 
                  ? "bg-primary-500 text-white border-primary-600 dark:border-primary-500 shadow-lg shadow-primary-200 dark:shadow-none" 
                  : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              )}
            >
              অন্যান্য
            </button>
          </div>
          {guarantorIsMember ? (
            <select 
              required
              value={formData.guarantor}
              onChange={e => setFormData({...formData, guarantor: e.target.value})}
              className="w-full p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-sm text-slate-900 dark:text-white"
            >
              <option value="">জামিনদার সদস্য নির্বাচন করুন</option>
              {members.map(m => (
                <option key={m.id} value={`সদস্য: ${m.name} (${m.memberId})`}>
                  {m.name} ({m.memberId})
                </option>
              ))}
            </select>
          ) : (
            <input 
              required
              type="text"
              placeholder="জামিনদারের নাম লিখুন"
              value={formData.guarantor}
              onChange={e => setFormData({...formData, guarantor: e.target.value})}
              className="w-full p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-sm text-slate-900 dark:text-white"
            />
          )}
        </div>
      
        <textarea 
          placeholder="ঠিকানা"
          value={formData.address}
          onChange={e => setFormData({...formData, address: e.target.value})}
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white min-h-[100px]"
        />
      </div>
      <button type="submit" className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none">
        আপডেট করুন
      </button>
      </form>
      <button 
        type="button" 
        onClick={handleDelete}
        className="w-full py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-100 dark:border-red-900/30"
      >
        ঋণদাতা ডিলিট করুন
      </button>
    </div>
  );
}

function PortalAccountsModal({ onClose, members, borrowers }: any) {
  const [localAccs, setLocalAccs] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const credsData = useLiveQuery(() => db.settings.get('portalCreds'));
  const savedCredsMap = credsData?.value || {};

  useEffect(() => {
    const merged = new Map<string, any>();
    
    // Map existing local items for preservation
    const existingMap = new Map(localAccs.map(a => [a.id || a.memberRec?.id || a.borrowerRec?.id, a]));
    
    members.forEach(m => {
      const idKey = `m_${m.id}`;
      const fbU = savedCredsMap[idKey]?.userId;
      const fbP = savedCredsMap[idKey]?.password;
      const existing = existingMap.get(m.id);
      
      merged.set(idKey, {
        name: m.name,
        memberId: m.memberId,
        id: m.id,
        photo: m.photo,
        // Only prioritize existing (local user input) if it's already set. 
        // Else fallback to DB/Settings.
        portalUserId: existing?.portalUserId || fbU || m.portalUserId || '',
        portalPassword: existing?.portalPassword || fbP || m.portalPassword || '',
        memberRec: m
      });
    });

    borrowers.forEach(b => {
      const idKey = b.memberId ? `m_${b.memberId}` : `b_${b.id}`;
      const fbU = savedCredsMap[idKey]?.userId;
      const fbP = savedCredsMap[idKey]?.password;
      
      const existing = existingMap.get(b.id);
      
      if (!merged.has(idKey)) {
        merged.set(idKey, {
          name: b.name,
          uid: b.uid,
          id: b.id,
          photo: b.photo,
          portalUserId: existing?.portalUserId || fbU || b.portalUserId || '',
          portalPassword: existing?.portalPassword || fbP || b.portalPassword || '',
          borrowerRec: b
        });
      } else {
        const existingEntry = merged.get(idKey);
        if (!existingEntry.borrowerRec) {
          existingEntry.borrowerRec = b;
        }
      }
    });

    setLocalAccs(Array.from(merged.values()));
  }, [members, borrowers, JSON.stringify(savedCredsMap)]);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      let successCount = 0;
      let failCount = 0;
      const newCredsMap = { ...savedCredsMap };

      for (const acc of localAccs) {
        const userId = (acc.portalUserId || '').trim();
        const password = (acc.portalPassword || '').trim();
        console.log(`Saving acc ${acc.id}: U=${userId}, P=${password}`);
        
        let updateOk = true;

        if (acc.memberRec && acc.memberRec.id) {
          const ok = await db.members.update(acc.memberRec.id, { 
            portalUserId: userId, 
            portalPassword: password 
          });
          if (!ok) updateOk = false;
          newCredsMap[`m_${acc.memberRec.id}`] = { userId, password };
        }
        
        if (acc.borrowerRec && acc.borrowerRec.id) {
          const ok = await db.borrowers.update(acc.borrowerRec.id, { 
            portalUserId: userId, 
            portalPassword: password 
          });
          if (!ok) updateOk = false;
          newCredsMap[`b_${acc.borrowerRec.id}`] = { userId, password };
        }

        // Even if updateOk is false (column missing), we save to settings!
        successCount++; 
      }
      
      // Save the universal fallback 
      await db.settings.put({ key: 'portalCreds', value: newCredsMap });

      alert('সকল তথ্য সফলভাবে সেভ করা হয়েছে!');
      onClose();
    } catch (e: any) {
      console.error(e);
      alert('তথ্য সেভ করতে সমস্যা হয়েছে: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
       <div className="bg-white dark:bg-slate-900 w-full max-w-lg h-[80vh] rounded-[2.5rem] flex flex-col p-6 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between mb-6">
             <div>
                <h3 className="text-xl font-black">সদস্য পোর্টাল অ্যাকাউন্টস</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">লগইন আইডি ও পাসওয়ার্ড পরিচালনা করুন</p>
             </div>
             <button onClick={onClose} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                <XCircle className="w-5 h-5 text-slate-400" />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
             {localAccs.map((acc: any, index: number) => (
               <div key={`portal-acc-${acc.id}-${index}`} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-indigo-600 font-bold overflow-hidden border border-slate-100 dark:border-slate-800">
                           {acc.photo ? <img src={acc.photo} className="w-full h-full object-cover" /> : <User className="w-5 h-5 opacity-30" />}
                        </div>
                        <div>
                           <p className="font-black text-sm">{acc.name}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase">
                             ID: {acc.memberId || acc.uid} {acc.memberRec && acc.borrowerRec ? '(সদস্য ও ঋণগ্রহীতা)' : acc.memberRec ? '(সদস্য)' : '(ঋণগ্রহীতা)'}
                           </p>
                        </div>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Portal User ID</p>
                        <input 
                          type="text"
                          value={acc.portalUserId}
                          onChange={(e) => {
                            const newAccs = [...localAccs];
                            newAccs[index] = { ...newAccs[index], portalUserId: e.target.value };
                            setLocalAccs(newAccs);
                          }}
                          placeholder="Portal User ID লিখুন"
                          className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl outline-none text-xs font-bold border-2 border-transparent focus:border-indigo-300 transition-all"
                        />
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Portal Password</p>
                        <input 
                          type="text"
                          value={acc.portalPassword}
                          onChange={(e) => {
                            const newAccs = [...localAccs];
                            newAccs[index] = { ...newAccs[index], portalPassword: e.target.value };
                            setLocalAccs(newAccs);
                          }}
                          placeholder="Portal Password লিখুন"
                          className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl outline-none text-xs font-bold border-2 border-transparent focus:border-indigo-300 transition-all"
                        />
                     </div>
                  </div>
               </div>
             ))}
             {localAccs.length === 0 && <p className="text-center py-10 font-bold text-slate-400">কোনো সদস্য পাওয়া যায়নি</p>}
          </div>
          
          <div className="flex gap-3 mt-6">
            <button 
              onClick={onClose} 
              className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black transition-all"
            >
              বন্ধ করুন
            </button>
            <button 
              onClick={handleSaveAll} 
              disabled={isSaving}
              className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              তথ্য সেভ করুন
            </button>
          </div>
       </div>
    </div>
  );
}

function SettingsPage({ onBack, goHome, themeConfig, setThemeConfig, logTransaction, navigateTo }: any) {
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const [showPinReset, setShowPinReset] = useState(false);
  const [showSettingsPinReset, setShowSettingsPinReset] = useState(false);
  const [showEditMembers, setShowEditMembers] = useState(false);
  const [showEditBorrowers, setShowEditBorrowers] = useState(false);
  const [showNightModeSettings, setShowNightModeSettings] = useState(false);
  const [tempThemeConfig, setTempThemeConfig] = useState(themeConfig || { mode: 'light', darkStart: '18:00', darkEnd: '06:00' });
  const [newPin, setNewPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [newSettingsPin, setNewSettingsPin] = useState('');
  const [oldSettingsPin, setOldSettingsPin] = useState('');
  const [confirmSettingsPin, setConfirmSettingsPin] = useState('');
  const [showTitleEdit, setShowTitleEdit] = useState(false);
  const [showReceiptNameEdit, setShowReceiptNameEdit] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [tempSubtitle, setTempSubtitle] = useState('');
  const [tempReceiptName, setTempReceiptName] = useState('');
  const [tempMeetingDay, setTempMeetingDay] = useState(1);
  const [tempPenalty, setTempPenalty] = useState(200);
  const [showMenuEdit, setShowMenuEdit] = useState(false);
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [showPenaltyEdit, setShowPenaltyEdit] = useState(false);
  const [showSubscriptionAmountEdit, setShowSubscriptionAmountEdit] = useState(false);
  const [showSubMigration, setShowSubMigration] = useState(false);
  const [showLoanMigration, setShowLoanMigration] = useState(false);
  const [showLoanAmountEdit, setShowLoanAmountEdit] = useState(false);
  const [showProfitSettingsEdit, setShowProfitSettingsEdit] = useState(false);
  const [showPortalAccounts, setShowPortalAccounts] = useState(false);
  const [tempPhone, setTempPhone] = useState('');
  const [tempSubscriptionAmount, setTempSubscriptionAmount] = useState(1000);
  const [tempLoanAmount, setTempLoanAmount] = useState(10000);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<number | null>(null);
  const [tempProfitPercentage, setTempProfitPercentage] = useState(5);
  const [tempCompoundPercentage, setTempCompoundPercentage] = useState(10);
  const [tempMenuTitles, setTempMenuTitles] = useState<any>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAdSenseEdit, setShowAdSenseEdit] = useState(false);
  const [tempAdClient, setTempAdClient] = useState('');
  const [tempAdSlot, setTempAdSlot] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [appLogo, setAppLogo] = useState<string | null>(null);

  const borrowers = useLiveQuery(() => db.borrowers.toArray()) || [];

  useEffect(() => {
    const load = async () => {
      const t = await db.settings.get('app_title');
      const s = await db.settings.get('app_subtitle');
      const rn = await db.settings.get('receipt_samity_name');
      const d = await db.settings.get('meeting_day');
      const mt = await db.settings.get('menu_titles');
      const sig = await db.settings.get('authorized_signature');
      const logo = await db.settings.get('app_logo');
      const phone = await db.settings.get('admin_phone');
      const penalty = await db.settings.get('penalty_amount');
      const subAmount = await db.settings.get('subscription_amount');
      const lnAmount = await db.settings.get('loan_amount');
      const pp = await db.settings.get('profit_percentage');
      const cp = await db.settings.get('compound_percentage');
      const ac = await db.settings.get('adsense_client_id');
      const as = await db.settings.get('adsense_slot_id');
      
      setTempTitle(t?.value || 'যুব সমাজ সমবায় সমিতি');
      setTempSubtitle(s?.value || 'Save today, build tomorrow.');
      setTempReceiptName(rn?.value || '');
      setTempMeetingDay(d?.value || 1);
      setTempPenalty(penalty?.value || 200);
      setTempSubscriptionAmount(subAmount?.value || 1000);
      setTempLoanAmount(lnAmount?.value || 10000);
      setTempProfitPercentage(pp?.value || 5);
      setTempCompoundPercentage(cp?.value || 10);
      setTempAdClient(ac?.value || '');
      setTempAdSlot(as?.value || '');
      
      setTempPhone(phone?.value || '');
      setSignature(sig?.value || null);
      setAppLogo(logo?.value || null);
      setTempMenuTitles(mt?.value || {
        cash: 'Total Fund',
        members: 'Member List',
        borrowers: 'Borrower List',
        expenses: 'Expense',
        halkhata: 'Audit',
        backup: 'Backup & Restore',
        settings: 'Settings'
      });
    };
    load();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const compressedBase64 = await compressImage(base64, 256, 256); // Smaller for safety (50k chars limit)
        await db.settings.put({ key: 'app_logo', value: compressedBase64 });
        setAppLogo(compressedBase64);
        await logTransaction({
          amount: 0,
          type: 'Settings Change',
          payerName: 'Admin',
          description: 'App logo has been updated.',
          category: 'info'
        });
        alert('Logo uploaded successfully');
      } catch (error) {
        console.error('Logo process error:', error);
        alert('Error processing logo.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteLogo = async () => {
    await db.settings.delete('app_logo');
    setAppLogo(null);
    await logTransaction({
      amount: 0,
      type: 'Settings Change',
      payerName: 'Admin',
      description: 'App logo has been deleted.',
      category: 'info'
    });
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const compressedBase64 = await compressImage(base64, 256, 128); // Smaller for safety
        await db.settings.put({ key: 'authorized_signature', value: compressedBase64 });
        setSignature(compressedBase64);
        await logTransaction({
          amount: 0,
          type: 'Settings Change',
          payerName: 'Admin',
          description: 'Authorized signature has been updated.',
          category: 'info'
        });
        alert('Signature uploaded successfully');
      } catch (error) {
        console.error('Signature process error:', error);
        alert('Error processing signature.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteSignature = async () => {
    await db.settings.delete('authorized_signature');
    setSignature(null);
    await logTransaction({
      amount: 0,
      type: 'Settings Change',
      payerName: 'Admin',
      description: 'Authorized signature has been deleted.',
      category: 'info'
    });
  };

  const handleReset = async () => {
    if (newPin.length !== 6) {
      alert('Password must be exactly 6 digits');
      return;
    }
    if (newPin !== confirmPin) {
      alert('New password and confirm password do not match');
      return;
    }

    const saved = await db.settings.get('admin_pin');
    const currentPin = saved?.value || '123456';
    if (oldPin !== String(currentPin)) {
      alert('Current password is incorrect!');
      return;
    }

    if (window.confirm('Are you sure you want to change the login password?')) {
      await db.settings.put({ key: 'admin_pin', value: newPin });
      await logTransaction({
        amount: 0,
        type: 'Settings Change',
        payerName: 'Admin',
        description: 'Login password has been updated.',
        category: 'info'
      });
      alert('Password updated successfully');
      setShowPinReset(false);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    }
  };

  const handleSaveSettingsPin = async () => {
    if (newSettingsPin.length !== 4) {
      alert('PIN must be 4 digits');
      return;
    }
    if (newSettingsPin !== confirmSettingsPin) {
      alert('New PIN and confirm PIN do not match');
      return;
    }

    const saved = await db.settings.get('settings_pin');
    let currentSettingsPin = saved?.value;
    if (!currentSettingsPin) {
        const ap = await db.settings.get('admin_pin');
        currentSettingsPin = ap?.value || '1234';
    }

    if (oldSettingsPin !== String(currentSettingsPin)) {
      alert('Current Settings PIN is incorrect!');
      return;
    }

    if (window.confirm('Are you sure you want to change the settings PIN?')) {
      await db.settings.put({ key: 'settings_pin', value: newSettingsPin });
      await logTransaction({
        amount: 0,
        type: 'Settings Change',
        payerName: 'Admin',
        description: 'Settings PIN has been updated.',
        category: 'info'
      });
      alert('Settings PIN updated successfully');
      setShowSettingsPinReset(false);
      setOldSettingsPin('');
      setNewSettingsPin('');
      setConfirmSettingsPin('');
    }
  };

  const handleSaveAppInfo = async () => {
    try {
      await db.settings.put({ key: 'app_title', value: tempTitle });
      await db.settings.put({ key: 'app_subtitle', value: tempSubtitle });
      await db.settings.put({ key: 'meeting_day', value: tempMeetingDay });
      
      await logTransaction({
        amount: 0,
        type: 'Settings Change',
        payerName: 'Admin',
        description: `App title (${tempTitle}), subtitle and meeting day (${tempMeetingDay}) have been updated.`,
        category: 'info'
      });

      alert('Information updated successfully');
      setShowTitleEdit(false);
      goHome();
    } catch (error) {
      console.error('Failed to save app info:', error);
      alert('Error saving information. Please try again.');
    }
  };

  const handleSaveReceiptName = async () => {
    await db.settings.put({ key: 'receipt_samity_name', value: tempReceiptName });
    await logTransaction({
      amount: 0,
      type: 'Settings Change',
      payerName: 'Admin',
      description: `Receipt name updated to: ${tempReceiptName}`,
      category: 'info'
    });
    alert('Receipt name updated successfully');
    setShowReceiptNameEdit(false);
  };

  const handleSaveMenuTitles = async () => {
    await db.settings.put({ key: 'menu_titles', value: tempMenuTitles });
    await logTransaction({
      amount: 0,
      type: 'সেটিংস পরিবর্তন',
      payerName: 'অ্যাডমিন',
      description: 'মেনু টাইটেলসমূহ পরিবর্তন করা হয়েছে।',
      category: 'info'
    });
    alert('মেনু টাইটেল সফলভাবে আপডেট করা হয়েছে');
    setShowMenuEdit(false);
  };

  const handleSavePhone = async () => {
    if (tempPhone.length === 11) {
      await db.settings.put({ key: 'admin_phone', value: tempPhone });
      await logTransaction({
        amount: 0,
        type: 'Settings Change',
        payerName: 'Admin',
        description: `Login mobile number updated to: ${tempPhone}`,
        category: 'info'
      });
      alert('Login mobile number updated successfully');
      setShowPhoneEdit(false);
    } else {
      alert('Mobile number must be 11 digits');
    }
  };

  const handleSaveNightMode = () => {
    setThemeConfig(tempThemeConfig);
    logTransaction({
      amount: 0,
      type: 'Settings Change',
      payerName: 'Admin',
      description: `Night mode settings updated (${tempThemeConfig.mode}).`,
      category: 'info'
    });
    alert('Night mode settings updated');
    setShowNightModeSettings(false);
  };

  const handleSavePenalty = async () => {
    await db.settings.put({ key: 'penalty_amount', value: Number(tempPenalty) });
    await logTransaction({
      amount: 0,
      type: 'Settings Change',
      payerName: 'Admin',
      description: `Penalty amount updated to: ${tempPenalty} Taka.`,
      category: 'info'
    });
    alert('Penalty amount updated successfully');
    setShowPenaltyEdit(false);
  };

  const handleSaveSubscriptionAmount = async () => {
    await db.settings.put({ key: 'subscription_amount', value: Number(tempSubscriptionAmount) });
    await logTransaction({
      amount: 0,
      type: 'Settings Change',
      payerName: 'Admin',
      description: `Monthly savings/subscription amount updated to: ${tempSubscriptionAmount} Taka.`,
      category: 'info'
    });
    alert('Subscription amount updated successfully');
    setShowSubscriptionAmountEdit(false);
  };

  const handleSaveLoanAmount = async () => {
    if (selectedBorrowerId) {
      await db.borrowers.update(selectedBorrowerId, { loanAmount: Number(tempLoanAmount) });
      const borrower = borrowers.find(b => Number(b.id) === Number(selectedBorrowerId));
      await logTransaction({
        amount: 0,
        type: 'Settings Change',
        payerName: 'Admin',
        description: `Loan amount for ${borrower?.name} updated to: ${tempLoanAmount} Taka.`,
        category: 'info'
      });
      alert('Borrower loan amount updated successfully');
    } else {
      await db.settings.put({ key: 'loan_amount', value: Number(tempLoanAmount) });
      await logTransaction({
        amount: 0,
        type: 'Settings Change',
        payerName: 'Admin',
        description: `Default loan amount updated to: ${tempLoanAmount} Taka.`,
        category: 'info'
      });
      alert('Default loan amount updated successfully');
    }
    setShowLoanAmountEdit(false);
    setSelectedBorrowerId(null);
  };

  const handleSaveProfitSettings = async () => {
    await db.settings.put({ key: 'profit_percentage', value: Number(tempProfitPercentage) });
    await db.settings.put({ key: 'compound_percentage', value: Number(tempCompoundPercentage) });
    await logTransaction({
      amount: 0,
      type: 'Settings Change',
      payerName: 'Admin',
      description: `Profit percentage (${tempProfitPercentage}%) and compound interest rate (${tempCompoundPercentage}%) have been updated.`,
      category: 'info'
    });
    alert('Profit rates updated successfully');
    setShowProfitSettingsEdit(false);
  };

  const handleSaveAdSenseSettings = async () => {
    await db.settings.put({ key: 'adsense_client_id', value: tempAdClient });
    await db.settings.put({ key: 'adsense_slot_id', value: tempAdSlot });
    await logTransaction({
      amount: 0,
      type: 'Settings Change',
      payerName: 'Admin',
      description: 'AdSense settings updated.',
      category: 'info'
    });
    setShowAdSenseEdit(false);
    alert('AdSense settings updated');
  };

  const handleFullReset = async () => {
    try {
      await db.transaction('rw', [db.members, db.borrowers, db.payments, db.expenses, db.deposits, db.subscriptions, db.adjustments, db.settings, db.mfsTransactions], async () => {
        await Promise.all([
          db.members.clear(),
          db.borrowers.clear(),
          db.payments.clear(),
          db.expenses.clear(),
          db.deposits.clear(),
          db.subscriptions.clear(),
          db.adjustments.clear(),
          db.settings.clear(),
          db.mfsTransactions.clear()
        ]);
      });
      await logTransaction({
        amount: 0,
        type: 'সিস্টেম রিসেট',
        payerName: 'অ্যাডমিন',
        description: 'অ্যাপটি সফলভাবে রিসেট (সকল ডাটা ডিলিট) করা হয়েছে।',
        category: 'info'
      });
      alert('অ্যাপটি সফলভাবে রিসেট করা হয়েছে।');
      goHome();
    } catch (error) {
      alert('রিসেট করতে সমস্যা হয়েছে');
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="সেটিংস" onBack={onBack} goHome={goHome} />


      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <button 
          onClick={() => navigateTo && navigateTo('backup')}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <CloudUpload className="w-5 h-5 text-amber-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">ব্যাকআপ ও রিস্টোর</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => {
            setTempThemeConfig(themeConfig || { mode: 'light', darkStart: '18:00', darkEnd: '06:00' });
            setShowNightModeSettings(true);
          }}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Moon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">নাইট মোড সেটিংস</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowTitleEdit(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Edit className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">টাইটেল ও সাবটাইটেল পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowReceiptNameEdit(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">রিসিট সমিতির নাম পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowPinReset(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">লগইন পাসওয়ার্ড পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowSettingsPinReset(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">সেটিংস পিন পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowPhoneEdit(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">লগইন মোবাইল নম্বর</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowPenaltyEdit(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">জরিমানার পরিমাণ পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowSubscriptionAmountEdit(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">চাঁদার পরিমাণ নির্ধারণ</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowLoanAmountEdit(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Banknote className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">ঋণের পরিমাণ নির্ধারণ</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowProfitSettingsEdit(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">লাভের হার নির্ধারণ</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>

        <button 
          onClick={() => setShowSubMigration(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Calculator className="w-5 h-5 text-amber-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200 uppercase tracking-tighter">সাবেক চাঁদা ও জরিমানা এন্ট্রি</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowLoanMigration(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200 uppercase tracking-tighter">সাবেক ঋণ ও লাভ এন্ট্রি</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>

        <button 
          onClick={() => setShowMenuEdit(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">মেনু টাইটেল পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowEditMembers(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">সদস্যদের তথ্য পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowEditBorrowers(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <HandCoins className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">ঋণদাতার তথ্য পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>

        <button 
          onClick={() => setShowPortalAccounts(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-indigo-50/30 dark:hover:bg-indigo-950/25 bg-indigo-50/10 dark:bg-indigo-950/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            <span className="font-bold text-indigo-600 dark:text-indigo-400">সদস্য পোর্টাল অ্যাকাউন্টস সেটিংস</span>
          </div>
          <ChevronRight className="w-5 h-5 text-indigo-300 dark:text-indigo-800" />
        </button>

        <div className="p-4 border-b border-slate-50 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <span className="font-medium text-slate-700 dark:text-slate-200">অ্যাপ লোগো</span>
            </div>
            {appLogo ? (
              <button 
                onClick={handleDeleteLogo}
                className="text-xs text-red-500 font-bold flex items-center gap-1 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> মুছে ফেলুন
              </button>
            ) : (
              <label className="text-xs text-primary-600 dark:text-primary-400 font-bold cursor-pointer flex items-center gap-1 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
                <CloudUpload className="w-3 h-3" /> আপলোড করুন
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            )}
          </div>
          {appLogo ? (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-700 shadow-inner">
              <img src={appLogo} alt="Logo" className="max-h-20 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.2)]" />
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl text-center border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">কোন লোগো সেট করা নেই</p>
            </div>
          )}
        </div>

        <div className="p-4 border-b border-slate-50 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Edit className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <span className="font-medium text-slate-700 dark:text-slate-200 uppercase tracking-tighter">Authorized Signature</span>
            </div>
          </div>
          <SignaturePad 
            onSave={async (data) => {
               await db.settings.put({ key: 'authorized_signature', value: data });
               setSignature(data);
            }}
            onClear={handleDeleteSignature}
            initialData={signature || undefined}
            label="অ্যাডমিন স্বাক্ষর (কলম দিয়ে লিখুন)"
            height={300}
          />
        </div>

        <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">নোটিফিকেশন</span>
          </div>
          <div className="w-12 h-6 bg-primary-500 dark:bg-primary-600 rounded-full relative cursor-pointer">
             <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
          </div>
        </div>
        <button 
          onClick={() => setShowAdSenseEdit(true)}
          className="w-full p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-700 dark:text-slate-200">Google AdSense</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        </button>
        <button 
          onClick={() => setShowResetConfirm(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5" />
            <span className="font-bold">সম্পূর্ণ অ্যাপ রিসেট করুন</span>
          </div>
          <ChevronRight className="w-5 h-5 opacity-50" />
        </button>
      </div>

      {showResetConfirm && (
        <DeleteConfirmationModal 
          onConfirm={handleFullReset} 
          onClose={() => setShowResetConfirm(false)} 
        />
      )}

      {showAdSenseEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-xl border border-slate-100 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-500" /> Google AdSense Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Client ID (ca-pub-xxx)</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-blue-500 font-medium font-mono text-slate-800 dark:text-slate-200"
                  placeholder="ca-pub-xxxxxxxxxxxxxxxx"
                  value={tempAdClient}
                  onChange={e => setTempAdClient(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Slot ID</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mt-1 outline-none focus:border-blue-500 font-medium font-mono text-slate-800 dark:text-slate-200"
                  placeholder="xxxxxxxxxx"
                  value={tempAdSlot}
                  onChange={e => setTempAdSlot(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowAdSenseEdit(false)} 
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAdSenseSettings} 
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 dark:shadow-none"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showPortalAccounts && (
        <PortalAccountsModal 
          onClose={() => setShowPortalAccounts(false)} 
          members={members} 
          borrowers={borrowers} 
        />
      )}

      {showNightModeSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-white/20 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
              <Moon className="w-6 h-6 text-primary-500" />
              নাইট মোড সেটিংস
            </h3>
            <div className="space-y-4 mb-6">
              <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <input 
                  type="radio" 
                  name="themeMode" 
                  checked={tempThemeConfig.mode === 'light'} 
                  onChange={() => setTempThemeConfig({...tempThemeConfig, mode: 'light'})}
                  className="w-5 h-5 accent-primary-500" 
                />
                <span className="font-bold text-slate-700 dark:text-slate-200">লাইট মোড (Day)</span>
              </label>

              <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <input 
                  type="radio" 
                  name="themeMode" 
                  checked={tempThemeConfig.mode === 'dark'} 
                  onChange={() => setTempThemeConfig({...tempThemeConfig, mode: 'dark'})}
                  className="w-5 h-5 accent-primary-500" 
                />
                <span className="font-bold text-slate-700 dark:text-slate-200">ডার্ক মোড (Night)</span>
              </label>

              <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <input 
                  type="radio" 
                  name="themeMode" 
                  checked={tempThemeConfig.mode === 'schedule'} 
                  onChange={() => setTempThemeConfig({...tempThemeConfig, mode: 'schedule'})}
                  className="w-5 h-5 accent-primary-500" 
                />
                <span className="font-bold text-slate-700 dark:text-slate-200">টাইম শিডিউল মোড</span>
              </label>

              {tempThemeConfig.mode === 'schedule' && (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">ডার্ক মোড শুরুর সময় (রাত)</label>
                    <input 
                      type="time" 
                      value={tempThemeConfig.darkStart} 
                      onChange={e => setTempThemeConfig({...tempThemeConfig, darkStart: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-primary-500 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">ডার্ক মোড শেষের সময় (দিন)</label>
                    <input 
                      type="time" 
                      value={tempThemeConfig.darkEnd} 
                      onChange={e => setTempThemeConfig({...tempThemeConfig, darkEnd: e.target.value})}
                      className="w-full p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-primary-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowNightModeSettings(false)}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                type="button"
              >
                বাতিল
              </button>
              <button 
                onClick={handleSaveNightMode}
                className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
                type="button"
              >
                সেভ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {showTitleEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">App Information</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Title</label>
                <input 
                  placeholder="Title"
                  value={tempTitle}
                  onChange={e => setTempTitle(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Subtitle</label>
                <input 
                  placeholder="Subtitle"
                  value={tempSubtitle}
                  onChange={e => setTempSubtitle(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Meeting Date (1-31)</label>
                <input 
                  placeholder="Meeting date (e.g., 15)"
                  type="text" inputMode="numeric"
                  value={tempMeetingDay}
                  onChange={e => setTempMeetingDay(parseInt(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, '')) || 1)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 px-1 italic">Enter the day number only. Month and year will update automatically.</p>
            </div>
            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setShowTitleEdit(false)} 
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAppInfo} 
                className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceiptNameEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Change Receipt Samity Name</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Receipt Samity Name (English)</label>
                <input 
                  placeholder="Receipt Samity Name (English)"
                  value={tempReceiptName}
                  onChange={e => setTempReceiptName(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 px-1 italic">If left blank, main title will be used. This shows only on PDF receipts.</p>
            </div>
            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setShowReceiptNameEdit(false)} 
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveReceiptName} 
                className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showMenuEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Change Menu Titles</h3>
            <div className="space-y-4">
              {Object.keys(tempMenuTitles).map((key) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 block capitalize">{key.replace('_', ' ')}</label>
                  <input 
                    value={tempMenuTitles[key]}
                    onChange={e => setTempMenuTitles({ ...tempMenuTitles, [key]: e.target.value })}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setShowMenuEdit(false)} 
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveMenuTitles} 
                className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showPhoneEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Login Mobile Number</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Will be used for login.</p>
            <div className="space-y-1.5 mb-6">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">11 Digit Mobile Number</label>
              <input 
                type="tel" inputMode="numeric"
                maxLength={11}
                placeholder="01XXXXXXXXX"
                value={tempPhone}
                onChange={e => setTempPhone(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''))}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white text-center text-xl tracking-widest font-mono"
              />
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowPhoneEdit(false)} 
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSavePhone} 
                className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showPinReset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">লগইন পাসওয়ার্ড পরিবর্তন</h3>
            <div className="space-y-4 mb-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">বর্তমান পাসওয়ার্ড</label>
                <input 
                  type="password" inputMode="numeric"
                  maxLength={6}
                  placeholder="বর্তমান পাসওয়ার্ড"
                  value={oldPin}
                  onChange={e => setOldPin(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white text-center text-xl tracking-widest font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">নতুন ৬ সংখ্যার পাসওয়ার্ড</label>
                <input 
                  type="password" inputMode="numeric"
                  maxLength={6}
                  placeholder="নতুন ৬ সংখ্যার পাসওয়ার্ড"
                  value={newPin}
                  onChange={e => setNewPin(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white text-center text-xl tracking-widest font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">কনফার্ম নতুন পাসওয়ার্ড</label>
                <input 
                  type="password" inputMode="numeric"
                  maxLength={6}
                  placeholder="কনফার্ম নতুন পাসওয়ার্ড"
                  value={confirmPin}
                  onChange={e => setConfirmPin(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white text-center text-xl tracking-widest font-mono"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setShowPinReset(false);
                  setOldPin('');
                  setNewPin('');
                  setConfirmPin('');
                }} 
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                বাতিল
              </button>
              <button 
                onClick={handleReset} 
                className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
              >
                পরিবর্তন করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettingsPinReset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Change Settings PIN</h3>
            <div className="space-y-4 mb-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Current Settings PIN</label>
                <input 
                  type="password" inputMode="numeric"
                  maxLength={4}
                  placeholder="Current Settings PIN"
                  value={oldSettingsPin}
                  onChange={e => setOldSettingsPin(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white text-center text-xl tracking-widest font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">New 4 Digit PIN</label>
                <input 
                  type="password" inputMode="numeric"
                  maxLength={4}
                  placeholder="New 4 Digit PIN"
                  value={newSettingsPin}
                  onChange={e => setNewSettingsPin(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white text-center text-xl tracking-widest font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Confirm New PIN</label>
                <input 
                  type="password" inputMode="numeric"
                  maxLength={4}
                  placeholder="Confirm New PIN"
                  value={confirmSettingsPin}
                  onChange={e => setConfirmSettingsPin(bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, ''))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white text-center text-xl tracking-widest font-mono"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setShowSettingsPinReset(false);
                  setOldSettingsPin('');
                  setNewSettingsPin('');
                  setConfirmSettingsPin('');
                }} 
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveSettingsPin} 
                className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
              >
                Change PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {showPenaltyEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Change Penalty amount</h3>
            <input 
              type="text" inputMode="numeric"
              placeholder="Penalty amount (e.g., 200)"
              value={tempPenalty}
              onChange={e => setTempPenalty(Number(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, '')))}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 text-center text-2xl text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
            />
            <div className="flex gap-4">
              <button 
                onClick={() => setShowPenaltyEdit(false)} 
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSavePenalty} 
                className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubscriptionAmountEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Set Subscription amount</h3>
            <input 
              type="text" inputMode="numeric"
              placeholder="Subscription amount (e.g., 1000)"
              value={tempSubscriptionAmount}
              onChange={e => setTempSubscriptionAmount(Number(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, '')))}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 text-center text-2xl text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
            />
            <div className="flex gap-4">
              <button 
                onClick={() => setShowSubscriptionAmountEdit(false)} 
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveSubscriptionAmount} 
                className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoanAmountEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Set Loan amount</h3>
            
            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Select Borrower (Optional)</label>
                <select 
                  value={selectedBorrowerId || ''}
                  onChange={e => {
                    const id = e.target.value || null;
                    setSelectedBorrowerId(id as any);
                    if (id) {
                      const b = borrowers.find(x => x.id === id);
                      if (b) setTempLoanAmount(b.loanAmount);
                    } else {
                      db.settings.get('loan_amount').then(s => setTempLoanAmount(s?.value || 10000));
                    }
                  }}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
                >
                  <option value="">Default Loan amount</option>
                  {borrowers.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.uid})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Loan amount</label>
                <input 
                  type="text" inputMode="numeric"
                  placeholder="Loan amount (e.g., 10000)"
                  value={tempLoanAmount}
                  onChange={e => setTempLoanAmount(Number(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, '')))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-center text-2xl text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setShowLoanAmountEdit(false);
                  setSelectedBorrowerId(null);
                }} 
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveLoanAmount} 
                className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfitSettingsEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-slate-700">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">লাভের হার নির্ধারণ</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">মাসিক লাভের হার (%)</label>
                <input 
                  type="text" inputMode="numeric"
                  value={tempProfitPercentage}
                  onChange={e => setTempProfitPercentage(Number(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, '')))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">চক্রবৃদ্ধি লাভের হার (%)</label>
                <input 
                  type="text" inputMode="numeric"
                  value={tempCompoundPercentage}
                  onChange={e => setTempCompoundPercentage(Number(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, '')))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 px-1 italic">
                মাসিক লাভ পরিশোধ করলে প্রথম হারটি প্রযোজ্য হবে। পরিশোধ না করলে দ্বিতীয় হারে চক্রবৃদ্ধি হবে।
              </p>
            </div>
            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setShowProfitSettingsEdit(false)} 
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                বাতিল
              </button>
              <button 
                onClick={handleSaveProfitSettings} 
                className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
              >
                সংরক্ষণ
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditMembers && <SettingsEditMembers onClose={() => setShowEditMembers(false)} />}
      {showEditBorrowers && <SettingsEditBorrowers onClose={() => setShowEditBorrowers(false)} />}
      
      {showSubMigration && (
        <SubscriptionMigrationModal 
          onClose={() => setShowSubMigration(false)} 
          members={members} 
          logTransaction={logTransaction} 
        />
      )}

      {showLoanMigration && (
        <LoanMigrationModal 
          onClose={() => setShowLoanMigration(false)} 
          borrowers={borrowers.filter(b => !b.notes?.includes('FIXED_INSTALLMENT'))} 
          logTransaction={logTransaction} 
        />
      )}
    </div>
  );
}

function SubscriptionMigrationModal({ onClose, members, logTransaction }: any) {
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [penalty, setPenalty] = useState('');
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!selectedMemberId || !amount) {
      alert('Please enter member and amount');
      return;
    }
    
    // Check for duplicate
    const existing = await db.subscriptions
      .where('[memberId+month+year]')
      .equals([selectedMemberId, Number(month), Number(year)])
      .first();
    
    if (existing) {
      alert('The subscription for this month is already paid.');
      return;
    }

    setIsSubmitting(true);
    try {
      await db.subscriptions.add({
        memberId: selectedMemberId,
        amount: Number(amount),
        penalty: Number(penalty || 0),
        month: Number(month),
        year: Number(year),
        date: getTodayDate()
      });
      await logTransaction({
        amount: Number(amount) + Number(penalty || 0),
        type: 'Old Subscription Migration',
        payerName: members.find((m: any) => m.id === selectedMemberId)?.name || 'Member',
        description: `Old subscription and penalty for ${BANGLISH_MONTHS[month]} ${year} has been entered.`,
        category: 'income'
      });
      alert('Saved successfully.');
      onClose();
    } catch (err) {
      alert('An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm border border-white/20 dark:border-slate-700 shadow-2xl">
        <h3 className="text-xl font-black mb-4 flex items-center gap-2">
           <Calculator className="w-6 h-6 text-amber-500" />
           Old Subscription Entry
        </h3>
        <div className="space-y-4">
           <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Select Member</label>
              <select 
                value={selectedMemberId} 
                onChange={e => setSelectedMemberId(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-100 dark:border-slate-800 focus:border-amber-500 outline-none"
              >
                  <option value="">Choose Member</option>
                  {members.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.memberId})</option>)}
              </select>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Month</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none">
                  {BANGLISH_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Year</label>
                <input 
                  type="number" 
                  value={year} 
                  onChange={e => setYear(Number(e.target.value))} 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none"
                />
              </div>
           </div>
           <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Subscription amount</label>
              <input 
                placeholder="Subscription amount" 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none"
              />
           </div>
           <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Penalty (if any)</label>
              <input 
                placeholder="Penalty" 
                type="number" 
                value={penalty} 
                onChange={e => setPenalty(e.target.value)} 
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none"
              />
           </div>
           <div className="flex gap-4 pt-2">
              <button onClick={onClose} className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold">Cancel</button>
              <button 
                onClick={handleSave} 
                disabled={isSubmitting} 
                className="flex-1 py-4 bg-amber-500 text-white rounded-xl font-bold shadow-lg shadow-amber-200 dark:shadow-none hover:bg-amber-600 disabled:bg-slate-300"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

function LoanMigrationModal({ onClose, borrowers, logTransaction }: any) {
  const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
  const [profitAmount, setProfitAmount] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!selectedBorrowerId || (!profitAmount && !principalAmount)) {
      alert('Please select borrower and enter amount');
      return;
    }

    // Check for duplicate profit/principal in the same month
    const existingProfit = await db.payments
      .where({
        borrowerId: selectedBorrowerId,
        month: Number(month),
        year: Number(year),
        type: 'profit'
      })
      .first();
    
    const existingPrincipal = await db.payments
      .where({
        borrowerId: selectedBorrowerId,
        month: Number(month),
        year: Number(year),
        type: 'principal'
      })
      .first();

    if ((profitAmount && existingProfit) || (principalAmount && existingPrincipal)) {
      alert('Profit or principal for this month is already paid.');
      return;
    }

    setIsSubmitting(true);
    try {
      const b = borrowers.find((br: any) => br.id === selectedBorrowerId);
      if (profitAmount) {
        await db.payments.add({
          borrowerId: selectedBorrowerId,
          amount: Number(profitAmount),
          type: 'profit',
          month: Number(month),
          year: Number(year),
          date: getTodayDate(),
          remainingBalance: b?.loanAmount || 0
        });
      }
      if (principalAmount) {
        const currentLoan = await db.borrowers.get(selectedBorrowerId);
        const newBalance = (currentLoan?.loanAmount || 0) - Number(principalAmount);
        
        await db.payments.add({
          borrowerId: selectedBorrowerId,
          amount: Number(principalAmount),
          type: 'principal',
          month: Number(month),
          year: Number(year),
          date: getTodayDate(),
          remainingBalance: newBalance
        });
        
        await db.borrowers.update(selectedBorrowerId, { 
          loanAmount: newBalance,
          paymentStatus: newBalance <= 0 ? 'paid' : 'partial'
        });
      }

      await logTransaction({
        amount: Number(profitAmount || 0) + Number(principalAmount || 0),
        type: 'Old Loan & Profit Migration',
        payerName: b?.name || 'Borrower',
        description: `Old installments/profit for ${BANGLISH_MONTHS[month]} ${year} has been entered.`,
        category: 'income'
      });
      
      alert('Saved successfully.');
      onClose();
    } catch (err) {
      alert('An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm border border-white/20 dark:border-slate-700 shadow-2xl">
        <h3 className="text-xl font-black mb-4 flex items-center gap-2">
           <TrendingUp className="w-6 h-6 text-indigo-500" />
           Old Loan & Profit Entry
        </h3>
        <div className="space-y-4">
           <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Select Borrower</label>
              <select 
                value={selectedBorrowerId} 
                onChange={e => setSelectedBorrowerId(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none"
              >
                  <option value="">Choose Borrower</option>
                  {borrowers.map((b: any) => <option key={b.id} value={b.id}>{b.name} (৳{b.loanAmount})</option>)}
              </select>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Month</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none">
                  {BANGLISH_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Year</label>
                <input 
                  type="number" 
                  value={year} 
                  onChange={e => setYear(Number(e.target.value))} 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none"
                />
              </div>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Principal Collection</label>
                <input 
                  placeholder="Principal" 
                  type="number" 
                  value={principalAmount} 
                  onChange={e => setPrincipalAmount(e.target.value)} 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Profit Collection</label>
                <input 
                  placeholder="Profit" 
                  type="number" 
                   value={profitAmount} 
                  onChange={e => setProfitAmount(e.target.value)} 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none"
                />
              </div>
           </div>
           <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">Use this for business loans. For installment loans, use installment collection directly.</p>
           <div className="flex gap-4 pt-2">
              <button onClick={onClose} className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold">Cancel</button>
              <button 
                onClick={handleSave} 
                disabled={isSubmitting} 
                className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 disabled:bg-slate-300"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

function CashPage({ onBack, goHome, totalCash }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const adjustments = useLiveQuery<ManualAdjustment[]>(() => db.adjustments.orderBy('date').reverse().toArray()) || [];

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="মোট ক্যাশ বিবরণ" onBack={onBack} goHome={goHome} />
      <AdSenseBanner />
      <div className="bg-primary-600 dark:bg-primary-700 p-8 rounded-3xl text-white text-center mb-6 shadow-lg shadow-primary-200 dark:shadow-none">
        <p className="opacity-80 mb-2">বর্তমান মোট ক্যাশ</p>
        <h2 className="text-5xl font-black">{formatCurrency(totalCash)}</h2>
      </div>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setShowAdd(true)}
          className="flex-1 p-4 rounded-2xl border font-bold flex items-center justify-center gap-2 transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <Plus className="w-5 h-5 text-primary-600 dark:text-primary-500" /> 
          ক্যাশ যোগ/বিয়োগ
        </button>
      </div>

      <h3 className="font-bold mb-4 text-slate-800 dark:text-slate-200">সাম্প্রতিক অ্যাডজাস্টমেন্ট</h3>
      <div className="space-y-3">
        {adjustments.map(a => (
          <div key={a.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">{a.notes}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{formatBengaliDate(a.date)}</p>
            </div>
            <p className={cn("font-bold", a.type === 'add' ? "text-primary-600 dark:text-primary-400" : "text-red-600 dark:text-red-400")}>
              {a.type === 'add' ? '+' : '-'}{formatCurrency(a.amount)}
            </p>
          </div>
        ))}
        {adjustments.length === 0 && (
          <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400">কোনো অ্যাডজাস্টমেন্ট নেই</p>
          </div>
        )}
      </div>

      {showAdd && <AddCashModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddCashModal({ onClose }: any) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'add' | 'subtract'>('add');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(getTodayDate());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const englishAmount = bengaliToEnglishNumber(amount);
      const finalAmount = Math.abs(Number(englishAmount));
      if (isNaN(finalAmount) || finalAmount <= 0) {
        alert("দয়া করে সঠিক টাকার পরিমাণ দিন।");
        return;
      }
      await db.adjustments.add({
        amount: finalAmount,
        type,
        notes,
        date: date
      });
      onClose();
    } catch (error) {
      console.error("Error adding adjustment:", error);
      alert("অ্যাডজাস্টমেন্ট যোগ করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-white/20 dark:border-slate-700">
        <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">ক্যাশ অ্যাডজাস্টমেন্ট</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button 
              type="button"
              onClick={() => setType('add')}
              className={cn("flex-1 py-3 rounded-lg font-bold transition-all", type === 'add' ? "bg-primary-500 text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300")}
            >
              যোগ (+)
            </button>
            <button 
              type="button"
              onClick={() => setType('subtract')}
              className={cn("flex-1 py-3 rounded-lg font-bold transition-all", type === 'subtract' ? "bg-red-500 text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300")}
            >
              বিয়োগ (-)
            </button>
          </div>
          <input 
            required
            type="text"
            inputMode="numeric"
            placeholder="টাকার পরিমাণ"
            value={amount}
            onChange={e => setAmount(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, ''))}
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
          />
          <input 
            required
            placeholder="বিবরণ"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 text-slate-900 dark:text-white"
          />
          <div className="flex gap-4 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              বাতিল
            </button>
            <button 
              type="submit" 
              className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-100 dark:shadow-none"
            >
              নিশ্চিত করুন
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NotificationsPage({ onBack, goHome, notifications, onDelete, onNotificationClick }: any) {
  return (
    <div className="p-4 max-w-lg mx-auto pb-32">
      <PageHeader title="নোটিফিকেশন" onBack={onBack} goHome={goHome} />
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
            <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">কোন নতুন নোটিফিকেশন নেই</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {notifications.map((n: any) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 100, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="relative active:z-10 group"
              >
                {/* Delete Background Action */}
                <div className="absolute inset-0 bg-red-500 dark:bg-red-600 rounded-2xl flex items-center justify-start pl-6 shadow-inner">
                   <Trash2 className="text-white w-6 h-6 " />
                </div>

                <motion.div 
                  drag="x"
                  dragConstraints={{ left: 0, right: 100 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 80) {
                      onDelete(n.id);
                    }
                  }}
                  onClick={() => onNotificationClick(n)}
                  className={cn(
                    "relative bg-white dark:bg-slate-800 p-5 rounded-2xl border-l-4 shadow-sm border-y border-r border-slate-100 dark:border-slate-700 transition-all cursor-pointer active:scale-[0.98] select-none",
                    n.urgency === 'extreme' ? "border-l-red-500" : n.urgency === 'high' ? "border-l-orange-500" : "border-l-blue-500"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-2xl",
                      n.type === 'message' ? "bg-indigo-50 text-indigo-500 dark:bg-indigo-950/20" :
                      n.urgency === 'extreme' ? "bg-red-50 text-red-500 dark:bg-red-950/20" : n.urgency === 'high' ? "bg-orange-50 text-orange-500 dark:bg-orange-950/20" : "bg-blue-50 text-blue-500 dark:bg-blue-950/20"
                    )}>
                      {n.type === 'message' ? <MessageSquare className="w-6 h-6" /> : n.urgency === 'extreme' ? <AlertTriangle className="w-6 h-6" /> : n.urgency === 'high' ? <Bell className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight line-clamp-2">{n.title}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-bold uppercase tracking-wide">
                          <Clock className="w-3 h-3" />
                          {n.type === 'message' ? 'নতুন মেসেজ' : n.urgency === 'extreme' ? 'তাৎক্ষণিক ব্যবস্থা নিন' : n.urgency === 'high' ? 'সতর্কতা: দ্রুত পরিশোধ' : 'আগামী কিস্তি'}
                        </p>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(n.id);
                      }}
                      className="p-2 -mr-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
      <p className="text-center text-[10px] text-slate-400 mt-8 font-medium">ডান দিকে সুইপ করে ডিলেট করুন</p>
    </div>
  );
}

function DynamicCashPage({ onBack, goHome, totalSubscriptions, totalProfit, totalDeposits, totalPenalties, totalFormFees, totalExpenses, totalAdjustments }: any) {
  const actualCash = totalSubscriptions + totalDeposits + totalProfit + totalPenalties + totalFormFees - totalExpenses + (totalAdjustments || 0);

  return (
    <div className="p-4 max-w-lg mx-auto pb-32">
      <PageHeader title="প্রকৃত ক্যাশ (অটোমেটিক)" onBack={onBack} goHome={goHome} />
      <div className="bg-blue-600 dark:bg-blue-700 p-8 rounded-3xl text-white text-center mb-6 shadow-xl shadow-blue-200 dark:shadow-none relative overflow-hidden">
        <div className="relative z-10">
          <p className="opacity-80 mb-2">মোট প্রকৃত ক্যাশ</p>
          <h2 className="text-5xl font-black">{formatCurrency(actualCash)}</h2>
          <p className="text-xs mt-3 opacity-80 bg-black/10 inline-block px-3 py-1 rounded-full">এই পেজে কোনো ম্যানুয়াল যোগ/বিয়োগ করা যাবে না</p>
        </div>
        <Wallet className="absolute right-[-20px] bottom-[-20px] w-40 h-40 opacity-10" />
      </div>

      <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 ml-2">আয় ও জমার বিবরণী</h3>
      <div className="space-y-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg"><Wallet className="w-5 h-5" /></div>
            <span className="font-bold text-slate-700 dark:text-slate-200">সদস্যদের সঞ্চয় জমা</span>
          </div>
          <span className="font-bold text-primary-600 dark:text-primary-400">+{formatCurrency(totalDeposits)}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg"><Users className="w-5 h-5" /></div>
            <span className="font-bold text-slate-700 dark:text-slate-200">মোট চাঁদা আদায়</span>
          </div>
          <span className="font-bold text-primary-600 dark:text-primary-400">+{formatCurrency(totalSubscriptions)}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
            <span className="font-bold text-slate-700 dark:text-slate-200">মোট লাভ ও চক্রবৃদ্ধি</span>
          </div>
          <span className="font-bold text-primary-600 dark:text-primary-400">+{formatCurrency(totalProfit)}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
            <span className="font-bold text-slate-700 dark:text-slate-200">চাঁদার জরিমানা আদায়</span>
          </div>
          <span className="font-bold text-primary-600 dark:text-primary-400">+{formatCurrency(totalPenalties)}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg"><FileText className="w-5 h-5" /></div>
            <span className="font-bold text-slate-700 dark:text-slate-200">ফরমের মোট টাকা</span>
          </div>
          <span className="font-bold text-primary-600 dark:text-primary-400">+{formatCurrency(totalFormFees)}</span>
        </div>
      </div>
    </div>
  );
}

function DividendPage({ onBack, goHome, members, deposits, totalActualCash, totalExpenses }: any) {
  // Calculate total deposits across all members
  const totalDeposits = deposits.reduce((sum: number, d: any) => sum + d.amount, 0);
  
  // Distributable profit is total Actual Cash minus Total Deposits (which gives the profit part)
  const distributableProfit = totalActualCash - totalDeposits;
  
  const memberCount = members.length;

  return (
    <div className="p-4 max-w-lg mx-auto pb-32">
      <PageHeader title="শেয়ার ও লভ্যাংশ বন্টন" onBack={onBack} goHome={goHome} />
      
      <div className="bg-purple-600 dark:bg-purple-700 p-8 rounded-3xl text-white text-center mb-6 shadow-xl shadow-purple-200 dark:shadow-none relative overflow-hidden">
        <div className="relative z-10">
          <p className="opacity-80 mb-2">বন্টনযোগ্য মোট লভ্যাংশ</p>
          <h2 className="text-4xl font-black">{formatCurrency(distributableProfit)}</h2>
          <p className="text-xs mt-3 opacity-80 bg-black/10 inline-block px-3 py-1 rounded-full">
            (মোট আয় - মোট খরচ)
          </p>
        </div>
        <PieChart className="absolute right-[-20px] bottom-[-20px] w-40 h-40 opacity-10" />
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 mb-6 shadow-sm flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">মোট সদস্য</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{memberCount} জন</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500 dark:text-slate-400">সর্বমোট সঞ্চয় জমা</p>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{formatCurrency(totalDeposits)}</p>
        </div>
      </div>

      <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 ml-2">সদস্যদের প্রো-রাটা শেয়ার বিবরণী</h3>
      <div className="space-y-3">
        {members.map((member: any) => {
          const memberDeposits = deposits
            .filter((d: any) => d.memberId === member.id)
            .reduce((sum: number, d: any) => sum + d.amount, 0);
            
          // Proportional share based on the member's initial deposit vs total deposits
          const depositRatio = totalDeposits > 0 ? (memberDeposits / totalDeposits) : 0;
          const proportionalShare = distributableProfit * depositRatio;
          const totalMemberShare = memberDeposits + proportionalShare;

          return (
            <div key={member.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                {member.photo ? (
                  <img src={member.photo} alt={member.name} className="w-10 h-10 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700" />
                ) : (
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{member.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">সদস্য নং: {member.memberId}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl mb-2">
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">সঞ্চয় জমা ({(depositRatio * 100).toFixed(1)}%)</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(memberDeposits)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">লভ্যাংশ অংশ</p>
                  <p className="text-sm font-bold text-primary-600 dark:text-primary-400">{proportionalShare >= 0 ? '+' : ''}{formatCurrency(proportionalShare)}</p>
                </div>
              </div>
              
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">মোট প্রাপ্য:</span>
                <span className="font-black text-purple-600 dark:text-purple-400">{formatCurrency(totalMemberShare)}</span>
              </div>
            </div>
          );
        })}
        
        {members.length === 0 && (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
            কোনো সদস্য পাওয়া যায়নি
          </div>
        )}
      </div>
    </div>
  );
}

function IncomeExpensePage({ onBack, goHome, totalIncome, totalExpense }: any) {
  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="আয় ব্যয়ের হিসাব" onBack={onBack} goHome={goHome} />
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">মোট আয়</p>
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-2xl">
            <TrendingUp className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">মোট ব্যয়</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalExpense)}</p>
          </div>
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl">
            <PieChart className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function LoanCalculatorPage({ onBack, goHome }: any) {
  const [amount, setAmount] = useState('');
  const [profitRate, setProfitRate] = useState('5');
  const [compoundRate, setCompoundRate] = useState('10');
  const [months, setMonths] = useState('1');
  const [type, setType] = useState<'regular' | 'installment'>('regular');
  const [results, setResults] = useState<any>(null);

  const calculate = () => {
    const p = Number(bengaliToEnglishNumber(amount));
    const pr = Number(profitRate) / 100;
    const cr = Number(compoundRate) / 100;
    const m = Number(months);

    if (isNaN(p) || p <= 0) {
      alert('সঠিক ঋণের পরিমাণ দিন');
      return;
    }

    if (type === 'installment') {
      const fixedMonthlyPrincipal = p / m;
      const monthlyProfit = p * pr;
      const totalMonthly = fixedMonthlyPrincipal + monthlyProfit;
      const totalProfit = monthlyProfit * m;

      setResults({
        monthlyPrincipal: fixedMonthlyPrincipal,
        monthlyProfit,
        totalMonthly,
        totalProfit,
        totalPayable: p + totalProfit,
        type: 'কিস্তি ঋণ (ফিক্সড)'
      });
    } else {
      const monthlyProfit = p * pr;
      setResults({
        monthlyProfit,
        penaltyProfit: p * cr,
        totalPayable: p + monthlyProfit,
        type: 'সাধারণ ঋণ'
      });
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-32">
      <PageHeader title="লোন ক্যালকুলেটর" onBack={onBack} goHome={goHome} />
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-700 shadow-xl mb-6">
        <div className="space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl mb-2">
            <button 
              onClick={() => setType('regular')}
              className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", type === 'regular' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-md" : "text-slate-400")}
            >সাধারণ ঋণ</button>
            <button 
              onClick={() => setType('installment')}
              className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", type === 'installment' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-md" : "text-slate-400")}
            >কিস্তি ঋণ</button>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">ঋণের পরিমাণ (৳)</label>
            <input 
              type="text" inputMode="numeric"
              value={amount}
              onChange={e => setAmount(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, ''))}
              placeholder="৫০০০"
              className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">লাভের হার (%)</label>
              <input 
                type="text" inputMode="numeric"
                value={profitRate}
                onChange={e => setProfitRate(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, ''))}
                className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">চক্রবৃদ্ধি (%)</label>
              <input 
                type="text" inputMode="numeric"
                value={compoundRate}
                onChange={e => setCompoundRate(bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, ''))}
                className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
              />
            </div>
          </div>

          {type === 'installment' && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">মেয়াদ (মাস)</label>
              <select 
                value={months}
                onChange={e => setMonths(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
              >
                {[1,2,3,4,5,6,12,24].map(m => <option key={m} value={m}>{m} মাস</option>)}
              </select>
            </div>
          )}

          <button 
            onClick={calculate}
            className="w-full py-5 bg-blue-600 text-white rounded-[1.8rem] font-black shadow-xl hover:bg-blue-700 active:scale-95 transition-all text-lg flex items-center justify-center gap-3"
          >
            <Calculator className="w-6 h-6" />
            হিসাব করুন
          </button>
        </div>
      </div>

      {results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-gradient-to-br from-teal-500 to-teal-700 p-6 rounded-[2.5rem] text-white shadow-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">{results.type} ফলাফল</p>
            <div className="space-y-4">
              {type === 'installment' ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs opacity-80">মাসিক কিস্তি (মাথা পিছু)</span>
                    <span className="text-2xl font-black">{formatCurrency(results.totalMonthly)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                    <div>
                      <p className="text-[8px] opacity-60 uppercase font-black">আসল অংশ</p>
                      <p className="text-sm font-bold">{formatCurrency(results.monthlyPrincipal)}</p>
                    </div>
                    <div>
                      <p className="text-[8px] opacity-60 uppercase font-black">মুনাফা অংশ</p>
                      <p className="text-sm font-bold">{formatCurrency(results.monthlyProfit)}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/20">
                    <div className="flex justify-between">
                      <span className="text-[10px] font-bold">মোট মুনাফা ({months} মাস)</span>
                      <span className="text-sm font-black">+{formatCurrency(results.totalProfit)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs opacity-80">মাসিক মুনাফা (৫%)</span>
                    <span className="text-2xl font-black">{formatCurrency(results.monthlyProfit)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-white/20">
                    <span className="text-xs opacity-80 italic">চক্রবৃদ্ধি মুনাফা (১০%)</span>
                    <span className="text-xl font-bold text-rose-200">{formatCurrency(results.penaltyProfit)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function PerformancePage({ onBack, goHome, members, subscriptions, deposits, borrowers, payments }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const memberStats = members.map((m: any) => {
    const memberSubs = subscriptions.filter((s: any) => s.memberId === m.id);
    const memberPayments = payments.filter((p: any) => p.payerName === m.name); // Simple match
    const unpaidMonths = 0; // Logic for unpaid months should ideally be here
    
    return {
      ...m,
      totalSaved: memberSubs.reduce((sum: number, s: any) => sum + s.amount, 0),
      totalDeposits: deposits.filter((d: any) => d.memberId === m.id).reduce((sum: number, d: any) => sum + d.amount, 0),
      isRegular: memberSubs.length > 5, // Simple regularity check
    };
  });

  const filteredMembers = memberStats.filter((m: any) => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.memberId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 max-w-lg mx-auto pb-32">
      <PageHeader title="সদস্য পারফরম্যান্স" onBack={onBack} goHome={goHome} />
      
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text"
          placeholder="Search member..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500 outline-none shadow-sm"
        />
      </div>

      <div className="space-y-4">
        {filteredMembers.map((m: any) => (
          <div key={m.id} className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
             <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center text-blue-600 font-black text-lg shrink-0">
               {m.name.charAt(0)}
             </div>
             <div className="flex-1">
               <h4 className="font-black text-slate-800 dark:text-white leading-tight">{m.name}</h4>
               <p className="text-[10px] font-bold text-slate-400 mt-0.5">ID: {m.memberId}</p>
               <div className="flex gap-4 mt-2">
                 <div>
                   <p className="text-[8px] font-black text-slate-400 uppercase">মোট সঞ্চয়</p>
                   <p className="text-xs font-black text-blue-600">{formatCurrency(m.totalSaved)}</p>
                 </div>
                 <div>
                   <p className="text-[8px] font-black text-slate-400 uppercase">প্রারম্ভিক</p>
                   <p className="text-xs font-black text-emerald-600">{formatCurrency(m.totalDeposits)}</p>
                 </div>
               </div>
             </div>
             <div className={cn("px-3 py-1 rounded-full text-[8px] font-black uppercase", m.isRegular ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600")}>
               {m.isRegular ? 'প্রতিশ্রুত' : 'অনিয়মিত'}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionsPage({ onBack, goHome, transactionLogs }: any) {
  // Group logs by date
  const groupedLogs = (transactionLogs || []).reduce((groups: any, log: any) => {
    const date = new Date(log.date).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!groups[date]) groups[date] = [];
    groups[date].push(log);
    return groups;
  }, {});

  const dates = Object.keys(groupedLogs).sort((a, b) => {
     const dateA = groupedLogs[a]?.[0] ? new Date(groupedLogs[a][0].date).getTime() : 0;
     const dateB = groupedLogs[b]?.[0] ? new Date(groupedLogs[b][0].date).getTime() : 0;
     return dateB - dateA;
  });

  return (
    <div className="p-4 max-w-lg mx-auto pb-28">
      <PageHeader title="লেনদেন ইতিহাস" onBack={onBack} goHome={goHome} />
      
      <div className="space-y-6">
        {dates.map((date: string) => {
          const logs = groupedLogs[date];
          return (
          <div key={date}>
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-2 flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              {date}
            </h3>
            <div className="space-y-2">
              {logs.map((log: any, index: number) => (
                <div key={log.id || index} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center transition-all">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[8px] font-black uppercase",
                        log.category === 'income' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : 
                        log.category === 'expense' ? "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" :
                        "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      )}>
                        {log.type}
                      </span>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">{log.payerName}</h4>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{log.description}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-sm font-black",
                      log.category === 'income' ? "text-emerald-600 dark:text-emerald-400" : 
                      log.category === 'expense' ? "text-rose-600 dark:text-rose-400" :
                      "text-blue-600 dark:text-blue-400"
                    )}>
                      {log.category === 'income' ? '+' : log.category === 'expense' ? '-' : ''}{log.category !== 'info' ? formatCurrency(log.amount) : 'সেটিংস'}
                    </p>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 flex items-center justify-end gap-1 font-medium">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(log.date).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );})}

        {(transactionLogs || []).length === 0 && (
          <div className="text-center py-20 bg-slate-50/50 dark:bg-slate-800/30 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-700">
             <History className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
             <p className="text-slate-400 dark:text-slate-500 font-medium">এখনো কোনো লেনদেন রেকর্ড করা হয়নি</p>
          </div>
        )}
      </div>
      
      <div className="mt-8 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900/30">
        <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold flex items-center gap-2 uppercase tracking-wider">
           <AlertCircle className="w-3 h-3" />
           নিরাপত্তা নির্দেশনা
        </p>
        <p className="text-[9px] text-orange-500/80 dark:text-orange-400/80 mt-1 leading-relaxed">
           এই তালিকাটি অ্যাপের সকল আর্থিক লেনদেনের একটি অপরিবর্তনীয় রেকর্ড। কোনো লেনদেন ডিলিট বা এডিট করা সম্ভব নয় যাতে হিসাবের শতভাগ স্বচ্ছতা বজায় থাকে।
        </p>
      </div>
    </div>
  );
}

function InstallmentPage({ onBack, goHome, isTransactionAllowed, logTransaction, handleImageUpload, totalCash }: any) {
  const members = useLiveQuery<Member[]>(() => db.members.toArray()) || [];
  const borrowers = useLiveQuery<Borrower[]>(() => db.borrowers.toArray()) || [];
  const [activeTab, setActiveTab] = useState<'form' | 'list'>('list');
  
  // Filter for installment loans - encoded in notes for now
  const installmentLoans = borrowers.filter(b => b.notes?.includes('FIXED_INSTALLMENT'));
  
  return (
    <div className="p-4 max-w-lg mx-auto pb-32">
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md py-4 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-900 dark:text-white" />
          </button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">কিস্তি ব্যবস্থাপনা</h1>
        </div>
        <button 
          onClick={() => setActiveTab(activeTab === 'list' ? 'form' : 'list')} 
          className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          {activeTab === 'list' ? (
            <>
              <Plus className="w-5 h-5" />
              <span className="text-xs font-bold">নতুন কিস্তি</span>
            </>
          ) : (
            <>
              <Clock className="w-5 h-5" />
              <span className="text-xs font-bold">তালিকা দেখুন</span>
            </>
          )}
        </button>
      </div>

      {/* Total Cash Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-4 mb-6 shadow-lg shadow-blue-500/20 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-blue-100">সমিতির মোট ফান্ড</p>
            <p className="text-xl font-black">{formatCurrency(totalCash || 0)}</p>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'form' ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <InstallmentForm members={members} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} handleImageUpload={handleImageUpload} onSuccess={() => setActiveTab('list')} totalCash={totalCash} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <InstallmentList loans={installmentLoans} logTransaction={logTransaction} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InstallmentForm({ members, isTransactionAllowed, logTransaction, handleImageUpload, onSuccess, totalCash }: any) {
  const [personType, setPersonType] = useState<'member' | 'other'>('member');
  const borrowers = useLiveQuery(() => db.borrowers.toArray()) || [];
  const installmentLoans = borrowers.filter(b => b.notes?.includes('FIXED_INSTALLMENT'));

  const [formData, setFormData] = useState({
    memberId: '',
    name: '',
    fatherName: '',
    phone: '',
    address: '',
    guarantor: '',
    guarantorType: 'member', // 'member' or 'other'
    amount: '',
    months: '1',
    photo: ''
  });

  const amount = Number(formData.amount) || 0;
  const remainingCash = (totalCash || 0) - amount;
  const months = Number(formData.months) || 1;
  const monthlyInterest = amount * 0.05;
  const monthlyPrincipal = amount / months;
  const totalMonthly = monthlyPrincipal + monthlyInterest;

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (amount <= 0) {
      alert('সঠিক টাকার পরিমাণ দিন');
      return;
    }

    if (remainingCash < 0) {
      alert('দুঃখিত, ফান্ডে পর্যাপ্ত টাকা নেই! ঋণের পরিমাণ কমান।');
      return;
    }

    const selectedMember = personType === 'member' ? members.find((m: any) => m.id === formData.memberId) : null;

    if (personType === 'member' && !selectedMember) {
      alert('অনুগ্রহ করে সদস্য নির্বাচন করুন');
      return;
    }

    // Check for duplicate active loan
    const existingLoan = (installmentLoans || []).find(loan => 
      (personType === 'member' && loan.memberId === formData.memberId) ||
      (personType === 'other' && loan.phone === formData.phone)
    );

    if (existingLoan) {
      alert(`এই ${personType === 'member' ? 'সদস্যের' : 'ব্যক্তির'} নামে ইতিমধ্যে একটি সক্রিয় কিস্তি ঋণ রয়েছে। নতুন কিস্তি যোগ করা সম্ভব নয়।`);
      return;
    }

    setShowConfirmModal(true);
  };

  const processApproval = async () => {
    if (isSubmitting) return;

    const selectedMember = personType === 'member' ? members.find((m: any) => m.id === formData.memberId) : null;
    
    let borrowerData: any = {
      name: personType === 'member' ? selectedMember?.name : formData.name,
      fatherName: personType === 'member' ? (selectedMember?.fatherName || 'সদস্য') : formData.fatherName,
      phone: personType === 'member' ? (selectedMember?.phone || '') : formData.phone,
      address: personType === 'member' ? (selectedMember?.address || 'সমিতি এলাকা') : formData.address,
      guarantor: personType === 'member' ? 'সদস্য নিজেই' : `${formData.guarantor} (${formData.guarantorType === 'member' ? 'সমিতির সদস্য' : 'বাইরের ব্যক্তি'})`,
      loanAmount: Number(amount),
      loanDate: getTodayDate(),
      paymentStatus: 'pending',
      notes: `FIXED_INSTALLMENT | Months: ${months} | Monthly: ${totalMonthly.toFixed(2)}`,
      memberId: personType === 'member' ? formData.memberId : undefined,
      uid: personType === 'member' ? (selectedMember?.memberId || `M-${Date.now().toString().slice(-4)}`) : `G-${Date.now().toString().slice(-4)}`,
      photo: personType === 'member' ? (selectedMember?.photo || '') : formData.photo
    };

    if (!borrowerData.name || !borrowerData.phone) {
      alert('সদস্যের নাম বা মোবাইল নম্বর পাওয়া যাচ্ছে না। প্রোফাইল চেক করুন।');
      setShowConfirmModal(false);
      return;
    }
    
    if (personType === 'other' && (!borrowerData.fatherName || !borrowerData.address || !borrowerData.guarantor)) {
      alert('অন্য ব্যক্তির ক্ষেত্রে সকল তথ্য দেয়া বাধ্যতামূলক।');
      setShowConfirmModal(false);
      return;
    }

    if (personType === 'other' && !borrowerData.photo) {
      alert('অন্য ব্যক্তির কিস্তির ক্ষেত্রে ছবি আপলোড করা বাধ্যতামূলক।');
      setShowConfirmModal(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await db.borrowers.add(borrowerData);
      await logTransaction({
        amount: Number(amount),
        type: 'কিস্তি প্রদান (খরচ)',
        payerName: borrowerData.name,
        description: `${months} মাসের জন্য ৫% লাভে কিস্তি ঋণ প্রদান।`,
        category: 'expense'
      });

      alert('নতুন কিস্তি ঋণ সফলভাবে অনুমোদন করা হয়েছে।');
      onSuccess();
    } catch (error) {
      console.error('Submission error:', error);
      alert('রকরর্ড সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-700 shadow-xl relative">
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2 italic">কিস্তি মঞ্জুর করুন</h3>
              <p className="text-slate-500 text-sm mb-6 font-bold">
                আপনি কি নিশ্চিত যে {personType === 'member' ? (members.find((m: any) => m.id === formData.memberId)?.name) : formData.name} কে {formatCurrency(amount)} টাকা {months} মাসের জন্য কিস্তি প্রদান করছেন?
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="py-4 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-2xl font-black text-sm"
                >বাতিল</button>
                <button 
                  onClick={processApproval}
                  disabled={isSubmitting}
                  className="py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> প্রসেসিং...</> : 'হ্যাঁ, নিশ্চিত'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl">
        <div className="bg-blue-600 p-2 rounded-xl text-white">
          <Banknote className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 italic">নতুন কিস্তি ঋণ ফরম</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">সকল তথ্য দেয়া বাধ্যতামূলক</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo Upload Section - Hidden for Members */}
        {personType === 'other' && (
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl bg-slate-100 dark:bg-slate-900 border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden flex items-center justify-center">
                {formData.photo ? (
                  <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 p-3 bg-blue-600 text-white rounded-2xl shadow-lg cursor-pointer hover:bg-blue-700 active:scale-90 transition-all border-4 border-white dark:border-slate-800">
                <Plus className="w-5 h-5" />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => handleImageUpload(e, (base64) => setFormData({...formData, photo: base64}))} 
                  className="hidden" 
                />
              </label>
            </div>
            <p className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-widest text-center">কিস্তি গ্রহণকারীর ছবি (বাধ্যতামূলক)</p>
          </div>
        )}

        <div className="flex gap-4 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl mb-2">
          <button 
            disabled={isSubmitting}
            type="button"
            onClick={() => setPersonType('member')}
            className={cn(
              "flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", 
              personType === 'member' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-md" : "text-slate-400"
            )}
          >
            <User className="w-4 h-4" />
            সমিতির সদস্য
          </button>
          <button 
            disabled={isSubmitting}
            type="button"
            onClick={() => setPersonType('other')}
            className={cn(
              "flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", 
              personType === 'other' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-md" : "text-slate-400"
            )}
          >
            <Users className="w-4 h-4" />
            অন্য ব্যক্তি
          </button>
        </div>

        {personType === 'member' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5 ml-1 uppercase tracking-tight">সদস্য নির্বাচন করুন</label>
              <select 
                required
                disabled={isSubmitting}
                value={formData.memberId}
                onChange={e => setFormData({...formData, memberId: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all"
              >
                <option value="">সদস্য সিলেক্ট করুন</option>
                {members.map((m: any) => {
                  const hasLoan = (installmentLoans || []).some(l => l.memberId === m.id);
                  return (
                    <option key={m.id} value={m.id} disabled={hasLoan}>
                      {m.name} ({m.memberId}) {hasLoan ? '— কিস্তি চলছে' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <input 
                required
                disabled={isSubmitting}
                placeholder="নতুন সদস্যর নাম"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all"
              />
              <input 
                required
                disabled={isSubmitting}
                placeholder="পিতার নাম"
                value={formData.fatherName}
                onChange={e => setFormData({...formData, fatherName: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all"
              />
              <input 
                required
                disabled={isSubmitting}
                type="tel"
                placeholder="মোবাইল নম্বর"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: bengaliToEnglishNumber(e.target.value).replace(/[^0-9]/g, '')})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all"
              />
              <input 
                required
                disabled={isSubmitting}
                placeholder="পূর্ণ ঠিকানা"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all"
              />
              
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-500 ml-1 uppercase tracking-tight">জামিনদারের ধরন</label>
                <div className="flex gap-4 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                  <button 
                    disabled={isSubmitting}
                    type="button"
                    onClick={() => setFormData({...formData, guarantorType: 'member', guarantor: ''})}
                    className={cn("flex-1 py-2 text-[10px] font-bold rounded-lg transition-all", formData.guarantorType === 'member' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-400")}
                  >সমিতির সদস্য</button>
                  <button 
                    disabled={isSubmitting}
                    type="button"
                    onClick={() => setFormData({...formData, guarantorType: 'other', guarantor: ''})}
                    className={cn("flex-1 py-2 text-[10px] font-bold rounded-lg transition-all", formData.guarantorType === 'other' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-400")}
                  >অন্য কেউ</button>
                </div>
                
                {formData.guarantorType === 'member' ? (
                  <select 
                    required
                    disabled={isSubmitting}
                    value={formData.guarantor}
                    onChange={e => setFormData({...formData, guarantor: e.target.value})}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all"
                  >
                    <option value="">জামিনদার সদস্য নির্বাচন করুন</option>
                    {members.filter((m: any) => m.id !== formData.memberId).map((m: any) => (
                      <option key={m.id} value={m.name}>{m.name} ({m.memberId})</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    required
                    disabled={isSubmitting}
                    placeholder="জামিনদারের নাম ও মোবাইল"
                    value={formData.guarantor}
                    onChange={e => setFormData({...formData, guarantor: e.target.value})}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none transition-all"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="relative">
              <label className="block text-xs font-black text-slate-500 mb-1.5 ml-1 uppercase tracking-tight">কিস্তির পরিমাণ (টাকায়)</label>
              <input 
                required
                disabled={isSubmitting}
                type="text" inputMode="numeric"
                placeholder="৫০০০, ১০০০০..."
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: bengaliToEnglishNumber(e.target.value).replace(/[^0-9.]/g, '')})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
              />
              <span className="absolute right-4 bottom-4 text-slate-400 font-bold">৳</span>
            </div>
            <p className={cn("text-[9px] mt-1.5 font-bold flex items-center justify-between mx-1", remainingCash < 0 ? "text-red-500" : "text-emerald-500")}>
              <span>বর্তমান ফান্ড: {formatCurrency(totalCash || 0)}</span>
              <span>অবশিষ্ট: {formatCurrency(remainingCash)}</span>
            </p>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1.5 ml-1 uppercase tracking-tight">কিস্তির মেয়াদ (মাস)</label>
            <select 
              required
              disabled={isSubmitting}
              value={formData.months}
              onChange={e => setFormData({...formData, months: e.target.value})}
              className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>{formatBengaliNumber(m)} মাস</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-[2rem] shadow-inner border border-blue-200 dark:border-blue-800">
          <div className="flex justify-between items-center mb-3">
             <span className="text-xs font-bold text-blue-600/70 uppercase">প্রথম মাসিক মুনাফা (৫%)</span>
             <span className="text-lg font-black text-blue-700">{formatCurrency(monthlyInterest)}</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-blue-200/50 dark:border-blue-800/50">
             <span className="text-sm font-black text-slate-700 dark:text-slate-300">প্রথম মাসের কিস্তি</span>
             <span className="text-xl font-black text-blue-600 bg-white dark:bg-slate-800 px-4 py-1 rounded-full shadow-sm">
                {formatCurrency(totalMonthly)}
             </span>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className={cn(
            "w-full py-5 text-white rounded-[1.8rem] font-black shadow-xl transition-all text-lg flex items-center justify-center gap-3",
            isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 shadow-blue-200 dark:shadow-none hover:bg-blue-700 active:scale-[0.98]"
          )}
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              প্রসেসিং...
            </>
          ) : (
            'কিস্তি অনুমোদন করুন'
          )}
        </button>
      </form>
    </motion.div>
  );
}

function InstallmentList({ loans, logTransaction }: any) {
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [deleteConfirmLoan, setDeleteConfirmLoan] = useState<any>(null);
  const allPayments = useLiveQuery(() => db.payments.toArray()) || [];

  const handleDownloadAndClear = async () => {
    if (!deleteConfirmLoan) return;
    const loan = deleteConfirmLoan;
    
    // Generate PDF
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Rin Porishodh Hisab Biboroni", 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Rin-grohitar Name: ${transliterateBengali(loan.name)}`, 14, 32);
    doc.text(`Phone: ${loan.phone}`, 14, 38);
    doc.text(`Loan Amount: ${loan.loanAmount} Taka`, 14, 44);
    doc.text(`Disbursement Date: ${loan.loanDate}`, 14, 50);
    
    const bPayments = allPayments.filter(p => p.borrowerId === loan.id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const tableData = bPayments.map((p, idx) => [
      idx + 1,
      new Date(p.date).toLocaleDateString(),
      p.type === 'principal' ? 'Asol Taka' : (p.type === 'profit' ? 'Labh/Kisti' : p.type),
      `${p.amount} Taka`,
      p.remainingBalance !== undefined ? `${p.remainingBalance} Taka` : '-'
    ]);
    
    autoTable(doc, {
      startY: 60,
      head: [['#', 'Tarikh', 'Dhoron', 'Takar Poriman', 'Avoshisto Asol']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });
    
    doc.setFontSize(10);
    doc.setTextColor(0, 150, 0);
    doc.text("Rin-grohitar record chirothayi bhabe bondho kora hoyeche.", 14, (doc as any).lastAutoTable.finalY + 15);
    
    doc.save(`Hisab_Biboroni_${transliterateBengali(loan.name).replace(/\s+/g, '_')}_${loan.phone}.pdf`);

    // Delete borrower
    try {
       await db.transaction('rw', [db.borrowers, db.payments], async () => {
         await db.payments.where('borrowerId').equals(loan.id).delete();
         await db.borrowers.delete(loan.id);
       });
       setDeleteConfirmLoan(null);
       alert('সদস্য ইতিহাস ডিলিট এবং পিডিএফ ডাউনলোড সম্পন্ন হয়েছে।');
    } catch(err) {
       console.error(err);
       alert('সদস্য মুছে ফেলতে সমস্যা হয়েছে।');
    }
  };
  
  return (
    <div className="space-y-4">
      {loans.map((loan: any) => {
        const loanStatus = calculateLoan(loan.loanAmount, loan.loanDate || '', allPayments.filter(p => p.borrowerId === loan.id), undefined, undefined, undefined, loan.notes);
        const monthlyAmount = loanStatus.monthlyProfit;
        
        // Check if paid this month
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const hasPaidThisMonth = allPayments.some(p => 
          p.borrowerId === loan.id && 
          new Date(p.date).getMonth() === currentMonth && 
          new Date(p.date).getFullYear() === currentYear
        );

        const isLoanCleared = loanStatus.remainingPrincipal <= 0;
        
        return (
          <motion.div 
            key={loan.id} 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "bg-white dark:bg-slate-800 p-5 rounded-[2.5rem] border-2 border-slate-50 dark:border-slate-700 shadow-sm transition-all hover:border-blue-100 dark:hover:border-blue-900 relative overflow-hidden group",
              isLoanCleared && "opacity-60 grayscale-[0.5]"
            )}
          >
            {isLoanCleared && (
              <div className="absolute inset-0 bg-emerald-500/5 backdrop-blur-[1px] flex items-center justify-center z-10">
                <div className="bg-emerald-600 text-white px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg -rotate-12">পরিশোধিত</div>
              </div>
            )}
            
            <div className="absolute top-0 right-0 p-3 flex gap-2 z-20">
               <button 
                onClick={() => setDeleteConfirmLoan(loan)}
                className="w-10 h-10 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors cursor-pointer"
               >
                 <Trash2 className="w-4 h-4 pointer-events-none" />
               </button>
               {!isLoanCleared && (
                 <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/20 rounded-full flex items-center justify-center text-blue-600 opacity-20 group-hover:opacity-100 transition-opacity">
                    <Banknote className="w-4 h-4" />
                 </div>
               )}
            </div>

            <div className="flex gap-4 items-start mb-4">
               {loan.photo ? (
                 <img src={loan.photo} alt={loan.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-white dark:border-slate-700 shadow-md" />
               ) : (
                 <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-100 dark:shadow-none shrink-0 capitalize">
                    {loan.name.charAt(0)}
                 </div>
               )}
               <div className="flex-1">
                  <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">{loan.name}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {loan.phone}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">কিস্তি ঋণ: {formatCurrency(loan.loanAmount)}</p>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
               <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight mb-1">বকেয়া আসল (Principal)</p>
                  <p className="text-base font-black text-blue-600 leading-none">{formatCurrency(loanStatus.remainingPrincipal)}</p>
               </div>
               <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className={cn("text-[8px] font-black uppercase tracking-tight mb-1", loanStatus.profitType === 'penalty' ? "text-rose-500" : "text-slate-400")}>
                    {loanStatus.profitType === 'penalty' ? 'চক্রবৃদ্ধি লাভ (১০%)' : 'মাসিক লাভ (৫%)'}
                  </p>
                  <p className={cn("text-base font-black leading-none", loanStatus.profitType === 'penalty' ? "text-rose-600" : "text-emerald-600")}>
                    {formatCurrency(loanStatus.monthlyProfit)}
                  </p>
               </div>
            </div>

            <div className="flex items-center justify-between gap-3">
               <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">শুরু: {formatBengaliDate(loan.loanDate)}</span>
               </div>
               
               {!isLoanCleared && !hasPaidThisMonth && !loanStatus.isLoanMonth && (
                 <button 
                  onClick={() => setSelectedLoan(loan)}
                  className="flex-1 max-w-[140px] py-3 bg-blue-600 text-white rounded-2xl text-xs font-black hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2"
                 >
                  <PlusCircle className="w-4 h-4" />
                  টাকা আদায়
                 </button>
               )}

               {loanStatus.isLoanMonth && !isLoanCleared && (
                 <div className="px-3 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                   <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">আগামী মাস থেকে কিস্তি</span>
                 </div>
               )}

               {hasPaidThisMonth && !isLoanCleared && (
                 <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl flex items-center gap-2">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">চলতি মাসের টাকা জমা</span>
                 </div>
               )}
            </div>
          </motion.div>
        );
      })}
      {loans.length === 0 && (
        <div className="text-center py-20 bg-slate-50/50 dark:bg-slate-800/30 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-700">
           <Banknote className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
           <p className="text-slate-400 dark:text-slate-500 font-medium">কোন কিস্তি রেকর্ড পাওয়া যায়নি</p>
        </div>
      )}

      {selectedLoan && (
        <InstallmentPaymentModal 
          loan={selectedLoan} 
          onClose={() => setSelectedLoan(null)}
          logTransaction={logTransaction}
        />
      )}

      {deleteConfirmLoan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
          >
            <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-center text-slate-800 dark:text-white mb-2">সদস্য ডিলিট করুন</h3>
            <p className="text-center text-slate-500 text-sm mb-6">
              আপনি কি <strong>{deleteConfirmLoan.name}</strong> এর সম্পূর্ণ কিস্তি ইতিহাস মুছে ফেলতে চান? এটি মুছে ফেলার আগে একটি কমপ্লিট পিডিএফ (PDF) রিপোর্ট ডাউনলোড হবে।
            </p>
            <div className="space-y-3">
              <button 
                onClick={handleDownloadAndClear}
                className="w-full py-4 bg-rose-600 text-white rounded-xl font-black shadow-lg shadow-rose-200 dark:shadow-none hover:bg-rose-700 transition flex justify-center items-center gap-2"
              >
                ডাউনলোড ও ডিলিট
              </button>
              <button 
                onClick={() => setDeleteConfirmLoan(null)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-black hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                বাতিল করুন
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function InstallmentPaymentModal({ loan, onClose, logTransaction }: any) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'bKash' | 'Nagad' | 'Rocket'>('Cash');
  const [payType, setPayType] = useState<'installment' | 'full'>('installment');
  const [showConfirm, setShowConfirm] = useState(false);
  
  const allPayments = useLiveQuery(() => db.payments.toArray()) || [];
  const borrowerPayments = allPayments.filter(p => p.borrowerId === loan.id);
  const loanStatus = calculateLoan(loan.loanAmount, loan.loanDate || '', borrowerPayments, undefined, undefined, undefined, loan.notes);

  const isMonthPaid = (m: number, y: number) => {
    return borrowerPayments.some(p => p.type === 'profit' && p.month === m && p.year === y);
  };

  const isPaidThisMonth = isMonthPaid(selectedMonth, selectedYear);

  useEffect(() => {
    if (payType === 'installment') {
      setAmount(Math.round(loanStatus.dueInstallment).toString());
    } else {
      setAmount((loanStatus.remainingBalance).toString());
    }
  }, [payType, loanStatus.dueInstallment, loanStatus.remainingBalance]);

  const handlePay = async () => {
    const payAmount = Number(amount);
    if (payAmount <= 0) return;
    if (isPaidThisMonth && payType === 'installment') {
      alert('এই মাসের জন্য ইতিমধ্যে কিস্তি পরিশোধ করা হয়েছে।');
      return;
    }

    try {
      await db.transaction('rw', [db.payments, db.transactionLogs, db.mfsTransactions, db.borrowers], async () => {
        // Principal reduction logic: payment - monthly profit
        const actualProfit = Math.min(payAmount, loanStatus.monthlyProfit);
        const principalReduction = Math.max(0, payAmount - actualProfit);
        
        if (actualProfit > 0) {
          await db.payments.add({
            borrowerId: loan.id,
            amount: actualProfit,
            date: getLocalISOString(),
            remainingBalance: loanStatus.remainingPrincipal, 
            type: 'profit',
            month: selectedMonth,
            year: selectedYear
          });
        }

        if (principalReduction > 0) {
          await db.payments.add({
            borrowerId: loan.id,
            amount: principalReduction,
            date: getLocalISOString(),
            remainingBalance: Math.max(0, loanStatus.remainingPrincipal - principalReduction),
            type: 'principal'
          });
        }

        if (payMethod !== 'Cash') {
          await db.mfsTransactions.add({
            amount: payAmount,
            date: getLocalISOString(),
            source: payMethod,
            type: 'profit',
            payerName: loan.name
          });
        }

        await logTransaction({
          amount: payAmount,
          type: payType === 'full' ? 'কিস্তি ঋণ ক্লোজ' : 'কিস্তি আদায়',
          payerName: loan.name,
          description: `${payType === 'full' ? 'সম্পূর্ণ বকেয়া পরিশোধ' : `${BANGLISH_MONTHS[selectedMonth]} ${selectedYear} কিস্তির টাকা গ্রহণ`} (${payMethod}). লভ্যাংশ: ${formatCurrency(actualProfit)}, আসল বিয়োগ: ${formatCurrency(principalReduction)}`,
          category: 'income'
        });
      });

      alert('কিস্তি জমা সফল হয়েছে');
      onClose();
    } catch (error) {
      console.error(error);
      alert('টাকা জমা করতে সমস্যা হয়েছে।');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {!showConfirm ? (
          <motion.div 
            key="config"
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-700"
          >
            <div className="flex items-center gap-3 mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl relative">
              <div className="bg-blue-600 p-2 rounded-xl text-white">
                <Banknote className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 italic">কিস্তি আদায়</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{loan.name}</p>
              </div>
              <button 
                onClick={onClose}
                className="absolute -top-2 -right-2 p-1 bg-white dark:bg-slate-800 rounded-full shadow-md border border-slate-100 dark:border-slate-700 hover:bg-slate-50 transition-colors"
              >
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <select 
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
              >
                {BANGLISH_MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select 
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
              >
                {Array.from({ length: 17 }, (_, i) => 2024 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {isPaidThisMonth && payType === 'installment' && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-black text-center border border-emerald-100 dark:border-emerald-900/40">
                এই মাসের কিস্তি পরিশোধিত
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-6">
               <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">
                    {loan.notes?.includes('FIXED_INSTALLMENT') ? 'মাসিক কিস্তি' : 'বকেয়া আসল'}
                  </p>
                  <p className="text-sm font-black text-slate-700 dark:text-white">
                    {formatCurrency(loan.notes?.includes('FIXED_INSTALLMENT') ? loanStatus.baseInstallmentAmount : loanStatus.remainingPrincipal)}
                  </p>
               </div>
               {loanStatus.penaltyAmount > 0 ? (
                 <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[8px] font-black uppercase mb-1 text-rose-500">
                      জরিমানা (১০%)
                    </p>
                    <p className="text-sm font-black text-rose-600">
                      {formatCurrency(loanStatus.penaltyAmount)}
                    </p>
                 </div>
               ) : (
                 <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[8px] font-black uppercase mb-1 text-emerald-500">
                      লভ্যাংশ (৫%)
                    </p>
                    <p className="text-sm font-black text-emerald-600">
                      {formatCurrency(loanStatus.monthlyProfit)}
                    </p>
                 </div>
               )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl mb-2">
                <button 
                  onClick={() => setPayType('installment')}
                  className={cn("py-2 text-[10px] font-black rounded-lg transition-all", payType === 'installment' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-400")}
                >সাধারণ কিস্তি</button>
                <button 
                  onClick={() => setPayType('full')}
                  className={cn("py-2 text-[10px] font-black rounded-lg transition-all", payType === 'full' ? "bg-white dark:bg-slate-800 text-rose-600 shadow-sm" : "text-slate-400")}
                >সব পরিশোধ</button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">জমার পরিমাণ (টাকায়)</label>
                <div className="relative">
                  <input 
                    type="text" inputMode="numeric"
                    value={amount}
                    readOnly
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-xl font-black text-blue-600 shadow-inner opacity-70 cursor-not-allowed"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl">৳</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {['Cash', 'bKash', 'Nagad', 'Rocket'].map((m: any) => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    className={cn(
                      "py-3 rounded-xl text-[10px] font-black transition-all border-2",
                      payMethod === m 
                        ? "bg-blue-600 text-white border-blue-600 shadow-lg" 
                        : "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800"
                    )}
                  >
                    {m === 'Cash' ? 'নগদ' : m}
                  </button>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setShowConfirm(true)}
                  disabled={isPaidThisMonth && payType === 'installment'}
                  className={cn(
                    "flex-1 py-5 rounded-[2rem] font-black text-lg transition-all shadow-xl",
                    isPaidThisMonth && payType === 'installment'
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:scale-[1.02] active:scale-[0.98]"
                  )}
                >কিস্তি জমা দিন</button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="confirm"
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl border-4 border-blue-600 flex flex-col items-center"
          >
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 text-blue-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2 italic">জমা নিশ্চিত করুন</h2>
            <p className="text-center text-slate-500 dark:text-slate-400 text-sm mb-6 font-bold leading-relaxed">
              আপনি কি নিশ্চিত যে আপনি <span className="font-black text-blue-600">{formatCurrency(Number(amount))}</span> টাকা <span className="text-slate-800 dark:text-slate-200">{payMethod === 'Cash' ? 'নগদ' : payMethod}</span> মাধ্যমে <span className="font-bold text-blue-500 italic">{loan.name}</span> এর কাছ থেকে আদায় করছেন?
              <br/>
              <span className="text-[10px] text-primary-600 mt-2 block">
                ({BANGLISH_MONTHS[selectedMonth]} {selectedYear} কিস্তি পরিশোধ হিসেবে গণ্য হবে)
              </span>
            </p>
            
            <div className="w-full bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl mb-8 space-y-2 border border-slate-100 dark:border-slate-800">
               <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400 uppercase">লভ্যাংশ:</span>
                  <span className="text-emerald-600">{formatCurrency(loanStatus.monthlyProfit)}</span>
               </div>
               <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400 uppercase">আসল বিয়োগ:</span>
                  <span className="text-blue-600">{formatCurrency(Math.max(0, Number(amount) - loanStatus.monthlyProfit))}</span>
               </div>
            </div>

            <div className="flex flex-col w-full gap-3">
              <button 
                onClick={handlePay}
                className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-blue-200 active:scale-95 transition-all"
              >
                হ্যাঁ, নিশ্চিত করুন
              </button>
              <button 
                onClick={() => setShowConfirm(false)}
                className="w-full py-4 text-slate-400 font-bold"
              >
                ফিরে যান
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


function DailyCollectionSection({ subscriptions, payments, mfsTransactions, transactionLogs }: any) {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const selectedDate = getMeetingDateISO(meetingDay).split('T')[0];

  const filteredSubs = subscriptions.filter((s: any) => s && s.date && s.date.split('T')[0] === selectedDate);
  const filteredProfit = payments.filter((p: any) => p && p.type === 'profit' && p.date && p.date.split('T')[0] === selectedDate);
  const filteredMfs = mfsTransactions.filter((t: any) => t && t.date && t.date.split('T')[0] === selectedDate);
  const filteredLogs = (transactionLogs || []).filter((l: any) => l.date && l.date.split('T')[0] === selectedDate);

  const subTotal = filteredSubs.reduce((sum: number, s: any) => sum + s.amount, 0);
  const profitTotal = filteredProfit.reduce((sum: number, p: any) => sum + p.amount, 0);
  const mfsOtherTotal = filteredMfs
    .filter((t: any) => t.type === 'other' || !t.type)
    .reduce((sum: number, t: any) => sum + t.amount, 0);
  
  const grandTotal = subTotal + profitTotal + mfsOtherTotal;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 mb-8 overflow-hidden relative transition-colors"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 dark:bg-primary-900/10 rounded-full -mr-16 -mt-16 opacity-50" />
      
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            তারিখ অনুযায়ী সংগ্রহ
          </h3>
        </div>

        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-4 text-right uppercase tracking-widest">
          প্রদর্শিত তারিখ: {formatBengaliDate(selectedDate)}
        </div>

        <div className="space-y-3">
          {[
            { label: 'চাঁদা (Subscription)', amount: subTotal, color: 'primary', icon: Users },
            { label: 'লাভ (Profit)', amount: profitTotal, color: 'orange', icon: TrendingUp },
            { label: 'MFS জমা', amount: mfsOtherTotal, color: 'purple', icon: Wallet },
          ].map((item, i) => (
            <div key={i} className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100/50 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl", item.color === 'primary' ? "bg-primary-100 dark:bg-primary-900/30" : item.color === 'orange' ? "bg-orange-100 dark:bg-orange-900/30" : "bg-purple-100 dark:bg-purple-900/30")}>
                  <item.icon className={cn("w-4 h-4", item.color === 'primary' ? "text-primary-600 dark:text-primary-400" : item.color === 'orange' ? "text-orange-600 dark:text-orange-400" : "text-purple-600 dark:text-purple-400")} />
                </div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{item.label}</span>
              </div>
              <span className={cn("font-black", item.color === 'primary' ? "text-primary-700 dark:text-primary-400" : item.color === 'orange' ? "text-orange-700 dark:text-orange-400" : "text-purple-700 dark:text-purple-400")}>{formatCurrency(item.amount)}</span>
            </div>
          ))}

          <div className="mt-6 pt-6 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">সর্বমোট সংগ্রহ</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">নির্বাচিত তারিখের জন্য</p>
            </div>
            <span className="text-2xl font-black text-primary-600 dark:text-primary-400 drop-shadow-sm">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* Transaction History List - As requested by user */}
        <div className="mt-8">
           <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
             <div className="w-1.5 h-4 bg-primary-500 rounded-full" />
             লেনদেন তালিকা (অপরিবর্তনীয়)
           </h4>
           <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
             {filteredLogs.length > 0 ? (
               filteredLogs.map((log: any, i: number) => (
                 <div key={log.id || i} className="p-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100/50 dark:border-slate-700/50 flex justify-between items-center transition-colors">
                   <div className="flex-1 min-w-0 pr-3">
                     <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">{log.payerName}</p>
                     <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate opacity-80">{log.description}</p>
                   </div>
                   <div className="text-right flex-shrink-0">
                     <p className={cn(
                       "text-xs font-black", 
                       log.category === 'income' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                     )}>
                       {log.category === 'income' ? '+' : '-'}{formatBengaliNumber(log.amount)} ৳
                     </p>
                     <p className="text-[8px] text-slate-400 dark:text-slate-500 mt-0.5">
                       {new Date(log.date).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                     </p>
                   </div>
                 </div>
               ))
             ) : (
               <div className="text-center py-8 bg-slate-50/30 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/50">
                 <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">অদ্যবধি কোনো লেনদেন পাওয়া যায়নি</p>
               </div>
             )}
           </div>
        </div>
      </div>
    </motion.div>
  );
}

function AllNamesPage({ onBack, goHome }: any) {
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const borrowers = useLiveQuery(() => db.borrowers.toArray()) || [];
  const [search, setSearch] = useState('');

  const mergedMap = new Map();

  members.forEach(m => {
    mergedMap.set(m.id, { ...m, type: 'সদস্য' });
  });

  borrowers.forEach(b => {
    const isInstallment = b.notes?.includes('FIXED_INSTALLMENT');
    const label = isInstallment ? 'কিস্তি ঋণী' : 'ঋণগ্রহীতা';
    
    if (b.memberId && mergedMap.has(b.memberId)) {
      const existing = mergedMap.get(b.memberId);
      const types = existing.type.split(' + ');
      if (!types.includes(label)) {
        types.push(label);
        existing.type = types.join(' + ');
      }
    } else {
      const existingMember = Array.from(mergedMap.values()).find(m => m.name === b.name && m.phone === b.phone);
      if (existingMember) {
        const types = existingMember.type.split(' + ');
        if (!types.includes(label)) {
          types.push(label);
          existingMember.type = types.join(' + ');
        }
      } else {
        mergedMap.set(`b_${b.id}`, { ...b, type: label });
      }
    }
  });

  const allNames = Array.from(mergedMap.values()).filter(item => 
    item.name && item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 max-w-lg mx-auto pb-32">
      <PageHeader title="সদস্য ও ঋণগ্রহীতা তালিকা" onBack={onBack} goHome={goHome} />
      
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Search name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none shadow-sm transition-colors"
        />
      </div>

      <div className="space-y-3">
        {allNames.map((item, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border-2 border-slate-50 dark:border-slate-700 flex justify-between items-center shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-900/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-lg shrink-0">
                {idx + 1}
              </div>
              <div>
                <p className="font-black text-slate-800 dark:text-slate-100 leading-tight">{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">Father: {item.fatherName || 'Member'}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={cn(
                "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tight whitespace-nowrap",
                item.type === 'সদস্য' ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" : 
                item.type.includes('কিস্তি') ? "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse" :
                item.type.includes('ঋণগ্রহীতা') ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" : 
                "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              )}>
                {item.type}
              </span>
              {item.memberId && <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600">ID: {item.memberId}</span>}
            </div>
          </div>
        ))}
        {allNames.length === 0 && (
          <div className="text-center py-20 bg-slate-50/50 dark:bg-slate-800/20 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-700">
            <Search className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400 dark:text-slate-500 font-bold">কোন নাম পাওয়া যায়নি</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MfsPage({ onBack, goHome, isTransactionAllowed, logTransaction }: any) {
  const mfsTransactions = useLiveQuery<MfsTransaction[]>(() => db.mfsTransactions.orderBy('date').reverse().toArray()) || [];
  const [showAdd, setShowAdd] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<any>(null);
  const isAllowed = isTransactionAllowed ? isTransactionAllowed() : true;

  const handleDelete = async () => {
    if (transactionToDelete) {
      await db.mfsTransactions.delete(transactionToDelete.id);
      setTransactionToDelete(null);
    }
  };

  const totalsBySource = mfsTransactions.reduce((acc: any, t) => {
    acc[t.source] = (acc[t.source] || 0) + t.amount;
    return acc;
  }, {});

  return (
    <div className="p-4 max-w-lg mx-auto pb-32">
      <PageHeader title="বিকাশ/নগদ জমা" onBack={onBack} goHome={goHome} />
      
      <div className="grid grid-cols-3 gap-2 mb-6">
        {['bKash', 'Nagad', 'Rocket'].map((source: any) => (
          <div key={source} className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm text-center transition-colors">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">{source}</p>
            <p className="text-sm font-bold text-pink-600 dark:text-pink-400">{formatCurrency(totalsBySource[source] || 0)}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {mfsTransactions.map(t => (
          <div key={t.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center transition-colors">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs",
                t.source === 'bKash' ? "bg-pink-500" : t.source === 'Nagad' ? "bg-orange-500" : "bg-purple-600"
              )}>
                {t.source[0]}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  {t.source}
                  {t.type && t.type !== 'other' && (
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[8px] font-bold",
                      t.type === 'subscription' ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" : "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                    )}>
                      {t.type === 'subscription' ? 'চাঁদা' : 'লাভ'}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatBengaliDate(t.date)}</p>
                {t.payerName && <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">প্রদানকারী: {t.payerName}</p>}
                {t.transactionId && <p className="text-[10px] text-slate-400 dark:text-slate-500">TrxID: {t.transactionId}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-lg font-bold text-primary-600 dark:text-primary-400">+{formatCurrency(t.amount)}</p>
              <button 
                onClick={() => setTransactionToDelete(t)}
                className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {mfsTransactions.length === 0 && (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">কোন লেনদেন পাওয়া যায়নি</div>
        )}
      </div>

      <button 
        onClick={() => setShowAdd(true)}
        disabled={!isAllowed}
        className={cn(
          "fixed bottom-24 right-4 sm:right-8 w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all",
          isAllowed ? "bg-pink-600 text-white hover:bg-pink-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"
        )}
      >
        <Plus className="w-8 h-8" />
      </button>

      {showAdd && <AddMfsModal onClose={() => setShowAdd(false)} isTransactionAllowed={isTransactionAllowed} logTransaction={logTransaction} />}
      {transactionToDelete && <DeleteConfirmationModal onConfirm={handleDelete} onClose={() => setTransactionToDelete(null)} />}
    </div>
  );
}

function AddMfsModal({ onClose, isTransactionAllowed, initialData, logTransaction }: any) {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const penaltyAmount = dbSettings.find(s => s.key === 'penalty_amount')?.value || 200;
  const subscriptionAmount = dbSettings.find(s => s.key === 'subscription_amount')?.value || 1000;
  const profitPercentage = (dbSettings.find(s => s.key === 'profit_percentage')?.value || 5) / 100;
  const compoundPercentage = (dbSettings.find(s => s.key === 'compound_percentage')?.value || 10) / 100;
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const borrowers = useLiveQuery(() => db.borrowers.toArray()) || [];
  const payments = useLiveQuery(() => db.payments.toArray()) || [];
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray(), [], 'subscriptions') || [];
  const isAllowed = isTransactionAllowed ? isTransactionAllowed() : true;

  const [formData, setFormData] = useState({
    source: 'bKash' as 'bKash' | 'Nagad' | 'Rocket',
    amount: initialData?.amount || '',
    date: getTodayDate(),
    month: initialData?.month !== undefined ? initialData.month : new Date().getMonth(),
    year: initialData?.year !== undefined ? initialData.year : new Date().getFullYear(),
    transactionId: '',
    penaltyAmount: initialData?.penaltyAmount || '',
    notes: initialData?.notes || '',
    type: initialData?.type || 'other' as 'subscription' | 'profit' | 'other',
    payerId: initialData?.payerId ? String(initialData.payerId) : ''
  });

  useEffect(() => {
    if (formData.type === 'profit' && formData.payerId) {
      const borrower = borrowers.find(b => b.id === formData.payerId);
      if (borrower) {
        const bPayments = payments.filter(p => p && p.borrowerId === borrower.id && p.date >= borrower.loanDate);
        const isPaid = bPayments.some(p => p.type === 'profit' && p.month === Number(formData.month) && p.year === Number(formData.year));
        
        if (isPaid) {
          setFormData(prev => ({ ...prev, amount: 'পরিশোধ' }));
        } else {
          const loanData = calculateLoan(borrower.loanAmount, borrower.loanDate, bPayments, borrower.customProfit, profitPercentage, compoundPercentage, borrower.notes);
          setFormData(prev => ({ ...prev, amount: loanData.dueInstallment.toString() }));
        }
      }
    } else if (formData.type === 'subscription' && formData.payerId) {
      const member = members.find(m => m.id === formData.payerId);
      if (member) {
        const isPaid = subscriptions.some(s => s.memberId === member.id && s.month === Number(formData.month) && s.year === Number(formData.year));
        
        if (isPaid) {
          setFormData(prev => ({ ...prev, amount: 'পরিশোধ' }));
        } else {
          setFormData(prev => ({ ...prev, amount: subscriptionAmount.toString() }));
        }
      }
    }
  }, [formData.type, formData.payerId, formData.month, formData.year, JSON.stringify(borrowers), JSON.stringify(payments), JSON.stringify(subscriptions), JSON.stringify(members), subscriptionAmount, profitPercentage, compoundPercentage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowed) {
      alert('Transaction window is closed!');
      return;
    }
    if (!formData.transactionId) {
      alert('ট্রানজেকশন আইডি বাধ্যতামূলক!');
      return;
    }
    if (formData.amount === 'পরিশোধ') {
      alert('এই মাসের টাকা ইতিমধ্যে পরিশোধ করা হয়েছে!');
      return;
    }
    const amount = Number(formData.amount);
    const penalty = Number(formData.penaltyAmount || 0);
    
    let payerName = '';
    
    try {
      await db.transaction('rw', [db.subscriptions, db.payments, db.mfsTransactions, db.transactionLogs], async () => {
        if (formData.type === 'subscription' && formData.payerId) {
          const member = members.find(m => m.id === formData.payerId);
          if (member) {
            payerName = member.name;
            
            // Check if already paid for the selected month/year
            const existing = await db.subscriptions
              .where('[memberId+month+year]')
              .equals([member.id, Number(formData.month), Number(formData.year)])
              .first();
            
            // If subscription doesn't exist, add it. If it does, we just record the MFS transaction.
            if (!existing) {
              await db.subscriptions.add({
                memberId: member.id!,
                amount: amount,
                date: formData.date,
                month: Number(formData.month),
                year: Number(formData.year),
                penalty: penalty
              });
              await logTransaction({
                amount: amount,
                type: 'MFS সঞ্চয় চাঁদা',
                payerName: member.name,
                description: `${new Intl.DateTimeFormat('bn-BD', { month: 'long' }).format(new Date(2024, Number(formData.month)))} ${formData.year} মাসের চাঁদা (${formData.source})`,
                category: 'income'
              });
            }
          }
        } else if (formData.type === 'profit' && formData.payerId) {
          const borrower = borrowers.find(b => b.id === formData.payerId);
          if (borrower) {
            payerName = borrower.name;
            const bPayments = payments.filter(p => p && p.borrowerId === borrower.id && p.date >= borrower.loanDate);
            const loanData = calculateLoan(borrower.loanAmount, borrower.loanDate, bPayments, borrower.customProfit, profitPercentage, compoundPercentage, borrower.notes);
            
            await db.payments.add({
              borrowerId: borrower.id!,
              amount: amount,
              date: formData.date,
              type: 'profit',
              month: Number(formData.month),
              year: Number(formData.year),
              remainingBalance: loanData.remainingBalance
            });
            await logTransaction({
              amount: amount,
              type: 'MFS ঋণের লাভ',
              payerName: borrower.name,
              description: `${new Intl.DateTimeFormat('bn-BD', { month: 'long' }).format(new Date(2024, Number(formData.month)))} ${formData.year} মাসের লাভ (${formData.source})`,
              category: 'income'
            });
          }
        } else if (formData.type === 'other') {
           await logTransaction({
             amount: amount,
             type: 'MFS অন্যান্য জমা',
             payerName: 'অন্যান্য',
             description: `সার্বিক জমা (${formData.source}) - ${formData.notes}`,
             category: 'income'
           });
        }

        // Add MFS transaction record
        await db.mfsTransactions.add({
          source: formData.source,
          amount: amount,
          date: formData.date,
          transactionId: formData.transactionId,
          notes: formData.notes,
          type: formData.type,
          payerName: payerName,
          payerId: formData.payerId ? Number(formData.payerId) : undefined
        });
      });
      onClose();
    } catch (error: any) {
      console.error('MFS deposit error:', error);
      alert(error.message || 'লেনদেন সম্পন্ন করতে সমস্যা হয়েছে।');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-200">MFS জমা যোগ করুন</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
            {['bKash', 'Nagad', 'Rocket'].map((s: any) => (
              <button 
                key={s}
                type="button"
                onClick={() => setFormData({...formData, source: s})}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                  formData.source === s ? "bg-white dark:bg-slate-800 shadow-sm text-pink-600 dark:text-pink-400" : "text-slate-500 dark:text-slate-400"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">জমার ধরণ</p>
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
              <button 
                type="button"
                onClick={() => setFormData({...formData, type: 'subscription', payerId: ''})}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", formData.type === 'subscription' ? "bg-white dark:bg-slate-800 shadow-sm text-primary-600 dark:text-primary-400" : "text-slate-500 dark:text-slate-400")}
              >
                চাঁদা
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, type: 'profit', payerId: ''})}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", formData.type === 'profit' ? "bg-white dark:bg-slate-800 shadow-sm text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400")}
              >
                লাভ
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, type: 'other', payerId: ''})}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", formData.type === 'other' ? "bg-white dark:bg-slate-800 shadow-sm text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-400")}
              >
                অন্যান্য
              </button>
            </div>
          </div>

          {formData.type !== 'other' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">
                {formData.type === 'subscription' ? 'সদস্য নির্বাচন করুন' : 'ঋণগ্রহীতা নির্বাচন করুন'}
              </p>
              <select 
                required
                value={formData.payerId}
                onChange={e => setFormData({...formData, payerId: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-pink-500 dark:focus:border-pink-400 text-slate-800 dark:text-slate-200 transition-colors"
              >
                <option value="">নির্বাচন করুন</option>
                {formData.type === 'subscription' ? (
                  members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.memberId})</option>)
                ) : (
                  borrowers.map(b => <option key={b.id} value={b.id}>{b.name} ({b.uid})</option>)
                )}
              </select>
            </div>
          )}

          {formData.type === 'subscription' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">মাস</p>
                <select 
                  value={formData.month}
                  onChange={e => setFormData({...formData, month: Number(e.target.value)})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-pink-500 dark:focus:border-pink-400 text-slate-800 dark:text-slate-200 transition-colors"
                >
                  {Array.from({length: 12}).map((_, i) => (
                    <option key={i} value={i}>
                      {new Intl.DateTimeFormat('bn-BD', { month: 'long' }).format(new Date(2024, i))}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">বছর</p>
                <select 
                  value={formData.year}
                  onChange={e => setFormData({...formData, year: Number(e.target.value)})}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-pink-500 dark:focus:border-pink-400 text-slate-800 dark:text-slate-200 transition-colors"
                >
                  {Array.from({ length: 20 }, (_, i) => 2024 + i).map(y => (
                    <option key={y} value={y}>{formatBengaliNumber(y)}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <input 
            required 
            type={formData.type === 'other' ? "number" : "text"} 
            placeholder="টাকার পরিমাণ" 
            value={formData.amount} 
            readOnly={formData.type !== 'other'}
            onChange={e => setFormData({...formData, amount: e.target.value})} 
            className={cn(
              "w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:outline-none focus:border-pink-500 dark:focus:border-pink-400",
              formData.type !== 'other' && "bg-slate-100 dark:bg-slate-800 cursor-not-allowed font-bold text-pink-600 dark:text-pink-400"
            )} 
          />
          <input required readOnly type="date" value={formData.date} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-not-allowed text-slate-500 dark:text-slate-400" />
          <input required placeholder="ট্রানজেকশন আইডি (বাধ্যতামূলক)" value={formData.transactionId} onChange={e => setFormData({...formData, transactionId: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-pink-500 dark:focus:border-pink-400 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors" />
          
          {formData.type === 'subscription' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">জরিমানা টাকার পরিমাণ</p>
              <select 
                value={formData.penaltyAmount} 
                onChange={e => setFormData({...formData, penaltyAmount: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-pink-500 dark:focus:border-pink-400 text-slate-800 dark:text-slate-200 transition-colors"
              >
                <option value="0">কোনো জরিমানা নেই</option>
                <option value={penaltyAmount}>৳ {penaltyAmount.toLocaleString('bn-BD')}</option>
                <option value={penaltyAmount * 2}>৳ {(penaltyAmount * 2).toLocaleString('bn-BD')}</option>
                <option value={penaltyAmount * 3}>৳ {(penaltyAmount * 3).toLocaleString('bn-BD')}</option>
              </select>
            </div>
          )}

          <textarea placeholder="নোট" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-pink-500 dark:focus:border-pink-400 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors" />
          
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">বাতিল</button>
            <button type="submit" className="flex-1 py-4 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-bold shadow-lg shadow-pink-200 dark:shadow-none transition-all">জমা করুন</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

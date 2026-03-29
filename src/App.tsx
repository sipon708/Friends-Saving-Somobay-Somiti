import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
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
  ArrowLeft,
  Download,
  Share2,
  Bell,
  Lock,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Calendar,
  LogOut,
  LogIn,
  Calculator,
  AlertCircle,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatCurrency, formatBengaliNumber, formatBengaliDate, formatMeetingDate, getMeetingDateISO, generateMessage, calculateLoan, cn } from './utils/helpers';
import { analyzeFinancials } from './services/aiService';
import { jsPDF } from 'jspdf';
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
import 'jspdf-autotable';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';

// --- Components ---

const Card = ({ title, icon: Icon, onClick, color }: any) => (
  <motion.button
    whileHover={{ scale: 1.05, y: -5 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={cn(
      "flex flex-col items-center justify-center p-5 rounded-[2rem] shadow-sm border border-slate-100 bg-white text-slate-800 transition-all",
      "hover:shadow-xl hover:shadow-slate-200/50 hover:border-emerald-100"
    )}
  >
    <div className={cn("p-4 rounded-2xl mb-3 shadow-inner", color)}>
      <Icon className="w-7 h-7 text-white" />
    </div>
    <span className="font-bold text-sm text-slate-700 leading-tight">{title}</span>
  </motion.button>
);

const PageHeader = ({ title, onBack, goHome }: any) => (
  <>
    <div className="flex items-center justify-between mb-6 sticky top-0 bg-slate-50/80 backdrop-blur-md py-4 z-10">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 truncate max-w-[180px] sm:max-w-none">{title}</h1>
      </div>
      <button 
        onClick={goHome} 
        className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all flex items-center gap-2 px-3"
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-xs font-bold hidden sm:inline">হোম</span>
      </button>
    </div>
    
    {/* Floating Home Button for Mobile Convenience */}
    <button
      onClick={goHome}
      className="fixed bottom-6 left-6 p-4 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-200 z-50 sm:hidden hover:scale-110 active:scale-95 transition-transform"
      title="ড্যাশবোর্ডে ফিরে যান"
    >
      <LayoutDashboard className="w-6 h-6" />
    </button>
  </>
);

// --- Main App ---

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const currentPageRef = React.useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const [isAdmin, setIsAdmin] = useState(false);
  const isAdminRef = React.useRef(isAdmin);
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  const [showPinModal, setShowPinModal] = useState(true);
  const showPinModalRef = React.useRef(showPinModal);
  useEffect(() => {
    showPinModalRef.current = showPinModal;
  }, [showPinModal]);

  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotNewPin, setForgotNewPin] = useState('');
  const [forgotStep, setForgotStep] = useState(1);

  // Splash screen timer
  useEffect(() => {
    // Hide native splash screen
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(e => console.warn('SplashScreen hide failed', e));
    }

    // Configure Status Bar
    const setupStatusBar = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        await StatusBar.setBackgroundColor({ color: '#f8fafc' });
        await StatusBar.setStyle({ style: Style.Light });
      } catch (e) {
        console.warn('StatusBar not available', e);
      }
    };
    setupStatusBar();

    // Handle Android Back Button
    let backListener: any;
    if (Capacitor.isNativePlatform()) {
      backListener = App.addListener('backButton', ({ canGoBack }) => {
        if (showPinModalRef.current) {
          App.exitApp();
        } else if (currentPageRef.current !== 'dashboard') {
          setCurrentPage('dashboard');
        } else {
          App.exitApp();
        }
      });
    }

    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => {
      clearTimeout(timer);
      if (backListener) backListener.remove();
    };
  }, []);

  // Data Queries
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const borrowers = useLiveQuery(() => db.borrowers.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const payments = useLiveQuery(() => db.payments.toArray()) || [];
  const deposits = useLiveQuery(() => db.deposits.toArray()) || [];
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray()) || [];
  const mfsTransactions = useLiveQuery(() => db.mfsTransactions.toArray()) || [];

  // Calculations
  const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
  const totalSubscriptions = subscriptions.reduce((sum, s) => sum + s.amount, 0);
  const totalPenalties = subscriptions.reduce((sum, s) => sum + (s.penalty || 0), 0);
  const totalMfs = mfsTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalLoansDistributed = borrowers.reduce((sum, b) => sum + b.loanAmount, 0);
  const totalFormFees = borrowers.reduce((sum, b) => sum + (b.formFee || 0), 0);
  
  // Actual Collected Profit
  const totalProfit = payments
    .filter(p => p.type === 'profit')
    .reduce((sum, p) => sum + p.amount, 0);
    
  const totalLoanRepayments = totalPayments - totalProfit;

  const adjustments = useLiveQuery(() => db.adjustments.toArray()) || [];
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];

  const totalAdjustments = adjustments.reduce((sum, a) => a.type === 'add' ? sum + a.amount : sum - a.amount, 0);
  const totalCash = totalDeposits + totalSubscriptions + totalPenalties + totalFormFees + totalPayments + totalMfs - totalExpenses - totalLoansDistributed + totalAdjustments;

  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const checkNotifications = () => {
      const alerts = [];
      // Check for due loans
      borrowers.forEach(b => {
        // Loan alerts removed as requested
      });
      setNotifications(alerts);
    };
    if (borrowers.length > 0) checkNotifications();
  }, [borrowers]);

  const handleAdminLogin = async () => {
    const savedPin = await db.settings.get('admin_pin');
    const currentPin = savedPin ? savedPin.value : '1234';
    
    if (pin === currentPin) {
      setIsAdmin(true);
      setShowPinModal(false);
      setLoginError('');
      if (Capacitor.isNativePlatform()) {
        try {
          await Keyboard.hide();
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      setLoginError('ভুল পিন! (ডিফল্ট পিন: 1234)');
    }
  };

  const handleForgotPhoneSubmit = async () => {
    const savedPhone = await db.settings.get('admin_phone');
    const phone = savedPhone ? savedPhone.value : '01700000000';
    
    if (forgotPhone === phone) {
      setForgotStep(2);
      setLoginError('');
    } else {
      setLoginError('ভুল মোবাইল নম্বর!');
    }
  };

  const handleForgotPinReset = async () => {
    if (forgotNewPin.length === 4) {
      await db.settings.put({ key: 'admin_pin', value: forgotNewPin });
      setShowForgotPin(false);
      setForgotStep(1);
      setForgotPhone('');
      setForgotNewPin('');
      setLoginError('');
      if (Capacitor.isNativePlatform()) {
        try {
          await Keyboard.hide();
        } catch (e) {
          console.error(e);
        }
      }
      alert('পিন সফলভাবে পরিবর্তন করা হয়েছে। নতুন পিন দিয়ে লগইন করুন।');
    } else {
      setLoginError('পিন ৪ সংখ্যার হতে হবে!');
    }
  };

  const [appTitle, setAppTitle] = useState('যুব সমাজ সমবায় সমিতি');
  const [appSubtitle, setAppSubtitle] = useState('সঞ্চয় করুন, ভবিষ্যৎ গড়ুন।');
  const [meetingDay, setMeetingDay] = useState(1);
  const [appLogo, setAppLogo] = useState<string | null>(null);
  
  useEffect(() => {
    const loadSettings = async () => {
    };
    loadSettings();
  }, []);




  const isTransactionAllowed = () => {
    const now = new Date();
    const todayDay = now.getDate();
    
    // Check if today matches the meeting day (e.g. if today is 25 and meetingDay is 25)
    return todayDay === meetingDay;
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
      
      if (title) setAppTitle(title.value);
      if (subtitle) setAppSubtitle(subtitle.value);
      if (mDay) setMeetingDay(mDay.value);
      if (mTitles) setMenuTitles(mTitles.value);
      if (logo) setAppLogo(logo.value);
      
      const tokens = await db.settings.get('google_tokens');
    };
    loadSettings();
  }, [dbSettings]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('ছবি ১ এমবি-র বেশি হতে পারবে না!');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const goHome = () => setCurrentPage('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'members': return <MembersPage onBack={goHome} goHome={goHome} handleImageUpload={handleImageUpload} isTransactionAllowed={isTransactionAllowed} />;
      case 'borrowers': return <BorrowersPage onBack={goHome} goHome={goHome} handleImageUpload={handleImageUpload} isTransactionAllowed={isTransactionAllowed} />;
      case 'expenses': return <ExpensesPage onBack={goHome} goHome={goHome} isTransactionAllowed={isTransactionAllowed} />;
      case 'reports': return <ReportsPage onBack={goHome} goHome={goHome} />;
      case 'all_names': return <AllNamesPage onBack={goHome} goHome={goHome} />;
      case 'calculator': return <CalculatorPage onBack={goHome} goHome={goHome} />;
      case 'backup': return (
        <BackupPage 
          onBack={goHome} 
          goHome={goHome} 
        />
      );
      case 'notifications': return <NotificationsPage onBack={goHome} goHome={goHome} notifications={notifications} />;
      case 'settings': return <SettingsLock onBack={goHome} goHome={goHome} />;
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
      case 'income_expense': return <IncomeExpensePage onBack={goHome} goHome={goHome} />;
    case 'mfs': return <MfsPage onBack={goHome} goHome={goHome} isTransactionAllowed={isTransactionAllowed} />;
    default: return (
        <div className="p-4 max-w-lg mx-auto pb-24">
          {/* Header */}
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 mb-8 mt-4">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center gap-4 mb-3">
                {appLogo ? (
                  <div className="p-1 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                    <img src={appLogo} alt="Logo" className="w-14 h-14 object-contain rounded-xl" />
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-100 rounded-2xl">
                    <LayoutDashboard className="w-8 h-8 text-emerald-600" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight whitespace-nowrap">{appTitle}</h1>
                  <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest">সমিতির তারিখ: {meetingDate}</p>
                </div>
              </div>
              
              <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />
              
              <div className="w-full overflow-hidden whitespace-nowrap relative h-5">
                <motion.p 
                  animate={{ x: [400, -600] }}
                  transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                  className="text-slate-500 text-sm font-medium absolute whitespace-nowrap"
                >
                  {appSubtitle} • সঞ্চয় করুন, ভবিষ্যৎ গড়ুন • একতাই বল • সততাই মূলধন
                </motion.p>
              </div>
              
              {/* Transaction Window Status */}
              <div className="mt-4 w-full">
                <div className={cn(
                  "px-4 py-2 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm border transition-all",
                  isTransactionAllowed() 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                    : "bg-red-50 text-red-700 border-red-100"
                )}>
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    isTransactionAllowed() ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                  )} />
                  {isTransactionAllowed() ? 'লেনদেন উইন্ডো খোলা আছে' : 'লেনদেন উইন্ডো বন্ধ আছে'}
                </div>
              </div>
            </div>
          </div>

          {/* Main Cash Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-200/50 relative overflow-hidden cursor-pointer"
              onClick={() => setCurrentPage('cash')}
            >
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 opacity-80">
                  <Wallet className="w-4 h-4" />
                  <p className="text-xs font-bold uppercase tracking-wider">মোট ক্যাশ</p>
                </div>
                <h2 className="text-2xl font-black">{formatCurrency(totalCash)}</h2>
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <TrendingUp className="absolute right-[-10px] bottom-[-10px] w-24 h-24 opacity-10" />
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-[2rem] text-white shadow-xl shadow-blue-200/50 relative overflow-hidden cursor-pointer"
              onClick={() => setCurrentPage('dynamic_cash')}
            >
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 opacity-80">
                  <CheckCircle2 className="w-4 h-4" />
                  <p className="text-xs font-bold uppercase tracking-wider">প্রকৃত ক্যাশ</p>
                </div>
                <h2 className="text-2xl font-black">{formatCurrency(totalDeposits + totalSubscriptions + totalProfit + totalPenalties + totalFormFees - totalExpenses)}</h2>
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <Wallet className="absolute right-[-10px] bottom-[-10px] w-24 h-24 opacity-10" />
            </motion.div>
          </div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-purple-200/50 relative overflow-hidden cursor-pointer mb-8 flex items-center justify-between"
            onClick={() => setCurrentPage('dividend')}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1 opacity-80">
                <PieChart className="w-4 h-4" />
                <p className="text-xs font-bold uppercase tracking-wider">শেয়ার ও লভ্যাংশ</p>
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
            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3 ml-2">আর্থিক সারসংক্ষেপ</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'চাঁদা', value: totalSubscriptions, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Wallet },
                { label: 'লাভ', value: totalProfit, color: 'text-orange-600', bg: 'bg-orange-50', icon: TrendingUp },
                { label: 'ঋণ', value: totalLoansDistributed, color: 'text-blue-600', bg: 'bg-blue-50', icon: HandCoins },
                { label: 'জরিমানা মোট টাকা', value: totalPenalties, color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle },
                { label: 'ফরমের মোট টাকা', value: totalFormFees, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: FileText },
                { label: 'MFS', value: totalMfs, color: 'text-purple-600', bg: 'bg-purple-50', icon: CloudUpload },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                  <div className={cn("p-1.5 rounded-lg mb-2", stat.bg)}>
                    <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">{stat.label}</p>
                  <p className={cn("text-[11px] font-black", stat.color)}>{formatCurrency(stat.value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Menu Grid */}
          <div className="mb-8">
            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4 ml-2">দ্রুত মেনু</h3>
            <div className="grid grid-cols-2 gap-4">
              <Card title={menuTitles.cash} icon={Wallet} color="bg-blue-500" onClick={() => setCurrentPage('cash')} />
              <Card title="বিকাশ/নগদ জমা" icon={CloudUpload} color="bg-pink-500" onClick={() => setCurrentPage('mfs')} />
              <Card title={menuTitles.members} icon={Users} color="bg-purple-500" onClick={() => setCurrentPage('members')} />
              <Card title="সদস্য ও ঋণগ্রহীতা তালিকা" icon={Users} color="bg-blue-600" onClick={() => setCurrentPage('all_names')} />
              <Card title={menuTitles.borrowers} icon={HandCoins} color="bg-orange-500" onClick={() => setCurrentPage('borrowers')} />
              <Card title={menuTitles.expenses} icon={PieChart} color="bg-red-500" onClick={() => setCurrentPage('expenses')} />
              <Card title={menuTitles.calculator} icon={Calculator} color="bg-amber-600" onClick={() => setCurrentPage('calculator')} />
              <Card title={menuTitles.backup} icon={CloudUpload} color="bg-cyan-500" onClick={() => setCurrentPage('backup')} />
              <Card title={menuTitles.settings} icon={Settings} color="bg-slate-500" onClick={() => setCurrentPage('settings')} />
              <Card title="লগ আউট" icon={LogOut} color="bg-red-500" onClick={() => { setIsAdmin(false); setShowPinModal(true); setPin(''); }} />
            </div>
          </div>

          {/* Daily Collection Section */}
          <DailyCollectionSection 
            subscriptions={subscriptions} 
            payments={payments} 
            mfsTransactions={mfsTransactions} 
          />

          {/* AI Analysis Quick View */}
          <AIAnalysisSection data={{ totalCash, totalDeposits, totalExpenses, totalProfit }} />
        </div>
      );
    }
  };

  return (
    <div className="min-h-full bg-slate-50 font-sans text-slate-900 relative overflow-x-hidden">
      {/* Subtle background elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-100/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100/20 rounded-full blur-[120px]" />
      </div>

      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 bg-gradient-to-br from-emerald-700 to-emerald-900 z-[100] flex flex-col items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col items-center"
            >
              <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl mb-8 border border-white/20">
                <div className="bg-white p-6 rounded-[2.5rem] shadow-inner">
                  {appLogo ? (
                    <img src={appLogo} alt="Logo" className="w-24 h-24 object-contain" />
                  ) : (
                    <LayoutDashboard className="w-24 h-24 text-emerald-700" />
                  )}
                </div>
              </div>
              <h1 className="text-5xl font-black text-white mb-3 tracking-tighter drop-shadow-lg">{appTitle}</h1>
              <p className="text-emerald-100 text-xl font-medium tracking-wide opacity-90">{appSubtitle}</p>
              
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
        {!showSplash && showPinModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex flex-col items-center mb-8">
                <div className="bg-emerald-50 p-5 rounded-[2rem] mb-5 shadow-inner">
                  <Lock className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">অ্যাডমিন লগইন</h2>
                <p className="text-slate-500 text-center mt-3 font-medium">অ্যাপটি ব্যবহার করতে ৪ সংখ্যার পিন দিন</p>
              </div>
              
              <div className="relative group mb-4">
                <input 
                  type="password" 
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setLoginError('');
                  }}
                  className="w-full text-center text-4xl tracking-[0.8em] py-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-black text-slate-800"
                  placeholder="••••"
                />
                <div className="absolute inset-0 rounded-[2rem] border-2 border-emerald-500/0 group-focus-within:border-emerald-500/10 pointer-events-none transition-all" />
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

              <button 
                onClick={handleAdminLogin}
                className="w-full bg-emerald-600 text-white py-5 rounded-[2rem] font-black text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 mb-6"
              >
                প্রবেশ করুন
              </button>

              {false && (
                <>
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-4 bg-white text-slate-400 font-bold uppercase tracking-widest">অথবা</span>
                    </div>
                  </div>

                  <button 
                    className="w-full bg-white border-2 border-slate-100 text-slate-700 py-5 rounded-[2rem] font-black text-lg hover:bg-slate-50 transition-all mb-6 flex items-center justify-center gap-3 active:scale-95"
                  >
                    <div className="p-1 bg-white rounded-lg shadow-sm border border-slate-100">
                      <LogIn className="w-6 h-6 text-emerald-600" />
                    </div>
                    গুগল দিয়ে লগইন
                  </button>
                </>
              )}

              <button 
                onClick={() => {
                  setShowForgotPin(true);
                  setLoginError('');
                }}
                className="w-full text-emerald-600 font-bold text-sm hover:text-emerald-700 transition-colors uppercase tracking-widest"
              >
                পিন ভুলে গেছেন?
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
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold">পিন রিকভারি</h2>
                <p className="text-slate-500 text-center mt-2">
                  {forgotStep === 1 ? 'আপনার রিকভারি মোবাইল নম্বর দিন' : 'নতুন ৪ সংখ্যার পিন দিন'}
                </p>
              </div>
              
              {forgotStep === 1 && (
                <>
                  <input 
                    type="tel" 
                    value={forgotPhone}
                    onChange={(e) => {
                      setForgotPhone(e.target.value);
                      setLoginError('');
                    }}
                    className="w-full text-center text-xl py-4 border-2 border-slate-200 rounded-2xl focus:border-emerald-500 focus:outline-none mb-2"
                    placeholder="01XXXXXXXXX"
                  />
                  {loginError && <p className="text-red-500 text-center mb-4 font-medium">{loginError}</p>}
                  <button 
                    onClick={handleForgotPhoneSubmit}
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-colors mb-4"
                  >
                    পরবর্তী ধাপ
                  </button>
                </>
              )}

              {forgotStep === 2 && (
                <>
                  <input 
                    type="password" 
                    maxLength={4}
                    value={forgotNewPin}
                    onChange={(e) => {
                      setForgotNewPin(e.target.value);
                      setLoginError('');
                    }}
                    className="w-full text-center text-3xl tracking-[1em] py-4 border-2 border-slate-200 rounded-2xl focus:border-emerald-500 focus:outline-none mb-2"
                    placeholder="****"
                  />
                  {loginError && <p className="text-red-500 text-center mb-4 font-medium">{loginError}</p>}
                  <button 
                    onClick={handleForgotPinReset}
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-colors mb-4"
                  >
                    পিন পরিবর্তন করুন
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
    </div>
  );
}

// --- Sub-Pages ---

function DeleteConfirmationModal({ onConfirm, onClose }: any) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    const savedPin = await db.settings.get('admin_pin');
    const currentPin = savedPin ? savedPin.value : '1234';
    
    if (pin === currentPin) {
      onConfirm();
      onClose();
    } else {
      setError('ভুল পিন!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="bg-red-100 p-4 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold">ডিলিট নিশ্চিত করুন</h2>
          <p className="text-slate-500 text-center mt-2">ডিলিট করতে অ্যাডমিন পিন দিন</p>
        </div>
        <input 
          type="password" 
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full text-center text-3xl tracking-[1em] py-4 border-2 border-slate-200 rounded-2xl focus:border-red-500 focus:outline-none mb-2"
          placeholder="****"
        />
        {error && <p className="text-red-500 text-center text-sm mb-4">{error}</p>}
        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 text-slate-500 font-bold"
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

function SubscriptionModal({ member, onClose, isTransactionAllowed, setMfsInitialData }: any) {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const penaltyAmount = dbSettings.find(s => s.key === 'penalty_amount')?.value || 200;
  const isAllowed = isTransactionAllowed();

  const subscriptions = useLiveQuery(() => 
    db.subscriptions.where('memberId').equals(member.id).toArray()
  ) || [];

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

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
      
      if (!isPaid(m, y)) {
        const isPastMonth = checkDate < currentMonthStart;
        dues.push({
          month: m,
          year: y,
          amount: isPastMonth ? (1000 + penaltyAmount) : 1000,
          penalty: penaltyAmount,
          isPenaltyRequired: isPastMonth
        });
      }
      checkDate.setMonth(checkDate.getMonth() + 1);
    }
    return dues;
  };

  const dues = calculateDues();
  const totalDueAmount = dues.reduce((sum, d) => sum + d.amount, 0);
  const currentMonthPaid = isPaid(selectedMonth, selectedYear);
  const selectedMonthDue = dues.find(d => d.month === selectedMonth && d.year === selectedYear);

  const handlePay = async (month: number, year: number, amount: number, penalty: number) => {
    if (!isAllowed) {
      alert('লেনদেনের সময় শেষ হয়ে গেছে!');
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

    setLoading(true);
    try {
      const subscription = {
        memberId: member.id,
        amount: amount,
        date: new Date().toISOString(),
        month: month,
        year: year,
        penalty: penalty
      };
      
      await db.subscriptions.add(subscription);
      await generateReceipt(subscription);
    } catch (error) {
      console.error('Subscription error:', error);
      alert('চাঁদা জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handlePayAll = async () => {
    if (!isAllowed) {
      alert('লেনদেনের সময় শেষ হয়ে গেছে!');
      return;
    }
    if (dues.length === 0) return;
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
              date: new Date().toISOString(),
              month: due.month,
              year: due.year,
              penalty: due.isPenaltyRequired ? due.penalty : 0
            });
          }
        }
      });
      alert('সকল বকেয়া সফলভাবে পরিশোধ করা হয়েছে।');
    } catch (error) {
      console.error('Pay all error:', error);
      alert('বকেয়া পরিশোধে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const handlePayLastAndCurrent = async () => {
    if (!isAllowed) {
      alert('লেনদেনের সময় শেষ হয়ে গেছে!');
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
            date: new Date().toISOString(),
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
            date: new Date().toISOString(),
            month: currentMonth,
            year: currentYear,
            penalty: currentMonthDue.isPenaltyRequired ? currentMonthDue.penalty : 0
          });
        }
      });
      alert('গত মাস ও বর্তমান মাসের চাঁদা সফলভাবে জমা হয়েছে।');
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
    const samityName = receiptNameSetting?.value || titleSetting?.value || 'Yuba Samaj Samabay Samity';
    const subtitleSetting = await db.settings.get('app_subtitle');
    const samitySubtitle = subtitleSetting?.value || 'Save Today, Build Tomorrow';
    
    // Design
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(0, 0, 210, 297, 'F');
    
    doc.setDrawColor(16, 185, 129); // Emerald 500
    doc.setLineWidth(2);
    doc.rect(10, 10, 190, 277);
    
    doc.setFontSize(24);
    doc.setTextColor(16, 185, 129);
    doc.text(samityName, 105, 35, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(samitySubtitle, 105, 42, { align: 'center' });
    
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
      doc.text(value, 100, y);
      y += 15;
    };

    drawRow('Member Name:', member.name);
    drawRow('Father\'s Name:', member.fatherName);
    drawRow('Member ID:', member.memberId);
    drawRow('Month:', `${months[sub.month]} ${sub.year}`);
    drawRow('Payment Date:', new Date(sub.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    drawRow('Amount Paid:', `BDT ${sub.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    
    if (sub.penalty > 0) {
      drawRow('Note:', `Includes BDT ${sub.penalty.toLocaleString('en-US', { minimumFractionDigits: 2 })} Penalty`);
    }
    
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('This is an official computer-generated receipt.', 105, 200, { align: 'center' });
    
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
    
    doc.save(`Receipt_Chada_${member.name}_${months[sub.month]}_${sub.year}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden">
              {member.photo ? (
                <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <Users className="w-full h-full p-4 text-slate-300" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">{member.name}</h2>
              <p className="text-xs text-slate-500">পিতা: {member.fatherName}</p>
              <p className="text-sm text-slate-500">আইডি: {member.memberId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <XCircle className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl mb-6 space-y-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            চাঁদা জমা দিন
          </h3>
          
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-slate-600">তারিখ</p>
            <div className="flex gap-2">
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1"
              >
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1"
              >
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-slate-600">টাকার পরিমাণ</p>
              <p className="text-2xl font-bold text-slate-900">
                ৳ {selectedMonthDue ? selectedMonthDue.amount.toLocaleString('bn-BD') : '১,০০০'}
                {selectedMonthDue?.penalty > 0 && (
                  <span className={cn(
                    "text-xs block mt-1",
                    selectedMonthDue.isPenaltyRequired ? "text-red-500" : "text-slate-400 line-through"
                  )}>
                    জরিমানা: ৳ {selectedMonthDue.penalty.toLocaleString('bn-BD')} {selectedMonthDue.isPenaltyRequired ? 'সহ' : ''}
                  </span>
                )}
              </p>
            </div>
            
            {currentMonthPaid ? (
              <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold bg-emerald-50 py-3 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
                পরিশোধিত
              </div>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={() => handlePay(selectedMonth, selectedYear, selectedMonthDue?.amount || 1000, selectedMonthDue?.isPenaltyRequired ? selectedMonthDue.penalty : 0)}
                  disabled={loading || !isAllowed}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold transition-all disabled:opacity-50 text-sm",
                    isAllowed ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {loading ? 'প্রসেসিং...' : isAllowed ? 'নগদ জমা' : 'সময় শেষ'}
                </button>
                <button 
                  onClick={() => {
                    setMfsInitialData({
                      type: 'subscription',
                      payerId: member.id,
                      amount: selectedMonthDue?.amount || 1000,
                      penaltyAmount: selectedMonthDue?.penalty || 0,
                      month: selectedMonth,
                      year: selectedYear
                    });
                  }}
                  disabled={!isAllowed}
                  className="flex-1 flex items-center justify-center gap-1 py-3 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 transition-colors disabled:opacity-50"
                >
                  <Smartphone className="w-4 h-4" />
                  বিকাশ/নগদ
                </button>
              </div>
            )}
          </div>
        </div>

        {dues.length > 0 && (
          <div className="bg-orange-50 p-4 rounded-2xl mb-6 border border-orange-100 space-y-3">
            <div className="flex justify-between items-center mb-1">
              <h4 className="font-bold text-orange-800 text-sm">বকেয়া চাঁদা ({dues.length} মাস)</h4>
              <p className="text-lg font-black text-orange-900">৳ {totalDueAmount.toLocaleString('bn-BD')}</p>
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
                      "w-full py-3 rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 border-2 border-orange-200 bg-white text-orange-600 hover:bg-orange-50",
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
                "w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2",
                isAllowed ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              <Wallet className="w-4 h-4" />
              {isAllowed ? 'একত্রে সকল বকেয়া পরিশোধ করুন' : 'সময় শেষ'}
            </button>
          </div>
        )}

        <div>
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-purple-600" />
            চাঁদা প্রদানের ইতিহাস ({selectedYear})
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {months.map((m, i) => {
              const paid = isPaid(i, selectedYear);
              return (
                <div 
                  key={i}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all",
                    paid 
                      ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                      : "bg-slate-50 border-slate-100 text-slate-400"
                  )}
                >
                  <p className="text-[10px] font-medium opacity-70">{m}</p>
                  {paid ? (
                    <CheckCircle2 className="w-4 h-4 mx-auto mt-1" />
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setMfsInitialData({
                          type: 'subscription',
                          payerId: member.id,
                          amount: 1000,
                          month: i,
                          year: selectedYear
                        });
                      }}
                      className="text-pink-600 hover:text-pink-700 transition-colors mt-1"
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
              const msg = generateMessage('subscription', member.name, 1000);
              window.open(`https://wa.me/88${member.phone}?text=${msg}`, '_blank');
            }}
            className="w-full mt-6 py-3 border-2 border-emerald-100 text-emerald-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-50"
          >
            <MessageSquare className="w-5 h-5" />
            মেসেজ পাঠান
          </button>
        )}
      </motion.div>
    </div>
  );
}

function MembersPage({ onBack, goHome, handleImageUpload, isTransactionAllowed }: any) {
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray()) || [];
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const penaltyAmount = dbSettings.find(s => s.key === 'penalty_amount')?.value || 200;
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
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
      await db.members.delete(memberToDelete.id);
      setMemberToDelete(null);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <PageHeader title="সদস্যগণের তালিকা" onBack={onBack} goHome={goHome} />
      
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="সদস্য খুঁজুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 focus:border-emerald-500 focus:outline-none shadow-sm"
        />
      </div>

      <div className="space-y-4">
        {filteredMembers.map(member => {
          const paid = subscriptions.some(s => s && s.memberId === member.id && s.month === currentMonth && s.year === currentYear);
          
          // Calculate penalty if not paid
          let calculatedPenalty = 0;
          if (!paid) {
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            const lastPaid = subscriptions.some(s => s && s.memberId === member.id && s.month === lastMonth && s.year === lastYear);
            if (!lastPaid) {
              calculatedPenalty = penaltyAmount;
            }
          }

          return (
            <div 
              key={member.id} 
              className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:border-emerald-200 transition-all group relative overflow-hidden"
              onClick={() => setSelectedMember(member)}
            >
              {/* Payment Status Ribbon */}
              <div className={cn(
                "absolute top-0 right-0 px-3 py-1 text-[10px] font-bold rounded-bl-xl",
                paid ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
              )}>
                {paid ? 'পরিশোধিত' : 'বাকি'}
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                  {member.photo ? (
                    <img src={member.photo} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Users className="w-full h-full p-4 text-slate-300" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{member.name}</h3>
                  <p className="text-xs text-slate-500">আইডি: {member.memberId}</p>
                  <p className="text-xs text-slate-500">{member.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end gap-2">
                  {paid ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">টাকা পরিশোধ</span>
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setMfsInitialData({
                          type: 'subscription',
                          payerId: member.id,
                          amount: 1000,
                          penaltyAmount: calculatedPenalty,
                          month: currentMonth,
                          year: currentYear
                        });
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-pink-600 text-white rounded-full text-[10px] font-bold hover:bg-pink-700 transition-colors"
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
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
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
          "fixed bottom-8 right-8 w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all",
          isAllowed ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"
        )}
      >
        <Plus className="w-8 h-8" />
      </button>

      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} handleImageUpload={handleImageUpload} isTransactionAllowed={isTransactionAllowed} />}
      {selectedMember && <SubscriptionModal member={selectedMember} onClose={() => setSelectedMember(null)} isTransactionAllowed={isTransactionAllowed} setMfsInitialData={setMfsInitialData} />}
      {memberToDelete && <DeleteConfirmationModal onConfirm={handleDelete} onClose={() => setMemberToDelete(null)} />}
      {mfsInitialData && <AddMfsModal initialData={mfsInitialData} onClose={() => setMfsInitialData(null)} isTransactionAllowed={isTransactionAllowed} />}
    </div>
  );
}

function AddMemberModal({ onClose, handleImageUpload, isTransactionAllowed }: any) {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const isAllowed = isTransactionAllowed ? isTransactionAllowed() : true;

  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    phone: '',
    address: '',
    memberId: '',
    photo: '',
    joinDate: new Date().toISOString().split('T')[0],
    initialDeposit: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowed) {
      alert('লেনদেনের সময় শেষ হয়ে গেছে!');
      return;
    }
    
    // Duplicate check
    const existing = await db.members.where('name').equalsIgnoreCase(formData.name).first();
    if (existing) {
      alert('এই নামের একজন সদস্য ইতিমধ্যে বিদ্যমান! অনুগ্রহ করে অন্য নাম ব্যবহার করুন বা নামের সাথে কিছু যোগ করুন।');
      return;
    }

    const { initialDeposit, ...memberData } = formData;
    const newMemberId = await db.members.add(memberData);
    
    if (initialDeposit && parseFloat(initialDeposit) > 0) {
      await db.deposits.add({
        memberId: newMemberId as number,
        amount: parseFloat(initialDeposit),
        date: new Date().toISOString()
      });
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-2xl font-bold mb-6">নতুন সদস্য যোগ করুন</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300 relative overflow-hidden">
              {formData.photo ? (
                <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-8 h-8 text-slate-400" />
              )}
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => handleImageUpload(e, (base64: string) => setFormData({ ...formData, photo: base64 }))}
                className="absolute inset-0 opacity-0 cursor-pointer" 
              />
            </div>
          </div>
          <input 
            required
            placeholder="সদস্যের নাম"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <input 
            required
            placeholder="পিতার নাম"
            value={formData.fatherName}
            onChange={e => setFormData({...formData, fatherName: e.target.value})}
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <input 
            required
            placeholder="ফোন নম্বর"
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <input 
            required
            placeholder="সদস্য আইডি"
            value={formData.memberId}
            onChange={e => setFormData({...formData, memberId: e.target.value})}
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <input 
            required
            type="number"
            placeholder="প্রাথমিক সঞ্চয় জমা"
            value={formData.initialDeposit}
            onChange={e => setFormData({...formData, initialDeposit: e.target.value})}
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <textarea 
            placeholder="ঠিকানা"
            value={formData.address}
            onChange={e => setFormData({...formData, address: e.target.value})}
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-500 font-bold">বাতিল</button>
            <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-bold">সংরক্ষণ করুন</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function BorrowersPage({ onBack, goHome, handleImageUpload, isTransactionAllowed }: any) {
  const borrowers = useLiveQuery(() => db.borrowers.toArray()) || [];
  const payments = useLiveQuery(() => db.payments.toArray()) || [];
  const [showAdd, setShowAdd] = useState(false);
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);
  const [borrowerToDelete, setBorrowerToDelete] = useState<any>(null);
  const [mfsInitialData, setMfsInitialData] = useState<any>(null);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const isAllowed = isTransactionAllowed();

  const handleDelete = async () => {
    if (borrowerToDelete) {
      await db.borrowers.delete(borrowerToDelete.id);
      // Also delete related payments
      const bPayments = await db.payments.where('borrowerId').equals(borrowerToDelete.id).toArray();
      for (const p of bPayments) {
        await db.payments.delete(p.id!);
      }
      setBorrowerToDelete(null);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <PageHeader title="ঋণগ্রহীতার তালিকা" onBack={onBack} goHome={goHome} />
      
      <div className="space-y-4">
        {borrowers.map(b => {
          const bPayments = payments.filter(p => p && p.borrowerId === b.id);
          const loanData = calculateLoan(b.loanAmount, b.loanDate, bPayments, b.customProfit);
          const profitPaidThisMonth = bPayments.some(p => p && p.type === 'profit' && p.month === currentMonth && p.year === currentYear);
          
          return (
            <div 
              key={b.id} 
              onClick={() => setSelectedBorrower(b)}
              className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:border-orange-200 transition-colors group relative overflow-hidden"
            >
              {/* Profit Status Ribbon */}
              <div className={cn(
                "absolute top-0 right-0 px-3 py-1 text-[10px] font-bold rounded-bl-xl",
                profitPaidThisMonth ? "bg-emerald-500 text-white" : "bg-orange-500 text-white"
              )}>
                {profitPaidThisMonth ? 'লাভ পরিশোধিত' : 'লাভ বাকি'}
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                  {b.photo ? (
                    <img src={b.photo} alt={b.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <HandCoins className="w-full h-full p-3 text-slate-300" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{b.name}</h3>
                  <p className="text-sm text-slate-500">ঋণের তারিখ: {formatBengaliDate(b.loanDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end gap-2">
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(b.loanAmount)}</p>
                  {!profitPaidThisMonth && (
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
                        "flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors",
                        loanData.isLoanMonth ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-pink-600 text-white hover:bg-pink-700"
                      )}
                    >
                      <Smartphone className="w-3 h-3" />
                      বিকাশ/নগদ/রকেট
                    </button>
                  )}
                  {profitPaidThisMonth && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">লাভ পরিশোধিত</span>
                  )}
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setBorrowerToDelete(b);
                  }}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
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
          "fixed bottom-8 right-8 w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all",
          isAllowed ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"
        )}
      >
        <Plus className="w-8 h-8" />
      </button>

      {showAdd && <AddBorrowerModal onClose={() => setShowAdd(false)} handleImageUpload={handleImageUpload} isTransactionAllowed={isTransactionAllowed} />}
      {selectedBorrower && <LoanDetailsModal borrower={selectedBorrower} onClose={() => setSelectedBorrower(null)} isTransactionAllowed={isTransactionAllowed} setMfsInitialData={setMfsInitialData} />}
      {borrowerToDelete && <DeleteConfirmationModal onConfirm={handleDelete} onClose={() => setBorrowerToDelete(null)} />}
      {mfsInitialData && <AddMfsModal initialData={mfsInitialData} onClose={() => setMfsInitialData(null)} isTransactionAllowed={isTransactionAllowed} />}
    </div>
  );
}

function AddBorrowerModal({ onClose, handleImageUpload, isTransactionAllowed }: any) {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
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
    loanAmount: '',
    loanDate: new Date().toISOString().split('T')[0],
    formFee: '',
    notes: '',
    photo: '',
    memberId: '' as string | number
  });

  const resetForm = () => {
    setFormData({
      name: '',
      fatherName: '',
      phone: '',
      uid: '',
      address: '',
      guarantor: '',
      loanAmount: '',
      loanDate: new Date().toISOString().split('T')[0],
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
    if (!isAllowed) {
      alert('লেনদেনের সময় শেষ হয়ে গেছে!');
      return;
    }

    // Duplicate check
    const existing = await db.borrowers.where('name').equalsIgnoreCase(formData.name).first();
    if (existing) {
      alert('এই নামের একজন ঋণগ্রহীতা ইতিমধ্যে বিদ্যমান! অনুগ্রহ করে অন্য নাম ব্যবহার করুন বা নামের সাথে কিছু যোগ করুন।');
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
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-2xl font-bold mb-6">নতুন ঋণগ্রহীতা যোগ করুন</h2>
        
        {/* Borrower Type Selection */}
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6">
          <button 
            type="button"
            onClick={() => handleTypeChange('other')}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
              borrowerType === 'other' ? "bg-white shadow-sm text-orange-600" : "text-slate-500"
            )}
          >
            অন্যান্য (Other)
          </button>
          <button 
            type="button"
            onClick={() => handleTypeChange('member')}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
              borrowerType === 'member' ? "bg-white shadow-sm text-orange-600" : "text-slate-500"
            )}
          >
            সদস্য (Member)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {borrowerType === 'member' && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600">সদস্য নির্বাচন করুন</label>
              <select 
                required
                value={formData.memberId || ''}
                onChange={(e) => handleMemberSelect(e.target.value)}
                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500"
              >
                <option value="">সদস্য বাছাই করুন</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.memberId})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300 relative overflow-hidden">
              {formData.photo ? (
                <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-8 h-8 text-slate-400" />
              )}
              {borrowerType === 'other' && (
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, (base64: string) => setFormData({ ...formData, photo: base64 }))}
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
              )}
            </div>
          </div>
          <input 
            required
            readOnly={borrowerType === 'member'}
            type="text"
            placeholder="ঋণগ্রহীতার নাম"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            className={cn(
              "w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500",
              borrowerType === 'member' && "bg-slate-100 cursor-not-allowed"
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
              "w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500",
              borrowerType === 'member' && "bg-slate-100 cursor-not-allowed"
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <input 
              required
              readOnly={borrowerType === 'member'}
              type="tel"
              placeholder="মোবাইল নাম্বার"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              className={cn(
                "w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500",
                borrowerType === 'member' && "bg-slate-100 cursor-not-allowed"
              )}
            />
            <input 
              required
              readOnly={borrowerType === 'member'}
              type="text"
              placeholder="ইউআইডি (UID)"
              value={formData.uid}
              onChange={e => setFormData({...formData, uid: e.target.value})}
              className={cn(
                "w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500",
                borrowerType === 'member' && "bg-slate-100 cursor-not-allowed"
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
              "w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500",
              borrowerType === 'member' && "bg-slate-100 cursor-not-allowed"
            )}
          />
          
          <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">জামিনদার (Guarantor)</label>
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
                    ? "bg-orange-500 text-white border-orange-600 shadow-lg shadow-orange-200" 
                    : "bg-white text-slate-500 border-slate-200"
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
                    ? "bg-orange-500 text-white border-orange-600 shadow-lg shadow-orange-200" 
                    : "bg-white text-slate-500 border-slate-200"
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
                className="w-full p-4 bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500 text-sm"
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
                className="w-full p-4 bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500 text-sm"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input 
              required
              type="number"
              placeholder="ঋণের পরিমাণ"
              value={formData.loanAmount}
              onChange={e => setFormData({...formData, loanAmount: e.target.value})}
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500"
            />
            <input 
              required
              readOnly
              type="date"
              value={formData.loanDate}
              className="w-full p-4 bg-slate-100 rounded-xl border border-slate-200 focus:outline-none cursor-not-allowed"
            />
          </div>
          <input 
            type="number"
            placeholder="ফরমের টাকা (ঐচ্ছিক)"
            value={formData.formFee}
            onChange={e => setFormData({...formData, formFee: e.target.value})}
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500"
          />
          <textarea 
            placeholder="নোট (ঐচ্ছিক)"
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500"
          />
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-500 font-bold">বাতিল</button>
            <button type="submit" className="flex-1 py-4 bg-orange-500 text-white rounded-xl font-bold">সংরক্ষণ করুন</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function LoanDetailsModal({ borrower, onClose, isTransactionAllowed, setMfsInitialData }: any) {
  const payments = useLiveQuery(() => db.payments.where('borrowerId').equals(borrower.id).toArray()) || [];
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const loanData = calculateLoan(borrower.loanAmount, borrower.loanDate, payments, borrower.customProfit);
  const [showPayment, setShowPayment] = useState(false);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [isEditingProfit, setIsEditingProfit] = useState(false);
  const [tempProfit, setTempProfit] = useState(loanData.totalProfit.toString());
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const isAllowed = isTransactionAllowed();

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleSaveProfit = async () => {
    if (!isAllowed) {
      alert('লেনদেনের সময় শেষ হয়ে গেছে!');
      return;
    }
    await db.borrowers.update(borrower.id, { customProfit: Number(tempProfit) });
    setIsEditingProfit(false);
    alert('লাভের পরিমাণ আপডেট করা হয়েছে');
  };

  const isProfitPaid = (m: number, y: number) => {
    return payments.some(p => p.type === 'profit' && p.month === m && p.year === y);
  };

  const generateReceipt = async (payment: any) => {
    const doc = new jsPDF();
    const isProfit = payment.type === 'profit';
    const sig = await db.settings.get('authorized_signature');
    const receiptNameSetting = await db.settings.get('receipt_samity_name');
    const titleSetting = await db.settings.get('app_title');
    const samityName = receiptNameSetting?.value || titleSetting?.value || 'Yuba Samaj Samabay Samity';
    
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Emerald color
    doc.text(samityName, 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100, 116, 139); // Slate color
    doc.text(isProfit ? 'PROFIT PAYMENT RECEIPT' : 'LOAN PAYMENT RECEIPT', 105, 30, { align: 'center' });
    
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

    drawRow('Borrower Name:', borrower.name);
    drawRow('Date:', new Date(payment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    drawRow('Payment Type:', isProfit ? 'Monthly Profit' : 'Principal Amount');
    if (isProfit) {
      drawRow('For Month:', `${months[payment.month]} ${payment.year}`);
    }
    drawRow('Amount Paid:', `BDT ${payment.amount.toLocaleString()}`);
    
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('This is a computer generated receipt.', 105, y, { align: 'center' });
    
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
    
    doc.save(`Receipt_${borrower.name}_${payment.date}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-6">
          <div className="flex gap-4 items-center">
            {borrower.photo && (
              <img src={borrower.photo} alt={borrower.name} className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
            )}
            <div>
              <h2 className="text-2xl font-bold">{borrower.name}</h2>
              <p className="text-slate-500 text-sm">UID: {borrower.uid || 'N/A'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <ArrowLeft className="w-6 h-6 rotate-180" />
          </button>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">পিতার নাম:</span>
            <span className="font-medium">{borrower.fatherName || 'N/A'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">মোবাইল:</span>
            <span className="font-medium">{borrower.phone || 'N/A'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">ঠিকানা:</span>
            <span className="font-medium">{borrower.address || 'N/A'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">জামিনদার:</span>
            <span className="font-medium">{borrower.guarantor || 'N/A'}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400 mb-1">মূল ঋণ</p>
              <p className="text-lg font-bold">{formatCurrency(loanData.loanAmount)}</p>
            </div>
            <button 
              onClick={() => setShowAddLoan(true)}
              className="p-2 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-colors"
              title="নতুন ঋণ যোগ করুন"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl relative group">
            <p className="text-xs text-slate-400 mb-1">মোট লাভ (৫%/১০%)</p>
            {isEditingProfit ? (
              <div className="flex gap-2">
                <input 
                  type="number"
                  value={tempProfit}
                  onChange={e => setTempProfit(e.target.value)}
                  className="w-full p-1 text-sm border rounded"
                />
                <button onClick={handleSaveProfit} className="text-emerald-600"><TrendingUp className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <p className="text-lg font-bold text-orange-600">{formatCurrency(loanData.totalProfit)}</p>
                <button onClick={() => setIsEditingProfit(true)} className="p-1 text-slate-400 hover:text-emerald-600">
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <div className="bg-orange-50 p-4 rounded-2xl">
            <p className="text-xs text-orange-400 mb-1">মাসিক লাভ (৫%)</p>
            <p className="text-lg font-bold text-orange-700">{formatCurrency(loanData.monthlyProfit)}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl">
            <p className="text-xs text-slate-400 mb-1">পরিশোধিত</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl">
            <p className="text-xs text-slate-400 mb-1">ফরমের টাকা</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(borrower.formFee || 0)}</p>
          </div>
        </div>

        {/* Profit History Grid */}
        <div className="mb-8 p-5 bg-slate-50 rounded-3xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              লাভের ইতিহাস
            </h3>
            <select 
              value={historyYear}
              onChange={e => setHistoryYear(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {months.map((m, i) => {
              const paid = isProfitPaid(i, historyYear);
              return (
                <div 
                  key={i} 
                  className={cn(
                    "p-2 rounded-xl border flex flex-col items-center gap-1 transition-all",
                    paid ? "bg-emerald-50 border-emerald-100" : "bg-white border-slate-100"
                  )}
                >
                  <span className={cn("text-[10px] font-bold", paid ? "text-emerald-600" : "text-slate-400")}>{m}</span>
                  {paid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <button 
                      onClick={() => {
                        const isThisLoanMonth = i === new Date(borrower.loanDate).getMonth() && historyYear === new Date(borrower.loanDate).getFullYear();
                        if (isThisLoanMonth) {
                          alert('ঋণ গ্রহণের মাসে লাভের টাকা পরিশোধ করা যাবে না। আগামী মাস থেকে পরিশোধ করতে পারবেন।');
                          return;
                        }
                        setMfsInitialData({
                          type: 'profit',
                          payerId: borrower.id,
                          amount: loanData.monthlyProfit,
                          month: i,
                          year: historyYear
                        });
                      }}
                      className={cn(
                        "transition-colors",
                        (i === new Date(borrower.loanDate).getMonth() && historyYear === new Date(borrower.loanDate).getFullYear()) ? "text-slate-200 cursor-not-allowed" : "text-pink-600 hover:text-pink-700"
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
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            পরিশোধের ইতিহাস
          </h3>
          <div className="space-y-3">
            {payments.length === 0 ? (
              <p className="text-slate-400 text-center py-4">কোন পেমেন্ট পাওয়া যায়নি</p>
            ) : (
              payments.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-bold">{formatCurrency(p.amount)} {p.type === 'profit' && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full ml-2">লাভ</span>}</p>
                    <p className="text-xs text-slate-500">{formatBengaliDate(p.date)} {p.type === 'profit' && `(${months[p.month!]})`}</p>
                  </div>
                  <button onClick={async () => await generateReceipt(p)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <button 
              onClick={() => setShowPayment(true)}
              disabled={!isAllowed}
              className={cn(
                "flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                isAllowed ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              <Wallet className="w-5 h-5" />
              {isAllowed ? 'টাকা জমা নিন' : 'সময় শেষ'}
            </button>
            <button 
              onClick={() => setShowAddLoan(true)}
              disabled={!isAllowed}
              className={cn(
                "flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                isAllowed ? "bg-orange-500 text-white shadow-lg shadow-orange-100 hover:bg-orange-600" : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              <Plus className="w-5 h-5" />
              {isAllowed ? 'অতিরিক্ত ঋণ' : 'সময় শেষ'}
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
          />
        )}

        {showAddLoan && (
          <AddLoanAmountModal 
            borrower={borrower}
            onClose={() => setShowAddLoan(false)}
            isTransactionAllowed={isTransactionAllowed}
          />
        )}
      </motion.div>
    </div>
  );
}

function AddLoanAmountModal({ borrower, onClose, isTransactionAllowed }: any) {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const [amount, setAmount] = useState('');
  const [formFee, setFormFee] = useState('');
  const isAllowed = isTransactionAllowed();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowed) {
      alert('লেনদেনের সময় শেষ হয়ে গেছে!');
      return;
    }
    const additionalAmount = Number(amount);
    const additionalFormFee = Number(formFee) || 0;
    if (additionalAmount <= 0) return;

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
    
    alert('নতুন ঋণ সফলভাবে যোগ করা হয়েছে এবং মোট ক্যাশ থেকে বিয়োগ করা হয়েছে।');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">নতুন ঋণ যোগ করুন</h3>
        <p className="text-sm text-slate-500 mb-4">বর্তমান ঋণ: {formatCurrency(borrower.loanAmount)}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input 
              required
              type="number"
              placeholder="অতিরিক্ত ঋণের পরিমাণ"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
          </div>
          <div className="relative">
            <input 
              type="number"
              placeholder="ফরমের টাকা (ঐচ্ছিক)"
              value={formFee}
              onChange={e => setFormFee(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold">বাতিল</button>
            <button type="submit" className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold">যোগ করুন</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddPaymentModal({ borrower, remaining, onClose, monthlyProfit, isTransactionAllowed }: any) {
  const [amount, setAmount] = useState(monthlyProfit.toString());
  const [type, setType] = useState<'profit' | 'principal'>('profit');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const isAllowed = isTransactionAllowed();

  const payments = useLiveQuery(() => 
    db.payments.where('borrowerId').equals(borrower.id).toArray()
  ) || [];

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const isProfitPaid = (m: number, y: number) => {
    return payments.some(p => p.type === 'profit' && p.month === m && p.year === y);
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
      alert('লেনদেনের সময় শেষ হয়ে গেছে!');
      return;
    }
    if (currentMonthPaid) return;

    const payAmount = Number(amount);
    const payment: any = {
      borrowerId: borrower.id,
      amount: payAmount,
      date: new Date().toISOString(),
      remainingBalance: type === 'principal' ? Math.max(0, remaining - payAmount) : remaining,
      type: type
    };

    if (type === 'profit') {
      payment.month = selectedMonth;
      payment.year = selectedYear;
    }

    try {
      await db.payments.add(payment);
      
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
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">টাকা জমা নিন</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button 
              type="button"
              onClick={() => {
                setType('profit');
                setAmount(monthlyProfit.toString());
              }}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                type === 'profit' ? "bg-white shadow-sm text-emerald-600" : "text-slate-500"
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
                type === 'principal' ? "bg-white shadow-sm text-emerald-600" : "text-slate-500"
              )}
            >
              আসল (Principal)
            </button>
          </div>

          {type === 'profit' && (
            <div className="grid grid-cols-2 gap-2">
              <select 
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className={cn(
                  "p-3 bg-slate-50 rounded-xl border text-sm focus:outline-none",
                  currentMonthPaid ? "border-emerald-500 bg-emerald-50" : "border-slate-200"
                )}
              >
                {months.map((m, i) => {
                  const paid = isProfitPaid(i, selectedYear);
                  const isLoanM = isLoanMonth(i, selectedYear);
                  return (
                    <option key={i} value={i} disabled={isLoanM}>
                      {m} {isLoanM ? '(প্রযোজ্য নয়)' : paid ? '✓' : ''}
                    </option>
                  );
                })}
              </select>
              <select 
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <input 
              required
              type="number"
              placeholder="টাকার পরিমাণ"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
          </div>

          {currentMonthPaid && (
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold text-center border border-emerald-100">
              এই মাসের লাভের টাকা ইতিমধ্যে পরিশোধিত
            </div>
          )}

          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold">বাতিল</button>
            {!currentMonthPaid && (
              <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">জমা দিন</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function ExpensesPage({ onBack, goHome, isTransactionAllowed }: any) {
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
          <div key={e.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold">{e.title}</h3>
              <p className="text-sm text-slate-500">{formatBengaliDate(e.date)}</p>
              {e.notes && <p className="text-xs text-slate-400 mt-1">{e.notes}</p>}
            </div>
            <div className="flex items-center gap-4">
              <p className="text-lg font-bold text-red-500">{formatCurrency(e.amount)}</p>
              <button 
                onClick={() => setExpenseToDelete(e)}
                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
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
          "fixed bottom-8 right-8 w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all",
          isAllowed ? "bg-red-500 text-white hover:bg-red-600" : "bg-slate-200 text-slate-400 cursor-not-allowed"
        )}
      >
        <Plus className="w-8 h-8" />
      </button>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} isTransactionAllowed={isTransactionAllowed} />}
      {expenseToDelete && <DeleteConfirmationModal onConfirm={handleDelete} onClose={() => setExpenseToDelete(null)} />}
    </div>
  );
}

function AddExpenseModal({ onClose, isTransactionAllowed }: any) {
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
      alert('লেনদেনের সময় শেষ হয়ে গেছে!');
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
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">নতুন খরচ যোগ করুন</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required placeholder="খরচের বিবরণ" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200" />
          <input required type="number" placeholder="টাকার পরিমাণ" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200" />
          <input required readOnly type="date" value={formData.date} className="w-full p-4 bg-slate-100 rounded-xl border border-slate-200 cursor-not-allowed" />
          <textarea placeholder="নোট" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200" />
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4">বাতিল</button>
            <button type="submit" className="flex-1 py-4 bg-red-500 text-white rounded-xl font-bold">খরচ করুন</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ReportsPage({ onBack, goHome }: any) {
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const payments = useLiveQuery(() => db.payments.toArray()) || [];

  const chartData = [
    { name: 'আয়', value: payments.reduce((sum, p) => sum + p.amount, 0), color: '#10b981' },
    { name: 'ব্যয়', value: expenses.reduce((sum, e) => sum + e.amount, 0), color: '#ef4444' },
  ];

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="রিপোর্ট ও পরিসংখ্যান" onBack={onBack} goHome={goHome} />
      
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6">
        <h3 className="font-bold mb-6">আয় বনাম ব্যয়</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
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
        <button className="p-6 bg-white rounded-3xl border border-slate-100 flex flex-col items-center gap-2">
          <Download className="w-6 h-6 text-emerald-600" />
          <span className="text-sm font-bold">PDF রিপোর্ট</span>
        </button>
        <button className="p-6 bg-white rounded-3xl border border-slate-100 flex flex-col items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          <span className="text-sm font-bold">Excel রিপোর্ট</span>
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
    { label: 'C', onClick: clear, color: 'bg-red-100 text-red-600' },
    { label: '(', onClick: () => handleNumber('('), color: 'bg-slate-100 text-slate-600' },
    { label: ')', onClick: () => handleNumber(')'), color: 'bg-slate-100 text-slate-600' },
    { label: '÷', onClick: () => handleOperator('/'), color: 'bg-emerald-100 text-emerald-600' },
    { label: '৭', onClick: () => handleNumber('7'), color: 'bg-white' },
    { label: '৮', onClick: () => handleNumber('8'), color: 'bg-white' },
    { label: '৯', onClick: () => handleNumber('9'), color: 'bg-white' },
    { label: '×', onClick: () => handleOperator('*'), color: 'bg-emerald-100 text-emerald-600' },
    { label: '৪', onClick: () => handleNumber('4'), color: 'bg-white' },
    { label: '৫', onClick: () => handleNumber('5'), color: 'bg-white' },
    { label: '৬', onClick: () => handleNumber('6'), color: 'bg-white' },
    { label: '-', onClick: () => handleOperator('-'), color: 'bg-emerald-100 text-emerald-600' },
    { label: '১', onClick: () => handleNumber('1'), color: 'bg-white' },
    { label: '২', onClick: () => handleNumber('2'), color: 'bg-white' },
    { label: '৩', onClick: () => handleNumber('3'), color: 'bg-white' },
    { label: '+', onClick: () => handleOperator('+'), color: 'bg-emerald-100 text-emerald-600' },
    { label: '০', onClick: () => handleNumber('0'), color: 'bg-white' },
    { label: '.', onClick: () => handleNumber('.'), color: 'bg-white' },
    { label: '⌫', onClick: () => setDisplay(display.length > 1 ? display.slice(0, -1) : '0'), color: 'bg-slate-100 text-slate-600' },
    { label: '=', onClick: calculate, color: 'bg-emerald-600 text-white col-span-1' },
  ];

  const toBengali = (str: string) => {
    return str.replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <PageHeader title="ক্যালকুলেটর" onBack={onBack} goHome={goHome} />
      
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden mb-6">
        {/* Display */}
        <div className="p-6 bg-slate-900 text-right min-h-[140px] flex flex-col justify-end">
          <p className="text-emerald-400 text-sm mb-1 font-mono h-6">
            {toBengali(equation)}
          </p>
          <h2 className="text-4xl font-bold text-white font-mono break-all">
            {toBengali(display)}
          </h2>
        </div>

        {/* Keypad */}
        <div className="p-4 grid grid-cols-4 gap-3 bg-slate-50">
          {buttons.map((btn, idx) => (
            <motion.button
              key={idx}
              whileTap={{ scale: 0.95 }}
              onClick={btn.onClick}
              className={cn(
                "h-16 rounded-2xl text-xl font-bold shadow-sm flex items-center justify-center transition-all",
                btn.color,
                btn.color === 'bg-white' ? "hover:bg-slate-100 text-slate-700" : ""
              )}
            >
              {btn.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" />
          সাম্প্রতিক হিসাব
        </h3>
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-slate-400 text-center py-4">কোনো ইতিহাস নেই</p>
          ) : (
            history.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600 font-medium">{item}</span>
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

          alert('রিস্টোর সফল হয়েছে! অ্যাপটি রিলোড হচ্ছে...');
          window.location.reload();
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
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 text-center">
          <div className="w-20 h-20 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CloudUpload className="w-10 h-10 text-cyan-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">ডেটা ব্যাকআপ</h2>
          <p className="text-slate-500 mb-8">আপনার সমিতির সকল তথ্য একটি ফাইল হিসেবে ডাউনলোড করে নিরাপদ স্থানে রাখুন।</p>
          
          <button 
            onClick={handleBackup}
            disabled={loading}
            className="w-full py-5 bg-cyan-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-cyan-100 flex items-center justify-center gap-3 hover:bg-cyan-700 transition-all disabled:opacity-50"
          >
            {loading ? 'প্রসেসিং...' : <><Download className="w-6 h-6" /> ব্যাকআপ ডাউনলোড করুন</>}
          </button>
        </div>

        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CloudUpload className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">ডেটা রিস্টোর</h2>
          <p className="text-slate-500 mb-8">পূর্বে ডাউনলোড করা ব্যাকআপ ফাইলটি সিলেক্ট করে তথ্য রিস্টোর করুন।</p>
          
          <label className="block w-full py-5 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-100 flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all cursor-pointer">
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

        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>সতর্কতা:</strong> রিস্টোর করলে বর্তমান সকল তথ্য মুছে গিয়ে ব্যাকআপ ফাইলের তথ্যগুলো যুক্ত হবে। রিস্টোর করার আগে বর্তমান তথ্যের একটি ব্যাকআপ নিয়ে রাখা ভালো।
          </p>
        </div>
      </div>
    </div>
  );
}

function SettingsLock({ onBack, goHome }: any) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState('1234');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPin = async () => {
      const p = await db.settings.get('settings_pin');
      if (p) setSavedPin(p.value);
    };
    loadPin();
  }, []);

  const handleUnlock = () => {
    if (pin === savedPin) {
      setIsUnlocked(true);
      setError('');
    } else {
      setError('ভুল পিন!');
      setPin('');
    }
  };

  if (isUnlocked) {
    return <SettingsPage onBack={onBack} goHome={goHome} />;
  }

  return (
    <div className="p-4 max-w-lg mx-auto min-h-[80vh] flex flex-col items-center justify-center">
      <PageHeader title="সেটিংস লক" onBack={onBack} goHome={goHome} />
      <div className="bg-white rounded-3xl p-8 w-full shadow-xl border border-slate-100">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-slate-100 p-4 rounded-full mb-4">
            <Lock className="w-8 h-8 text-slate-600" />
          </div>
          <h2 className="text-2xl font-bold">সেটিংস পিন</h2>
          <p className="text-slate-500 text-center mt-2">সেটিংসে প্রবেশ করতে আলাদা পিন দিন</p>
        </div>
        <input 
          type="password" 
          maxLength={4}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError('');
          }}
          className="w-full text-center text-3xl tracking-[1em] py-4 border-2 border-slate-200 rounded-2xl focus:border-emerald-500 focus:outline-none mb-2"
          placeholder="****"
        />
        {error && <p className="text-red-500 text-center mb-4 font-medium">{error}</p>}
        <button 
          onClick={handleUnlock}
          className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-900 transition-colors"
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
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">সদস্যদের তথ্য পরিবর্তন</h2>
          <button onClick={onClose}><XCircle className="w-6 h-6 text-slate-400 hover:text-red-500" /></button>
        </div>
        
        {!selectedMember ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {members.map(member => (
              <div 
                key={member.id} 
                onClick={() => setSelectedMember(member)}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-all"
              >
                {member.photo ? (
                  <img src={member.photo} alt={member.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-800">{member.name}</p>
                  <p className="text-xs text-slate-500">আইডি: {member.memberId}</p>
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
    photo: member.photo || ''
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert('ছবি ১ এমবি-র বেশি হতে পারবে না!');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, photo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.members.update(member.id, formData);
    alert('সদস্যের তথ্য সফলভাবে আপডেট করা হয়েছে');
    onBack();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><ArrowLeft className="w-5 h-5" /></button>
        <h3 className="font-bold text-lg text-slate-800">তথ্য সম্পাদনা</h3>
      </div>
      
      <div className="flex justify-center mb-4">
        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300 relative overflow-hidden">
          {formData.photo ? (
            <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-8 h-8 text-slate-400" />
          )}
          <input 
            type="file" 
            accept="image/*"
            onChange={handleImageUpload}
            className="absolute inset-0 opacity-0 cursor-pointer" 
          />
        </div>
      </div>
      
      <input 
        required
        placeholder="সদস্যের নাম"
        value={formData.name}
        onChange={e => setFormData({...formData, name: e.target.value})}
        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
      />
      <input 
        required
        placeholder="পিতার নাম"
        value={formData.fatherName}
        onChange={e => setFormData({...formData, fatherName: e.target.value})}
        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
      />
      <input 
        required
        placeholder="ফোন নম্বর"
        value={formData.phone}
        onChange={e => setFormData({...formData, phone: e.target.value})}
        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
      />
      <input 
        required
        placeholder="সদস্য আইডি"
        value={formData.memberId}
        onChange={e => setFormData({...formData, memberId: e.target.value})}
        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
      />
      <textarea 
        placeholder="ঠিকানা"
        value={formData.address}
        onChange={e => setFormData({...formData, address: e.target.value})}
        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
      />
      <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700">আপডেট করুন</button>
    </form>
  );
}

function SettingsEditBorrowers({ onClose }: any) {
  const borrowers = useLiveQuery(() => db.borrowers.toArray()) || [];
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">ঋণদাতার তথ্য পরিবর্তন</h2>
          <button onClick={onClose}><XCircle className="w-6 h-6 text-slate-400 hover:text-red-500" /></button>
        </div>
        
        {!selectedBorrower ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {borrowers.map(borrower => (
              <div 
                key={borrower.id} 
                onClick={() => setSelectedBorrower(borrower)}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-all"
              >
                {borrower.photo ? (
                  <img src={borrower.photo} alt={borrower.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                    <HandCoins className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-800">{borrower.name}</p>
                  <p className="text-xs text-slate-500">আইডি: {borrower.uid}</p>
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
    photo: borrower.photo || ''
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert('ছবি ১ এমবি-র বেশি হতে পারবে না!');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, photo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.borrowers.update(borrower.id, formData);
    alert('ঋণদাতার তথ্য সফলভাবে আপডেট করা হয়েছে');
    onBack();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><ArrowLeft className="w-5 h-5" /></button>
        <h3 className="font-bold text-lg text-slate-800">তথ্য সম্পাদনা</h3>
      </div>
      
      <div className="flex justify-center mb-4">
        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300 relative overflow-hidden">
          {formData.photo ? (
            <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-8 h-8 text-slate-400" />
          )}
          <input 
            type="file" 
            accept="image/*"
            onChange={handleImageUpload}
            className="absolute inset-0 opacity-0 cursor-pointer" 
          />
        </div>
      </div>
      
      <input 
        required
        placeholder="ঋণদাতার নাম"
        value={formData.name}
        onChange={e => setFormData({...formData, name: e.target.value})}
        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
      />
      <input 
        required
        placeholder="পিতার নাম"
        value={formData.fatherName}
        onChange={e => setFormData({...formData, fatherName: e.target.value})}
        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
      />
      <input 
        required
        placeholder="ফোন নম্বর"
        value={formData.phone}
        onChange={e => setFormData({...formData, phone: e.target.value})}
        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
      />
      <input 
        required
        placeholder="আইডি নম্বর"
        value={formData.uid}
        onChange={e => setFormData({...formData, uid: e.target.value})}
        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
      />
      
      <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">জামিনদার (Guarantor)</label>
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
                ? "bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-200" 
                : "bg-white text-slate-500 border-slate-200"
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
                ? "bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-200" 
                : "bg-white text-slate-500 border-slate-200"
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
            className="w-full p-4 bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 text-sm"
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
            className="w-full p-4 bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 text-sm"
          />
        )}
      </div>

      <textarea 
        placeholder="ঠিকানা"
        value={formData.address}
        onChange={e => setFormData({...formData, address: e.target.value})}
        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
      />
      <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700">আপডেট করুন</button>
    </form>
  );
}

function SettingsPage({ onBack, goHome }: any) {
  const [showPinReset, setShowPinReset] = useState(false);
  const [showSettingsPinReset, setShowSettingsPinReset] = useState(false);
  const [showEditMembers, setShowEditMembers] = useState(false);
  const [showEditBorrowers, setShowEditBorrowers] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newSettingsPin, setNewSettingsPin] = useState('');
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
  const [tempPhone, setTempPhone] = useState('');
  const [tempMenuTitles, setTempMenuTitles] = useState<any>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [appLogo, setAppLogo] = useState<string | null>(null);

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
      
      setTempTitle(t?.value || 'যুব সমাজ সমবায় সমিতি');
      setTempSubtitle(s?.value || 'সঞ্চয় করুন, ভবিষ্যৎ গড়ুন।');
      setTempReceiptName(rn?.value || '');
      setTempMeetingDay(d?.value || 1);
      setTempPenalty(penalty?.value || 200);
      
      setTempPhone(phone?.value || '');
      setSignature(sig?.value || null);
      setAppLogo(logo?.value || null);
      setTempMenuTitles(mt?.value || {
        cash: 'মোট ক্যাশ',
        members: 'সদস্যগণের নাম',
        borrowers: 'ঋণগ্রহীতার নাম',
        expenses: 'খরচ',
        halkhata: 'হালখাতা',
        backup: 'ব্যাকআপ & রিস্টোর',
        settings: 'সেটিংস'
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
      await db.settings.put({ key: 'app_logo', value: base64 });
      setAppLogo(base64);
      alert('লোগো সফলভাবে আপলোড করা হয়েছে');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteLogo = async () => {
    if (confirm('আপনি কি নিশ্চিত যে আপনি এই লোগোটি মুছে ফেলতে চান?')) {
      await db.settings.delete('app_logo');
      setAppLogo(null);
      alert('লোগো মুছে ফেলা হয়েছে');
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await db.settings.put({ key: 'authorized_signature', value: base64 });
      setSignature(base64);
      alert('স্বাক্ষর সফলভাবে আপলোড করা হয়েছে');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteSignature = async () => {
    if (confirm('আপনি কি নিশ্চিত যে আপনি এই স্বাক্ষরটি মুছে ফেলতে চান?')) {
      await db.settings.delete('authorized_signature');
      setSignature(null);
      alert('স্বাক্ষর মুছে ফেলা হয়েছে');
    }
  };

  const handleReset = async () => {
    if (newPin.length === 4) {
      await db.settings.put({ key: 'admin_pin', value: newPin });
      alert('পিন সফলভাবে পরিবর্তন করা হয়েছে');
      setShowPinReset(false);
    } else {
      alert('পিন ৪ সংখ্যার হতে হবে');
    }
  };

  const handleSaveSettingsPin = async () => {
    if (newSettingsPin.length === 4) {
      await db.settings.put({ key: 'settings_pin', value: newSettingsPin });
      alert('সেটিংস পিন সফলভাবে পরিবর্তন করা হয়েছে');
      setShowSettingsPinReset(false);
    } else {
      alert('পিন ৪ সংখ্যার হতে হবে');
    }
  };

  const handleSaveAppInfo = async () => {
    try {
      await db.settings.put({ key: 'app_title', value: tempTitle });
      await db.settings.put({ key: 'app_subtitle', value: tempSubtitle });
      await db.settings.put({ key: 'meeting_day', value: tempMeetingDay });
      
      alert('তথ্য সফলভাবে আপডেট করা হয়েছে');
      setShowTitleEdit(false);
      window.location.reload(); // Reload to apply date changes globally
    } catch (error) {
      console.error('Failed to save app info:', error);
      alert('তথ্য সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  };

  const handleSaveReceiptName = async () => {
    await db.settings.put({ key: 'receipt_samity_name', value: tempReceiptName });
    alert('রিসিট নাম সফলভাবে আপডেট করা হয়েছে');
    setShowReceiptNameEdit(false);
  };

  const handleSaveMenuTitles = async () => {
    await db.settings.put({ key: 'menu_titles', value: tempMenuTitles });
    alert('মেনু টাইটেল সফলভাবে আপডেট করা হয়েছে');
    setShowMenuEdit(false);
  };

  const handleSavePhone = async () => {
    await db.settings.put({ key: 'admin_phone', value: tempPhone });
    alert('রিকভারি মোবাইল নম্বর সফলভাবে আপডেট করা হয়েছে');
    setShowPhoneEdit(false);
  };

  const handleSavePenalty = async () => {
    await db.settings.put({ key: 'penalty_amount', value: Number(tempPenalty) });
    alert('জরিমানার পরিমাণ সফলভাবে আপডেট করা হয়েছে');
    setShowPenaltyEdit(false);
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
      alert('অ্যাপটি সফলভাবে রিসেট করা হয়েছে।');
      window.location.reload();
    } catch (error) {
      alert('রিসেট করতে সমস্যা হয়েছে');
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="সেটিংস" onBack={onBack} goHome={goHome} />


      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <button 
          onClick={() => setShowTitleEdit(true)}
          className="w-full p-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <Edit className="w-5 h-5 text-slate-400" />
            <span className="font-medium">টাইটেল ও সাবটাইটেল পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>
        <button 
          onClick={() => setShowReceiptNameEdit(true)}
          className="w-full p-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-slate-400" />
            <span className="font-medium">রিসিট সমিতির নাম পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>
        <button 
          onClick={() => setShowPinReset(true)}
          className="w-full p-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-slate-400" />
            <span className="font-medium">লগইন পিন পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>
        <button 
          onClick={() => setShowSettingsPinReset(true)}
          className="w-full p-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-slate-400" />
            <span className="font-medium">সেটিংস পিন পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>
        <button 
          onClick={() => setShowPhoneEdit(true)}
          className="w-full p-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-slate-400" />
            <span className="font-medium">রিকভারি মোবাইল নম্বর</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>
        <button 
          onClick={() => setShowPenaltyEdit(true)}
          className="w-full p-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-slate-400" />
            <span className="font-medium">জরিমানার পরিমাণ পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>
        <button 
          onClick={() => setShowMenuEdit(true)}
          className="w-full p-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-5 h-5 text-slate-400" />
            <span className="font-medium">মেনু টাইটেল পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>
        <button 
          onClick={() => setShowEditMembers(true)}
          className="w-full p-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-slate-400" />
            <span className="font-medium">সদস্যদের তথ্য পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>
        <button 
          onClick={() => setShowEditBorrowers(true)}
          className="w-full p-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <HandCoins className="w-5 h-5 text-slate-400" />
            <span className="font-medium">ঋণদাতার তথ্য পরিবর্তন</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>

        <div className="p-4 border-b border-slate-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-slate-400" />
              <span className="font-medium">অ্যাপ লোগো</span>
            </div>
            {appLogo ? (
              <button 
                onClick={handleDeleteLogo}
                className="text-xs text-red-500 font-bold flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> মুছে ফেলুন
              </button>
            ) : (
              <label className="text-xs text-emerald-600 font-bold cursor-pointer flex items-center gap-1">
                <CloudUpload className="w-3 h-3" /> আপলোড করুন
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            )}
          </div>
          {appLogo ? (
            <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-center border border-dashed border-slate-200">
              <img src={appLogo} alt="Logo" className="max-h-20 object-contain" />
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-2xl text-center border border-dashed border-slate-200">
              <p className="text-xs text-slate-400 italic">কোন লোগো সেট করা নেই</p>
            </div>
          )}
        </div>

        <div className="p-4 border-b border-slate-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Edit className="w-5 h-5 text-slate-400" />
              <span className="font-medium">Authorized Signature</span>
            </div>
            {signature ? (
              <button 
                onClick={handleDeleteSignature}
                className="text-xs text-red-500 font-bold flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> মুছে ফেলুন
              </button>
            ) : (
              <label className="text-xs text-emerald-600 font-bold cursor-pointer flex items-center gap-1">
                <CloudUpload className="w-3 h-3" /> আপলোড করুন
                <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
              </label>
            )}
          </div>
          {signature ? (
            <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-center border border-dashed border-slate-200">
              <img src={signature} alt="Signature" className="max-h-20 object-contain" />
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-2xl text-center border border-dashed border-slate-200">
              <p className="text-xs text-slate-400 italic">কোন স্বাক্ষর আপলোড করা নেই</p>
            </div>
          )}
        </div>

        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-slate-400" />
            <span className="font-medium">নোটিফিকেশন</span>
          </div>
          <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
             <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
          </div>
        </div>
        <button 
          onClick={() => setShowResetConfirm(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-red-50 text-red-600"
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

      {showTitleEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">অ্যাপের তথ্য পরিবর্তন</h3>
            <div className="space-y-4">
              <input 
                placeholder="টাইটেল"
                value={tempTitle}
                onChange={e => setTempTitle(e.target.value)}
                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200"
              />
              <input 
                placeholder="সাবটাইটেল"
                value={tempSubtitle}
                onChange={e => setTempSubtitle(e.target.value)}
                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200"
              />
              <input 
                placeholder="সমিতির তারিখ (যেমন: ১৫)"
                type="number"
                min="1"
                max="31"
                value={tempMeetingDay}
                onChange={e => setTempMeetingDay(parseInt(e.target.value) || 1)}
                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200"
              />
              <p className="text-xs text-slate-400 px-1">শুধুমাত্র তারিখের সংখ্যাটি লিখুন। মাস ও বছর অটোমেটিক আপডেট হবে।</p>
            </div>
            <div className="flex gap-4 mt-6">
              <button onClick={() => setShowTitleEdit(false)} className="flex-1 py-3">বাতিল</button>
              <button onClick={handleSaveAppInfo} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">সংরক্ষণ</button>
            </div>
          </div>
        </div>
      )}

      {showReceiptNameEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">রিসিট সমিতির নাম পরিবর্তন</h3>
            <div className="space-y-4">
              <input 
                placeholder="রিসিট সমিতির নাম (ইংরেজি)"
                value={tempReceiptName}
                onChange={e => setTempReceiptName(e.target.value)}
                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200"
              />
              <p className="text-xs text-slate-400 px-1">ফাঁকা রাখলে মেইন টাইটেল ব্যবহার হবে। এটি শুধুমাত্র PDF রিসিটে দেখাবে।</p>
            </div>
            <div className="flex gap-4 mt-6">
              <button onClick={() => setShowReceiptNameEdit(false)} className="flex-1 py-3">বাতিল</button>
              <button onClick={handleSaveReceiptName} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">সংরক্ষণ</button>
            </div>
          </div>
        </div>
      )}

      {showMenuEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">মেনু টাইটেল পরিবর্তন</h3>
            <div className="space-y-4">
              {Object.keys(tempMenuTitles).map((key) => (
                <div key={key}>
                  <label className="text-xs text-slate-400 ml-1 mb-1 block capitalize">{key.replace('_', ' ')}</label>
                  <input 
                    value={tempMenuTitles[key]}
                    onChange={e => setTempMenuTitles({ ...tempMenuTitles, [key]: e.target.value })}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-6">
              <button onClick={() => setShowMenuEdit(false)} className="flex-1 py-3">বাতিল</button>
              <button onClick={handleSaveMenuTitles} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">সংরক্ষণ</button>
            </div>
          </div>
        </div>
      )}

      {showPhoneEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">রিকভারি মোবাইল নম্বর</h3>
            <p className="text-sm text-slate-500 mb-4">পিন ভুলে গেলে এই নম্বর দিয়ে রিসেট করতে পারবেন।</p>
            <input 
              type="tel" 
              placeholder="01XXXXXXXXX"
              value={tempPhone}
              onChange={e => setTempPhone(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-center text-xl tracking-widest"
            />
            <div className="flex gap-4">
              <button onClick={() => setShowPhoneEdit(false)} className="flex-1 py-3">বাতিল</button>
              <button onClick={handleSavePhone} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">সংরক্ষণ</button>
            </div>
          </div>
        </div>
      )}

      {showPinReset && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">লগইন পিন পরিবর্তন</h3>
            <input 
              type="password" 
              maxLength={4}
              placeholder="নতুন ৪ সংখ্যার পিন"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-center text-2xl tracking-widest"
            />
            <div className="flex gap-4">
              <button onClick={() => setShowPinReset(false)} className="flex-1 py-3">বাতিল</button>
              <button onClick={handleReset} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">পরিবর্তন করুন</button>
            </div>
          </div>
        </div>
      )}

      {showSettingsPinReset && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">সেটিংস পিন পরিবর্তন</h3>
            <input 
              type="password" 
              maxLength={4}
              placeholder="নতুন ৪ সংখ্যার পিন"
              value={newSettingsPin}
              onChange={e => setNewSettingsPin(e.target.value)}
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-center text-2xl tracking-widest"
            />
            <div className="flex gap-4">
              <button onClick={() => setShowSettingsPinReset(false)} className="flex-1 py-3">বাতিল</button>
              <button onClick={handleSaveSettingsPin} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">পরিবর্তন করুন</button>
            </div>
          </div>
        </div>
      )}

      {showPenaltyEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">জরিমানার পরিমাণ পরিবর্তন</h3>
            <input 
              type="number" 
              placeholder="জরিমানার পরিমাণ (যেমন: ২০০)"
              value={tempPenalty}
              onChange={e => setTempPenalty(Number(e.target.value))}
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-center text-2xl"
            />
            <div className="flex gap-4">
              <button onClick={() => setShowPenaltyEdit(false)} className="flex-1 py-3">বাতিল</button>
              <button onClick={handleSavePenalty} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">সংরক্ষণ</button>
            </div>
          </div>
        </div>
      )}

      {showEditMembers && <SettingsEditMembers onClose={() => setShowEditMembers(false)} />}
      {showEditBorrowers && <SettingsEditBorrowers onClose={() => setShowEditBorrowers(false)} />}
    </div>
  );
}

function CashPage({ onBack, goHome, totalCash, isAllowed }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const adjustments = useLiveQuery(() => db.adjustments.orderBy('date').reverse().toArray()) || [];

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="মোট ক্যাশ বিবরণ" onBack={onBack} goHome={goHome} />
      <div className="bg-emerald-600 p-8 rounded-3xl text-white text-center mb-6">
        <p className="opacity-80 mb-2">বর্তমান মোট ক্যাশ</p>
        <h2 className="text-5xl font-black">{formatCurrency(totalCash)}</h2>
      </div>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setShowAdd(true)}
          disabled={!isAllowed}
          className={cn(
            "flex-1 p-4 rounded-2xl border font-bold flex items-center justify-center gap-2 transition-all",
            isAllowed ? "bg-white border-slate-200 text-slate-800" : "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
          )}
        >
          <Plus className="w-5 h-5 text-emerald-600" /> 
          {isAllowed ? 'ক্যাশ যোগ/বিয়োগ' : 'সময় শেষ'}
        </button>
      </div>

      <h3 className="font-bold mb-4">সাম্প্রতিক অ্যাডজাস্টমেন্ট</h3>
      <div className="space-y-3">
        {adjustments.map(a => (
          <div key={a.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
            <div>
              <p className="font-bold">{a.notes}</p>
              <p className="text-xs text-slate-500">{formatBengaliDate(a.date)}</p>
            </div>
            <p className={cn("font-bold", a.type === 'add' ? "text-emerald-600" : "text-red-600")}>
              {a.type === 'add' ? '+' : '-'}{formatCurrency(a.amount)}
            </p>
          </div>
        ))}
      </div>

      {showAdd && <AddCashModal onClose={() => setShowAdd(false)} isAllowed={isAllowed} />}
    </div>
  );
}

function AddCashModal({ onClose, isAllowed }: any) {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'add' | 'subtract'>('add');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowed) {
      alert('লেনদেনের সময় শেষ হয়ে গেছে!');
      return;
    }
    await db.adjustments.add({
      amount: Number(amount),
      type,
      notes,
      date: date
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
        <h3 className="text-xl font-bold mb-6">ক্যাশ অ্যাডজাস্টমেন্ট</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              type="button"
              onClick={() => setType('add')}
              className={cn("flex-1 py-2 rounded-lg font-bold transition-all", type === 'add' ? "bg-white shadow-sm text-emerald-600" : "text-slate-500")}
            >
              যোগ
            </button>
            <button 
              type="button"
              onClick={() => setType('subtract')}
              className={cn("flex-1 py-2 rounded-lg font-bold transition-all", type === 'subtract' ? "bg-white shadow-sm text-red-600" : "text-slate-500")}
            >
              বিয়োগ
            </button>
          </div>
          <input 
            required
            type="number"
            placeholder="টাকার পরিমাণ"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200"
          />
          <input 
            required
            placeholder="বিবরণ"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200"
          />
          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3">বাতিল</button>
            <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">নিশ্চিত করুন</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NotificationsPage({ onBack, goHome, notifications }: any) {
  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="নোটিফিকেশন" onBack={onBack} goHome={goHome} />
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400">কোন নতুন নোটিফিকেশন নেই</p>
          </div>
        ) : (
          notifications.map((n: any) => (
            <div key={n.id} className="bg-white p-4 rounded-2xl border-l-4 border-orange-500 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <p className="font-bold text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-1">অনুগ্রহ করে দ্রুত ব্যবস্থা নিন।</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DynamicCashPage({ onBack, goHome, totalSubscriptions, totalProfit, totalDeposits, totalPenalties, totalFormFees, totalExpenses }: any) {
  const actualCash = totalSubscriptions + totalDeposits + totalProfit + totalPenalties + totalFormFees;

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <PageHeader title="প্রকৃত ক্যাশ (অটোমেটিক)" onBack={onBack} goHome={goHome} />
      <div className="bg-blue-600 p-8 rounded-3xl text-white text-center mb-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <p className="opacity-80 mb-2">মোট প্রকৃত ক্যাশ</p>
          <h2 className="text-5xl font-black">{formatCurrency(actualCash)}</h2>
          <p className="text-xs mt-3 opacity-80 bg-black/10 inline-block px-3 py-1 rounded-full">এই পেজে কোনো ম্যানুয়াল যোগ/বিয়োগ করা যাবে না</p>
        </div>
        <Wallet className="absolute right-[-20px] bottom-[-20px] w-40 h-40 opacity-10" />
      </div>

      <h3 className="font-bold text-slate-800 mb-4 ml-2">আয় ও জমার বিবরণী</h3>
      <div className="space-y-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Wallet className="w-5 h-5" /></div>
            <span className="font-bold text-slate-700">সদস্যদের সঞ্চয় জমা</span>
          </div>
          <span className="font-bold text-emerald-600">+{formatCurrency(totalDeposits)}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Users className="w-5 h-5" /></div>
            <span className="font-bold text-slate-700">মোট চাঁদা আদায়</span>
          </div>
          <span className="font-bold text-emerald-600">+{formatCurrency(totalSubscriptions)}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
            <span className="font-bold text-slate-700">মোট লাভ ও চক্রবৃদ্ধি</span>
          </div>
          <span className="font-bold text-emerald-600">+{formatCurrency(totalProfit)}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
            <span className="font-bold text-slate-700">চাঁদার জরিমানা আদায়</span>
          </div>
          <span className="font-bold text-emerald-600">+{formatCurrency(totalPenalties)}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><FileText className="w-5 h-5" /></div>
            <span className="font-bold text-slate-700">ফরমের মোট টাকা</span>
          </div>
          <span className="font-bold text-emerald-600">+{formatCurrency(totalFormFees)}</span>
        </div>
      </div>
    </div>
  );
}

function DividendPage({ onBack, goHome, members, deposits, totalActualCash, totalExpenses }: any) {
  // Calculate total deposits
  const totalDeposits = deposits.reduce((sum: number, d: any) => sum + d.amount, 0);
  
  // Distributable profit = Actual Cash (which already has expenses subtracted) - Total Deposits
  // This ensures members get their own deposits back + equal share of the profit
  const distributableProfit = totalActualCash - totalDeposits;
  
  const memberCount = members.length;
  const perMemberShare = memberCount > 0 ? distributableProfit / memberCount : 0;

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <PageHeader title="শেয়ার ও লভ্যাংশ বন্টন" onBack={onBack} goHome={goHome} />
      
      <div className="bg-purple-600 p-8 rounded-3xl text-white text-center mb-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <p className="opacity-80 mb-2">বন্টনযোগ্য মোট লভ্যাংশ</p>
          <h2 className="text-4xl font-black">{formatCurrency(distributableProfit)}</h2>
          <p className="text-xs mt-3 opacity-80 bg-black/10 inline-block px-3 py-1 rounded-full">
            (মোট আয় - মোট খরচ)
          </p>
        </div>
        <PieChart className="absolute right-[-20px] bottom-[-20px] w-40 h-40 opacity-10" />
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 mb-6 shadow-sm flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-500">মোট সদস্য</p>
          <p className="text-xl font-bold text-slate-800">{memberCount} জন</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">সদস্য প্রতি লভ্যাংশ</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(perMemberShare)}</p>
        </div>
      </div>

      <h3 className="font-bold text-slate-800 mb-4 ml-2">সদস্যদের শেয়ার বিবরণী</h3>
      <div className="space-y-3">
        {members.map((member: any) => {
          const memberDeposits = deposits
            .filter((d: any) => d.memberId === member.id)
            .reduce((sum: number, d: any) => sum + d.amount, 0);
            
          const totalMemberShare = memberDeposits + perMemberShare;

          return (
            <div key={member.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                {member.photo ? (
                  <img src={member.photo} alt={member.name} className="w-10 h-10 rounded-full object-cover border-2 border-slate-100" />
                ) : (
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-800">{member.name}</p>
                  <p className="text-xs text-slate-500">সদস্য নং: {member.memberId}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl mb-2">
                <div>
                  <p className="text-[10px] text-slate-400">প্রাথমিক সঞ্চয় জমা</p>
                  <p className="text-sm font-bold text-slate-700">{formatCurrency(memberDeposits)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">লভ্যাংশ অংশ</p>
                  <p className="text-sm font-bold text-emerald-600">{perMemberShare >= 0 ? '+' : ''}{formatCurrency(perMemberShare)}</p>
                </div>
              </div>
              
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-slate-600">মোট পাওনা:</span>
                <span className="font-black text-purple-600">{formatCurrency(totalMemberShare)}</span>
              </div>
            </div>
          );
        })}
        
        {members.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            কোনো সদস্য পাওয়া যায়নি
          </div>
        )}
      </div>
    </div>
  );
}

function IncomeExpensePage({ onBack, goHome }: any) {
  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="আয় ব্যয়ের হিসাব" onBack={onBack} goHome={goHome} />
      <div className="space-y-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500">মোট আয়</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(50000)}</p>
          </div>
          <div className="p-3 bg-emerald-100 rounded-2xl">
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500">মোট ব্যয়</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(12000)}</p>
          </div>
          <div className="p-3 bg-red-100 rounded-2xl">
            <PieChart className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function DailyCollectionSection({ subscriptions, payments, mfsTransactions }: any) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredSubs = subscriptions.filter((s: any) => s && s.date && s.date.split('T')[0] === selectedDate);
  const filteredProfit = payments.filter((p: any) => p && p.type === 'profit' && p.date && p.date.split('T')[0] === selectedDate);
  const filteredMfs = mfsTransactions.filter((t: any) => t && t.date && t.date.split('T')[0] === selectedDate);

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
      className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8 overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50" />
      
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>
            তারিখ অনুযায়ী সংগ্রহ
          </h3>
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        <div className="text-[10px] font-bold text-slate-400 mb-4 text-right uppercase tracking-widest">
          প্রদর্শিত তারিখ: {formatBengaliDate(selectedDate)}
        </div>

        <div className="space-y-3">
          {[
            { label: 'চাঁদা (Subscription)', amount: subTotal, color: 'emerald', icon: Users },
            { label: 'লাভ (Profit)', amount: profitTotal, color: 'orange', icon: TrendingUp },
            { label: 'MFS জমা', amount: mfsOtherTotal, color: 'purple', icon: Wallet },
          ].map((item, i) => (
            <div key={i} className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl", `bg-${item.color}-100`)}>
                  <item.icon className={cn("w-4 h-4", `text-${item.color}-600`)} />
                </div>
                <span className="text-xs font-bold text-slate-600">{item.label}</span>
              </div>
              <span className={cn("font-black", `text-${item.color}-700`)}>{formatCurrency(item.amount)}</span>
            </div>
          ))}

          <div className="mt-6 pt-6 border-t border-dashed border-slate-200 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">সর্বমোট সংগ্রহ</p>
              <p className="text-xs text-slate-500">নির্বাচিত তারিখের জন্য</p>
            </div>
            <span className="text-2xl font-black text-emerald-600 drop-shadow-sm">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AIAnalysisSection({ data }: any) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    const result = await analyzeFinancials(data);
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mt-8 bg-gradient-to-br from-indigo-50 to-blue-50 p-8 rounded-[2.5rem] border border-indigo-100 shadow-inner relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-50" />
      
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-white rounded-2xl shadow-sm">
          <TrendingUp className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-black text-indigo-900 text-lg tracking-tight">এআই আর্থিক বিশ্লেষণ</h3>
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">স্মার্ট ইনসাইটস</p>
        </div>
      </div>
      
      {analysis ? (
        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl border border-white/50 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap shadow-sm">
          {analysis}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-slate-500 text-sm mb-6 font-medium">আপনার সমিতির আর্থিক অবস্থা এআই এর মাধ্যমে বিশ্লেষণ করুন এবং ভবিষ্যৎ পরিকল্পনা গ্রহণ করুন।</p>
          <button 
            onClick={handleAnalyze}
            disabled={loading}
            className="group relative bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-200 flex items-center gap-2 mx-auto"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                বিশ্লেষণ করা হচ্ছে...
              </>
            ) : (
              <>
                বিশ্লেষণ শুরু করুন
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      )}
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
    if (b.memberId && mergedMap.has(b.memberId)) {
      const existing = mergedMap.get(b.memberId);
      existing.type = 'সদস্য+ঋনগ্রহীতা';
    } else {
      const existingMember = Array.from(mergedMap.values()).find(m => m.name === b.name && m.phone === b.phone);
      if (existingMember) {
        existingMember.type = 'সদস্য+ঋনগ্রহীতা';
      } else {
        mergedMap.set(`b_${b.id}`, { ...b, type: 'ঋণগ্রহীতা' });
      }
    }
  });

  const allNames = Array.from(mergedMap.values()).filter(item => 
    item.name && item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="সদস্য ও ঋণগ্রহীতা তালিকা" onBack={onBack} goHome={goHome} />
      
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="নাম খুঁজুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 focus:border-blue-500 focus:outline-none shadow-sm"
        />
      </div>

      <div className="space-y-3">
        {allNames.map((item, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                {idx + 1}
              </div>
              <div>
                <p className="font-bold text-slate-800">{item.name}</p>
                <p className="text-xs text-slate-500">পিতা: {item.fatherName}</p>
              </div>
            </div>
            <span className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap",
              item.type === 'সদস্য' ? "bg-purple-100 text-purple-600" : 
              item.type === 'ঋণগ্রহীতা' ? "bg-orange-100 text-orange-600" : 
              "bg-blue-100 text-blue-600"
            )}>
              {item.type}
            </span>
          </div>
        ))}
        {allNames.length === 0 && (
          <div className="text-center py-12 text-slate-400 font-medium">কোন নাম পাওয়া যায়নি</div>
        )}
      </div>
    </div>
  );
}

function MfsPage({ onBack, goHome, isTransactionAllowed }: any) {
  const mfsTransactions = useLiveQuery(() => db.mfsTransactions.orderBy('date').reverse().toArray()) || [];
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
    <div className="p-4 max-w-lg mx-auto">
      <PageHeader title="বিকাশ/নগদ জমা" onBack={onBack} goHome={goHome} />
      
      <div className="grid grid-cols-3 gap-2 mb-6">
        {['bKash', 'Nagad', 'Rocket'].map((source: any) => (
          <div key={source} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
            <p className="text-[10px] text-slate-400 mb-1">{source}</p>
            <p className="text-sm font-bold text-pink-600">{formatCurrency(totalsBySource[source] || 0)}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {mfsTransactions.map(t => (
          <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs",
                t.source === 'bKash' ? "bg-pink-500" : t.source === 'Nagad' ? "bg-orange-500" : "bg-purple-600"
              )}>
                {t.source[0]}
              </div>
              <div>
                <h3 className="font-bold flex items-center gap-2">
                  {t.source}
                  {t.type && t.type !== 'other' && (
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[8px] font-bold",
                      t.type === 'subscription' ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"
                    )}>
                      {t.type === 'subscription' ? 'চাঁদা' : 'লাভ'}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500">{formatBengaliDate(t.date)}</p>
                {t.payerName && <p className="text-[10px] text-slate-600 font-medium">প্রদানকারী: {t.payerName}</p>}
                {t.transactionId && <p className="text-[10px] text-slate-400">TrxID: {t.transactionId}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-lg font-bold text-emerald-600">+{formatCurrency(t.amount)}</p>
              <button 
                onClick={() => setTransactionToDelete(t)}
                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {mfsTransactions.length === 0 && (
          <div className="text-center py-12 text-slate-400">কোন লেনদেন পাওয়া যায়নি</div>
        )}
      </div>

      <button 
        onClick={() => setShowAdd(true)}
        disabled={!isAllowed}
        className={cn(
          "fixed bottom-8 right-8 w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all",
          isAllowed ? "bg-pink-600 text-white hover:bg-pink-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"
        )}
      >
        <Plus className="w-8 h-8" />
      </button>

      {showAdd && <AddMfsModal onClose={() => setShowAdd(false)} isTransactionAllowed={isTransactionAllowed} />}
      {transactionToDelete && <DeleteConfirmationModal onConfirm={handleDelete} onClose={() => setTransactionToDelete(null)} />}
    </div>
  );
}

function AddMfsModal({ onClose, isTransactionAllowed, initialData }: any) {
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const meetingDay = dbSettings.find(s => s.key === 'meeting_day')?.value || 1;
  const penaltyAmount = dbSettings.find(s => s.key === 'penalty_amount')?.value || 200;
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const borrowers = useLiveQuery(() => db.borrowers.toArray()) || [];
  const payments = useLiveQuery(() => db.payments.toArray()) || [];
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray()) || [];
  const isAllowed = isTransactionAllowed ? isTransactionAllowed() : true;

  const [formData, setFormData] = useState({
    source: 'bKash' as 'bKash' | 'Nagad' | 'Rocket',
    amount: initialData?.amount || '',
    date: new Date().toISOString().split('T')[0],
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
      const borrower = borrowers.find(b => b.id === Number(formData.payerId));
      if (borrower) {
        const bPayments = payments.filter(p => p && p.borrowerId === borrower.id);
        const isPaid = bPayments.some(p => p.type === 'profit' && p.month === Number(formData.month) && p.year === Number(formData.year));
        
        if (isPaid) {
          setFormData(prev => ({ ...prev, amount: 'পরিশোধ' }));
        } else {
          const loanData = calculateLoan(borrower.loanAmount, borrower.loanDate, bPayments, borrower.customProfit);
          setFormData(prev => ({ ...prev, amount: loanData.monthlyProfit.toString() }));
        }
      }
    } else if (formData.type === 'subscription' && formData.payerId) {
      const member = members.find(m => m.id === Number(formData.payerId));
      if (member) {
        const isPaid = subscriptions.some(s => s.memberId === member.id && s.month === Number(formData.month) && s.year === Number(formData.year));
        
        if (isPaid) {
          setFormData(prev => ({ ...prev, amount: 'পরিশোধ' }));
        } else {
          setFormData(prev => ({ ...prev, amount: '1000' }));
        }
      }
    }
  }, [formData.type, formData.payerId, formData.month, formData.year, borrowers, payments, subscriptions, members]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowed) {
      alert('লেনদেনের সময় শেষ হয়ে গেছে!');
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
      await db.transaction('rw', [db.subscriptions, db.payments, db.mfsTransactions], async () => {
        if (formData.type === 'subscription' && formData.payerId) {
          const member = members.find(m => m.id === Number(formData.payerId));
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
            }
          }
        } else if (formData.type === 'profit' && formData.payerId) {
          const borrower = borrowers.find(b => b.id === Number(formData.payerId));
          if (borrower) {
            payerName = borrower.name;
            const bPayments = payments.filter(p => p && p.borrowerId === borrower.id);
            const loanData = calculateLoan(borrower.loanAmount, borrower.loanDate, bPayments, borrower.customProfit);
            
            await db.payments.add({
              borrowerId: borrower.id!,
              amount: amount,
              date: formData.date,
              type: 'profit',
              month: Number(formData.month),
              year: Number(formData.year),
              remainingBalance: loanData.remainingBalance
            });
          }
        }

        // Add MFS transaction record
        await db.mfsTransactions.add({
          source: formData.source,
          amount: amount,
          date: formData.date,
          transactionId: formData.transactionId,
          notes: formData.notes,
          type: formData.type,
          payerName: payerName
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
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">MFS জমা যোগ করুন</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            {['bKash', 'Nagad', 'Rocket'].map((s: any) => (
              <button 
                key={s}
                type="button"
                onClick={() => setFormData({...formData, source: s})}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                  formData.source === s ? "bg-white shadow-sm text-pink-600" : "text-slate-500"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 ml-1">জমার ধরণ</p>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              <button 
                type="button"
                onClick={() => setFormData({...formData, type: 'subscription', payerId: ''})}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", formData.type === 'subscription' ? "bg-white shadow-sm text-emerald-600" : "text-slate-500")}
              >
                চাঁদা
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, type: 'profit', payerId: ''})}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", formData.type === 'profit' ? "bg-white shadow-sm text-orange-600" : "text-slate-500")}
              >
                লাভ
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, type: 'other', payerId: ''})}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", formData.type === 'other' ? "bg-white shadow-sm text-slate-600" : "text-slate-500")}
              >
                অন্যান্য
              </button>
            </div>
          </div>

          {formData.type !== 'other' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 ml-1">
                {formData.type === 'subscription' ? 'সদস্য নির্বাচন করুন' : 'ঋণগ্রহীতা নির্বাচন করুন'}
              </p>
              <select 
                required
                value={formData.payerId}
                onChange={e => setFormData({...formData, payerId: e.target.value})}
                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-pink-500"
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
                <p className="text-xs font-bold text-slate-500 ml-1">মাস</p>
                <select 
                  value={formData.month}
                  onChange={e => setFormData({...formData, month: Number(e.target.value)})}
                  className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-pink-500"
                >
                  {Array.from({length: 12}).map((_, i) => (
                    <option key={i} value={i}>
                      {new Intl.DateTimeFormat('bn-BD', { month: 'long' }).format(new Date(2024, i))}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 ml-1">বছর</p>
                <select 
                  value={formData.year}
                  onChange={e => setFormData({...formData, year: Number(e.target.value)})}
                  className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-pink-500"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
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
              "w-full p-4 bg-slate-50 rounded-xl border border-slate-200",
              formData.type !== 'other' && "bg-slate-100 cursor-not-allowed font-bold text-pink-600"
            )} 
          />
          <input required readOnly type="date" value={formData.date} className="w-full p-4 bg-slate-100 rounded-xl border border-slate-200 cursor-not-allowed" />
          <input required placeholder="ট্রানজেকশন আইডি (বাধ্যতামূলক)" value={formData.transactionId} onChange={e => setFormData({...formData, transactionId: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200" />
          
          {formData.type === 'subscription' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 ml-1">জরিমানা টাকার পরিমাণ</p>
              <select 
                value={formData.penaltyAmount} 
                onChange={e => setFormData({...formData, penaltyAmount: e.target.value})}
                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="0">কোনো জরিমানা নেই</option>
                <option value={penaltyAmount}>৳ {penaltyAmount.toLocaleString('bn-BD')}</option>
                <option value={penaltyAmount * 2}>৳ {(penaltyAmount * 2).toLocaleString('bn-BD')}</option>
                <option value={penaltyAmount * 3}>৳ {(penaltyAmount * 3).toLocaleString('bn-BD')}</option>
              </select>
            </div>
          )}

          <textarea placeholder="নোট" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200" />
          
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4">বাতিল</button>
            <button type="submit" className="flex-1 py-4 bg-pink-600 text-white rounded-xl font-bold">জমা করুন</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

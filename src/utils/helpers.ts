import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatBengaliNumber = (num: number | string) => {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
};

export const bengaliToEnglishNumber = (str: string) => {
  const bengaliToEnglishMap: { [key: string]: string } = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return str.replace(/[০-৯]/g, match => bengaliToEnglishMap[match]);
};

export const transliterateBengali = (text: string) => {
  if (!text) return "";
  const mapping: { [key: string]: string } = {
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'y', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n',
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou', '্': '',
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };

  // Common UI words translation to Banglish
  const translations: { [key: string]: string } = {
    'সদস্যর নাম': 'Sodossyo Name',
    'পিতার নাম': 'Pitar Name',
    'সদস্য আইডি': 'Sodossyo ID',
    'মাস': 'Mash',
    'তারিখ': 'Tarikh',
    'টাকার পরিমাণ': 'Takar Poriman',
    'জরিমানা': 'Jorimana',
    'বকেয়া': 'Bokeya',
    'লাভ': 'Labh',
    'কিস্তি': 'Kisti',
    'সদস্য': 'Sodossyo',
    'ঋণগ্রহীতা': 'Rin-grohita',
    'টাকা': 'Taka',
    'সংরক্ষণ': 'Songrokkon',
    'বিবরণী': 'Biboroni',
    'সফলভাবে': 'Sofol bhabe',
    'সম্পন্ন': 'Somponno',
    'ইতিহাস': 'Itihas',
    'আবেদন': 'Abedon',
    'অনুমোদিত': 'Onumodito',
    'বাতিল': 'Batil',
    'জমা': 'Joma',
    'খরচ': 'Khoroch',
    'আয়': 'Ay',
    'উত্তোলন': 'Uttolon',
    'সঞ্চয়': 'Sanchoy',
    'চাঁদা': 'Chada',
    'আসল': 'Asol'
  };

  if (translations[text]) return translations[text];

  let result = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    result += mapping[char] || char;
  }
  
  // Basic cleanup for redundant vowels and capitalization
  return result.charAt(0).toUpperCase() + result.slice(1);
};

export const formatBengaliDate = (date: string | Date) => {
  try {
    let d: Date;
    if (typeof date === 'string' && date.includes('-')) {
      const [year, month, day] = date.split('-').map(Number);
      d = new Date(year, month - 1, day);
    } else {
      d = new Date(date);
    }
    
    if (isNaN(d.getTime())) return 'Unknown Date';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (e) {
    return 'Unknown Date';
  }
};

export const formatMeetingDate = (day: number) => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), day);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const getMeetingDateISO = (day: number) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  return `${year}-${month}-${dayStr}T00:00:00.000Z`;
};

export const getTodayDate = () => {
  const now = new Date(new Date().getTime() + (6 * 60 * 60 * 1000));
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalISOString = () => {
  const now = new Date(new Date().getTime() + (6 * 60 * 60 * 1000));
  return now.toISOString();
};

export const generateMessage = (type: 'subscription' | 'profit', name: string, amount: number) => {
  const text = type === 'subscription' 
    ? `Dear ${name}, your monthly subscription of ${amount} Taka has been received. Thank you.`
    : `Dear ${name}, your dividend of ${amount} Taka has been paid. Thank you.`;
  
  return encodeURIComponent(text);
};

export const calculateLoan = (amount: number, date: string, payments: any[] = [], customProfit?: number, profitPercentage: number = 0.05, compoundPercentage: number = 0.10, notes?: string) => {
  if (!date) return { loanAmount: amount, currentPrincipal: amount, monthlyProfit: 0, penalty: 0, remainingPrincipal: amount, totalProfit: 0, totalCompoundPaid: 0, totalPayable: amount, remainingBalance: amount, isLoanMonth: true, dueInstallment: 0 };

  const [year, month, day] = date.split('-').map(Number);
  const loanDate = new Date(year, month - 1, day);
  const now = new Date();
  
  let iterDate = new Date(year, month, 1);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const isInstallment = notes && notes.includes('FIXED_INSTALLMENT');
  
  if (isInstallment) {
    let monthsMatch = notes.match(/Months:\s*(\d+)/);
    const totalMonths = monthsMatch ? parseInt(monthsMatch[1], 10) : 1;
    const fixedMonthlyPrincipal = amount / totalMonths;

    let unpaidProfitArrear = 0;
    let unpaidPrincipalArrear = 0;
    
    let currentPrincipal = amount;
    
    let totalProfitAccrued = 0;
    let totalCompoundPaid = 0;
    let scheduledMonthsPassed = 0;
    let lastPenalty = 0;

    let currentDynamicBaseInstallment = fixedMonthlyPrincipal + (amount * profitPercentage);
    let currentDynamicProfit = amount * profitPercentage;
    
    while (iterDate <= currentMonthStart) {
      const m = iterDate.getMonth();
      const y = iterDate.getFullYear();
      
      const monthPayments = Array.isArray(payments) ? payments.filter(p => {
        if (p.month !== undefined && p.year !== undefined) {
          return p.month === m && p.year === y;
        }
        const pd = new Date(p.date);
        return pd.getMonth() === m && pd.getFullYear() === y;
      }) : [];
      const totalPaidInMonth = monthPayments.reduce((sum, p) => sum + p.amount, 0);

      // Penalty is 10% on unpaid profit from previous months
      const penalty = unpaidProfitArrear * compoundPercentage;
      lastPenalty = penalty;
      
      let currentMonthPrincipalDemand = 0;
      let currentMonthProfitDemand = 0;

      if (scheduledMonthsPassed < totalMonths) {
        currentMonthPrincipalDemand = fixedMonthlyPrincipal;
        currentMonthProfitDemand = currentPrincipal * profitPercentage;
        
        currentDynamicBaseInstallment = currentMonthPrincipalDemand + currentMonthProfitDemand;
        currentDynamicProfit = currentMonthProfitDemand;
      }

      // Total expected this month
      let totalPrincipalDueThisMonth = unpaidPrincipalArrear + currentMonthPrincipalDemand;
      let totalProfitDueThisMonth = unpaidProfitArrear + penalty + currentMonthProfitDemand;
      
      totalProfitAccrued += currentMonthProfitDemand + penalty;

      let remainingPayment = totalPaidInMonth;
      
      // Deduct profit first
      if (remainingPayment >= totalProfitDueThisMonth) {
         remainingPayment -= totalProfitDueThisMonth;
         unpaidProfitArrear = 0;
         totalCompoundPaid += penalty;
      } else {
         if (remainingPayment > currentMonthProfitDemand) {
           totalCompoundPaid += (remainingPayment - currentMonthProfitDemand);
         }
         unpaidProfitArrear = totalProfitDueThisMonth - remainingPayment;
         remainingPayment = 0;
      }

      // Then deduct principal
      if (remainingPayment >= totalPrincipalDueThisMonth) {
         remainingPayment -= totalPrincipalDueThisMonth;
         unpaidPrincipalArrear = 0;
      } else {
         unpaidPrincipalArrear = totalPrincipalDueThisMonth - remainingPayment;
      }

      // Actual principal paid this month
      const principalPaidThisMonth = totalPrincipalDueThisMonth - unpaidPrincipalArrear + remainingPayment; 
      currentPrincipal = Math.max(0, currentPrincipal - principalPaidThisMonth);

      scheduledMonthsPassed++;
      iterDate.setMonth(iterDate.getMonth() + 1);
    }

    const outstandingArrears = unpaidPrincipalArrear + unpaidProfitArrear;
    
    return {
      loanAmount: amount,
      remainingPrincipal: Math.round(currentPrincipal),
      currentPrincipal: Math.round(currentPrincipal),
      monthlyProfit: Math.round(currentDynamicProfit),
      totalProfit: Math.round(totalProfitAccrued),
      totalCompoundPaid: Math.round(totalCompoundPaid),
      totalPayable: Math.round(amount + totalProfitAccrued),
      remainingBalance: Math.round(currentPrincipal + unpaidProfitArrear), // Total remaining to close the loan
      dueInstallment: Math.round(outstandingArrears),
      penaltyAmount: Math.round(lastPenalty),
      baseInstallmentAmount: Math.round(currentDynamicBaseInstallment),
      profitType: unpaidProfitArrear > currentDynamicProfit ? 'penalty' : 'regular',
      lastMonthWasPaid: unpaidProfitArrear <= currentDynamicProfit,
      isLoanMonth: now.getFullYear() === loanDate.getFullYear() && now.getMonth() === loanDate.getMonth()
    };
  }

  let remainingPrincipal = amount || 0;
  let totalProfitAccrued = 0;
  let totalCompoundPaid = 0;
  let lastMonthWasPaid = true; 
  
  while (iterDate <= currentMonthStart) {
    const m = iterDate.getMonth();
    const y = iterDate.getFullYear();
    
    // Monthly Profit Check - penalty is 10% (compoundPercentage) if last month missed, otherwise profitPercentage
    const baseInterest = remainingPrincipal * profitPercentage;
    const compoundInterest = lastMonthWasPaid ? 0 : remainingPrincipal * (compoundPercentage - profitPercentage);
    const rate = lastMonthWasPaid ? profitPercentage : compoundPercentage;
    const monthlyInterest = remainingPrincipal * rate;
    
    const monthPayments = Array.isArray(payments) ? payments.filter(p => {
      if (p.month !== undefined && p.year !== undefined) {
        return p.month === m && p.year === y;
      }
      const pd = new Date(p.date);
      return pd.getMonth() === m && pd.getFullYear() === y;
    }) : [];

    const totalPaidInMonth = monthPayments.reduce((sum, p) => sum + p.amount, 0);

    if (totalPaidInMonth > 0) {
      if (totalPaidInMonth >= monthlyInterest) {
        totalProfitAccrued += monthlyInterest;
        totalCompoundPaid += compoundInterest;
        remainingPrincipal -= (totalPaidInMonth - monthlyInterest);
        lastMonthWasPaid = true;
      } else {
        totalProfitAccrued += totalPaidInMonth;
        if (totalPaidInMonth > baseInterest) {
          totalCompoundPaid += (totalPaidInMonth - baseInterest);
        }
        lastMonthWasPaid = false;
      }
    } else {
      lastMonthWasPaid = false;
    }
    
    iterDate.setMonth(iterDate.getMonth() + 1);
  }

  const isLoanMonth = now.getFullYear() === loanDate.getFullYear() && now.getMonth() === loanDate.getMonth();
  const currentMonthlyProfit = remainingPrincipal * (lastMonthWasPaid ? profitPercentage : compoundPercentage);

  const totalPaid = Array.isArray(payments) ? payments.reduce((sum, p) => sum + p.amount, 0) : 0;
  const finalProfit = customProfit !== undefined ? customProfit : totalProfitAccrued;

  return {
    loanAmount: amount,
    remainingPrincipal: Math.max(0, Math.round(remainingPrincipal)),
    currentPrincipal: Math.round(remainingPrincipal), // For backward compatibility
    monthlyProfit: Math.round(currentMonthlyProfit),
    totalProfit: Math.round(finalProfit),
    totalCompoundPaid: Math.round(totalCompoundPaid),
    totalPayable: Math.round(remainingPrincipal + finalProfit),
    remainingBalance: Math.round(remainingPrincipal + finalProfit - totalPaid), // Approximate
    dueInstallment: Math.round(currentMonthlyProfit), // Default due is just the monthly interest
    penaltyAmount: lastMonthWasPaid ? 0 : Math.round(remainingPrincipal * (compoundPercentage - profitPercentage)),
    profitType: lastMonthWasPaid ? 'regular' : 'penalty',
    lastMonthWasPaid,
    isLoanMonth
  };
};

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

export const formatBengaliDate = (date: string | Date) => {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'অজানা তারিখ';
    return d.toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (e) {
    return 'অজানা তারিখ';
  }
};

export const formatMeetingDate = (day: number) => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), day);
  return date.toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const getMeetingDateISO = (day: number) => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), day);
  return date.toISOString();
};

export const generateMessage = (type: 'subscription' | 'profit', name: string, amount: number) => {
  const text = type === 'subscription' 
    ? `সম্মানিত ${name}, আপনার এই মাসের সঞ্চয় চাঁদা ${amount} টাকা জমা হয়েছে। ধন্যবাদ।`
    : `সম্মানিত ${name}, আপনার লভ্যাংশ বাবদ ${amount} টাকা প্রদান করা হয়েছে। ধন্যবাদ।`;
  
  return encodeURIComponent(text);
};

export const calculateLoan = (amount: number, date: string, payments: any[] = [], customProfit?: number) => {
  const loanDate = new Date(date);
  const now = new Date();
  
  let currentPrincipal = amount || 0;
  let totalCalculatedProfit = 0;
  
  if (isNaN(loanDate.getTime())) {
    return {
      loanAmount: amount || 0,
      currentPrincipal: amount || 0,
      monthlyProfit: 0,
      totalProfit: customProfit || 0,
      totalPayable: amount || 0,
      remainingBalance: amount || 0
    };
  }
  
  // Start from the month AFTER loanDate
  let checkDate = new Date(loanDate);
  checkDate.setMonth(checkDate.getMonth() + 1);
  checkDate.setDate(1); // Start of month
  
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const isLoanMonth = now.getMonth() === loanDate.getMonth() && now.getFullYear() === loanDate.getFullYear();

  while (checkDate <= currentMonthStart) {
    const month = checkDate.getMonth();
    const year = checkDate.getFullYear();
    
    // Check if there's a payment in this month
    const monthPayments = Array.isArray(payments) ? payments.filter(p => {
      const pDate = new Date(p.date);
      return pDate.getMonth() === month && pDate.getFullYear() === year;
    }) : [];
    
    const profitPaidInMonth = monthPayments
      .filter(p => p && (p.type === 'profit' || !p.type)) // Default to profit if type missing
      .reduce((sum, p) => sum + p.amount, 0);
      
    const principalPaidInMonth = monthPayments
      .filter(p => p && p.type === 'principal')
      .reduce((sum, p) => sum + p.amount, 0);

    const expectedProfit = currentPrincipal * 0.05;
    
    if (profitPaidInMonth >= expectedProfit) {
      // Profit paid
      totalCalculatedProfit += expectedProfit;
      // Any excess profit doesn't reduce principal unless explicitly marked as principal
      currentPrincipal -= principalPaidInMonth;
    } else {
      // Profit not paid -> 10% compound on principal
      currentPrincipal = currentPrincipal * 1.10;
      currentPrincipal -= principalPaidInMonth; // Still reduce by any principal paid
    }
    
    checkDate.setMonth(checkDate.getMonth() + 1);
  }
  
  // Use custom profit if provided, otherwise use calculated
  const finalProfit = customProfit !== undefined ? customProfit : totalCalculatedProfit;
  const totalPayable = currentPrincipal + finalProfit;
  const totalPaid = Array.isArray(payments) ? payments.reduce((sum, p) => sum + p.amount, 0) : (typeof payments === 'number' ? payments : 0);

  return {
    loanAmount: amount,
    currentPrincipal: Math.round(currentPrincipal),
    monthlyProfit: Math.round(currentPrincipal * 0.05),
    totalProfit: Math.round(finalProfit),
    totalPayable: Math.round(totalPayable),
    remainingBalance: Math.round(totalPayable - totalPaid),
    isLoanMonth
  };
};

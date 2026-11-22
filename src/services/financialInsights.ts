// Derived financial insights: upcoming bills/subscriptions and month-end spending forecast
// Pure functions where possible so they are easy to reason about and reuse across screens

import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDaysInMonth,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { Expense, RecurringFrequency, UpcomingBill } from '../types';
import * as db from '../database';

// Advance a date by one recurrence period
export const nextOccurrence = (date: Date, frequency: RecurringFrequency): Date => {
  switch (frequency) {
    case 'daily':
      return addDays(date, 1);
    case 'weekly':
      return addWeeks(date, 1);
    case 'biweekly':
      return addWeeks(date, 2);
    case 'monthly':
      return addMonths(date, 1);
    case 'quarterly':
      return addMonths(date, 3);
    case 'yearly':
      return addYears(date, 1);
    default:
      return addMonths(date, 1);
  }
};

// How many times per month a frequency occurs on average (for normalised monthly cost)
const MONTHLY_FACTOR: Record<RecurringFrequency, number> = {
  daily: 30.44,
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export const toMonthlyCost = (amount: number, frequency: RecurringFrequency): number =>
  amount * (MONTHLY_FACTOR[frequency] ?? 1);

// Strip the "[Recurring]" marker the recurring service prepends to generated notes
const cleanNote = (notes?: string): string => (notes ?? '').replace(/^\[Recurring\]\s*/, '').trim();

/**
 * Build the list of active bills/subscriptions from recurring expenses.
 * Recurring entries are grouped by the same pattern key the recurring service uses,
 * the newest instance of each pattern decides the next due date.
 */
export const deriveUpcomingBills = (recurring: Expense[], today: Date = new Date()): UpcomingBill[] => {
  const base = startOfDay(today);
  const latestByPattern = new Map<string, Expense>();
  for (const e of recurring) {
    if (!e.recurringFrequency) continue;
    const key = `${e.category}_${e.amount}_${e.walletId || ''}_${e.recurringFrequency}`;
    const existing = latestByPattern.get(key);
    if (!existing || e.date > existing.date) latestByPattern.set(key, e);
  }

  const bills: UpcomingBill[] = [];
  for (const [key, e] of latestByPattern) {
    const frequency = e.recurringFrequency as RecurringFrequency;
    // Skip subscriptions that have ended
    if (e.recurringEndDate && isBefore(parseISO(e.recurringEndDate), base)) continue;
    let next = nextOccurrence(parseISO(e.date), frequency);
    // If the app hasn't generated past instances yet, roll forward to the next future date
    let guard = 0;
    while (isBefore(next, base) && guard < 400) {
      next = nextOccurrence(next, frequency);
      guard++;
    }
    if (e.recurringEndDate && isBefore(parseISO(e.recurringEndDate), next)) continue;
    bills.push({
      key,
      name: cleanNote(e.notes) || e.category,
      category: e.category,
      amount: e.amount,
      currency: e.currency,
      frequency,
      nextDate: format(next, 'yyyy-MM-dd'),
      daysUntil: differenceInCalendarDays(next, base),
      monthlyCost: toMonthlyCost(e.amount, frequency),
      walletId: e.walletId,
    });
  }
  return bills.sort((a, b) => a.daysUntil - b.daysUntil);
};

// Load recurring expenses from the database and derive upcoming bills
export const loadUpcomingBills = async (): Promise<UpcomingBill[]> => {
  const recurring = await db.getRecurringExpenses();
  return deriveUpcomingBills(recurring);
};

export interface MonthForecast {
  spentSoFar: number; // Month-to-date spending (all expenses, not just loaded page)
  incomeSoFar: number; // Month-to-date income
  projected: number; // Projected month-end spending at the current daily pace + known upcoming bills
  dailyAverage: number; // Average spend per elapsed day
  daysElapsed: number;
  daysLeft: number; // Days remaining including today
  lastMonthTotal: number; // Previous month's total spend for comparison
  budgetTotal: number; // Sum of monthly budgets this month (0 if none)
  safeToSpendPerDay: number | null; // Remaining (budget or income) divided by days left; null when no reference
}

/**
 * Compute a month-end forecast using database aggregates so it is accurate
 * regardless of how many expenses are loaded in the store.
 */
export const computeMonthForecast = async (
  bills: UpcomingBill[] = [],
  today: Date = new Date(),
): Promise<MonthForecast> => {
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const startStr = format(monthStart, 'yyyy-MM-dd');
  const endStr = format(monthEnd, 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');
  const prevStart = format(startOfMonth(addMonths(today, -1)), 'yyyy-MM-dd');
  const prevEnd = format(endOfMonth(addMonths(today, -1)), 'yyyy-MM-dd');

  const [spentSoFar, incomeSoFar, lastMonthTotal, budgets] = await Promise.all([
    db.getTotalExpenses(startStr, todayStr),
    db.getTotalIncome(startStr, todayStr),
    db.getTotalExpenses(prevStart, prevEnd),
    db.getBudgetsByMonth(today.getMonth() + 1, today.getFullYear()).catch(() => []),
  ]);

  const daysInMonth = getDaysInMonth(today);
  const daysElapsed = today.getDate();
  const daysLeft = daysInMonth - daysElapsed + 1;
  const dailyAverage = daysElapsed > 0 ? spentSoFar / daysElapsed : 0;

  // Known bills still to be charged later this month are added explicitly;
  // the pace-based projection covers discretionary spending for the remaining days.
  const billsRemaining = bills
    .filter((b) => b.nextDate > todayStr && b.nextDate <= endStr)
    .reduce((sum, b) => sum + b.amount, 0);
  const projected = spentSoFar + dailyAverage * (daysInMonth - daysElapsed) + billsRemaining;

  // Overall monthly budget = budgets with period monthly (category-specific ones are summed)
  const budgetTotal = budgets.filter((b) => b.period === 'monthly').reduce((sum, b) => sum + b.amount, 0);
  const reference = budgetTotal > 0 ? budgetTotal : incomeSoFar;
  const safeToSpendPerDay =
    reference > 0 ? Math.max(0, (reference - spentSoFar - billsRemaining) / Math.max(1, daysLeft)) : null;

  return {
    spentSoFar,
    incomeSoFar,
    projected,
    dailyAverage,
    daysElapsed,
    daysLeft,
    lastMonthTotal,
    budgetTotal,
    safeToSpendPerDay,
  };
};

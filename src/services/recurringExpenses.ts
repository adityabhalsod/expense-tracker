// Recurring expense service that auto-generates expense entries
// Checks for due recurring expenses and creates new instances

import { getDatabase } from '../database';
import * as db from '../database';
import { RecurringFrequency } from '../types';
import { addDays, addWeeks, addMonths, addYears, isAfter, isBefore, startOfDay, format } from 'date-fns';

// Calculate the next occurrence date based on frequency
const getNextDate = (currentDate: string, frequency: RecurringFrequency): Date => {
  const date = new Date(currentDate);
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
      return addMonths(date, 1); // Default to monthly
  }
};

// Process all recurring expenses and generate new entries for any that are due
export const processRecurringExpenses = async (): Promise<number> => {
  const database = await getDatabase();
  const today = startOfDay(new Date());
  let generatedCount = 0;

  // Find all active recurring expenses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recurringExpenses = await database.getAllAsync<any>(
    `SELECT * FROM expenses WHERE isRecurring = 1 AND recurringFrequency IS NOT NULL
     ORDER BY date DESC`
  );

  // Group by category + amount + walletId to find the most recent instance of each recurring pattern
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patterns = new Map<string, any>();
  for (const expense of recurringExpenses) {
    const key = `${expense.category}_${expense.amount}_${expense.walletId || ''}_${expense.recurringFrequency}`;
    if (!patterns.has(key)) {
      patterns.set(key, expense);
    }
  }

  // For each recurring pattern, generate any missing entries up to today
  for (const [, latestExpense] of patterns) {
    // Skip if recurring end date has passed
    if (latestExpense.recurringEndDate && isBefore(new Date(latestExpense.recurringEndDate), today)) {
      continue;
    }

    let nextDate = getNextDate(latestExpense.date, latestExpense.recurringFrequency);

    // Generate entries for all missed dates up to today (max 12 to prevent flooding)
    let safetyCounter = 0;
    while (!isAfter(startOfDay(nextDate), today) && safetyCounter < 12) {
      // Check if an entry already exists for this date and pattern
      const existing = await database.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM expenses
         WHERE category = ? AND amount = ? AND date = ? AND isRecurring = 1`,
        [latestExpense.category, latestExpense.amount, format(nextDate, 'yyyy-MM-dd')]
      );

      if (!existing || existing.count === 0) {
        // Create the recurring expense entry
        await db.addExpense({
          amount: latestExpense.amount,
          category: latestExpense.category,
          subcategory: latestExpense.subcategory || undefined,
          date: format(nextDate, 'yyyy-MM-dd'),
          notes: latestExpense.notes ? `[Recurring] ${latestExpense.notes}` : '[Recurring]',
          tags: typeof latestExpense.tags === 'string' ? JSON.parse(latestExpense.tags) : latestExpense.tags || [],
          currency: latestExpense.currency,
          isRecurring: true,
          recurringFrequency: latestExpense.recurringFrequency,
          recurringEndDate: latestExpense.recurringEndDate || undefined,
          walletId: latestExpense.walletId,
        });
        generatedCount++;
      }

      nextDate = getNextDate(format(nextDate, 'yyyy-MM-dd'), latestExpense.recurringFrequency);
      safetyCounter++;
    }
  }

  return generatedCount;
};

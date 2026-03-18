// Budget notification service using expo-notifications
// Sends alerts when spending approaches or exceeds budget limits
// Supports daily, weekly, monthly, quarterly, yearly budgets and wallet-specific tracking
// Uses dynamic import to avoid loading expo-notifications in Expo Go (crashes since SDK 53)

import Constants from 'expo-constants';
import { getDatabase } from '../database';
import { Budget, Category } from '../types';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format } from 'date-fns';

// Expo Go does not support push notifications since SDK 53 — avoid importing the module entirely
const isExpoGo = Constants.appOwnership === 'expo';

// Lazily load expo-notifications only in development builds / standalone apps
let _notifications: typeof import('expo-notifications') | null = null;
const getNotifications = async () => {
  if (isExpoGo) return null;
  if (!_notifications) {
    _notifications = await import('expo-notifications');
    // Configure foreground notification display after first load
    _notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return _notifications;
};

// Request notification permissions from the user
export const requestNotificationPermissions = async (): Promise<boolean> => {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
};

// Calculate the date range for a budget period based on the current date
const getDateRangeForPeriod = (period: string): { startDate: string; endDate: string } => {
  const now = new Date();
  switch (period) {
    case 'daily':
      // Today only
      const todayStr = format(now, 'yyyy-MM-dd');
      return { startDate: todayStr, endDate: todayStr };
    case 'weekly':
      return {
        startDate: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'quarterly':
      return {
        startDate: format(startOfQuarter(now), 'yyyy-MM-dd'),
        endDate: format(endOfQuarter(now), 'yyyy-MM-dd'),
      };
    case 'yearly':
      return {
        startDate: format(startOfYear(now), 'yyyy-MM-dd'),
        endDate: format(endOfYear(now), 'yyyy-MM-dd'),
      };
    case 'monthly':
    default: {
      // Default to current month range
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { startDate: start, endDate: end };
    }
  }
};

// Check all budgets and send notifications for any that exceed their threshold
export const checkBudgetNotifications = async (): Promise<void> => {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  const database = await getDatabase();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Get all budgets for the current month
  const budgets = await database.getAllAsync<Budget>(
    'SELECT * FROM budgets WHERE month = ? AND year = ?',
    [month, year]
  );

  if (budgets.length === 0) return;

  // Get all categories for name lookup
  const categories = await database.getAllAsync<Category>(
    'SELECT * FROM categories ORDER BY "order" ASC'
  );
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  for (const budget of budgets) {
    if (!budget.categoryId) continue;

    const category = categoryMap.get(budget.categoryId);
    if (!category) continue;

    // Get the date range based on the budget's period type
    const { startDate, endDate } = getDateRangeForPeriod(budget.period);

    // Build query with optional wallet filter
    let query = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
       WHERE category = ? AND date >= ? AND date <= ?`;
    const params: any[] = [category.name, startDate, endDate];

    // Filter by wallet if budget is wallet-specific
    if (budget.walletId) {
      query += ' AND walletId = ?';
      params.push(budget.walletId);
    }

    // Calculate spending for this budget's category and period
    const result = await database.getFirstAsync<{ total: number }>(query, params);

    const spent = result?.total || 0;
    const percentage = (spent / budget.amount) * 100;
    const threshold = budget.notifyAt || 80;

    // Send warning notification when spending is between threshold and 100%
    if (percentage >= threshold && percentage < 100) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Budget Alert: ${category.name}`,
          body: `You've spent ${Math.round(percentage)}% of your ${category.name} budget. Consider slowing down.`,
          data: { budgetId: budget.id, categoryId: budget.categoryId },
        },
        trigger: null, // Send immediately
      });
    } else if (percentage >= 100) {
      // Send exceeded notification when budget is fully consumed
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Budget Exceeded: ${category.name}`,
          body: `You've exceeded your ${category.name} budget by ${Math.round(percentage - 100)}%!`,
          data: { budgetId: budget.id, categoryId: budget.categoryId },
        },
        trigger: null,
      });
    }
  }
};

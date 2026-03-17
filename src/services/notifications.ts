// Budget notification service using expo-notifications
// Sends alerts when spending approaches or exceeds budget limits
// Uses dynamic import to avoid loading expo-notifications in Expo Go (crashes since SDK 53)

import Constants from 'expo-constants';
import { getDatabase } from '../database';
import { Budget, Category } from '../types';

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

  // Build date range for current month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  for (const budget of budgets) {
    if (!budget.categoryId) continue;

    const category = categoryMap.get(budget.categoryId);
    if (!category) continue;

    // Calculate spending for this budget's category
    const result = await database.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
       WHERE category = ? AND date >= ? AND date <= ?`,
      [category.name, startDate, endDate]
    );

    const spent = result?.total || 0;
    const percentage = (spent / budget.amount) * 100;
    const threshold = budget.notifyAt || 80;

    // Send notification if spending exceeds the budget's alert threshold
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

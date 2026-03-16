// Budget notification service using expo-notifications
// Sends alerts when spending approaches or exceeds budget limits

import * as Notifications from 'expo-notifications';
import { getDatabase } from '../database';
import { Budget, Category } from '../types';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Request notification permissions from the user
export const requestNotificationPermissions = async (): Promise<boolean> => {
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

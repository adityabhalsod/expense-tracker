// Utility to push fresh data to the Android home-screen widget
// Called after any financial mutation (add/edit/delete expense, income, transfer)
'use no memo';

import React from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { ExpenseTrackerWidget } from './ExpenseTrackerWidget';
import * as db from '../database';
import { CURRENCIES } from '../constants';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key matching the main Zustand store's settings persistence
const SETTINGS_KEY = '@expense_tracker_settings';

// Resolve the user's preferred currency symbol from saved settings
async function getCurrencySymbol(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const settings = JSON.parse(raw);
      const currency = CURRENCIES.find((c) => c.code === settings.defaultCurrency);
      if (currency) return currency.symbol;
    }
  } catch {
    // Default to ₹ on error
  }
  return '₹';
}

// Format a number with Indian-style grouping for widget display
function formatWidgetAmount(amount: number): string {
  if (amount % 1 === 0) {
    return amount.toLocaleString('en-IN');
  }
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Push an updated widget render to Android — no-op on iOS
export async function refreshWidget(): Promise<void> {
  // Widgets are Android-only; skip on other platforms
  if (Platform.OS !== 'android') return;

  try {
    // Fetch latest wallet balances and recent expenses from SQLite
    const wallets = await db.getAllWallets();
    const totalBalance = wallets.reduce((sum, w) => sum + w.currentBalance, 0);
    const expenses = await db.getAllExpenses(5);
    const currencySymbol = await getCurrencySymbol();

    // Map expenses to the compact format the widget expects
    const recentExpenses = expenses.map((e) => ({
      id: e.id,
      category: e.category,
      amount: formatWidgetAmount(e.amount),
      date: format(new Date(e.date), 'dd MMM'),
      icon: e.category,
    }));

    // Ask the system to re-render every instance of the ExpenseTracker widget
    await requestWidgetUpdate({
      widgetName: 'ExpenseTracker',
      // Render both theme variants — Android selects based on system appearance
      renderWidget: (info) => ({
        light: (
          <ExpenseTrackerWidget
            balance={formatWidgetAmount(totalBalance)}
            currencySymbol={currencySymbol}
            recentExpenses={recentExpenses}
            isDark={false}
            widgetWidth={info.width}
            widgetHeight={info.height}
          />
        ),
        dark: (
          <ExpenseTrackerWidget
            balance={formatWidgetAmount(totalBalance)}
            currencySymbol={currencySymbol}
            recentExpenses={recentExpenses}
            isDark={true}
            widgetWidth={info.width}
            widgetHeight={info.height}
          />
        ),
      }),
      widgetNotFound: () => {
        // No widget placed on home screen — nothing to update
      },
    });
  } catch (e) {
    // Log widget update failures for debugging — widget is non-critical
    console.warn('refreshWidget failed:', e);
  }
}

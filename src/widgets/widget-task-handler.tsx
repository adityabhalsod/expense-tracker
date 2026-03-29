// Widget task handler — runs in a background JS context when Android triggers a widget event
// Fetches live data from the SQLite database and renders the widget with fresh content

import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { ExpenseTrackerWidget } from './ExpenseTrackerWidget';
import * as db from '../database';
import { CURRENCIES } from '../constants';
import { Appearance } from 'react-native';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage key matching the one used in the main Zustand store
const SETTINGS_KEY = '@expense_tracker_settings';

// Map widget names to their component — only one widget for now
const nameToWidget = {
  ExpenseTracker: ExpenseTrackerWidget,
};

// Fetch the user's saved currency symbol from AsyncStorage settings
async function getCurrencySymbol(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const settings = JSON.parse(raw);
      // Look up the symbol for the user's selected currency code
      const currency = CURRENCIES.find((c) => c.code === settings.defaultCurrency);
      if (currency) return currency.symbol;
    }
  } catch {
    // Fall through to default on any parse error
  }
  // Default to Indian Rupee symbol
  return '₹';
}

// Detect whether the device is currently in dark mode
function getIsDark(): boolean {
  return Appearance.getColorScheme() === 'dark';
}

// Format a numeric amount for widget display (compact, no decimals for whole numbers)
function formatWidgetAmount(amount: number): string {
  // Show decimals only if the amount has a fractional part
  if (amount % 1 === 0) {
    return amount.toLocaleString('en-IN');
  }
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Fetch all data needed by the widget from SQLite + AsyncStorage
async function getWidgetData() {
  // Load wallets to compute total balance
  const wallets = await db.getAllWallets();
  // Sum up current balances across all wallets
  const totalBalance = wallets.reduce((sum, w) => sum + w.currentBalance, 0);

  // Load the 5 most recent expenses for the list view
  const expenses = await db.getAllExpenses(5);

  // Resolve the user's currency symbol
  const currencySymbol = await getCurrencySymbol();

  // Detect dark mode from device appearance
  const isDark = getIsDark();

  // Map raw expense records to the compact widget display format
  const recentExpenses = expenses.map((e) => ({
    id: e.id,
    category: e.category,
    amount: formatWidgetAmount(e.amount),
    date: format(new Date(e.date), 'dd MMM'), // Short date like "29 Mar"
    icon: e.category, // Category name doubles as icon identifier
  }));

  return {
    balance: formatWidgetAmount(totalBalance),
    currencySymbol,
    recentExpenses,
    isDark,
  };
}

// Main handler invoked by the Android widget system for every widget lifecycle event
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget = nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

  // Bail if the widget name doesn't match any registered widget
  if (!Widget) return;

  switch (props.widgetAction) {
    // Widget first placed on home screen — render with fresh data
    case 'WIDGET_ADDED': {
      const data = await getWidgetData();
      props.renderWidget(<Widget {...data} />);
      break;
    }

    // Periodic update triggered by updatePeriodMillis — refresh data
    case 'WIDGET_UPDATE': {
      const data = await getWidgetData();
      props.renderWidget(<Widget {...data} />);
      break;
    }

    // Widget resized by user — re-render at new dimensions
    case 'WIDGET_RESIZED': {
      const data = await getWidgetData();
      props.renderWidget(<Widget {...data} />);
      break;
    }

    // Widget removed from home screen — no cleanup needed
    case 'WIDGET_DELETED':
      break;

    // User tapped a click-action inside the widget
    case 'WIDGET_CLICK': {
      // Refresh data after any click action (e.g., after returning from QuickAdd)
      const data = await getWidgetData();
      props.renderWidget(<Widget {...data} />);
      break;
    }

    default:
      break;
  }
}

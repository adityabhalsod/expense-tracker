// Widget task handler — runs in a background JS context when Android triggers a widget event
// Fetches live data from the SQLite database and renders the widget with fresh content
'use no memo';

import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { ExpenseTrackerWidget } from './ExpenseTrackerWidget';
import * as db from '../database';
import { CURRENCIES } from '../constants';
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
  };
}

// Main handler invoked by the Android widget system for every widget lifecycle event
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget = nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

  // Bail if the widget name doesn't match any registered widget
  if (!Widget) return;

  switch (props.widgetAction) {
    // Render both light and dark variants — Android selects based on system theme
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK': {
      const data = await getWidgetData();
      // Fallback to reasonable defaults if dimensions aren't available yet
      const w = widgetInfo.width > 0 ? widgetInfo.width : 250;
      const h = widgetInfo.height > 0 ? widgetInfo.height : 180;
      // Provide both theme variants for native light/dark mode switching
      props.renderWidget({
        light: <Widget {...data} isDark={false} widgetWidth={w} widgetHeight={h} />,
        dark: <Widget {...data} isDark={true} widgetWidth={w} widgetHeight={h} />,
      });
      break;
    }

    // Widget removed from home screen — no cleanup needed
    case 'WIDGET_DELETED':
      break;

    default:
      break;
  }
}

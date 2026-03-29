// Android home-screen widget showing balance, recent expenses, and quick-add shortcuts
// Uses react-native-android-widget primitives — no React hooks allowed in widget components

import React from 'react';
import { FlexWidget, TextWidget, ListWidget } from 'react-native-android-widget';

// Hex color type required by react-native-android-widget's ColorProp
type HexColor = `#${string}`;

// Theme tokens typed as HexColor to satisfy widget style constraints
interface WidgetColors {
  background: HexColor;
  surface: HexColor;
  text: HexColor;
  textSecondary: HexColor;
  primary: HexColor;
  income: HexColor;
  expense: HexColor;
  border: HexColor;
  buttonBg: HexColor;
}

// Props passed to the widget from the task handler after fetching live data
interface ExpenseTrackerWidgetProps {
  // Current total balance across all wallets (formatted string)
  balance: string;
  // Currency symbol for display (e.g., "₹", "$")
  currencySymbol: string;
  // Recent expense entries to show in the list
  recentExpenses: {
    id: string;
    category: string;
    amount: string;
    date: string;
    icon: string;
  }[];
  // Whether the device is in dark mode
  isDark: boolean;
}

// Color tokens for light and dark widget themes
const getColors = (isDark: boolean): WidgetColors => ({
  background: isDark ? '#1A1A2E' : '#FFFFFF',
  surface: isDark ? '#16213E' : '#F8F9FE',
  text: isDark ? '#F8F9FE' : '#1A1A2E',
  textSecondary: isDark ? '#9CA3AF' : '#6B7280',
  primary: isDark ? '#8B85FF' : '#6C63FF',
  income: '#10B981',
  expense: '#EF4444',
  border: isDark ? '#2D2D44' : '#E5E7EB',
  buttonBg: isDark ? '#2D2D44' : '#EEF2FF',
});

// Main widget component rendered on the Android home screen
export function ExpenseTrackerWidget({
  balance,
  currencySymbol,
  recentExpenses,
  isDark,
}: ExpenseTrackerWidgetProps) {
  // Resolve theme-aware colors for all widget elements
  const colors = getColors(isDark);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: colors.background,
        borderRadius: 16,
        padding: 16,
      }}
    >
      {/* ── Header row: app name + balance ── */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* App brand label */}
        <TextWidget
          text="PaisaTrack"
          style={{
            fontSize: 14,
            color: colors.primary,
            fontWeight: '700',
          }}
        />
        {/* Live balance indicator */}
        <TextWidget
          text={`${currencySymbol}${balance}`}
          style={{
            fontSize: 18,
            color: colors.text,
            fontWeight: '700',
          }}
        />
      </FlexWidget>

      {/* ── "Total Balance" label below the header ── */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: 2,
        }}
      >
        <TextWidget
          text="Total Balance"
          style={{
            fontSize: 11,
            color: colors.textSecondary,
          }}
        />
      </FlexWidget>

      {/* ── Divider line ── */}
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 1,
          backgroundColor: colors.border,
          marginTop: 8,
          marginBottom: 8,
        }}
      />

      {/* ── Quick-action buttons: Add Expense / Add Income ── */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-evenly',
          marginBottom: 8,
        }}
      >
        {/* "Add Expense" button — opens QuickAdd screen via deep link */}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'expense-tracker://quick-add?type=expense' }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.buttonBg,
            borderRadius: 20,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
          }}
        >
          <TextWidget
            text="＋"
            style={{ fontSize: 14, color: colors.expense, fontWeight: '700' }}
          />
          <TextWidget
            text=" Expense"
            style={{ fontSize: 12, color: colors.text, fontWeight: '600' }}
          />
        </FlexWidget>

        {/* "Add Income" button — opens QuickAdd screen for income entry */}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'expense-tracker://quick-add?type=income' }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.buttonBg,
            borderRadius: 20,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
          }}
        >
          <TextWidget
            text="＋"
            style={{ fontSize: 14, color: colors.income, fontWeight: '700' }}
          />
          <TextWidget
            text=" Income"
            style={{ fontSize: 12, color: colors.text, fontWeight: '600' }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* ── "Recent Expenses" section label ── */}
      <TextWidget
        text="Recent Expenses"
        style={{
          fontSize: 12,
          color: colors.textSecondary,
          fontWeight: '600',
          marginBottom: 4,
        }}
      />

      {/* ── Scrollable list of recent expenses ── */}
      {recentExpenses.length > 0 ? (
        <ListWidget
          style={{
            height: 'match_parent',
            width: 'match_parent',
          }}
        >
          {recentExpenses.map((expense) => (
            <FlexWidget
              key={expense.id}
              clickAction="OPEN_URI"
              clickActionData={{ uri: 'expense-tracker://quick-add?type=expense' }}
              style={{
                width: 'match_parent',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 6,
                paddingBottom: 6,
                paddingLeft: 4,
                paddingRight: 4,
              }}
            >
              {/* Category name + date on the left */}
              <FlexWidget style={{ flexDirection: 'column' }}>
                <TextWidget
                  text={expense.category}
                  style={{
                    fontSize: 13,
                    color: colors.text,
                    fontWeight: '500',
                  }}
                />
                <TextWidget
                  text={expense.date}
                  style={{
                    fontSize: 10,
                    color: colors.textSecondary,
                  }}
                />
              </FlexWidget>
              {/* Expense amount on the right in red */}
              <TextWidget
                text={`-${currencySymbol}${expense.amount}`}
                style={{
                  fontSize: 13,
                  color: colors.expense,
                  fontWeight: '600',
                }}
              />
            </FlexWidget>
          ))}
        </ListWidget>
      ) : (
        /* Empty-state message when no expenses exist yet */
        <FlexWidget
          style={{
            height: 'match_parent',
            width: 'match_parent',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text="No expenses yet"
            style={{
              fontSize: 12,
              color: colors.textSecondary,
            }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

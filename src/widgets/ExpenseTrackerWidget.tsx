// Android home-screen widget showing balance, recent expenses, and quick-add shortcuts
// Supports translucent backgrounds, responsive sizing, and native light/dark themes
'use no memo';

import React from 'react';
import { FlexWidget, TextWidget, ListWidget } from 'react-native-android-widget';

// Color types matching react-native-android-widget's style system
type HexColor = `#${string}`;
type RgbaColor = `rgba(${number}, ${number}, ${number}, ${number})`;
type ColorProp = HexColor | RgbaColor;

// Theme tokens — backgrounds use rgba for wallpaper translucency
interface WidgetColors {
  background: ColorProp;
  surface: ColorProp;
  text: HexColor;
  textSecondary: HexColor;
  primary: HexColor;
  income: HexColor;
  expense: HexColor;
  border: ColorProp;
  expenseButtonBg: ColorProp;
  incomeButtonBg: ColorProp;
  balanceBg: ColorProp;
}

// Props passed from the task handler with live data and widget dimensions
interface ExpenseTrackerWidgetProps {
  // Total balance across all wallets (formatted string)
  balance: string;
  // Currency symbol (e.g., "₹", "$")
  currencySymbol: string;
  // Recent expenses for the scrollable list
  recentExpenses: {
    id: string;
    category: string;
    amount: string;
    date: string;
    icon: string;
  }[];
  // Whether to render the dark variant
  isDark: boolean;
  // Widget dimensions in dp for responsive layout
  widgetWidth: number;
  widgetHeight: number;
}

// Translucent color palettes aligned with the app's light and dark themes
const getColors = (isDark: boolean): WidgetColors => ({
  // Semi-transparent backgrounds let the home screen wallpaper show through
  background: isDark ? 'rgba(15, 15, 35, 0.85)' : 'rgba(255, 255, 255, 0.85)',
  surface: isDark ? 'rgba(26, 26, 46, 0.6)' : 'rgba(248, 249, 254, 0.6)',
  // Opaque text for readability
  text: isDark ? '#F8F9FE' : '#1A1A2E',
  textSecondary: isDark ? '#9CA3AF' : '#6B7280',
  primary: isDark ? '#8B85FF' : '#6C63FF',
  income: isDark ? '#34D399' : '#10B981',
  expense: isDark ? '#F87171' : '#EF4444',
  // Translucent UI accents
  border: isDark ? 'rgba(45, 45, 68, 0.5)' : 'rgba(229, 231, 235, 0.5)',
  expenseButtonBg: isDark ? 'rgba(248, 113, 113, 0.15)' : 'rgba(239, 68, 68, 0.08)',
  incomeButtonBg: isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.08)',
  balanceBg: isDark ? 'rgba(139, 133, 255, 0.12)' : 'rgba(108, 99, 255, 0.06)',
});

// Compute responsive font and spacing sizes from widget dp dimensions
function getResponsiveSizes(width: number, height: number) {
  // Scale factor clamped between 0.8x and 1.4x relative to 250dp baseline
  const scale = Math.max(0.8, Math.min(1.4, width / 250));
  return {
    brandFont: Math.round(13 * scale),
    balanceFont: Math.round(22 * scale),
    labelFont: Math.round(11 * scale),
    buttonFont: Math.round(12 * scale),
    sectionFont: Math.round(11 * scale),
    itemFont: Math.round(12 * scale),
    dateFont: Math.round(10 * scale),
    padding: Math.round(14 * scale),
    gap: Math.round(6 * scale),
    radius: Math.round(20 * scale),
    innerRadius: Math.round(12 * scale),
    // Only render the expense list when widget is tall enough
    showList: height > 160,
    // Cap visible items based on available vertical space
    maxItems: height > 280 ? 5 : height > 220 ? 3 : 2,
  };
}

// Main widget component rendered on the Android home screen
export function ExpenseTrackerWidget({
  balance,
  currencySymbol,
  recentExpenses,
  isDark,
  widgetWidth,
  widgetHeight,
}: ExpenseTrackerWidgetProps) {
  // Resolve theme-aware colors for translucent appearance
  const colors = getColors(isDark);
  // Compute responsive sizes from actual widget dimensions
  const sizes = getResponsiveSizes(widgetWidth, widgetHeight);
  // Trim expense list to fit available vertical space
  const visibleExpenses = recentExpenses.slice(0, sizes.maxItems);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: colors.background,
        borderRadius: sizes.radius,
        padding: sizes.padding,
      }}
    >
      {/* ── Brand label ── */}
      <TextWidget
        text="💰 PaisaTrack"
        style={{
          fontSize: sizes.brandFont,
          color: colors.primary,
          fontWeight: '700',
        }}
      />

      {/* ── Balance card with subtle accent tint ── */}
      <FlexWidget
        style={{
          width: 'match_parent',
          backgroundColor: colors.balanceBg,
          borderRadius: sizes.innerRadius,
          paddingHorizontal: sizes.gap + 4,
          paddingVertical: sizes.gap + 2,
          marginTop: sizes.gap,
        }}
      >
        {/* "Total Balance" label */}
        <TextWidget
          text="Total Balance"
          style={{
            fontSize: sizes.labelFont,
            color: colors.textSecondary,
          }}
        />
        {/* Formatted balance amount */}
        <TextWidget
          text={`${currencySymbol}${balance}`}
          style={{
            fontSize: sizes.balanceFont,
            color: colors.text,
            fontWeight: '700',
          }}
        />
      </FlexWidget>

      {/* ── Quick-action buttons ── */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          flexGap: sizes.gap,
          marginTop: sizes.gap + 2,
          marginBottom: sizes.gap,
        }}
      >
        {/* Expense button with red-tinted background */}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'expense-tracker://quick-add?type=expense' }}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.expenseButtonBg,
            borderRadius: sizes.innerRadius,
            paddingVertical: sizes.gap,
          }}
        >
          <TextWidget
            text="＋ Expense"
            style={{
              fontSize: sizes.buttonFont,
              color: colors.expense,
              fontWeight: '600',
            }}
          />
        </FlexWidget>

        {/* Income button with green-tinted background */}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'expense-tracker://quick-add?type=income' }}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.incomeButtonBg,
            borderRadius: sizes.innerRadius,
            paddingVertical: sizes.gap,
          }}
        >
          <TextWidget
            text="＋ Income"
            style={{
              fontSize: sizes.buttonFont,
              color: colors.income,
              fontWeight: '600',
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* ── Recent expenses section (hidden when widget is too short) ── */}
      {sizes.showList && (
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 'match_parent',
            flexDirection: 'column',
          }}
        >
          {/* Section divider */}
          <FlexWidget
            style={{
              width: 'match_parent',
              height: 1,
              backgroundColor: colors.border,
            }}
          />

          {/* Section label */}
          <TextWidget
            text="Recent Expenses"
            style={{
              fontSize: sizes.sectionFont,
              color: colors.textSecondary,
              fontWeight: '600',
              marginTop: sizes.gap,
              marginBottom: 2,
            }}
          />

          {/* Expense list or empty state */}
          {visibleExpenses.length > 0 ? (
            <ListWidget
              style={{
                height: 'match_parent',
                width: 'match_parent',
              }}
            >
              {visibleExpenses.map((expense) => (
                <FlexWidget
                  key={expense.id}
                  clickAction="OPEN_URI"
                  clickActionData={{ uri: 'expense-tracker://quick-add?type=expense' }}
                  style={{
                    width: 'match_parent',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: sizes.gap - 1,
                    paddingHorizontal: 2,
                  }}
                >
                  {/* Category info with colored indicator dot */}
                  <FlexWidget
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    {/* Red dot marking expense category */}
                    <FlexWidget
                      style={{
                        width: 8,
                        height: 8,
                        backgroundColor: colors.expense,
                        borderRadius: 4,
                        marginRight: 6,
                      }}
                    />
                    <FlexWidget style={{ flexDirection: 'column' }}>
                      <TextWidget
                        text={expense.category}
                        style={{
                          fontSize: sizes.itemFont,
                          color: colors.text,
                          fontWeight: '500',
                        }}
                        maxLines={1}
                        truncate="END"
                      />
                      <TextWidget
                        text={expense.date}
                        style={{
                          fontSize: sizes.dateFont,
                          color: colors.textSecondary,
                        }}
                      />
                    </FlexWidget>
                  </FlexWidget>

                  {/* Expense amount in red */}
                  <TextWidget
                    text={`-${currencySymbol}${expense.amount}`}
                    style={{
                      fontSize: sizes.itemFont,
                      color: colors.expense,
                      fontWeight: '600',
                    }}
                  />
                </FlexWidget>
              ))}
            </ListWidget>
          ) : (
            /* Empty-state placeholder */
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
                  fontSize: sizes.itemFont,
                  color: colors.textSecondary,
                }}
              />
            </FlexWidget>
          )}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

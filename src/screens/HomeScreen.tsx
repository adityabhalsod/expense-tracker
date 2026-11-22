// Home dashboard screen: balance hero, month-end forecast, shortcuts, upcoming bills, debts and recent activity
// Serves as the main entry point after app launch
// Supports multi-select mode for batch-deleting recent expenses

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppStore, selectExpenses, selectWallets, selectCategories, selectDebts, selectSettings } from '../store';
import Card from '../components/common/Card';
import GradientCard from '../components/common/GradientCard';
import IconBadge from '../components/common/IconBadge';
import ProgressBar from '../components/common/ProgressBar';
import SectionHeader from '../components/common/SectionHeader';
import { formatCurrency, formatRelativeDate } from '../utils/helpers';
import { useLanguage } from '../i18n';
import { UpcomingBill } from '../types';
import { computeMonthForecast, loadUpcomingBills, MonthForecast } from '../services/financialInsights';

const MASK = '••••••';

const HomeScreen = () => {
  const { theme, hideAmounts, toggleHideAmounts } = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const { t } = useLanguage();

  // Subscribe to individual store slices via selectors to prevent full-store re-renders
  const expenses = useAppStore(selectExpenses);
  const wallets = useAppStore(selectWallets);
  const categories = useAppStore(selectCategories);
  const debts = useAppStore(selectDebts);
  const settings = useAppStore(selectSettings);
  const initialize = useAppStore((s) => s.initialize);
  const loadExpenses = useAppStore((s) => s.loadExpenses);
  const loadCurrentWallet = useAppStore((s) => s.loadCurrentWallet);
  const loadWallets = useAppStore((s) => s.loadWallets);
  const deleteMultipleExpenses = useAppStore((s) => s.deleteMultipleExpenses);
  const loadIncome = useAppStore((s) => s.loadIncome);
  const loadDebts = useAppStore((s) => s.loadDebts);
  const currency = settings.defaultCurrency || 'INR';

  // Derived insights loaded from the database (accurate regardless of the loaded page size)
  const [forecast, setForecast] = useState<MonthForecast | null>(null);
  const [bills, setBills] = useState<UpcomingBill[]>([]);

  // Multi-select state for batch deleting recent expenses
  const [isSelectMode, setIsSelectMode] = useState(false); // Whether multi-select is active
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); // Selected expense IDs

  // Toggle an expense in the selection set
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id))
        next.delete(id); // Deselect if already selected
      else next.add(id); // Add to selection
      return next;
    });
  }, []);

  // Exit multi-select mode and clear selections
  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  // Reload the forecast and upcoming bills
  const refreshInsights = useCallback(async () => {
    try {
      const nextBills = await loadUpcomingBills();
      setBills(nextBills);
      setForecast(await computeMonthForecast(nextBills));
    } catch (e) {
      console.warn('Failed to compute dashboard insights:', e);
    }
  }, []);

  // Confirm and batch-delete selected expenses
  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete Expenses',
      `Delete ${selectedIds.size} selected expense${selectedIds.size === 1 ? '' : 's'}? Amounts will be restored to wallets.`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            await deleteMultipleExpenses([...selectedIds]);
            exitSelectMode(); // Clear selection after deletion
            refreshInsights();
          },
        },
      ],
    );
  }, [selectedIds, deleteMultipleExpenses, exitSelectMode, refreshInsights, t]);

  // Refresh data whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadExpenses(50);
      loadCurrentWallet();
      loadWallets();
      loadIncome(50);
      loadDebts();
      refreshInsights();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Pull-to-refresh handler reloads all data
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await initialize();
    await refreshInsights();
    setRefreshing(false);
  };

  // Get the 5 most recent expenses for the dashboard preview (memoized)
  const recentExpenses = useMemo(() => expenses.slice(0, 5), [expenses]);

  // Aggregate total balance across all wallets
  const totalBalance = useMemo(() => wallets.reduce((sum, w) => sum + w.currentBalance, 0), [wallets]);

  // Open debt totals for the lend & borrow strip
  const debtTotals = useMemo(() => {
    let owedToYou = 0;
    let youOwe = 0;
    let open = 0;
    for (const d of debts) {
      if (d.isSettled) continue;
      open++;
      if (d.type === 'lent') owedToYou += d.amount - d.paidAmount;
      else youOwe += d.amount - d.paidAmount;
    }
    return { owedToYou, youOwe, open };
  }, [debts]);

  // Find icon and color for a category name from the categories list (memoized)
  const getCategoryInfo = useCallback(
    (categoryName: string) => {
      const cat = categories.find((c) => c.name === categoryName);
      return { icon: cat?.icon || 'help-circle', color: cat?.color || '#999' };
    },
    [categories],
  );

  // Format money, respecting privacy mode
  const money = useCallback(
    (amount: number, code: string = currency) => (hideAmounts ? MASK : formatCurrency(amount, code)),
    [hideAmounts, currency],
  );

  // Get time-based greeting using translations
  const getLocalizedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t.greetings.morning;
    if (hour < 17) return t.greetings.afternoon;
    return t.greetings.evening;
  };

  // Month figures
  const spent = forecast?.spentSoFar ?? 0;
  const earned = forecast?.incomeSoFar ?? 0;
  const saved = earned - spent;
  const reference = forecast ? (forecast.budgetTotal > 0 ? forecast.budgetTotal : forecast.incomeSoFar) : 0;
  const spendRatio = reference > 0 ? spent / reference : 0;
  const lastMonth = forecast?.lastMonthTotal ?? 0;
  // Compare against the same share of last month's total to keep the delta fair mid-month
  const lastMonthPace =
    forecast && lastMonth > 0 ? (lastMonth * forecast.daysElapsed) / (forecast.daysElapsed + forecast.daysLeft - 1) : 0;
  const deltaPct = lastMonthPace > 0 ? Math.round(((spent - lastMonthPace) / lastMonthPace) * 100) : null;
  const ratioColor =
    spendRatio >= 1 ? theme.colors.error : spendRatio >= 0.8 ? theme.colors.warning : theme.colors.success;

  // Shortcut tiles (horizontal scroller)
  const shortcuts: { key: string; label: string; icon: string; color: string; onPress: () => void }[] = [
    {
      key: 'budgets',
      label: t.home.budgets,
      icon: 'target',
      color: '#EF4444',
      onPress: () => navigation.navigate('BudgetSetup'),
    },
    {
      key: 'bills',
      label: t.bills.shortTitle,
      icon: 'calendar-sync',
      color: '#0EA5E9',
      onPress: () => navigation.navigate('Bills'),
    },
    {
      key: 'debts',
      label: t.debts.title,
      icon: 'handshake',
      color: '#F59E0B',
      onPress: () => navigation.navigate('Debts'),
    },
    {
      key: 'goals',
      label: t.savingsGoals.title,
      icon: 'piggy-bank',
      color: '#10B981',
      onPress: () => navigation.navigate('SavingsGoals'),
    },
    {
      key: 'insights',
      label: t.insights.title,
      icon: 'lightbulb-on',
      color: '#6366F1',
      onPress: () => navigation.navigate('MonthlyInsights'),
    },
    {
      key: 'templates',
      label: t.templates.title,
      icon: 'lightning-bolt',
      color: '#8B5CF6',
      onPress: () => navigation.navigate('ExpenseTemplates'),
    },
    {
      key: 'income',
      label: t.homeIncome.incomeHistory,
      icon: 'cash-multiple',
      color: '#14B8A6',
      onPress: () => navigation.navigate('IncomeList'),
    },
    {
      key: 'calendar',
      label: t.calendarHeatmap.title,
      icon: 'calendar-month',
      color: '#06B6D4',
      onPress: () => navigation.navigate('CalendarHeatmap'),
    },
    {
      key: 'streaks',
      label: t.streaks.title,
      icon: 'fire',
      color: '#F97316',
      onPress: () => navigation.navigate('Streaks'),
    },
    {
      key: 'export',
      label: t.home.export,
      icon: 'tray-arrow-down',
      color: '#64748B',
      onPress: () => navigation.navigate('ExportReport'),
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Header with greeting and actions */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>{getLocalizedGreeting()} 👋</Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>{t.home.dashboard}</Text>
          </View>
          <Pressable
            onPress={toggleHideAmounts}
            accessibilityLabel={hideAmounts ? t.dashboard.showAmounts : t.dashboard.hideAmounts}
            style={[styles.headerButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <MaterialCommunityIcons
              name={hideAmounts ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={theme.colors.text}
            />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Search')}
            accessibilityLabel={t.search.title}
            style={[styles.headerButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <MaterialCommunityIcons name="magnify" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* Balance hero */}
        <GradientCard style={styles.hero}>
          {wallets.length > 0 ? (
            <>
              <Text style={styles.heroLabel}>{t.dashboard.totalBalance}</Text>
              <Text style={styles.heroBalance} numberOfLines={1} adjustsFontSizeToFit>
                {money(totalBalance)}
              </Text>
              <Text style={styles.heroSub}>{t.dashboard.acrossWallets.replace('{n}', String(wallets.length))}</Text>

              {/* Month in / out chips */}
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <View style={[styles.heroStatIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <MaterialCommunityIcons name="arrow-bottom-left" size={16} color="#D1FAE5" />
                  </View>
                  <View>
                    <Text style={styles.heroStatLabel}>{t.dashboard.earned}</Text>
                    <Text style={styles.heroStatValue}>{money(earned)}</Text>
                  </View>
                </View>
                <View style={styles.heroStat}>
                  <View style={[styles.heroStatIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <MaterialCommunityIcons name="arrow-top-right" size={16} color="#FEE2E2" />
                  </View>
                  <View>
                    <Text style={styles.heroStatLabel}>{t.dashboard.spent}</Text>
                    <Text style={styles.heroStatValue}>{money(spent)}</Text>
                  </View>
                </View>
              </View>

              {/* Mini wallet previews */}
              {wallets.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniWallets}>
                  {wallets.map((w) => (
                    <View key={w.id} style={styles.miniWallet}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <MaterialCommunityIcons name={w.iconName as any} size={14} color="#FFF" />
                      <Text style={styles.miniWalletName} numberOfLines={1}>
                        {w.nickname || w.name}
                      </Text>
                      <Text style={styles.miniWalletBal}>{money(w.currentBalance, w.currency)}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </>
          ) : (
            // Prompt user to set up their wallet if none exists
            <Pressable onPress={() => navigation.navigate('WalletSetup')} style={styles.walletSetup}>
              <View style={styles.walletSetupIcon}>
                <MaterialCommunityIcons name="wallet-plus" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.walletSetupText}>{t.home.setupWallet}</Text>
              <Text style={styles.walletSetupSubtext}>{t.home.addSalaryHint}</Text>
            </Pressable>
          )}
        </GradientCard>

        {/* This month + forecast */}
        <Card style={styles.monthCard}>
          <View style={styles.monthHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{t.dashboard.thisMonth}</Text>
            {forecast && (
              <View style={[styles.pill, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text style={[styles.pillText, { color: theme.colors.textSecondary }]}>
                  {t.dashboard.daysLeft.replace('{n}', String(forecast.daysLeft))}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.monthRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.monthSpent, { color: theme.colors.text }]}>{money(spent)}</Text>
              <Text style={[styles.muted, { color: theme.colors.textSecondary }]}>
                {reference > 0 ? `/ ${money(reference)}` : t.dashboard.spent}
              </Text>
            </View>
            {deltaPct !== null && (
              <View
                style={[
                  styles.deltaPill,
                  { backgroundColor: (deltaPct > 0 ? theme.colors.error : theme.colors.success) + '1A' },
                ]}
              >
                <MaterialCommunityIcons
                  name={deltaPct > 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={deltaPct > 0 ? theme.colors.error : theme.colors.success}
                />
                <Text style={[styles.deltaText, { color: deltaPct > 0 ? theme.colors.error : theme.colors.success }]}>
                  {Math.abs(deltaPct)}%
                </Text>
                <Text style={[styles.deltaCaption, { color: theme.colors.textSecondary }]}>
                  {t.dashboard.vsLastMonth}
                </Text>
              </View>
            )}
          </View>

          {reference > 0 && <ProgressBar progress={spendRatio} color={ratioColor} style={{ marginTop: 12 }} />}

          <View style={[styles.forecastGrid, { borderTopColor: theme.colors.border }]}>
            <View style={styles.forecastItem}>
              <Text style={[styles.forecastLabel, { color: theme.colors.textSecondary }]}>{t.dashboard.projected}</Text>
              <Text style={[styles.forecastValue, { color: theme.colors.text }]}>
                {money(forecast?.projected ?? 0)}
              </Text>
            </View>
            <View style={styles.forecastItem}>
              <Text style={[styles.forecastLabel, { color: theme.colors.textSecondary }]}>{t.dashboard.dailyAvg}</Text>
              <Text style={[styles.forecastValue, { color: theme.colors.text }]}>
                {money(forecast?.dailyAverage ?? 0)}
              </Text>
            </View>
            <View style={styles.forecastItem}>
              <Text style={[styles.forecastLabel, { color: theme.colors.textSecondary }]}>
                {forecast?.safeToSpendPerDay != null ? t.dashboard.safeToSpend : t.dashboard.saved}
              </Text>
              <Text
                style={[
                  styles.forecastValue,
                  {
                    color:
                      forecast?.safeToSpendPerDay != null
                        ? theme.colors.success
                        : saved >= 0
                          ? theme.colors.income
                          : theme.colors.expense,
                  },
                ]}
              >
                {forecast?.safeToSpendPerDay != null
                  ? `${money(forecast.safeToSpendPerDay)}${hideAmounts ? '' : t.dashboard.perDay}`
                  : money(saved)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Shortcuts */}
        <SectionHeader title={t.dashboard.quickActions} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
          {shortcuts.map((s) => (
            <Pressable
              key={s.key}
              onPress={s.onPress}
              style={({ pressed }) => [styles.shortcut, pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }]}
            >
              <View
                style={[
                  styles.shortcutIcon,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <IconBadge icon={s.icon} color={s.color} size={40} />
              </View>
              <Text style={[styles.shortcutLabel, { color: theme.colors.text }]} numberOfLines={2}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Lend & borrow strip */}
        {debtTotals.open > 0 && (
          <Card onPress={() => navigation.navigate('Debts')} style={styles.debtCard}>
            <IconBadge icon="handshake" color={theme.colors.warning} />
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.forecastLabel, { color: theme.colors.textSecondary }]}>
                  {t.dashboard.peopleOweYou}
                </Text>
                <Text style={[styles.forecastValue, { color: theme.colors.income }]}>
                  {money(debtTotals.owedToYou)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.forecastLabel, { color: theme.colors.textSecondary }]}>{t.dashboard.youOwe}</Text>
                <Text style={[styles.forecastValue, { color: theme.colors.expense }]}>{money(debtTotals.youOwe)}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.textTertiary} />
          </Card>
        )}

        {/* Upcoming bills */}
        {bills.length > 0 && (
          <>
            <SectionHeader
              title={t.dashboard.upcomingBills}
              actionLabel={t.dashboard.seeAll}
              onAction={() => navigation.navigate('Bills')}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.billsRow}>
              {bills.slice(0, 6).map((b) => {
                const info = getCategoryInfo(b.category);
                const urgent = b.daysUntil <= 2;
                return (
                  <Pressable
                    key={b.key}
                    onPress={() => navigation.navigate('Bills')}
                    style={[
                      styles.billTile,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    ]}
                  >
                    <IconBadge icon={info.icon} color={info.color} size={36} />
                    <Text style={[styles.billName, { color: theme.colors.text }]} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text style={[styles.billAmount, { color: theme.colors.text }]}>{money(b.amount, b.currency)}</Text>
                    <Text
                      style={[styles.billDue, { color: urgent ? theme.colors.warning : theme.colors.textSecondary }]}
                    >
                      {b.daysUntil <= 0
                        ? t.bills.dueToday
                        : b.daysUntil === 1
                          ? t.bills.dueTomorrow
                          : t.bills.inDays.replace('{n}', String(b.daysUntil))}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Recent expenses list section */}
        <SectionHeader
          title={t.home.recentExpenses}
          right={
            isSelectMode ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 13 }}>
                  {selectedIds.size} selected
                </Text>
                <Pressable onPress={handleBatchDelete} hitSlop={8}>
                  <MaterialCommunityIcons name="delete" size={22} color={theme.colors.expense} />
                </Pressable>
                <Pressable onPress={exitSelectMode} hitSlop={8}>
                  <MaterialCommunityIcons name="close" size={22} color={theme.colors.text} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => navigation.navigate('AllExpenses')} hitSlop={8}>
                <Text style={[styles.viewAll, { color: theme.colors.primary }]}>{t.home.viewAll}</Text>
              </Pressable>
            )
          }
        />

        {recentExpenses.length > 0 ? (
          <Card style={styles.listCard}>
            {recentExpenses.map((expense, index) => {
              const catInfo = getCategoryInfo(expense.category);
              const isSelected = selectedIds.has(expense.id); // Check if this expense is selected
              return (
                <Pressable
                  key={expense.id}
                  onPress={() => {
                    if (isSelectMode) {
                      toggleSelection(expense.id); // Toggle selection in multi-select mode
                    } else {
                      navigation.navigate('ExpenseDetail', { expenseId: expense.id });
                    }
                  }}
                  onLongPress={() => {
                    if (!isSelectMode) {
                      setIsSelectMode(true); // Enter select mode on long press
                      setSelectedIds(new Set([expense.id])); // Pre-select the long-pressed item
                    }
                  }}
                  style={({ pressed }) => [
                    styles.expenseRow,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
                    (pressed || isSelected) && { backgroundColor: theme.colors.primary + '0F' },
                  ]}
                >
                  {/* Checkbox shown only in multi-select mode */}
                  {isSelectMode && (
                    <MaterialCommunityIcons
                      name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={22}
                      color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                      style={{ marginRight: 10 }}
                    />
                  )}
                  <IconBadge icon={catInfo.icon} color={catInfo.color} size={42} />
                  <View style={styles.expenseInfo}>
                    <Text style={[styles.expenseCategory, { color: theme.colors.text }]} numberOfLines={1}>
                      {expense.notes
                        ? expense.notes.replace(/^\[Recurring\]\s*/, '') || expense.category
                        : expense.category}
                    </Text>
                    <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                      {expense.notes ? `${expense.category} · ` : ''}
                      {formatRelativeDate(expense.date)}
                      {expense.isRecurring ? ' · ↻' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.expenseAmount, { color: theme.colors.expense }]}>
                    {hideAmounts ? MASK : `-${formatCurrency(expense.amount, expense.currency)}`}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        ) : (
          // Empty state when no expenses exist yet
          <Card>
            <View style={styles.emptyState}>
              <IconBadge icon="receipt-text-outline" color={theme.colors.primary} size={64} />
              <Text style={[styles.emptyText, { color: theme.colors.text }]}>{t.home.noExpenses}</Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textTertiary }]}>{t.home.tapToAdd}</Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', // Greeting on the left, actions on the right
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: { fontSize: 14, fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '800', marginTop: 2, letterSpacing: -0.6 },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Balance hero
  hero: { marginHorizontal: 16, marginBottom: 10 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  heroBalance: { color: '#FFFFFF', fontSize: 38, fontWeight: '800', letterSpacing: -1, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  heroStats: { flexDirection: 'row', gap: 10, marginTop: 18 },
  heroStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroStatIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  heroStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  heroStatValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginTop: 1 },
  miniWallets: { marginTop: 14, flexDirection: 'row' },
  miniWallet: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginRight: 8,
    minWidth: 92,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  miniWalletName: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4 },
  miniWalletBal: { color: '#FFF', fontSize: 13, fontWeight: '700', marginTop: 1 },
  walletSetup: { alignItems: 'center', paddingVertical: 16 },
  walletSetupIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletSetupText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 12 },
  walletSetupSubtext: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4, textAlign: 'center' },
  // Month card
  monthCard: { padding: 18 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 11, fontWeight: '700' },
  monthRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 },
  monthSpent: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  muted: { fontSize: 13, marginTop: 2 },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  deltaText: { fontSize: 13, fontWeight: '800' },
  deltaCaption: { fontSize: 11 },
  forecastGrid: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  forecastItem: { flex: 1 },
  forecastLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  forecastValue: { fontSize: 15, fontWeight: '800' },
  // Shortcuts
  shortcuts: { paddingHorizontal: 14, gap: 4 },
  shortcut: { width: 76, alignItems: 'center' },
  shortcutIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortcutLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 6, lineHeight: 14 },
  // Debts strip
  debtCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  // Bills
  billsRow: { paddingHorizontal: 16, gap: 10 },
  billTile: { width: 136, padding: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  billName: { fontSize: 13, fontWeight: '700', marginTop: 10 },
  billAmount: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  billDue: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  // Recent list
  viewAll: { fontSize: 14, fontWeight: '600' },
  listCard: { padding: 0, overflow: 'hidden' },
  expenseRow: {
    flexDirection: 'row', // Icon, info, and amount in a row
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  expenseInfo: { flex: 1, marginLeft: 12 },
  expenseCategory: { fontSize: 15, fontWeight: '600' },
  expenseDate: { fontSize: 12, marginTop: 2 },
  expenseAmount: { fontSize: 15, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyText: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  emptySubtext: { fontSize: 13, marginTop: 4 },
});

export default HomeScreen;

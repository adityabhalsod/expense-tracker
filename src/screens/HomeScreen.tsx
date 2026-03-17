// Home dashboard screen showing wallet summary, recent expenses, and quick actions
// Serves as the main entry point after app launch with modern shortcut widgets

import React, { useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppStore, selectExpenses, selectCurrentWallet, selectWallets, selectCategories, selectIsLoading } from '../store';
import Card from '../components/common/Card';
import { formatCurrency, formatRelativeDate } from '../utils/helpers';
import { useLanguage } from '../i18n';

const HomeScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { t } = useLanguage();

  // Subscribe to individual store slices via selectors to prevent full-store re-renders
  const expenses = useAppStore(selectExpenses);
  const currentWallet = useAppStore(selectCurrentWallet);
  const wallets = useAppStore(selectWallets);
  const categories = useAppStore(selectCategories);
  const isLoading = useAppStore(selectIsLoading);
  const initialize = useAppStore((s) => s.initialize);
  const loadExpenses = useAppStore((s) => s.loadExpenses);
  const loadCurrentWallet = useAppStore((s) => s.loadCurrentWallet);
  const loadWallets = useAppStore((s) => s.loadWallets);

  // Refresh data whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadExpenses(50);
      loadCurrentWallet();
      loadWallets();
    }, [])
  );

  // Pull-to-refresh handler reloads all data
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await initialize();
    setRefreshing(false);
  };

  // Get the 5 most recent expenses for the dashboard preview (memoized)
  const recentExpenses = useMemo(() => expenses.slice(0, 5), [expenses]);

  // Aggregate total balance across all wallets
  const totalBalance = useMemo(
    () => wallets.reduce((sum, w) => sum + w.currentBalance, 0),
    [wallets]
  );

  // Aggregate total initial balance across all wallets
  const totalInitial = useMemo(
    () => wallets.reduce((sum, w) => sum + w.initialBalance, 0),
    [wallets]
  );

  // Calculate total spent across all wallets
  const totalSpent = useMemo(() => totalInitial - totalBalance, [totalInitial, totalBalance]);

  // Calculate today's total spending from expenses (memoized)
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTotal = useMemo(
    () => expenses.filter(e => e.date === todayStr).reduce((sum, e) => sum + e.amount, 0),
    [expenses, todayStr]
  );

  // Find icon and color for a category name from the categories list (memoized)
  const getCategoryInfo = useCallback((categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    return { icon: cat?.icon || 'help-circle', color: cat?.color || '#999' };
  }, [categories]);

  // Get time-based greeting using translations
  const getLocalizedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t.greetings.morning;
    if (hour < 17) return t.greetings.afternoon;
    return t.greetings.evening;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Header with greeting and search button */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>{getLocalizedGreeting()}</Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>{t.home.dashboard}</Text>
          </View>
          {/* Search icon navigates to the search screen */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Search')}
            style={[styles.searchButton, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <MaterialCommunityIcons name="magnify" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Multi-wallet aggregate balance card */}
        <View style={styles.walletCard}>
          <View style={[styles.walletGradient, { backgroundColor: theme.colors.primary }]}>
            {wallets.length > 0 ? (
              <>
                {/* Aggregate starting balance */}
                <View style={styles.walletRow}>
                  <Text style={styles.walletLabel}>{t.home.startingBalance}</Text>
                  <Text style={styles.walletAmount}>{formatCurrency(totalInitial)}</Text>
                </View>
                {/* Total remaining balance across all wallets (large emphasis) */}
                <View style={styles.walletMainBalance}>
                  <Text style={styles.walletBalanceLabel}>{t.home.remainingBalance}</Text>
                  <Text style={styles.walletBalance}>{formatCurrency(totalBalance)}</Text>
                </View>
                {/* Aggregate total spent */}
                <View style={styles.walletRow}>
                  <Text style={styles.walletLabel}>{t.home.totalSpent}</Text>
                  <Text style={styles.walletSpent}>{formatCurrency(totalSpent)}</Text>
                </View>
                {/* Mini wallet previews showing individual wallet balances */}
                {wallets.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniWallets}>
                    {wallets.map((w) => (
                      <View key={w.id} style={[styles.miniWallet, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                        <MaterialCommunityIcons name={w.iconName as any} size={16} color="#FFF" />
                        <Text style={styles.miniWalletName} numberOfLines={1}>{w.nickname || w.name}</Text>
                        <Text style={styles.miniWalletBal}>{formatCurrency(w.currentBalance, w.currency)}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            ) : (
              // Prompt user to set up their wallet if none exists
              <TouchableOpacity onPress={() => navigation.navigate('WalletSetup')} style={styles.walletSetup}>
                <MaterialCommunityIcons name="wallet-plus" size={40} color="rgba(255,255,255,0.9)" />
                <Text style={styles.walletSetupText}>{t.home.setupWallet}</Text>
                <Text style={styles.walletSetupSubtext}>{t.home.addSalaryHint}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Shortcut widgets — quick actions with modern icon cards */}
        <View style={styles.widgetRow}>
          {/* Quick Add Expense shortcut widget */}
          <TouchableOpacity
            style={[styles.widget, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('AddExpense', {})}
          >
            <View style={[styles.widgetIcon, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="arrow-up-circle" size={32} color="#EF4444" />
            </View>
            <Text style={[styles.widgetTitle, { color: theme.colors.text }]}>{t.home.addExpense}</Text>
            <Text style={[styles.widgetSubtitle, { color: theme.colors.textTertiary }]}>
              {t.upiPayments?.sent || 'Quick entry'}
            </Text>
          </TouchableOpacity>

          {/* Quick Payment Received shortcut widget */}
          <TouchableOpacity
            style={[styles.widget, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('WalletSetup')}
          >
            <View style={[styles.widgetIcon, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="arrow-down-circle" size={32} color="#22C55E" />
            </View>
            <Text style={[styles.widgetTitle, { color: theme.colors.text }]}>
              {t.upiPayments?.addIncome || 'Add Income'}
            </Text>
            <Text style={[styles.widgetSubtitle, { color: theme.colors.textTertiary }]}>
              {t.upiPayments?.received || 'Top up wallet'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick action buttons grid */}
        <View style={styles.quickActions}>
          {/* Analytics button */}
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Analytics' })}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="chart-line" size={24} color="#F59E0B" />
            </View>
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>{t.home.analytics}</Text>
          </TouchableOpacity>

          {/* Export button */}
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('ExportReport')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#ECFDF5' }]}>
              <MaterialCommunityIcons name="download" size={24} color="#10B981" />
            </View>
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>{t.home.export}</Text>
          </TouchableOpacity>

          {/* Budget button */}
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('BudgetSetup')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="target" size={24} color="#EF4444" />
            </View>
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>{t.home.budgets}</Text>
          </TouchableOpacity>

          {/* Wallets button */}
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Wallet' })}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
              <MaterialCommunityIcons name="wallet" size={24} color={theme.colors.primary} />
            </View>
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>{t.tabs.wallet}</Text>
          </TouchableOpacity>
        </View>

        {/* Today's spending summary card */}
        <Card style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <MaterialCommunityIcons name="calendar-today" size={20} color={theme.colors.primary} />
            <Text style={[styles.todayTitle, { color: theme.colors.text }]}>{t.home.todaysSpending}</Text>
          </View>
          <Text style={[styles.todayAmount, { color: theme.colors.expense }]}>
            {formatCurrency(todayTotal)}
          </Text>
        </Card>

        {/* Recent expenses list section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t.home.recentExpenses}</Text>
          {/* View All link navigates to full expense list */}
          <TouchableOpacity onPress={() => navigation.navigate('AllExpenses')}>
            <Text style={[styles.viewAll, { color: theme.colors.primary }]}>{t.home.viewAll}</Text>
          </TouchableOpacity>
        </View>

        {recentExpenses.length > 0 ? (
          // Render each recent expense as a touchable card row
          recentExpenses.map((expense) => {
            const catInfo = getCategoryInfo(expense.category);
            return (
              <TouchableOpacity
                key={expense.id}
                onPress={() => navigation.navigate('ExpenseDetail', { expenseId: expense.id })}
              >
                <Card style={styles.expenseCard}>
                  <View style={styles.expenseRow}>
                    {/* Category icon circle */}
                    <View style={[styles.expenseIcon, { backgroundColor: catInfo.color + '20' }]}>
                      <MaterialCommunityIcons name={catInfo.icon as any} size={24} color={catInfo.color} />
                    </View>
                    {/* Expense details (category name and date) */}
                    <View style={styles.expenseInfo}>
                      <Text style={[styles.expenseCategory, { color: theme.colors.text }]}>{expense.category}</Text>
                      <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]}>
                        {formatRelativeDate(expense.date)}
                      </Text>
                    </View>
                    {/* Expense amount */}
                    <Text style={[styles.expenseAmount, { color: theme.colors.expense }]}>
                      -{formatCurrency(expense.amount, expense.currency)}
                    </Text>
                  </View>
                  {/* Notes preview if available */}
                  {expense.notes ? (
                    <Text style={[styles.expenseNotes, { color: theme.colors.textTertiary }]} numberOfLines={1}>
                      {expense.notes}
                    </Text>
                  ) : null}
                </Card>
              </TouchableOpacity>
            );
          })
        ) : (
          // Empty state when no expenses exist yet
          <Card>
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="receipt" size={48} color={theme.colors.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>{t.home.noExpenses}</Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textTertiary }]}>
                {t.home.tapToAdd}
              </Text>
            </View>
          </Card>
        )}

        {/* Bottom spacer for scroll clearance above tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating action button for quick expense addition */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('AddExpense', {})}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', // Horizontal layout for greeting and search
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: { fontSize: 14, fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '700', marginTop: 2 },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22, // Perfect circle
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, overflow: 'hidden' },
  walletGradient: { padding: 24, borderRadius: 20 },
  walletRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  walletAmount: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '600' },
  walletMainBalance: { marginVertical: 16, alignItems: 'center' },
  walletBalanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 },
  walletBalance: { color: '#FFFFFF', fontSize: 36, fontWeight: '700' },
  walletSpent: { color: '#FFB4B4', fontSize: 15, fontWeight: '600' },
  walletSetup: { alignItems: 'center', paddingVertical: 20 },
  walletSetupText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginTop: 12 },
  walletSetupSubtext: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },
  // Mini wallet previews inside the main card
  miniWallets: { marginTop: 12, flexDirection: 'row' },
  miniWallet: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    marginRight: 8, alignItems: 'center', minWidth: 80,
  },
  miniWalletName: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 },
  miniWalletBal: { color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: 2 },
  // Shortcut widgets
  widgetRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  widget: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 0.5,
    alignItems: 'center',
    gap: 6,
  },
  widgetIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  widgetTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  widgetSubtitle: { fontSize: 11, textAlign: 'center' },
  // Quick action buttons
  quickActions: {
    flexDirection: 'row', // Horizontal grid of action buttons
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  quickAction: {
    width: '23%', // ~4 columns with margin
    margin: '1%',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 0.5,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  todayCard: { marginBottom: 8 },
  todayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  todayTitle: { fontSize: 15, fontWeight: '600' },
  todayAmount: { fontSize: 28, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row', // Title and "View All" on the same line
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  viewAll: { fontSize: 14, fontWeight: '600' },
  expenseCard: { paddingVertical: 12 },
  expenseRow: {
    flexDirection: 'row', // Icon, info, and amount in a row
    alignItems: 'center',
  },
  expenseIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: { flex: 1 },
  expenseCategory: { fontSize: 15, fontWeight: '600' },
  expenseDate: { fontSize: 12, marginTop: 2 },
  expenseAmount: { fontSize: 16, fontWeight: '700' },
  expenseNotes: { fontSize: 12, marginTop: 6, marginLeft: 56 },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtext: { fontSize: 13, marginTop: 4 },
  fab: {
    position: 'absolute', // Floating above content
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28, // Circular FAB
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6, // Android shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});

export default HomeScreen;

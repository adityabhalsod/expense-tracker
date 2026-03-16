// Home dashboard screen showing wallet summary, recent expenses, and quick actions
// Serves as the main entry point after app launch

import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppStore } from '../store';
import Card from '../components/common/Card';
import { formatCurrency, getGreeting, formatRelativeDate } from '../utils/helpers';

const HomeScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  // Subscribe to relevant store slices for reactive updates
  const { expenses, currentWallet, categories, isLoading, initialize, loadExpenses, loadCurrentWallet } = useAppStore();

  // Refresh data whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadExpenses(50);
      loadCurrentWallet();
    }, [])
  );

  // Pull-to-refresh handler reloads all data
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await initialize();
    setRefreshing(false);
  };

  // Get the 5 most recent expenses for the dashboard preview
  const recentExpenses = expenses.slice(0, 5);

  // Calculate today's total spending from expenses
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTotal = expenses
    .filter(e => e.date === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  // Find icon and color for a category name from the categories list
  const getCategoryInfo = (categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    return { icon: cat?.icon || 'help-circle', color: cat?.color || '#999' };
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
            <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>{getGreeting()}</Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>Dashboard</Text>
          </View>
          {/* Search icon navigates to the search screen */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Search')}
            style={[styles.searchButton, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <MaterialCommunityIcons name="magnify" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Wallet balance summary card */}
        <View style={styles.walletCard}>
          <View style={[styles.walletGradient, { backgroundColor: theme.colors.primary }]}>
            {currentWallet ? (
              <>
                {/* Starting balance display */}
                <View style={styles.walletRow}>
                  <Text style={styles.walletLabel}>Starting Balance</Text>
                  <Text style={styles.walletAmount}>
                    {formatCurrency(currentWallet.initialBalance, currentWallet.currency)}
                  </Text>
                </View>
                {/* Current remaining balance (large emphasis) */}
                <View style={styles.walletMainBalance}>
                  <Text style={styles.walletBalanceLabel}>Remaining Balance</Text>
                  <Text style={styles.walletBalance}>
                    {formatCurrency(currentWallet.currentBalance, currentWallet.currency)}
                  </Text>
                </View>
                {/* Total spent this month */}
                <View style={styles.walletRow}>
                  <Text style={styles.walletLabel}>Total Spent</Text>
                  <Text style={styles.walletSpent}>
                    {formatCurrency(currentWallet.initialBalance - currentWallet.currentBalance, currentWallet.currency)}
                  </Text>
                </View>
              </>
            ) : (
              // Prompt user to set up their wallet if none exists
              <TouchableOpacity onPress={() => navigation.navigate('WalletSetup')} style={styles.walletSetup}>
                <MaterialCommunityIcons name="wallet-plus" size={40} color="rgba(255,255,255,0.9)" />
                <Text style={styles.walletSetupText}>Set up your wallet</Text>
                <Text style={styles.walletSetupSubtext}>Add your monthly salary to get started</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick action buttons grid */}
        <View style={styles.quickActions}>
          {/* Add Expense button */}
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('AddExpense', {})}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
              <MaterialCommunityIcons name="plus" size={24} color={theme.colors.primary} />
            </View>
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>Add Expense</Text>
          </TouchableOpacity>

          {/* Analytics button */}
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Analytics' })}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="chart-line" size={24} color="#F59E0B" />
            </View>
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>Analytics</Text>
          </TouchableOpacity>

          {/* Export button */}
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('ExportReport')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#ECFDF5' }]}>
              <MaterialCommunityIcons name="download" size={24} color="#10B981" />
            </View>
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>Export</Text>
          </TouchableOpacity>

          {/* Budget button */}
          <TouchableOpacity
            style={[styles.quickAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('BudgetSetup')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="target" size={24} color="#EF4444" />
            </View>
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>Budgets</Text>
          </TouchableOpacity>
        </View>

        {/* Today's spending summary card */}
        <Card style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <MaterialCommunityIcons name="calendar-today" size={20} color={theme.colors.primary} />
            <Text style={[styles.todayTitle, { color: theme.colors.text }]}>Today's Spending</Text>
          </View>
          <Text style={[styles.todayAmount, { color: theme.colors.expense }]}>
            {formatCurrency(todayTotal)}
          </Text>
        </Card>

        {/* Recent expenses list section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Expenses</Text>
          {/* View All link navigates to full expense list */}
          <TouchableOpacity onPress={() => navigation.navigate('AllExpenses')}>
            <Text style={[styles.viewAll, { color: theme.colors.primary }]}>View All</Text>
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
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No expenses yet</Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textTertiary }]}>
                Tap + to add your first expense
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

// Expenses list screen with filtering tabs (All, Today, This Week, This Month)
// Provides a scrollable list of expenses grouped by date

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppStore, selectExpenses, selectCategories } from '../store';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency, formatRelativeDate } from '../utils/helpers';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { useLanguage } from '../i18n';

const ExpensesScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  // Subscribe to individual store slices to avoid full-store re-renders
  const expenses = useAppStore(selectExpenses);
  const categories = useAppStore(selectCategories);
  const loadExpenses = useAppStore((s) => s.loadExpenses);
  const { t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<string>('All'); // Currently selected filter

  // Filter label keys for translation
  const FILTERS = [
    { key: 'All', label: t.expenses.all },
    { key: 'Today', label: t.expenses.today },
    { key: 'This Week', label: t.expenses.thisWeek },
    { key: 'This Month', label: t.expenses.thisMonth },
  ];

  // Refresh expenses when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadExpenses(100); // Load up to 100 expenses
    }, [])
  );

  // Filter expenses based on selected time range (memoized to avoid recalculation every render)
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    switch (activeFilter) {
      case 'Today':
        return expenses.filter(e => e.date === todayStr);
      case 'This Week': {
        const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        return expenses.filter(e => e.date >= weekStart && e.date <= weekEnd);
      }
      case 'This Month': {
        const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
        return expenses.filter(e => e.date >= monthStart && e.date <= monthEnd);
      }
      default:
        return expenses;
    }
  }, [expenses, activeFilter]);

  // Calculate total for the filtered set of expenses (memoized)
  const totalFiltered = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  // Get category info (icon and color) for display (memoized callback)
  const getCategoryInfo = useCallback((categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    return { icon: cat?.icon || 'help-circle', color: cat?.color || '#999' };
  }, [categories]);

  // Render a single expense item in the list
  const renderExpenseItem = ({ item }: { item: typeof expenses[0] }) => {
    const catInfo = getCategoryInfo(item.category);
    return (
      <TouchableOpacity
        style={[styles.expenseItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })}
      >
        <View style={styles.expenseRow}>
          {/* Category icon with background color */}
          <View style={[styles.iconCircle, { backgroundColor: catInfo.color + '20' }]}>
            <MaterialCommunityIcons name={catInfo.icon as any} size={22} color={catInfo.color} />
          </View>
          {/* Expense category and date */}
          <View style={styles.expenseInfo}>
            <Text style={[styles.expenseCategory, { color: theme.colors.text }]}>{item.category}</Text>
            <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]}>
              {formatRelativeDate(item.date)}
              {item.notes ? ` • ${item.notes}` : '' /* Show notes preview if available */}
            </Text>
          </View>
          {/* Expense amount displayed in red */}
          <Text style={[styles.expenseAmount, { color: theme.colors.expense }]}>
            -{formatCurrency(item.amount, item.currency)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Screen header with title and search button */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t.expenses.title}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search')}>
          <MaterialCommunityIcons name="magnify" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Filter tabs row */}
      <View style={styles.filterRow}>
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterChip,
              {
                backgroundColor: activeFilter === filter.key ? theme.colors.primary : theme.colors.surfaceVariant,
                borderColor: activeFilter === filter.key ? theme.colors.primary : theme.colors.border,
              },
            ]}
            onPress={() => setActiveFilter(filter.key)} // Switch active filter
          >
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === filter.key ? '#FFFFFF' : theme.colors.text },
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total amount summary for active filter */}
      <View style={[styles.totalBar, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>
          {FILTERS.find(f => f.key === activeFilter)?.label} {t.common.total} ({filteredExpenses.length} {t.common.transactions})
        </Text>
        <Text style={[styles.totalAmount, { color: theme.colors.expense }]}>
          {formatCurrency(totalFiltered)}
        </Text>
      </View>

      {/* Scrollable expense list or empty state */}
      <FlatList
        data={filteredExpenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        initialNumToRender={15}
        ListEmptyComponent={
          <EmptyState
            icon="receipt"
            title={t.expenses.noExpenses}
            subtitle={t.expenses.addFirstExpense}
            actionLabel={t.expenses.addExpense}
            onAction={() => navigation.navigate('AddExpense', {})}
          />
        }
      />

      {/* Floating add button */}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700' },
  filterRow: {
    flexDirection: 'row', // Horizontal filter tabs
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  totalBar: {
    flexDirection: 'row', // Label and amount side by side
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  totalLabel: { fontSize: 13, fontWeight: '500' },
  totalAmount: { fontSize: 18, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  expenseItem: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 0.5,
  },
  expenseRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: { flex: 1 },
  expenseCategory: { fontSize: 15, fontWeight: '600' },
  expenseDate: { fontSize: 12, marginTop: 2 },
  expenseAmount: { fontSize: 15, fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});

export default ExpensesScreen;

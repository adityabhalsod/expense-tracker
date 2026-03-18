// Full expense list screen with advanced filtering and sorting
// Displays all expenses with date sections and action options

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectExpenses, selectCategories, selectSettings } from '../store';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency, formatDate, formatRelativeDate } from '../utils/helpers';
import { useNavigation } from '@react-navigation/native';
import { Expense } from '../types';

// Sort options for the expense list
type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

const AllExpensesScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  // Subscribe to individual store slices to avoid full-store re-renders
  const expenses = useAppStore(selectExpenses);
  const categories = useAppStore(selectCategories);
  const settings = useAppStore(selectSettings);
  const loadExpenses = useAppStore((s) => s.loadExpenses);

  const [sortBy, setSortBy] = useState<SortOption>('date_desc'); // Default: newest first
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  // Refresh handler for pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  };

  // Sort expenses based on selected criteria
  const sortedExpenses = useMemo(() => {
    const sorted = [...expenses];
    switch (sortBy) {
      case 'date_desc':
        return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      case 'date_asc':
        return sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'amount_desc':
        return sorted.sort((a, b) => b.amount - a.amount);
      case 'amount_asc':
        return sorted.sort((a, b) => a.amount - b.amount);
      default:
        return sorted;
    }
  }, [expenses, sortBy]);

  // Group expenses by date for section-style rendering
  const groupedExpenses = useMemo(() => {
    const groups: { date: string; expenses: Expense[]; total: number }[] = [];
    const map = new Map<string, Expense[]>();

    sortedExpenses.forEach(expense => {
      const dateKey = formatDate(expense.date, 'yyyy-MM-dd');
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(expense);
    });

    map.forEach((exps, date) => {
      groups.push({
        date,
        expenses: exps,
        total: exps.reduce((sum, e) => sum + e.amount, 0),
      });
    });

    return groups;
  }, [sortedExpenses]);

  // Lookup category details by name
  const getCategory = (categoryName: string) => {
    return categories.find(c => c.name === categoryName);
  };

  // Navigate to expense detail view
  const handleExpensePress = (expense: Expense) => {
    navigation.navigate('ExpenseDetail', { expenseId: expense.id });
  };

  // Cycle through sort options on button press
  const cycleSortOption = () => {
    const options: SortOption[] = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'];
    const currentIdx = options.indexOf(sortBy);
    setSortBy(options[(currentIdx + 1) % options.length]);
  };

  // Human-readable sort label for current selection
  const getSortLabel = () => {
    switch (sortBy) {
      case 'date_desc': return t.allExpenses.newestFirst;
      case 'date_asc': return t.allExpenses.oldestFirst;
      case 'amount_desc': return t.allExpenses.highestAmount;
      case 'amount_asc': return t.allExpenses.lowestAmount;
    }
  };

  // Calculate total of all visible expenses (memoized)
  const totalAmount = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  // Render a single expense row
  const renderExpenseItem = (expense: Expense) => {
    const category = getCategory(expense.category);
    return (
      <TouchableOpacity
        key={expense.id}
        style={[styles.expenseItem, { borderBottomColor: theme.colors.border }]}
        onPress={() => handleExpensePress(expense)}
      >
        <View style={[styles.catIcon, { backgroundColor: (category?.color || theme.colors.primary) + '15' }]}>
          <MaterialCommunityIcons
            name={(category?.icon || 'tag') as any}
            size={20}
            color={category?.color || theme.colors.primary}
          />
        </View>
        <View style={styles.expenseInfo}>
          <Text style={[styles.expenseName, { color: theme.colors.text }]} numberOfLines={1}>
            {expense.notes || category?.name || t.allExpenses.expense}
          </Text>
          <Text style={[styles.expensePayment, { color: theme.colors.textTertiary }]}>
            {expense.category}
          </Text>
        </View>
        <Text style={[styles.expenseAmount, { color: theme.colors.error }]}>
          -{formatCurrency(expense.amount, expense.currency)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Summary bar showing total and sort control */}
      <View style={[styles.summaryBar, { backgroundColor: theme.colors.surface }]}>
        <View>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>{t.allExpenses.totalExpenses}</Text>
          <Text style={[styles.summaryAmount, { color: theme.colors.text }]}>
            {formatCurrency(totalAmount, settings.defaultCurrency)}
          </Text>
        </View>

        {/* Sort toggle button */}
        <TouchableOpacity style={[styles.sortBtn, { backgroundColor: theme.colors.inputBackground }]} onPress={cycleSortOption}>
          <MaterialCommunityIcons name="sort" size={18} color={theme.colors.primary} />
          <Text style={[styles.sortLabel, { color: theme.colors.primary }]}>{getSortLabel()}</Text>
        </TouchableOpacity>
      </View>

      {/* Expense list grouped by date */}
      {expenses.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={t.allExpenses.noExpenses}
          subtitle={t.allExpenses.noExpensesHint}
          actionLabel={t.allExpenses.addExpense}
          onAction={() => navigation.navigate('AddExpense')}
        />
      ) : (
        <FlatList
          data={groupedExpenses}
          keyExtractor={item => item.date}
          windowSize={10}
          maxToRenderPerBatch={8}
          removeClippedSubviews={true}
          initialNumToRender={10}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
          }
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: group }) => (
            <View style={styles.dateGroup}>
              {/* Date section header with daily total */}
              <View style={styles.dateHeader}>
                <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
                  {formatRelativeDate(group.date)}
                </Text>
                <Text style={[styles.dateTotal, { color: theme.colors.text }]}>
                  {formatCurrency(group.total, settings.defaultCurrency)}
                </Text>
              </View>
              {/* Expense items within this date group */}
              <Card>
                {group.expenses.map(renderExpenseItem)}
              </Card>
            </View>
          )}
          ListFooterComponent={<View style={{ height: 80 }} />}
        />
      )}

      {/* Floating add button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('AddExpense')}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  summaryLabel: { fontSize: 12 },
  summaryAmount: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  sortLabel: { fontSize: 12, fontWeight: '600' },
  dateGroup: { marginBottom: 16 },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8, paddingHorizontal: 4,
  },
  dateText: { fontSize: 13, fontWeight: '600' },
  dateTotal: { fontSize: 13, fontWeight: '600' },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  catIcon: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  expenseInfo: { flex: 1 },
  expenseName: { fontSize: 14, fontWeight: '600' },
  expensePayment: { fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  expenseAmount: { fontSize: 15, fontWeight: '700' },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4,
  },
});

export default AllExpensesScreen;

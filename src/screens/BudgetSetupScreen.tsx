// Budget setup screen for creating and managing monthly budgets per category
// Users can set spending limits and track budget utilization

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useAppStore } from '../store';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency, getCurrencySymbol } from '../utils/helpers';
import { MONTH_NAMES } from '../constants';
import { Budget } from '../types';

const BudgetSetupScreen = () => {
  const { theme } = useTheme();
  const { budgets, categories, settings, loadBudgets, addBudget, updateBudget, deleteBudget, expenses } = useAppStore();

  const [showModal, setShowModal] = useState(false); // Budget edit modal visibility
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null); // Budget being edited
  const [selectedCategory, setSelectedCategory] = useState(''); // Selected category ID
  const [amount, setAmount] = useState(''); // Budget amount input
  const now = new Date();
  const [currentMonth] = useState(now.getMonth() + 1); // 1-indexed month number
  const [currentYear] = useState(now.getFullYear());

  // Load budgets for the current month on mount
  useEffect(() => {
    loadBudgets(currentMonth, currentYear);
  }, [currentMonth, currentYear]);

  // Calculate total spending for a category in the current month
  const getCategorySpending = useCallback((categoryId: string) => {
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0);
    const catName = categories.find(c => c.id === categoryId)?.name || '';

    return expenses
      .filter(e => e.category === catName &&
        new Date(e.date) >= monthStart &&
        new Date(e.date) <= monthEnd)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, currentMonth, currentYear, categories]);

  // Open modal for adding a new budget
  const handleAddBudget = () => {
    setEditingBudget(null);
    setSelectedCategory('');
    setAmount('');
    setShowModal(true);
  };

  // Open modal for editing an existing budget
  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setSelectedCategory(budget.categoryId || '');
    setAmount(budget.amount.toString());
    setShowModal(true);
  };

  // Save new or updated budget
  const handleSave = async () => {
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid budget amount.');
      return;
    }

    // Prevent duplicate budgets for same category in a month
    const existing = budgets.find(b => b.categoryId === selectedCategory && b.id !== editingBudget?.id);
    if (existing) {
      Alert.alert('Error', 'A budget already exists for this category. Please edit the existing one.');
      return;
    }

    if (editingBudget) {
      await updateBudget(editingBudget.id, { amount: numAmount, categoryId: selectedCategory });
    } else {
      await addBudget({ categoryId: selectedCategory, amount: numAmount, period: 'monthly', month: currentMonth, year: currentYear, notifyAt: 80 });
    }

    setShowModal(false);
    await loadBudgets(currentMonth, currentYear);
  };

  // Confirm and delete a budget
  const handleDelete = (budget: Budget) => {
    Alert.alert('Delete Budget', 'Are you sure you want to remove this budget?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteBudget(budget.id);
          await loadBudgets(currentMonth, currentYear);
        },
      },
    ]);
  };

  // Calculate budget progress percentage (capped at 100%)
  const getProgress = (spent: number, total: number) => Math.min(spent / total, 1);

  // Determine color based on spending percentage thresholds
  const getProgressColor = (progress: number) => {
    if (progress >= 1) return theme.colors.error; // Over budget
    if (progress >= 0.8) return theme.colors.warning; // Approaching limit
    return theme.colors.success; // Under budget
  };

  // Find category name by ID
  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  // Find category icon by ID
  const getCategoryIcon = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.icon || 'tag';
  };

  // Calculate aggregate totals across all budgets
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + getCategorySpending(b.categoryId || ''), 0);
  const overallProgress = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const currency = getCurrencySymbol(settings.defaultCurrency);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollContent}>
        {/* Monthly overview card with overall budget progress */}
        <Card>
          <View style={styles.overviewHeader}>
            <Text style={[styles.overviewMonth, { color: theme.colors.textSecondary }]}>
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </Text>
            <Text style={[styles.overviewTitle, { color: theme.colors.text }]}>Monthly Budget</Text>
          </View>

          {/* Total spent vs total budget */}
          <View style={styles.overviewRow}>
            <View>
              <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>Spent</Text>
              <Text style={[styles.overviewAmount, { color: getProgressColor(overallProgress) }]}>
                {formatCurrency(totalSpent, settings.defaultCurrency)}
              </Text>
            </View>
            <View style={styles.overviewRight}>
              <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>Budget</Text>
              <Text style={[styles.overviewAmount, { color: theme.colors.text }]}>
                {formatCurrency(totalBudget, settings.defaultCurrency)}
              </Text>
            </View>
          </View>

          {/* Overall progress bar */}
          <View style={[styles.progressBarBg, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(overallProgress, 1) * 100}%`,
                  backgroundColor: getProgressColor(overallProgress),
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
            {Math.round(overallProgress * 100)}% used
          </Text>
        </Card>

        {/* Budget list section header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Category Budgets ({budgets.length})
          </Text>
        </View>

        {/* Individual budget cards or empty state */}
        {budgets.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="No Budgets Set"
            subtitle="Create budgets to track your spending by category"
            actionLabel="Add Budget"
            onAction={handleAddBudget}
          />
        ) : (
          budgets.map((budget) => {
            const spent = getCategorySpending(budget.categoryId || '');
            const progress = getProgress(spent, budget.amount);
            const remaining = budget.amount - spent;

            return (
              <Card key={budget.id} onPress={() => handleEditBudget(budget)}>
                {/* Category name and budget amount */}
                <View style={styles.budgetHeader}>
                  <View style={styles.budgetCategoryRow}>
                    <View style={[styles.categoryIcon, { backgroundColor: getProgressColor(progress) + '15' }]}>
                      <MaterialCommunityIcons
                        name={getCategoryIcon(budget.categoryId || '') as any}
                        size={20}
                        color={getProgressColor(progress)}
                      />
                    </View>
                    <Text style={[styles.budgetCategory, { color: theme.colors.text }]}>
                      {getCategoryName(budget.categoryId || '')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(budget)}>
                    <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>

                {/* Spending progress bar for this category */}
                <View style={[styles.progressBarBg, { backgroundColor: theme.colors.border, marginTop: 12 }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progress * 100}%`, backgroundColor: getProgressColor(progress) },
                    ]}
                  />
                </View>

                {/* Amount details: spent / budget, remaining */}
                <View style={styles.budgetDetails}>
                  <Text style={[styles.budgetSpent, { color: theme.colors.textSecondary }]}>
                    {formatCurrency(spent, settings.defaultCurrency)} / {formatCurrency(budget.amount, settings.defaultCurrency)}
                  </Text>
                  <Text style={[styles.budgetRemaining, { color: remaining >= 0 ? theme.colors.success : theme.colors.error }]}>
                    {remaining >= 0 ? `${formatCurrency(remaining, settings.defaultCurrency)} left` : `${formatCurrency(Math.abs(remaining), settings.defaultCurrency)} over`}
                  </Text>
                </View>
              </Card>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating action button for adding new budgets */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={handleAddBudget}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Budget creation/edit modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingBudget ? 'Edit Budget' : 'New Budget'}
            </Text>

            {/* Category selection grid */}
            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories
                .map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: selectedCategory === cat.id ? theme.colors.primary : theme.colors.inputBackground,
                        borderColor: selectedCategory === cat.id ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <MaterialCommunityIcons
                      name={cat.icon as any}
                      size={16}
                      color={selectedCategory === cat.id ? '#FFF' : theme.colors.text}
                    />
                    <Text style={[styles.categoryChipText, { color: selectedCategory === cat.id ? '#FFF' : theme.colors.text }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Budget amount input */}
            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>
              Monthly Budget Amount
            </Text>
            <View style={[styles.amountInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
              <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>{currency}</Text>
              <TextInput
                style={[styles.amountField, { color: theme.colors.text }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Save and cancel actions */}
            <View style={styles.modalActions}>
              <Button title="Save" onPress={handleSave} size="large" style={{ flex: 1 }} />
              <Button
                title="Cancel"
                onPress={() => setShowModal(false)}
                variant="outline"
                size="large"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flex: 1, padding: 16 },
  overviewHeader: { marginBottom: 16 },
  overviewMonth: { fontSize: 13, fontWeight: '500' },
  overviewTitle: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  overviewRight: { alignItems: 'flex-end' },
  overviewLabel: { fontSize: 12 },
  overviewAmount: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 12, marginTop: 6, textAlign: 'right' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetCategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  budgetCategory: { fontSize: 15, fontWeight: '600' },
  budgetDetails: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  budgetSpent: { fontSize: 12 },
  budgetRemaining: { fontSize: 12, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end', // Slide up from bottom
  },
  modalContent: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '80%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  categoryScroll: { maxHeight: 44 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, marginRight: 8,
  },
  categoryChipText: { fontSize: 13, fontWeight: '500' },
  amountInput: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 16,
  },
  currencySymbol: { fontSize: 20, fontWeight: '600', marginRight: 8 },
  amountField: { flex: 1, fontSize: 24, fontWeight: '700', paddingVertical: 14 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
});

export default BudgetSetupScreen;

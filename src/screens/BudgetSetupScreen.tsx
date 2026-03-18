// Budget setup screen for creating and managing budgets per category
// Supports daily, weekly, monthly, quarterly, yearly periods and wallet association

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectBudgets, selectCategories, selectSettings, selectExpenses, selectWallets } from '../store';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency, getCurrencySymbol, formatAmountInput } from '../utils/helpers';
import { Budget, BudgetPeriod } from '../types';

const BudgetSetupScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // Subscribe to individual store slices to avoid full-store re-renders
  const budgets = useAppStore(selectBudgets);
  const categories = useAppStore(selectCategories);
  const settings = useAppStore(selectSettings);
  const expenses = useAppStore(selectExpenses);
  const wallets = useAppStore(selectWallets);
  const loadBudgets = useAppStore((s) => s.loadBudgets);
  const addBudget = useAppStore((s) => s.addBudget);
  const updateBudget = useAppStore((s) => s.updateBudget);
  const deleteBudget = useAppStore((s) => s.deleteBudget);

  const [showModal, setShowModal] = useState(false); // Budget edit modal visibility
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null); // Budget being edited
  // Default category selection: use the category marked as default (e.g., Food & Dining)
  const defaultCategory = categories.find(c => c.isDefault);
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory?.id || '');
  const [amount, setAmount] = useState(''); // Budget amount input
  const [selectedPeriod, setSelectedPeriod] = useState<BudgetPeriod>('monthly'); // Budget period type
  const [selectedWalletId, setSelectedWalletId] = useState(''); // Optional wallet association
  const now = new Date();
  const [currentMonth] = useState(now.getMonth() + 1); // 1-indexed month number
  const [currentYear] = useState(now.getFullYear());

  // Available budget period options
  const PERIOD_OPTIONS: { value: BudgetPeriod; label: string }[] = [
    { value: 'daily', label: t.frequencies.daily },
    { value: 'weekly', label: t.frequencies.weekly },
    { value: 'monthly', label: t.frequencies.monthly },
    { value: 'quarterly', label: t.frequencies.quarterly },
    { value: 'yearly', label: t.frequencies.yearly },
  ];

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

  // Open modal for adding a new budget with default category pre-selected
  const handleAddBudget = () => {
    setEditingBudget(null);
    setSelectedCategory(defaultCategory?.id || ''); // Pre-select default category
    setAmount('');
    setSelectedPeriod('monthly'); // Default to monthly period
    setSelectedWalletId(''); // No wallet by default
    setShowModal(true);
  };

  // Open modal for editing an existing budget
  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setSelectedCategory(budget.categoryId || '');
    setAmount(budget.amount.toString());
    setSelectedPeriod(budget.period || 'monthly'); // Restore saved period
    setSelectedWalletId(budget.walletId || ''); // Restore saved wallet
    setShowModal(true);
  };

  // Sanitize budget amount input: strip commas, only digits & one decimal, cap at 10 int + 2 decimal
  const handleAmountChange = useCallback((text: string) => {
    let cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
    if (parts[0].length > 10) parts[0] = parts[0].slice(0, 10);
    if (parts.length === 2 && parts[1].length > 2) parts[1] = parts[1].slice(0, 2);
    cleaned = parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts[0];
    setAmount(cleaned);
  }, []);

  // Save new or updated budget
  const handleSave = async () => {
    if (!selectedCategory) {
      Alert.alert(t.common.error, t.budget.selectCategory);
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert(t.common.error, t.budget.validAmount);
      return;
    }

    // Prevent duplicate budgets for same category in a month
    const existing = budgets.find(b => b.categoryId === selectedCategory && b.id !== editingBudget?.id);
    if (existing) {
      Alert.alert(t.common.error, t.budget.duplicateBudget);
      return;
    }

    if (editingBudget) {
      await updateBudget(editingBudget.id, { amount: numAmount, categoryId: selectedCategory, period: selectedPeriod, walletId: selectedWalletId || undefined });
    } else {
      await addBudget({
        categoryId: selectedCategory,
        amount: numAmount,
        period: selectedPeriod, // User-selected period (daily/weekly/monthly/etc.)
        month: currentMonth,
        year: currentYear,
        notifyAt: 80,
        walletId: selectedWalletId || undefined, // Optional wallet association
      });
    }

    setShowModal(false);
    await loadBudgets(currentMonth, currentYear);
  };

  // Confirm and delete a budget
  const handleDelete = (budget: Budget) => {
    Alert.alert(t.budget.deleteTitle, t.budget.deleteMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete, style: 'destructive',
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

  // Get display label for a budget period
  const getPeriodLabel = (period: string) => {
    return PERIOD_OPTIONS.find(p => p.value === period)?.label || period;
  };

  // Find wallet name by ID for display
  const getWalletName = (walletId?: string) => {
    if (!walletId) return null;
    const w = wallets.find(w => w.id === walletId);
    return w ? (w.nickname || w.name) : null;
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
              {t.months[currentMonth - 1]} {currentYear}
            </Text>
            <Text style={[styles.overviewTitle, { color: theme.colors.text }]}>{t.budget.monthlyBudget}</Text>
          </View>

          {/* Total spent vs total budget */}
          <View style={styles.overviewRow}>
            <View>
              <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>{t.budget.spent}</Text>
              <Text style={[styles.overviewAmount, { color: getProgressColor(overallProgress) }]}>
                {formatCurrency(totalSpent, settings.defaultCurrency)}
              </Text>
            </View>
            <View style={styles.overviewRight}>
              <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>{t.budget.budget}</Text>
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
            {Math.round(overallProgress * 100)}% {t.budget.used}
          </Text>
        </Card>

        {/* Budget list section header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t.budget.categoryBudgets} ({budgets.length})
          </Text>
        </View>

        {/* Individual budget cards or empty state */}
        {budgets.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title={t.budget.noBudgets}
            subtitle={t.budget.noBudgetsHint}
            actionLabel={t.budget.addBudget}
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
                    <View>
                      <Text style={[styles.budgetCategory, { color: theme.colors.text }]}>
                        {getCategoryName(budget.categoryId || '')}
                      </Text>
                      {/* Period and wallet labels */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>
                          {getPeriodLabel(budget.period)}
                        </Text>
                        {getWalletName(budget.walletId) && (
                          <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>
                            • {getWalletName(budget.walletId)}
                          </Text>
                        )}
                      </View>
                    </View>
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
                    {remaining >= 0 ? `${formatCurrency(remaining, settings.defaultCurrency)} ${t.budget.left}` : `${formatCurrency(Math.abs(remaining), settings.defaultCurrency)} ${t.budget.over}`}
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
              {editingBudget ? t.budget.editBudget : t.budget.newBudget}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category selection grid */}
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>{t.budget.category}</Text>
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

              {/* Budget period selector — daily, weekly, monthly, quarterly, yearly */}
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>
                Budget Period
              </Text>
              <View style={styles.periodRow}>
                {PERIOD_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.periodChip,
                      {
                        backgroundColor: selectedPeriod === opt.value ? theme.colors.primary : theme.colors.inputBackground,
                        borderColor: selectedPeriod === opt.value ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => setSelectedPeriod(opt.value)} // Set selected period
                  >
                    <Text style={{
                      color: selectedPeriod === opt.value ? '#FFF' : theme.colors.text,
                      fontSize: 12, fontWeight: '600',
                    }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Wallet/payment source selector — optional */}
              {wallets.length > 0 && (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>
                    Wallet (Optional)
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {/* "All Wallets" option to track without wallet filter */}
                    <TouchableOpacity
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: selectedWalletId === '' ? theme.colors.primary : theme.colors.inputBackground,
                          borderColor: selectedWalletId === '' ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                      onPress={() => setSelectedWalletId('')}
                    >
                      <MaterialCommunityIcons
                        name="wallet-outline"
                        size={16}
                        color={selectedWalletId === '' ? '#FFF' : theme.colors.text}
                      />
                      <Text style={[styles.categoryChipText, { color: selectedWalletId === '' ? '#FFF' : theme.colors.text }]}>
                        All Wallets
                      </Text>
                    </TouchableOpacity>
                    {wallets.map((w) => (
                      <TouchableOpacity
                        key={w.id}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: selectedWalletId === w.id ? w.color + '20' : theme.colors.inputBackground,
                            borderColor: selectedWalletId === w.id ? w.color : theme.colors.border,
                          },
                        ]}
                        onPress={() => setSelectedWalletId(w.id)} // Assign wallet to budget
                      >
                        <MaterialCommunityIcons
                          name={w.iconName as any}
                          size={16}
                          color={selectedWalletId === w.id ? w.color : theme.colors.text}
                        />
                        <Text style={[styles.categoryChipText, { color: selectedWalletId === w.id ? w.color : theme.colors.text }]}>
                          {w.nickname || w.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Budget amount input */}
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>
                {t.budget.monthlyBudgetAmount}
              </Text>
              <View style={[styles.amountInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>{currency}</Text>
                <TextInput
                  style={[styles.amountField, { color: theme.colors.text }]}
                  value={formatAmountInput(amount)}
                  onChangeText={handleAmountChange}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Save and cancel actions */}
              <View style={styles.modalActions}>
                <Button title={t.common.save} onPress={handleSave} size="large" style={{ flex: 1 }} />
                <Button
                  title={t.common.cancel}
                  onPress={() => setShowModal(false)}
                  variant="outline"
                  size="large"
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
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
  // Period selector row with wrapping chips
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  amountInput: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 16,
  },
  currencySymbol: { fontSize: 20, fontWeight: '600', marginRight: 8 },
  amountField: { flex: 1, fontSize: 24, fontWeight: '700', paddingVertical: 14 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
});

export default BudgetSetupScreen;

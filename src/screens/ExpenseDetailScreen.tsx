// Expense detail screen showing full information about a single expense
// Provides edit and delete actions with confirmation dialog

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectExpenses, selectCategories } from '../store';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { formatCurrency, formatDate } from '../utils/helpers';

const ExpenseDetailScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { expenseId } = route.params; // ID of the expense to display

  // Find the expense from the global store
  // Subscribe to individual store slices to avoid full-store re-renders
  const expenses = useAppStore(selectExpenses);
  const categories = useAppStore(selectCategories);
  const deleteExpense = useAppStore((s) => s.deleteExpense);
  const expense = expenses.find(e => e.id === expenseId);

  // Handle missing expense (edge case if deleted elsewhere)
  if (!expense) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.colors.textSecondary }}>{t.expenseDetail.notFound}</Text>
      </View>
    );
  }

  // Get category details for icon and color display
  const category = categories.find(c => c.name === expense.category);

  // Confirm and execute expense deletion
  const handleDelete = () => {
    Alert.alert(
      t.expenseDetail.deleteTitle,
      t.expenseDetail.deleteMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            await deleteExpense(expense.id); // Delete from database and restore wallet
            navigation.goBack(); // Return to previous screen
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Amount display card with category icon */}
      <View style={[styles.amountCard, { backgroundColor: theme.colors.primary }]}>
        {/* Category icon circle */}
        <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <MaterialCommunityIcons
            name={(category?.icon || 'help-circle') as any}
            size={32}
            color="#FFFFFF"
          />
        </View>
        {/* Category name */}
        <Text style={styles.categoryText}>{expense.category}</Text>
        {/* Large amount display */}
        <Text style={styles.amountText}>{formatCurrency(expense.amount, expense.currency)}</Text>
        {/* Date below amount */}
        <Text style={styles.dateText}>{formatDate(expense.date, 'EEEE, MMMM dd, yyyy')}</Text>
      </View>

      {/* Detail rows showing all expense fields */}
      <Card style={styles.detailCard}>
        {/* Currency detail row */}
        <DetailRow icon="currency-usd" label={t.expenseDetail.currency} value={expense.currency} theme={theme} />
        {/* Notes detail row (if present) */}
        {expense.notes ? (
          <DetailRow icon="note-text" label={t.expenseDetail.notes} value={expense.notes} theme={theme} />
        ) : null}
        {/* Tags detail row (if any tags exist) */}
        {expense.tags.length > 0 && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="tag-multiple" size={20} color={theme.colors.primary} />
            <View style={styles.detailInfo}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>{t.expenseDetail.tags}</Text>
              <View style={styles.tagsRow}>
                {expense.tags.map((tag, index) => (
                  <View key={index} style={[styles.tagChip, { backgroundColor: theme.colors.chipBackground }]}>
                    <Text style={[styles.tagText, { color: theme.colors.chipText }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
        {/* Recurring indicator (if recurring) */}
        {expense.isRecurring && (
          <DetailRow
            icon="repeat"
            label={t.expenseDetail.recurring}
            value={expense.recurringFrequency || 'Enabled'}
            theme={theme}
          />
        )}
        {/* Creation timestamp */}
        <DetailRow
          icon="clock-outline"
          label={t.expenseDetail.created}
          value={formatDate(expense.createdAt, 'MMM dd, yyyy HH:mm')}
          theme={theme}
        />
      </Card>

      {/* Action buttons: Edit and Delete */}
      <View style={styles.actions}>
        <Button
          title={t.expenseDetail.editExpense}
          onPress={() => navigation.navigate('AddExpense', { expenseId: expense.id })}
          variant="primary"
          fullWidth
          icon={<MaterialCommunityIcons name="pencil" size={20} color="#FFF" />}
        />
        <View style={{ height: 12 }} />
        <Button
          title={t.expenseDetail.deleteExpense}
          onPress={handleDelete}
          variant="danger"
          fullWidth
          icon={<MaterialCommunityIcons name="delete" size={20} color="#FFF" />}
        />
      </View>

      {/* Bottom spacer */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

// Reusable row component for displaying a labeled detail with icon
const DetailRow = ({ icon, label, value, theme }: { icon: string; label: string; value: string; theme: any }) => (
  <View style={styles.detailRow}>
    <MaterialCommunityIcons name={icon as any} size={20} color={theme.colors.primary} />
    <View style={styles.detailInfo}>
      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  amountCard: {
    padding: 32,
    alignItems: 'center', // Center all amount card content
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryText: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '500' },
  amountText: { color: '#FFFFFF', fontSize: 40, fontWeight: '700', marginVertical: 8 },
  dateText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  detailCard: { marginTop: 16 },
  detailRow: {
    flexDirection: 'row', // Icon and text side by side
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  detailInfo: { flex: 1 },
  detailLabel: { fontSize: 12, marginBottom: 2 },
  detailValue: { fontSize: 15, fontWeight: '500' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 12, fontWeight: '500' },
  actions: { padding: 16, marginTop: 8 },
});

export default ExpenseDetailScreen;

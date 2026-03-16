// Add/Edit expense form screen with category selection, amount input, and smart defaults
// Handles both creating new expenses and editing existing ones

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppStore } from '../store';
import { PaymentMethod, RecurringFrequency } from '../types';
import { PAYMENT_METHODS } from '../constants';
import { format } from 'date-fns';
import Button from '../components/common/Button';

const AddExpenseScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const expenseId = route.params?.expenseId; // Null for new expense, ID for editing

  // Pull state and actions from global store
  const { categories, currentWallet, addExpense, updateExpense, expenses, settings } = useAppStore();

  // Form field state values
  const [amount, setAmount] = useState(''); // Expense amount as string for input
  const [selectedCategory, setSelectedCategory] = useState(''); // Selected category name
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd')); // Selected date
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(settings.defaultPaymentMethod); // Payment type
  const [notes, setNotes] = useState(''); // Optional description
  const [tags, setTags] = useState(''); // Comma-separated tags string
  const [isRecurring, setIsRecurring] = useState(false); // Recurring toggle
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly'); // Recurrence interval
  const [loading, setLoading] = useState(false); // Submission loading state

  // Pre-fill form fields when editing an existing expense
  useEffect(() => {
    if (expenseId) {
      const expense = expenses.find(e => e.id === expenseId);
      if (expense) {
        setAmount(expense.amount.toString());
        setSelectedCategory(expense.category);
        setDate(expense.date);
        setPaymentMethod(expense.paymentMethod);
        setNotes(expense.notes || '');
        setTags(expense.tags.join(', '));
        setIsRecurring(expense.isRecurring);
        if (expense.recurringFrequency) setRecurringFrequency(expense.recurringFrequency);
        // Update header title to indicate edit mode
        navigation.setOptions({ title: 'Edit Expense' });
      }
    }
  }, [expenseId]);

  // Validate and submit the expense form
  const handleSave = async () => {
    // Validate required fields before saving
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('No Category', 'Please select a category for this expense.');
      return;
    }

    setLoading(true);
    try {
      const expenseData = {
        amount: parseFloat(amount), // Convert string to number
        category: selectedCategory,
        date,
        paymentMethod,
        notes: notes.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean), // Parse comma-separated tags
        currency: settings.defaultCurrency,
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
        walletId: currentWallet?.id || '', // Link to active wallet
      };

      if (expenseId) {
        // Update existing expense record
        await updateExpense(expenseId, expenseData);
      } else {
        // Create new expense record
        await addExpense(expenseData);
      }
      navigation.goBack(); // Return to previous screen on success
    } catch (error) {
      Alert.alert('Error', 'Failed to save expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Available recurring frequency options
  const frequencies: { value: RecurringFrequency; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Bi-weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} // iOS keyboard avoidance
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Amount input with large display for easy data entry */}
        <View style={[styles.amountContainer, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.amountLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="decimal-pad" // Numeric keyboard with decimal
              autoFocus={!expenseId} // Auto-focus for new expenses only
            />
          </View>
        </View>

        {/* Date input field */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Date</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>

        {/* Category selection grid with scrollable chips */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: selectedCategory === cat.name ? cat.color + '30' : theme.colors.surfaceVariant,
                    borderColor: selectedCategory === cat.name ? cat.color : theme.colors.border,
                    borderWidth: selectedCategory === cat.name ? 2 : 1, // Thicker border when selected
                  },
                ]}
                onPress={() => setSelectedCategory(cat.name)} // Set category on tap
              >
                <MaterialCommunityIcons name={cat.icon as any} size={20} color={cat.color} />
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: selectedCategory === cat.name ? cat.color : theme.colors.text },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Payment method selector as horizontal chips */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Payment Method</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method.value}
                style={[
                  styles.methodChip,
                  {
                    backgroundColor: paymentMethod === method.value ? theme.colors.primary + '20' : theme.colors.surfaceVariant,
                    borderColor: paymentMethod === method.value ? theme.colors.primary : theme.colors.border,
                    borderWidth: paymentMethod === method.value ? 2 : 1,
                  },
                ]}
                onPress={() => setPaymentMethod(method.value)} // Set payment method on tap
              >
                <MaterialCommunityIcons
                  name={method.icon as any}
                  size={18}
                  color={paymentMethod === method.value ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.methodChipText,
                    { color: paymentMethod === method.value ? theme.colors.primary : theme.colors.text },
                  ]}
                >
                  {method.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Notes text area for additional details */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Notes</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note..."
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top" // Align text to top of multiline input
          />
        </View>

        {/* Tags input for searchable labels */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Tags</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={tags}
            onChangeText={setTags}
            placeholder="e.g., lunch, office, team"
            placeholderTextColor={theme.colors.textTertiary}
          />
          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>Separate tags with commas</Text>
        </View>

        {/* Recurring expense toggle and frequency selector */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.recurringToggle, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border }]}
            onPress={() => setIsRecurring(!isRecurring)} // Toggle recurring state
          >
            <MaterialCommunityIcons
              name={isRecurring ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={isRecurring ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.recurringText, { color: theme.colors.text }]}>Recurring Expense</Text>
          </TouchableOpacity>

          {/* Show frequency options only when recurring is enabled */}
          {isRecurring && (
            <View style={styles.frequencyRow}>
              {frequencies.map((freq) => (
                <TouchableOpacity
                  key={freq.value}
                  style={[
                    styles.frequencyChip,
                    {
                      backgroundColor: recurringFrequency === freq.value ? theme.colors.primary : theme.colors.surfaceVariant,
                      borderColor: recurringFrequency === freq.value ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={() => setRecurringFrequency(freq.value)}
                >
                  <Text
                    style={{
                      color: recurringFrequency === freq.value ? '#FFF' : theme.colors.text,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {freq.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Save button to submit the form */}
        <View style={styles.saveContainer}>
          <Button
            title={expenseId ? 'Update Expense' : 'Save Expense'}
            onPress={handleSave}
            loading={loading}
            fullWidth
            size="large"
          />
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  amountContainer: {
    padding: 32,
    alignItems: 'center', // Center amount display
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  amountLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  currencySymbol: { color: '#FFFFFF', fontSize: 36, fontWeight: '300', marginRight: 4 },
  amountInput: {
    color: '#FFFFFF',
    fontSize: 48, // Large font for easy amount entry
    fontWeight: '700',
    minWidth: 100,
    textAlign: 'center',
  },
  section: { paddingHorizontal: 16, marginTop: 20 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80, // Taller for multiline notes
  },
  hint: { fontSize: 12, marginTop: 4, marginLeft: 4 },
  categoryScroll: { flexDirection: 'row' },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  categoryChipText: { fontSize: 13, fontWeight: '500' },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  methodChipText: { fontSize: 13, fontWeight: '500' },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  recurringText: { fontSize: 15, fontWeight: '500' },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Wrap to multiple lines if needed
    gap: 8,
    marginTop: 12,
  },
  frequencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  saveContainer: { paddingHorizontal: 16, marginTop: 32 },
});

export default AddExpenseScreen;

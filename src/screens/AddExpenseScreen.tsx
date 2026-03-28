// Add/Edit expense form screen with category selection, amount input, and smart defaults
// Handles both creating new expenses and editing existing ones

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, TouchableWithoutFeedback, Alert, Platform, Keyboard, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectCategories, selectWallets, selectCurrentWallet, selectExpenses, selectSettings } from '../store';
import { RecurringFrequency } from '../types';
import { format, parse } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import Button from '../components/common/Button';
import { formatAmountInput } from '../utils/helpers';
import * as ImagePicker from 'expo-image-picker';
import * as db from '../database';

const AddExpenseScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const route = useRoute<any>();
  const expenseId = route.params?.expenseId; // Null for new expense, ID for editing

  // Subscribe to individual store slices via selectors to avoid unnecessary re-renders
  const categories = useAppStore(selectCategories);
  const wallets = useAppStore(selectWallets);
  const currentWallet = useAppStore(selectCurrentWallet);
  const expenses = useAppStore(selectExpenses);
  const settings = useAppStore(selectSettings);
  const addExpense = useAppStore((s) => s.addExpense);
  const updateExpense = useAppStore((s) => s.updateExpense);

  // Form field state values
  const [amount, setAmount] = useState(''); // Expense amount as string for input
  // Pre-select the default category (isDefault=true) or empty for new expenses
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const defaultCat = categories.find(c => c.isDefault);
    return defaultCat?.name || ''; // Use default category name if available
  });
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd')); // Selected date
  const [notes, setNotes] = useState(''); // Optional description
  const [tags, setTags] = useState(''); // Comma-separated tags string
  const [isRecurring, setIsRecurring] = useState(false); // Recurring toggle
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly'); // Recurrence interval
  const [loading, setLoading] = useState(false); // Submission loading state
  const [showDatePicker, setShowDatePicker] = useState(false); // Date picker visibility
  const [receiptUris, setReceiptUris] = useState<string[]>([]); // Attached receipt photo URIs (both existing + new)
  const [existingReceiptIds, setExistingReceiptIds] = useState<Map<string, string>>(new Map()); // Map<uri, receiptId> for receipts already saved in DB
  const [removedReceiptIds, setRemovedReceiptIds] = useState<string[]>([]); // Receipt IDs to delete on save
  // Eagerly init wallet selection from store to prevent flash of unselected state
  const [selectedWalletId, setSelectedWalletId] = useState(() => {
    const defaultW = wallets.find(w => w.isDefault) || wallets[0];
    return defaultW?.id || '';
  });

  // Sanitize amount input: strip commas, only digits & one decimal, max 2 decimal places, max 10 integer digits
  const handleAmountChange = useCallback((text: string) => {
    // Strip commas and anything that isn't a digit or decimal point
    let cleaned = text.replace(/[^0-9.]/g, '');
    // Allow only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
    // Cap integer part to 10 digits
    if (parts[0].length > 10) parts[0] = parts[0].slice(0, 10);
    // Cap decimal part to 2 digits
    if (parts.length === 2 && parts[1].length > 2) parts[1] = parts[1].slice(0, 2);
    cleaned = parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts[0];
    setAmount(cleaned);
  }, []);

  // Load wallets on mount — removed: wallets already loaded by initialize() and HomeScreen useFocusEffect
  // No need to call loadWallets() here; it was causing redundant store updates

  // Sync wallet selection if wallets load after initial render (e.g., slow DB)
  useEffect(() => {
    if (!selectedWalletId && wallets.length > 0) {
      const defaultWallet = wallets.find(w => w.isDefault) || wallets[0];
      setSelectedWalletId(defaultWallet.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets.length]);

  // Deduplicate categories by name to prevent duplicate chips
  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter(cat => {
      if (seen.has(cat.name)) return false; // Skip duplicate names
      seen.add(cat.name);
      return true;
    });
  }, [categories]);

  // Ref to the scroll view for programmatic scrolling
  const scrollViewRef = useRef<ScrollView>(null);
  // Ref to amount TextInput — used by the container Pressable to focus on any tap
  const amountRef = useRef<TextInput>(null);

  // Pre-fill form fields when editing an existing expense
  useEffect(() => {
    if (expenseId) {
      const expense = expenses.find(e => e.id === expenseId);
      if (expense) {
        setAmount(expense.amount.toString());
        setSelectedCategory(expense.category);
        setDate(expense.date);
        setNotes(expense.notes || '');
        setTags(expense.tags.join(', '));
        setIsRecurring(expense.isRecurring);
        if (expense.recurringFrequency) setRecurringFrequency(expense.recurringFrequency);
        if (expense.walletId) setSelectedWalletId(expense.walletId); // Restore wallet selection
        // Update header title to indicate edit mode
        navigation.setOptions({ title: t.addExpense.editTitle });

        // Load existing receipt attachments from the database for this expense
        db.getReceiptsByExpense(expenseId).then((receipts) => {
          const uris = receipts.map(r => r.uri); // Extract URIs for display
          setReceiptUris(uris);
          // Build a map of URI → receipt ID so we can distinguish existing from new
          const idMap = new Map<string, string>();
          receipts.forEach(r => idMap.set(r.uri, r.id));
          setExistingReceiptIds(idMap);
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseId]);

  // Validate and submit the expense form
  const handleSave = async () => {
    // Validate required fields before saving
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t.addExpense.invalidAmount, t.addExpense.invalidAmountMsg);
      return;
    }
    if (!selectedCategory) {
      Alert.alert(t.addExpense.noCategory, t.addExpense.noCategoryMsg);
      return;
    }

    setLoading(true);
    try {
      const expenseData = {
        amount: parseFloat(amount), // Convert string to number
        category: selectedCategory,
        date,
        notes: notes.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean), // Parse comma-separated tags
        currency: settings.defaultCurrency,
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
        walletId: selectedWalletId || currentWallet?.id || '', // Link to selected wallet
      };

      if (expenseId) {
        // Update existing expense record
        await updateExpense(expenseId, expenseData);
        // Delete receipts that the user removed during this edit session
        for (const id of removedReceiptIds) {
          await db.deleteReceipt(id);
        }
        // Save only newly added receipt attachments (skip URIs that already exist in DB)
        for (const uri of receiptUris) {
          if (!existingReceiptIds.has(uri)) {
            await db.addReceipt({ expenseId, uri });
          }
        }
      } else {
        // Create new expense record
        const newExpense = await addExpense(expenseData);
        // Save receipt attachments linked to the new expense
        if (newExpense && receiptUris.length > 0) {
          for (const uri of receiptUris) {
            await db.addReceipt({ expenseId: newExpense.id, uri });
          }
        }
      }
      navigation.goBack(); // Return to previous screen on success
    } catch {
      Alert.alert(t.common.error, t.addExpense.saveFailed);
    } finally {
      setLoading(false);
    }
  };

  // Available recurring frequency options
  const frequencies: { value: RecurringFrequency; label: string }[] = [
    { value: 'daily', label: t.frequencies.daily },
    { value: 'weekly', label: t.frequencies.weekly },
    { value: 'biweekly', label: t.frequencies.biweekly },
    { value: 'monthly', label: t.frequencies.monthly },
    { value: 'quarterly', label: t.frequencies.quarterly },
    { value: 'yearly', label: t.frequencies.yearly },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        nestedScrollEnabled
      >
        {/* Amount input — entire purple area is tappable to focus the TextInput */}
        <TouchableWithoutFeedback onPress={() => amountRef.current?.focus()}>
          <View style={[styles.amountContainer, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.amountLabel}>{t.addExpense.amount}</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                ref={amountRef}
                style={styles.amountInput}
                value={formatAmountInput(amount)}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="decimal-pad"
                maxLength={13}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                selectionColor="rgba(255,255,255,0.5)"
                caretHidden={false}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>

        {/* Date picker field - tap to open native date picker */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.addExpense.date}</Text>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}
            onPress={() => setShowDatePicker(true)} // Open date picker on tap
          >
            <Text style={{ color: theme.colors.text, fontSize: 15 }}>{date}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={parse(date, 'yyyy-MM-dd', new Date())} // Parse current date string
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'} // Native picker style
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS, close on Android
                if (selectedDate) {
                  setDate(format(selectedDate, 'yyyy-MM-dd')); // Format selected date
                }
              }}
            />
          )}
        </View>

        {/* Category selection grid with scrollable chips */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.addExpense.category}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} keyboardShouldPersistTaps="always" nestedScrollEnabled>
            {uniqueCategories.map((cat) => (
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
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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

        {/* Wallet picker — select which wallet to deduct expense from */}
        {wallets.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t.wallet.title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" nestedScrollEnabled>
              {wallets.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[
                    styles.methodChip,
                    {
                      backgroundColor: selectedWalletId === w.id ? w.color + '20' : theme.colors.surfaceVariant,
                      borderColor: selectedWalletId === w.id ? w.color : theme.colors.border,
                      borderWidth: selectedWalletId === w.id ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelectedWalletId(w.id)}
                >
                  {/* eslint-disable @typescript-eslint/no-explicit-any */}
                  <MaterialCommunityIcons
                    name={w.iconName as any}
                    size={18}
                    color={selectedWalletId === w.id ? w.color : theme.colors.textSecondary}
                  />
                  {/* eslint-enable @typescript-eslint/no-explicit-any */}
                  <Text style={[
                    styles.methodChipText,
                    { color: selectedWalletId === w.id ? w.color : theme.colors.text },
                  ]}>
                    {w.nickname || w.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Notes text area for additional details */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.addExpense.notes}</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.addExpense.notesPlaceholder}
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top" // Align text to top of multiline input
          />
        </View>

        {/* Tags input for searchable labels */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.addExpense.tags}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={tags}
            onChangeText={setTags}
            placeholder={t.addExpense.tagsPlaceholder}
            placeholderTextColor={theme.colors.textTertiary}
          />
          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>{t.addExpense.tagsHint}</Text>
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
            <Text style={[styles.recurringText, { color: theme.colors.text }]}>{t.addExpense.recurringExpense}</Text>
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

        {/* Receipt photo attachment section */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.receipts.addReceipt}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {/* Thumbnail previews of attached receipt photos */}
            {receiptUris.map((uri, idx) => (
              <TouchableOpacity key={idx} onPress={() => {
                // Track removal of existing DB receipts for deletion on save
                const receiptId = existingReceiptIds.get(uri);
                if (receiptId) {
                  setRemovedReceiptIds(prev => [...prev, receiptId]);
                  // Remove from the existing map so it won't be skipped if re-added
                  setExistingReceiptIds(prev => { const next = new Map(prev); next.delete(uri); return next; });
                }
                // Remove URI from the display list
                setReceiptUris(receiptUris.filter((_, i) => i !== idx));
              }}>
                <View style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: theme.colors.inputBackground }}>
                  {/* Render actual receipt image from local file URI */}
                  <Image source={{ uri }} style={{ width: 72, height: 72 }} resizeMode="cover" />
                  {/* Red X button overlay to remove this receipt */}
                  <View style={{ position: 'absolute', top: 2, right: 2, backgroundColor: '#EF4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="close" size={12} color="#FFF" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            {/* Add photo button */}
            <TouchableOpacity
              style={{ width: 72, height: 72, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' }}
              onPress={async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  quality: 0.7,
                  allowsMultipleSelection: true,
                });
                if (!result.canceled && result.assets) {
                  setReceiptUris([...receiptUris, ...result.assets.map(a => a.uri)]);
                }
              }}
            >
              <MaterialCommunityIcons name="camera-plus" size={24} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Save button to submit the form */}
        <View style={styles.saveContainer}>
          <Button
            title={expenseId ? t.addExpense.updateExpense : t.addExpense.saveExpense}
            onPress={handleSave}
            loading={loading}
            fullWidth
            size="large"
          />
        </View>

        {/* Bottom spacer - extra space so keyboard doesn't cover last fields */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
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
    minWidth: 120,
    textAlign: 'center',
    paddingVertical: 8, // Sufficient tap target height on Android
    paddingHorizontal: 4,
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

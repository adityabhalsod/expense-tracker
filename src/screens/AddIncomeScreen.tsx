// Add/Edit income form screen with source selection, wallet picker, and amount input
// Mirrors the AddExpenseScreen design pattern for consistent UX

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, Alert, Platform, Keyboard,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectWallets, selectIncome, selectSettings } from '../store';
import { RecurringFrequency } from '../types';
import { format, parse } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import Button from '../components/common/Button';
import { formatAmountInput } from '../utils/helpers';
import { INCOME_SOURCES } from '../constants';

const AddIncomeScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const route = useRoute<any>();
  // Null for new income, ID for editing existing
  const incomeId = route.params?.incomeId;

  // Subscribe to store slices via selectors
  const wallets = useAppStore(selectWallets);
  const incomeRecords = useAppStore(selectIncome);
  const settings = useAppStore(selectSettings);
  const addIncome = useAppStore((s) => s.addIncome);
  const updateIncome = useAppStore((s) => s.updateIncome);

  // Form state values
  const [amount, setAmount] = useState('');
  const [selectedSource, setSelectedSource] = useState('salary'); // Default to salary
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Default to default wallet or first wallet
  const [selectedWalletId, setSelectedWalletId] = useState(() => {
    const defaultW = wallets.find(w => w.isDefault) || wallets[0];
    return defaultW?.id || '';
  });

  // Refs for input focus management
  const amountRef = useRef<TextInput>(null);

  // Sanitize amount input: strip commas, allow digits and one decimal point
  const handleAmountChange = useCallback((text: string) => {
    let cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
    if (parts[0].length > 10) parts[0] = parts[0].slice(0, 10);
    if (parts.length === 2 && parts[1].length > 2) parts[1] = parts[1].slice(0, 2);
    cleaned = parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts[0];
    setAmount(cleaned);
  }, []);

  // Sync wallet selection if wallets load after initial render
  useEffect(() => {
    if (!selectedWalletId && wallets.length > 0) {
      const defaultWallet = wallets.find(w => w.isDefault) || wallets[0];
      setSelectedWalletId(defaultWallet.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets.length]);

  // Pre-fill form when editing existing income
  useEffect(() => {
    if (incomeId) {
      const income = incomeRecords.find(i => i.id === incomeId);
      if (income) {
        setAmount(income.amount.toString());
        setSelectedSource(income.source);
        setDate(income.date);
        setNotes(income.notes || '');
        setIsRecurring(income.isRecurring);
        if (income.recurringFrequency) setRecurringFrequency(income.recurringFrequency);
        if (income.walletId) setSelectedWalletId(income.walletId);
        // Update header title for edit mode
        navigation.setOptions({ title: t.income.editTitle });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomeId]);

  // Validate and submit the income form
  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t.income.invalidAmount, t.income.invalidAmountMsg);
      return;
    }
    if (!selectedWalletId) {
      Alert.alert(t.income.noWallet, t.income.noWalletMsg);
      return;
    }

    setLoading(true);
    try {
      const incomeData = {
        amount: parseFloat(amount),
        source: selectedSource,
        date,
        notes: notes.trim(),
        walletId: selectedWalletId,
        currency: settings.defaultCurrency,
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
      };

      if (incomeId) {
        await updateIncome(incomeId, incomeData);
      } else {
        await addIncome(incomeData);
      }
      navigation.goBack();
    } catch {
      Alert.alert(t.common.error, t.income.saveFailed);
    } finally {
      setLoading(false);
    }
  };

  // Recurring frequency options
  const frequencies: { value: RecurringFrequency; label: string }[] = [
    { value: 'daily', label: t.frequencies.daily },
    { value: 'weekly', label: t.frequencies.weekly },
    { value: 'monthly', label: t.frequencies.monthly },
    { value: 'quarterly', label: t.frequencies.quarterly },
    { value: 'yearly', label: t.frequencies.yearly },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        {/* Amount input — green header area tappable to focus TextInput */}
        <TouchableWithoutFeedback onPress={() => amountRef.current?.focus()}>
          <View style={[styles.amountContainer, { backgroundColor: theme.colors.income }]}>
            <Text style={styles.amountLabel}>{t.income.amount}</Text>
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
              />
            </View>
          </View>
        </TouchableWithoutFeedback>

        {/* Income source selection chips */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.income.source}</Text>
          <View style={styles.sourceGrid}>
            {INCOME_SOURCES.map((src) => (
              <TouchableOpacity
                key={src.value}
                style={[
                  styles.sourceChip,
                  {
                    backgroundColor: selectedSource === src.value ? src.color + '20' : theme.colors.surfaceVariant,
                    borderColor: selectedSource === src.value ? src.color : theme.colors.border,
                    borderWidth: selectedSource === src.value ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedSource(src.value)}
              >
                {/* eslint-disable @typescript-eslint/no-explicit-any */}
                <MaterialCommunityIcons
                  name={src.icon as any}
                  size={22}
                  color={selectedSource === src.value ? src.color : theme.colors.textSecondary}
                />
                {/* eslint-enable @typescript-eslint/no-explicit-any */}
                <Text style={[
                  styles.sourceChipText,
                  { color: selectedSource === src.value ? src.color : theme.colors.text },
                ]}>
                  {src.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date picker field */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.income.date}</Text>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: theme.colors.text, fontSize: 15 }}>{date}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={parse(date, 'yyyy-MM-dd', new Date())}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) setDate(format(selectedDate, 'yyyy-MM-dd'));
              }}
            />
          )}
        </View>

        {/* Wallet picker — select which wallet to credit */}
        {wallets.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t.transfer.to}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
              {wallets.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[
                    styles.walletChip,
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
                    styles.walletChipText,
                    { color: selectedWalletId === w.id ? w.color : theme.colors.text },
                  ]}>
                    {w.nickname || w.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Notes text area */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.income.notes}</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.income.notesPlaceholder}
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Recurring income toggle and frequency selector */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.recurringToggle, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border }]}
            onPress={() => setIsRecurring(!isRecurring)}
          >
            <MaterialCommunityIcons
              name={isRecurring ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={isRecurring ? theme.colors.income : theme.colors.textSecondary}
            />
            <Text style={[styles.recurringText, { color: theme.colors.text }]}>{t.income.recurringIncome}</Text>
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
                      backgroundColor: recurringFrequency === freq.value ? theme.colors.income : theme.colors.surfaceVariant,
                      borderColor: recurringFrequency === freq.value ? theme.colors.income : theme.colors.border,
                    },
                  ]}
                  onPress={() => setRecurringFrequency(freq.value)}
                >
                  <Text style={{
                    color: recurringFrequency === freq.value ? '#FFF' : theme.colors.text,
                    fontSize: 12,
                    fontWeight: '600',
                  }}>
                    {freq.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Save button */}
        <View style={styles.saveContainer}>
          <Button
            title={incomeId ? t.income.updateIncome : t.income.saveIncome}
            onPress={handleSave}
            loading={loading}
            fullWidth
            size="large"
          />
        </View>

        {/* Bottom spacer for keyboard clearance */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  amountContainer: {
    padding: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  amountLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  currencySymbol: { color: '#FFFFFF', fontSize: 36, fontWeight: '300', marginRight: 4 },
  amountInput: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
    minWidth: 120,
    textAlign: 'center',
    paddingVertical: 8,
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
    minHeight: 80,
  },
  sourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  sourceChipText: { fontSize: 13, fontWeight: '500' },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  walletChipText: { fontSize: 13, fontWeight: '500' },
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
    flexWrap: 'wrap',
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

export default AddIncomeScreen;

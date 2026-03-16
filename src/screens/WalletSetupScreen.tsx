// Wallet setup screen for creating or editing a monthly wallet
// Allows users to set their salary/starting balance for the month

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppStore } from '../store';
import Button from '../components/common/Button';
import { MONTH_NAMES } from '../constants';

const WalletSetupScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const walletId = route.params?.walletId; // Null for new, ID for editing

  const { wallets, currentWallet, addWallet, updateWallet, settings } = useAppStore();

  // Form state for wallet fields
  const [name, setName] = useState('Monthly Salary'); // Wallet display name
  const [initialBalance, setInitialBalance] = useState(''); // Starting balance as string

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Pre-fill fields when editing an existing wallet
  useEffect(() => {
    if (walletId && currentWallet) {
      setName(currentWallet.name);
      setInitialBalance(currentWallet.initialBalance.toString());
      navigation.setOptions({ title: 'Edit Wallet' });
    }
  }, [walletId]);

  // Validate and save wallet data
  const handleSave = async () => {
    const balance = parseFloat(initialBalance);
    if (!initialBalance || isNaN(balance) || balance <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid starting balance greater than 0.');
      return;
    }

    try {
      if (walletId) {
        // Recalculate current balance based on the change in initial balance
        const diff = balance - (currentWallet?.initialBalance || 0);
        await updateWallet(walletId, {
          name: name.trim(),
          initialBalance: balance,
          currentBalance: (currentWallet?.currentBalance || 0) + diff, // Adjust remaining balance proportionally
        });
      } else {
        // Create new wallet for the current month
        await addWallet({
          name: name.trim(),
          initialBalance: balance,
          currentBalance: balance, // Start with full balance available
          currency: settings.defaultCurrency,
          month: currentMonth,
          year: currentYear,
        });
      }
      navigation.goBack(); // Return to wallet screen
    } catch (error) {
      Alert.alert('Error', 'Failed to save wallet. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
        {/* Month and year display header */}
        <View style={[styles.monthCard, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.monthLabel}>Setting up wallet for</Text>
          <Text style={styles.monthText}>{MONTH_NAMES[currentMonth - 1]} {currentYear}</Text>
        </View>

        {/* Wallet name input */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Wallet Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Monthly Salary"
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>

        {/* Starting balance input with large number display */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Starting Balance / Salary</Text>
          <TextInput
            style={[styles.amountInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={initialBalance}
            onChangeText={setInitialBalance}
            placeholder="0.00"
            placeholderTextColor={theme.colors.textTertiary}
            keyboardType="decimal-pad" // Show numeric keyboard
            autoFocus // Focus immediately for data entry
          />
          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
            This is the amount you start with at the beginning of the month. Expenses will be deducted from this balance.
          </Text>
        </View>

        {/* Save button */}
        <View style={styles.saveContainer}>
          <Button
            title={walletId ? 'Update Wallet' : 'Create Wallet'}
            onPress={handleSave}
            fullWidth
            size="large"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  monthCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center', // Center text within the card
    marginBottom: 24,
  },
  monthLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 },
  monthText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  section: { marginBottom: 24 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  amountInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    fontSize: 28, // Larger font for amount entry
    fontWeight: '700',
    textAlign: 'center', // Center the number for visual emphasis
  },
  hint: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  saveContainer: { marginTop: 16 },
});

export default WalletSetupScreen;

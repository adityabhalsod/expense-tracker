// Wallet-to-wallet transfer screen for moving money between payment sources
// Supports ATM withdrawals, UPI transfers, bank-to-cash movements, etc.

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, Alert, Platform, Keyboard,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectWallets, selectSettings } from '../store';
import { format, parse } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import Button from '../components/common/Button';
import { formatAmountInput, formatCurrency } from '../utils/helpers';

const TransferScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();

  // Store subscriptions
  const wallets = useAppStore(selectWallets);
  const settings = useAppStore(selectSettings);
  const addTransfer = useAppStore((s) => s.addTransfer);

  // Form state
  const [amount, setAmount] = useState('');
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Ref for amount input focus
  const amountRef = useRef<TextInput>(null);

  // Guard: if fewer than 2 wallets, show alert and go back immediately
  useEffect(() => {
    if (wallets.length < 2) {
      Alert.alert(t.transfer.noWallet, t.transfer.noWalletMsg, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter destination options — exclude the currently selected source wallet
  const toWalletOptions = useMemo(
    () => wallets.filter((w) => w.id !== fromWalletId),
    [wallets, fromWalletId]
  );

  // Filter source options — exclude the currently selected destination wallet
  const fromWalletOptions = useMemo(
    () => wallets.filter((w) => w.id !== toWalletId),
    [wallets, toWalletId]
  );

  // Sanitize amount input
  const handleAmountChange = useCallback((text: string) => {
    let cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
    if (parts[0].length > 10) parts[0] = parts[0].slice(0, 10);
    if (parts.length === 2 && parts[1].length > 2) parts[1] = parts[1].slice(0, 2);
    cleaned = parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts[0];
    setAmount(cleaned);
  }, []);

  // Validate and submit the transfer
  const handleTransfer = async () => {
    const parsedAmount = parseFloat(amount);
    // Validate amount
    if (!amount || parsedAmount <= 0) {
      Alert.alert(t.transfer.invalidAmount, t.transfer.invalidAmountMsg);
      return;
    }
    // Validate wallet selections
    if (!fromWalletId || !toWalletId) {
      Alert.alert(t.transfer.noWallet, t.transfer.noWalletMsg);
      return;
    }
    // Prevent same-wallet transfers
    if (fromWalletId === toWalletId) {
      Alert.alert(t.transfer.sameWallet, t.transfer.sameWalletMsg);
      return;
    }
    // Check source wallet has sufficient balance
    const fromWallet = wallets.find(w => w.id === fromWalletId);
    if (fromWallet && fromWallet.currentBalance < parsedAmount) {
      Alert.alert(t.transfer.insufficientBalance, t.transfer.insufficientBalanceMsg);
      return;
    }

    setLoading(true);
    try {
      await addTransfer({
        amount: parsedAmount,
        fromWalletId,
        toWalletId,
        date,
        notes: notes.trim(),
        currency: settings.defaultCurrency,
      });
      navigation.goBack();
    } catch {
      Alert.alert(t.common.error, t.transfer.saveFailed);
    } finally {
      setLoading(false);
    }
  };

  // Swap source and destination wallets
  const handleSwapWallets = () => {
    const temp = fromWalletId;
    setFromWalletId(toWalletId);
    setToWalletId(temp);
  };

  // Render a wallet selection card — accepts filtered wallet list to prevent same-wallet picks
  const renderWalletCard = (walletId: string, onSelect: (id: string) => void, label: string, walletList: typeof wallets) => (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
        {walletList.map((w) => (
          <TouchableOpacity
            key={w.id}
            style={[
              styles.walletCard,
              {
                backgroundColor: walletId === w.id ? w.color + '15' : theme.colors.surface,
                borderColor: walletId === w.id ? w.color : theme.colors.border,
                borderWidth: walletId === w.id ? 2 : 1,
              },
            ]}
            onPress={() => onSelect(w.id)}
          >
            {/* Wallet icon */}
            <View style={[styles.walletIconWrap, { backgroundColor: w.color + '20' }]}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <MaterialCommunityIcons name={w.iconName as any} size={24} color={w.color} />
            </View>
            {/* Wallet name and balance */}
            <Text style={[styles.walletName, { color: theme.colors.text }]} numberOfLines={1}>
              {w.nickname || w.name}
            </Text>
            <Text style={[styles.walletBalance, { color: theme.colors.textSecondary }]}>
              {formatCurrency(w.currentBalance, w.currency)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        {/* Amount input — blue header for transfers */}
        <TouchableWithoutFeedback onPress={() => amountRef.current?.focus()}>
          <View style={[styles.amountContainer, { backgroundColor: theme.colors.info }]}>
            <Text style={styles.amountLabel}>{t.transfer.amount}</Text>
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

        {/* Source wallet selection — filtered to exclude destination */}
        {renderWalletCard(fromWalletId, setFromWalletId, t.transfer.from, fromWalletOptions)}

        {/* Swap button between source and destination */}
        <View style={styles.swapContainer}>
          <TouchableOpacity
            style={[styles.swapButton, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border }]}
            onPress={handleSwapWallets}
          >
            <MaterialCommunityIcons name="swap-vertical" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Destination wallet selection — filtered to exclude source */}
        {renderWalletCard(toWalletId, setToWalletId, t.transfer.to, toWalletOptions)}

        {/* Date picker field */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.transfer.date}</Text>
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

        {/* Notes text area */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.transfer.notes}</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.transfer.notesPlaceholder}
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Transfer button */}
        <View style={styles.saveContainer}>
          <Button
            title={t.transfer.transferFunds}
            onPress={handleTransfer}
            loading={loading}
            fullWidth
            size="large"
            icon={<MaterialCommunityIcons name="bank-transfer" size={20} color="#FFF" />}
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
    minHeight: 60,
  },
  walletCard: {
    width: 130,
    padding: 14,
    borderRadius: 16,
    marginRight: 10,
    alignItems: 'center',
    gap: 6,
  },
  walletIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletName: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  walletBalance: { fontSize: 12, fontWeight: '500' },
  swapContainer: {
    alignItems: 'center',
    marginVertical: -4,
    zIndex: 1,
  },
  swapButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveContainer: { paddingHorizontal: 16, marginTop: 32 },
});

export default TransferScreen;

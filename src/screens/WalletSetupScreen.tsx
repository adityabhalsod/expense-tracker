// Wallet setup screen for creating or editing a wallet (payment source)
// Supports type selector, bank name, UPI ID, icon/color pickers, and default toggle

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Alert,
  ScrollView, TouchableOpacity, Keyboard,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectWallets, selectSettings } from '../store';
import { WalletType } from '../types';
import { formatAmountInput } from '../utils/helpers';
import Button from '../components/common/Button';

// Available wallet source types with icon and label metadata
const WALLET_TYPES: { type: WalletType; icon: string; label: string }[] = [
  { type: 'cash', icon: 'cash', label: 'Cash' },
  { type: 'bank_account', icon: 'bank', label: 'Bank Account' },
  { type: 'upi', icon: 'cellphone-nfc', label: 'UPI' },
  { type: 'digital_wallet', icon: 'wallet-outline', label: 'Digital Wallet' },
  { type: 'credit_card', icon: 'credit-card-outline', label: 'Credit Card' },
  { type: 'other', icon: 'dots-horizontal-circle-outline', label: 'Other' },
];

// Icon picker options for visual wallet identification
const ICON_OPTIONS = [
  'bank', 'cellphone-nfc', 'wallet-outline', 'credit-card-outline',
  'cash', 'bitcoin', 'contactless-payment', 'piggy-bank-outline',
  'currency-inr', 'hand-coin-outline', 'store-outline', 'briefcase-outline',
];

// Color palette for wallet card styling
const COLOR_OPTIONS = [
  '#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0',
  '#00BCD4', '#795548', '#607D8B', '#FF5722', '#3F51B5',
  '#009688', '#FFC107',
];

const WalletSetupScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const walletId = route.params?.walletId; // Null for new wallet, ID for editing

  // Subscribe to individual store slices to avoid full-store re-renders
  const wallets = useAppStore(selectWallets);
  const settings = useAppStore(selectSettings);
  const addWallet = useAppStore((s) => s.addWallet);
  const updateWallet = useAppStore((s) => s.updateWallet);

  // Find existing wallet when editing — only recompute when walletId changes, not on every wallets array update
  const existingWallet = useMemo(
    () => walletId ? wallets.find(w => w.id === walletId) : null,
    [walletId]
  );

  // Form state fields
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('cash');
  const [initialBalance, setInitialBalance] = useState('');
  const [bankName, setBankName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [nickname, setNickname] = useState('');
  const [iconName, setIconName] = useState('cash');
  const [color, setColor] = useState('#4CAF50');
  const [isDefault, setIsDefault] = useState(false);

  // Sanitize amount input: only digits & one decimal, max 2 decimal places, max 10 integer digits
  const handleBalanceChange = useCallback((text: string) => {
    // Strip anything that isn't a digit or decimal point
    let cleaned = text.replace(/[^0-9.]/g, '');
    // Allow only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
    // Cap integer part to 10 digits (up to 99,99,99,99,999 in INR)
    if (parts[0].length > 10) parts[0] = parts[0].slice(0, 10);
    // Cap decimal part to 2 digits
    if (parts.length === 2 && parts[1].length > 2) parts[1] = parts[1].slice(0, 2);
    cleaned = parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts[0];
    setInitialBalance(cleaned);
  }, []);

  // Pre-fill form when editing an existing wallet
  useEffect(() => {
    if (existingWallet) {
      setName(existingWallet.name);
      setType(existingWallet.type);
      setInitialBalance(existingWallet.initialBalance.toString());
      setBankName(existingWallet.bankName || '');
      setUpiId(existingWallet.upiId || '');
      setNickname(existingWallet.nickname || '');
      setIconName(existingWallet.iconName);
      setColor(existingWallet.color);
      setIsDefault(existingWallet.isDefault);
      navigation.setOptions({ title: t.walletSetup.updateWallet });
    }
  }, [existingWallet]);

  // Validate and save wallet data
  const handleSave = useCallback(async () => {
    // Name is required
    if (!name.trim()) {
      Alert.alert(t.common.error, t.walletSetup?.nameRequired || 'Please enter a name.');
      return;
    }

    const balance = parseFloat(initialBalance);
    if (!initialBalance || isNaN(balance) || balance < 0) {
      Alert.alert(t.common.error, 'Please enter a valid starting balance.');
      return;
    }

    try {
      if (walletId && existingWallet) {
        // Recalculate current balance based on the change in initial balance
        const diff = balance - existingWallet.initialBalance;
        await updateWallet(walletId, {
          name: name.trim(),
          type,
          initialBalance: balance,
          currentBalance: existingWallet.currentBalance + diff,
          bankName: bankName.trim() || undefined,
          upiId: upiId.trim() || undefined,
          nickname: nickname.trim() || undefined,
          iconName,
          color,
          isDefault,
        });
      } else {
        // Create new wallet with default currency fallback
        await addWallet({
          name: name.trim(),
          type,
          initialBalance: balance,
          currentBalance: balance, // Start with full balance
          currency: settings?.defaultCurrency || 'INR',
          bankName: bankName.trim() || undefined,
          upiId: upiId.trim() || undefined,
          nickname: nickname.trim() || undefined,
          iconName,
          color,
          isDefault,
        });
      }
    } catch (error) {
      console.error('Wallet save failed:', error); // Log actual error for debugging
      Alert.alert(t.common.error, t.walletSetup?.saveFailed || 'Failed to save wallet.');
      return; // Stop here — don't navigate if save failed
    }
    // Navigate back only after successful save (outside try/catch to avoid false error)
    navigation.goBack();
  }, [name, type, initialBalance, bankName, upiId, nickname, iconName, color, isDefault, walletId, existingWallet, settings, addWallet, updateWallet]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none" nestedScrollEnabled>
        {/* Wallet type selector chips */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {t.walletSetup?.type || 'Type'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow} keyboardShouldPersistTaps="always" nestedScrollEnabled>
            {WALLET_TYPES.map((wt) => (
              <TouchableOpacity
                key={wt.type}
                style={[
                  styles.typeChip,
                  { borderColor: theme.colors.border },
                  type === wt.type && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
                ]}
                onPress={() => {
                  setType(wt.type);
                  // Auto-set icon when changing type
                  const match = WALLET_TYPES.find(w => w.type === wt.type);
                  if (match) setIconName(match.icon);
                }}
              >
                <MaterialCommunityIcons
                  name={wt.icon as any}
                  size={20}
                  color={type === wt.type ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text style={[
                  styles.typeChipText,
                  { color: type === wt.type ? theme.colors.primary : theme.colors.textSecondary },
                ]}>
                  {wt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Wallet name input */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.walletSetup.walletName}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder={t.walletSetup?.namePlaceholder || 'e.g., HDFC Savings'}
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>

        {/* Bank name input (shown for bank accounts and credit cards) */}
        {(type === 'bank_account' || type === 'credit_card') && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              {t.walletSetup?.bankName || 'Bank Name'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={bankName}
              onChangeText={setBankName}
              placeholder={t.walletSetup?.bankNamePlaceholder || 'e.g., HDFC Bank'}
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>
        )}

        {/* UPI ID input (shown for UPI type) */}
        {type === 'upi' && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              {t.walletSetup?.upiId || 'UPI ID'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={upiId}
              onChangeText={setUpiId}
              placeholder="user@upi"
              placeholderTextColor={theme.colors.textTertiary}
              autoCapitalize="none"
            />
            {/* Encryption notice for sensitive data */}
            <View style={styles.encryptionNote}>
              <MaterialCommunityIcons name="shield-lock-outline" size={14} color={theme.colors.success} />
              <Text style={[styles.encryptionText, { color: theme.colors.success }]}>
                {t.walletSetup?.encryptedNote || 'Encrypted at rest'}
              </Text>
            </View>
          </View>
        )}

        {/* Starting balance input with large number display */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t.walletSetup.startingBalance}</Text>
          <TextInput
            style={[styles.amountInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={formatAmountInput(initialBalance)}
            onChangeText={handleBalanceChange}
            placeholder="0.00"
            placeholderTextColor={theme.colors.textTertiary}
            keyboardType="decimal-pad"
            maxLength={16}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
            {t.walletSetup.balanceHint}
          </Text>
        </View>

        {/* Nickname input (optional alias) */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {t.walletSetup?.nickname || 'Nickname (Optional)'}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={nickname}
            onChangeText={setNickname}
            placeholder={t.walletSetup?.nicknamePlaceholder || 'Short alias'}
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>

        {/* Icon selection grid */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {t.walletSetup?.icon || 'Icon'}
          </Text>
          <View style={styles.optionGrid}>
            {ICON_OPTIONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[
                  styles.iconOption,
                  { borderColor: theme.colors.border },
                  iconName === icon && { borderColor: color, backgroundColor: color + '20' },
                ]}
                onPress={() => setIconName(icon)}
              >
                <MaterialCommunityIcons
                  name={icon as any}
                  size={24}
                  color={iconName === icon ? color : theme.colors.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color selection grid */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {t.walletSetup?.color || 'Color'}
          </Text>
          <View style={styles.optionGrid}>
            {COLOR_OPTIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorOption,
                  { backgroundColor: c },
                  color === c && styles.colorSelected,
                ]}
                onPress={() => setColor(c)}
              >
                {color === c && <MaterialCommunityIcons name="check" size={18} color="#FFF" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Default wallet toggle */}
        <TouchableOpacity
          style={[styles.toggleRow, { backgroundColor: theme.colors.card }]}
          onPress={() => setIsDefault(!isDefault)}
        >
          <View style={styles.toggleContent}>
            <MaterialCommunityIcons name="star-outline" size={22} color={theme.colors.text} />
            <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>
              {t.walletSetup?.setDefault || 'Set as Default'}
            </Text>
          </View>
          {/* Checkbox indicator */}
          <View style={[
            styles.checkbox,
            { borderColor: theme.colors.border },
            isDefault && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
          ]}>
            {isDefault && <MaterialCommunityIcons name="check" size={16} color="#FFF" />}
          </View>
        </TouchableOpacity>

        {/* Save button */}
        <View style={styles.saveContainer}>
          <Button
            title={walletId ? t.walletSetup.updateWallet : t.walletSetup.createWallet}
            onPress={handleSave}
            fullWidth
            size="large"
          />
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  section: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  amountInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    fontSize: 28, // Large font for amount entry
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  typeRow: { flexDirection: 'row' },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
    gap: 6,
  },
  typeChipText: { fontSize: 13, fontWeight: '600' },
  encryptionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  encryptionText: { fontSize: 12, fontWeight: '500' },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#FFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: { fontSize: 16, fontWeight: '500' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveContainer: { paddingBottom: 40 },
});

export default WalletSetupScreen;

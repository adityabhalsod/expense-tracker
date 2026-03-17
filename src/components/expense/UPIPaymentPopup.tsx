// UPI Payment Popup — overlay modal that appears when a UPI notification is detected
// Shows a pre-filled form for either expense (debit) or income (credit) based on
// the parsed notification data. Acts like a "draw over apps" floating form.
// CREDIT → income form that tops up the selected wallet balance
// DEBIT → expense form that deducts from the selected wallet

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useLanguage } from '../../i18n';
import { useAppStore, selectCategories, selectWallets, selectCurrentWallet } from '../../store';
import { UPINotification, PaymentMethod } from '../../types';
import { format } from 'date-fns';

// Props for the UPI Payment Popup component
interface UPIPaymentPopupProps {
  visible: boolean; // Whether the popup is shown
  notification: UPINotification | null; // The detected UPI notification data
  onDismiss: () => void; // Callback when the popup is dismissed
  onSaved: () => void; // Callback when the expense/income is saved
}

const UPIPaymentPopup: React.FC<UPIPaymentPopupProps> = ({
  visible,
  notification,
  onDismiss,
  onSaved,
}) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // Subscribe to individual store slices to avoid full-store re-renders
  const categories = useAppStore(selectCategories);
  const wallets = useAppStore(selectWallets);
  const currentWallet = useAppStore(selectCurrentWallet);
  const addExpense = useAppStore((s) => s.addExpense);
  const updateWallet = useAppStore((s) => s.updateWallet);
  const markUPINotificationProcessed = useAppStore((s) => s.markUPINotificationProcessed);

  // Form state pre-filled from the notification
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [loading, setLoading] = useState(false);

  // Deduplicate categories by name for the selection chips
  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter(cat => {
      if (seen.has(cat.name)) return false;
      seen.add(cat.name);
      return true;
    });
  }, [categories]);

  // Pre-fill form fields when a new notification arrives
  React.useEffect(() => {
    if (notification) {
      setAmount(notification.amount.toString());
      setNotes(notification.message);
      setSelectedCategory('');
      // Auto-select matching wallet (UPI or bank type, or default)
      const matchedWallet = wallets.find(w => w.type === 'upi' || w.type === 'bank_account')
        || wallets.find(w => w.isDefault)
        || (wallets.length > 0 ? wallets[0] : null);
      setSelectedWalletId(matchedWallet?.id || '');
    }
  }, [notification, wallets]);

  // Determine if this is a credit (income) or debit (expense) notification
  const isCredit = notification?.transactionType === 'credit';

  // Handle saving — credit tops up wallet, debit creates expense
  const handleSave = async () => {
    if (!notification) return;

    const parsedAmount = parseFloat(amount);
    // Validate amount is a positive number
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(t.common.error, t.addExpense?.enterAmount || 'Please enter a valid amount');
      return;
    }

    // For debit (expense), require category selection
    if (!isCredit && !selectedCategory) {
      Alert.alert(t.common.error, t.addExpense?.selectCategory || 'Please select a category');
      return;
    }

    // Require wallet selection
    if (!selectedWalletId) {
      Alert.alert(t.common.error, 'Please select a wallet');
      return;
    }

    setLoading(true);
    try {
      if (isCredit) {
        // CREDIT FLOW — top up the selected wallet's balance
        const wallet = wallets.find(w => w.id === selectedWalletId);
        if (wallet) {
          await updateWallet(selectedWalletId, {
            currentBalance: wallet.currentBalance + parsedAmount,
            initialBalance: wallet.initialBalance + parsedAmount,
          });
        }
      } else {
        // DEBIT FLOW — create expense record from the UPI notification data
        await addExpense({
          amount: parsedAmount,
          category: selectedCategory,
          date: format(new Date(notification.timestamp), 'yyyy-MM-dd'),
          paymentMethod: 'upi' as PaymentMethod,
          notes: notes || `${notification.appName}: ${notification.message}`,
          tags: [notification.appName, notification.transactionType],
          currency: 'INR', // UPI is India-only
          isRecurring: false,
          walletId: selectedWalletId,
        });
      }

      // Mark the notification as processed so it doesn't appear again
      await markUPINotificationProcessed(notification.id);
      setLoading(false);
      onSaved(); // Notify parent that save completed
    } catch (error) {
      setLoading(false);
      Alert.alert(t.common.error, 'Failed to save transaction');
    }
  };

  if (!notification) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      {/* Semi-transparent backdrop */}
      <View style={styles.overlay}>
        <View style={[styles.popup, { backgroundColor: theme.colors.card }]}>
          {/* Header with transaction type indicator and close button */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconBg, { backgroundColor: isCredit ? '#DCFCE7' : '#FEE2E2' }]}>
                <MaterialCommunityIcons
                  name={isCredit ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={28}
                  color={isCredit ? '#22C55E' : '#EF4444'}
                />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                  {isCredit ? (t.upiPayments?.received || 'Payment Received') : (t.upiPayments?.sent || 'Payment Sent')}
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.colors.textTertiary }]}>
                  {isCredit ? (t.upiPayments?.addAsIncome || 'Add as Income') : (t.upiPayments?.addAsExpense || 'Add as Expense')}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Source app badge showing which UPI app triggered this */}
          <View style={[styles.appBadge, { backgroundColor: theme.colors.background }]}>
            <MaterialCommunityIcons name="cellphone" size={16} color={theme.colors.primary} />
            <Text style={[styles.appName, { color: theme.colors.textSecondary }]}>
              {notification.appName}
            </Text>
            <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
              {format(new Date(notification.timestamp), 'hh:mm a')}
            </Text>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Amount input field pre-filled from notification */}
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              {t.addExpense?.amount || 'Amount'}
            </Text>
            <View style={[styles.amountRow, { borderColor: isCredit ? '#22C55E' : theme.colors.border }]}>
              <Text style={[styles.currencySymbol, { color: isCredit ? '#22C55E' : theme.colors.primary }]}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: theme.colors.text }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            {/* Category selection chips — shown only for debit (expense) */}
            {!isCredit && (
              <>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                  {t.addExpense?.category || 'Category'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {uniqueCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selectedCategory === cat.name ? cat.color : theme.colors.background,
                          borderColor: cat.color,
                        },
                      ]}
                      onPress={() => setSelectedCategory(cat.name)}
                    >
                      <MaterialCommunityIcons
                        name={cat.icon as any}
                        size={16}
                        color={selectedCategory === cat.name ? '#FFF' : cat.color}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          { color: selectedCategory === cat.name ? '#FFF' : theme.colors.text },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Wallet selector — pick which wallet to credit/debit */}
            {wallets.length > 0 && (
              <>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                  {isCredit ? (t.upiPayments?.source || 'Add to Wallet') : (t.upiPayments?.source || 'Deduct from Wallet')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {wallets.map((wallet) => (
                    <TouchableOpacity
                      key={wallet.id}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selectedWalletId === wallet.id ? wallet.color : theme.colors.background,
                          borderColor: wallet.color,
                        },
                      ]}
                      onPress={() => setSelectedWalletId(wallet.id)}
                    >
                      <MaterialCommunityIcons
                        name={wallet.iconName as any}
                        size={16}
                        color={selectedWalletId === wallet.id ? '#FFF' : wallet.color}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          { color: selectedWalletId === wallet.id ? '#FFF' : theme.colors.text },
                        ]}
                      >
                        {wallet.nickname || wallet.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Notes text area pre-filled with notification message */}
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              {t.addExpense?.notes || 'Notes'}
            </Text>
            <TextInput
              style={[
                styles.notesInput,
                { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
              ]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              placeholder={t.addExpense?.notesPlaceholder || 'Add notes...'}
              placeholderTextColor={theme.colors.textSecondary}
            />
          </ScrollView>

          {/* Action buttons: dismiss or save the transaction */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.dismissButton, { borderColor: theme.colors.border }]}
              onPress={onDismiss}
            >
              <Text style={[styles.dismissText, { color: theme.colors.textSecondary }]}>
                {t.common.cancel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: isCredit ? '#22C55E' : theme.colors.primary }]}
              onPress={handleSave}
              disabled={loading}
            >
              <MaterialCommunityIcons name={isCredit ? 'arrow-down' : 'check'} size={18} color="#FFF" />
              <Text style={styles.saveText}>
                {loading
                  ? (t.common.loading || 'Saving...')
                  : isCredit
                    ? (t.upiPayments?.addIncome || 'Add Income')
                    : (t.addExpense?.save || 'Save Expense')
                }
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Full-screen semi-transparent overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  // Popup container with rounded top corners
  popup: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  // Header row with icon, title, and close button
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  // Badge showing the source UPI app
  appBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  appName: {
    fontSize: 13,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
    marginLeft: 8,
  },
  // Form container
  form: {
    marginBottom: 16,
  },
  // Input labels
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  // Amount input row with currency symbol
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '700',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
  },
  // Horizontal scrolling category/wallet chips
  chipScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
    gap: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Notes text area styling
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  // Bottom action buttons row
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  dismissButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default UPIPaymentPopup;

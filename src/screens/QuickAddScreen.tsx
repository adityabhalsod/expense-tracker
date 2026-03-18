// QuickAddScreen — minimal, focused form launched from the home screen widget.
// Opens as a transparent modal over a dimmed overlay so context is never lost.
// Two modes driven by the "type" route param:
//   - "expense" : log a payment made (amount, category, wallet, notes)
//   - "income"  : record a payment received (amount, destination wallet, source, notes)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  Platform,
  NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import {
  useAppStore,
  selectCategories,
  selectWallets,
  selectSettings,
} from '../store';
import { formatAmountInput } from '../utils/helpers';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Mode drives which form fields are shown */
type QuickAddType = 'expense' | 'income';

// ── Component ──────────────────────────────────────────────────────────────────

const QuickAddScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // Determine mode from deep-link param; default to expense
  const type: QuickAddType = route.params?.type === 'income' ? 'income' : 'expense';
  const isExpense = type === 'expense'; // convenience flag

  // ── Store subscriptions ────────────────────────────────────────────────────
  const categories = useAppStore(selectCategories);
  const wallets    = useAppStore(selectWallets);
  const settings   = useAppStore(selectSettings);
  const addExpense = useAppStore((s) => s.addExpense);
  const updateWallet = useAppStore((s) => s.updateWallet);
  const loadWallets  = useAppStore((s) => s.loadWallets);

  // ── Form state ─────────────────────────────────────────────────────────────
  // Amount entered by the user as a raw string
  const [amount, setAmount] = useState('');
  // Selected category ID for expense mode (defaults to the isDefault category)
  const [selectedCategoryName, setSelectedCategoryName] = useState(() => {
    const def = categories.find(c => c.isDefault);
    return def?.name || (categories[0]?.name ?? ''); // fall back to first if none marked default
  });
  // Selected wallet ID for both modes (defaults to the default wallet)
  const [selectedWalletId, setSelectedWalletId] = useState(() => {
    const def = wallets.find(w => w.isDefault) || wallets[0];
    return def?.id ?? '';
  });
  // Free-text source label for income mode (e.g., "Freelance", "Salary")
  const [source, setSource] = useState('');
  // Optional notes for either mode
  const [notes, setNotes] = useState('');
  // Whether a save operation is in progress (prevents double-tap)
  const [saving, setSaving] = useState(false);

  // ── Animation: bottom-sheet slide-up ──────────────────────────────────────
  // Starts off-screen below the bottom edge
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    // Slide the card up into view when the screen mounts
    Animated.spring(slideAnim, {
      toValue: 0,       // resting position (on-screen)
      useNativeDriver: true,
      tension: 60,      // spring stiffness
      friction: 10,     // damping — prevents excessive bounce
    }).start();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Sanitise textual amount input: digits + one decimal, max 10 integer + 2 decimal digits */
  const handleAmountChange = useCallback((text: string) => {
    // Strip anything that isn't a digit or decimal point
    let cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join(''); // keep only first dot
    if (parts[0].length > 10) parts[0] = parts[0].slice(0, 10);              // cap integer digits
    if (parts.length === 2 && parts[1].length > 2) parts[1] = parts[1].slice(0, 2); // cap decimals
    cleaned = parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts[0];
    setAmount(cleaned);
  }, []);

  /** Dismiss the modal, sliding the card back down first */
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: 400,    // slide back off-screen
      duration: 220,
      useNativeDriver: true,
    }).start(() => navigation.goBack()); // navigate back after animation completes
  }, [navigation, slideAnim]);

  /** Validate and save the form. Uses addExpense or updateWallet depending on mode. */
  const handleSave = useCallback(async () => {
    // Guard: amount must be a positive number
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    // Guard: a wallet must be selected
    if (!selectedWalletId) {
      Alert.alert('No Wallet', 'Please select a wallet.');
      return;
    }

    setSaving(true);
    try {
      if (isExpense) {
        // ── Expense mode: log a debit transaction via the standard addExpense API ──
        await addExpense({
          amount: parseFloat(amount),
          category: selectedCategoryName,
          date: new Date().toISOString().split('T')[0], // today's date in YYYY-MM-DD
          notes: notes.trim(),
          tags: [],
          currency: settings.defaultCurrency,
          isRecurring: false,
          walletId: selectedWalletId,
        });
      } else {
        // ── Income mode: credit the selected wallet's balance ──
        const wallet = wallets.find(w => w.id === selectedWalletId);
        if (!wallet) throw new Error('Wallet not found');
        const creditedBalance = wallet.currentBalance + parseFloat(amount); // add received amount
        await updateWallet(selectedWalletId, { currentBalance: creditedBalance });
        await loadWallets(); // refresh wallet list so HomeScreen shows updated balance
      }

      // Notify any active widget instances to re-render (no-op if no widget placed)
      try {
        NativeModules.WidgetBridge?.refreshWidgets(); // graceful no-op on iOS or if bridge absent
        NativeModules.WidgetBridge?.clearPendingEntry(); // clear any pending widget entry record
      } catch {
        // Bridge unavailable (e.g., iOS simulator) — safe to ignore
      }

      handleClose(); // dismiss form after successful save
    } catch (err) {
      Alert.alert('Error', 'Could not save the entry. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    amount, selectedCategoryName, selectedWalletId, notes, source,
    isExpense, addExpense, updateWallet, loadWallets, wallets, settings, handleClose,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Header color differs by mode to reinforce context at a glance
  const headerColor = isExpense ? theme.colors.expense : theme.colors.income; // red vs green

  return (
    // Full-screen transparent container — tapping outside the card closes the modal
    <View style={styles.overlay}>
      {/* Semi-transparent dim backdrop — pressing it calls handleClose */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* ── Bottom-sheet card (slides up from bottom) ── */}
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <SafeAreaView edges={['bottom']}>
          {/* ── Card header: colored strip with mode icon + title + close button ── */}
          <View style={[styles.cardHeader, { backgroundColor: headerColor }]}>
            <View style={styles.cardHeaderLeft}>
              {/* Mode icon: minus-circle for expense, arrow-down-circle for income */}
              <MaterialCommunityIcons
                name={isExpense ? 'minus-circle-outline' : 'arrow-down-circle-outline'}
                size={22}
                color="#FFFFFF"
              />
              <Text style={styles.cardTitle}>
                {isExpense ? 'Add Expense' : 'Payment Received'}
              </Text>
            </View>
            {/* Close (×) button — same as backdrop tap */}
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.cardBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* ── Amount input ──────────────────────────────────────────────── */}
            <View style={styles.amountRow}>
              {/* Currency symbol prefix */}
              <Text style={[styles.currencySymbol, { color: headerColor }]}>
                {settings.defaultCurrency === 'INR' ? '₹' : '$'}
              </Text>
              <TextInput
                style={[styles.amountInput, { color: theme.colors.text, borderBottomColor: headerColor }]}
                value={formatAmountInput(amount)}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="decimal-pad"
                maxLength={13}
                autoFocus // show keyboard immediately when modal opens
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>

            {/* ── Expense-only: Category selector ──────────────────────────── */}
            {isExpense && (
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Category</Text>
                {/* Horizontally scrollable category chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {categories.map((cat) => {
                    const isSelected = cat.name === selectedCategoryName;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? cat.color + '30' : theme.colors.inputBackground,
                            borderColor: isSelected ? cat.color : 'transparent',
                            borderWidth: isSelected ? 1.5 : 0,
                          },
                        ]}
                        onPress={() => setSelectedCategoryName(cat.name)}
                      >
                        {/* Category emoji/icon indicator */}
                        <MaterialCommunityIcons
                          name={cat.icon as any}
                          size={14}
                          color={isSelected ? cat.color : theme.colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? cat.color : theme.colors.textSecondary },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── Income-only: Source label field ──────────────────────────── */}
            {!isExpense && (
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Source (optional)</Text>
                <TextInput
                  style={[styles.textField, { color: theme.colors.text, backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}
                  value={source}
                  onChangeText={setSource}
                  placeholder="e.g. Freelance, Salary, Gift…"
                  placeholderTextColor={theme.colors.textTertiary}
                  returnKeyType="next"
                />
              </View>
            )}

            {/* ── Wallet selector (both modes) ─────────────────────────────── */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
                {isExpense ? 'Pay from wallet' : 'Received into wallet'}
              </Text>
              {/* Horizontally scrollable wallet chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {wallets.map((wallet) => {
                  const isSelected = wallet.id === selectedWalletId;
                  return (
                    <TouchableOpacity
                      key={wallet.id}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? theme.colors.primary + '20' : theme.colors.inputBackground,
                          borderColor: isSelected ? theme.colors.primary : 'transparent',
                          borderWidth: isSelected ? 1.5 : 0,
                        },
                      ]}
                      onPress={() => setSelectedWalletId(wallet.id)}
                    >
                      <MaterialCommunityIcons
                        name={wallet.iconName as any}
                        size={14}
                        color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          { color: isSelected ? theme.colors.primary : theme.colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {wallet.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Notes field (both modes) ──────────────────────────────────── */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Notes (optional)</Text>
              <TextInput
                style={[
                  styles.textField,
                  styles.notesField,
                  { color: theme.colors.text, backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border },
                ]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add a note…"
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                numberOfLines={2}
                returnKeyType="done"
                blurOnSubmit
              />
            </View>

            {/* ── Action buttons ────────────────────────────────────────────── */}
            <View style={styles.actions}>
              {/* Cancel — slides card back down without saving */}
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel, { borderColor: theme.colors.border }]}
                onPress={handleClose}
                disabled={saving}
              >
                <Text style={[styles.btnText, { color: theme.colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              {/* Save — validates + persists the entry */}
              <TouchableOpacity
                style={[styles.btn, styles.btnSave, { backgroundColor: headerColor, opacity: saving ? 0.7 : 1 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <MaterialCommunityIcons
                  name={saving ? 'loading' : 'check'}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                  {saving ? 'Saving…' : isExpense ? 'Save Expense' : 'Save Payment'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Full-screen container — overlays whatever is behind it
  overlay: {
    flex: 1,
    justifyContent: 'flex-end', // card anchors to the bottom edge
  },
  // Semi-transparent dark backdrop occupying the top portion of the screen
  backdrop: {
    ...StyleSheet.absoluteFillObject, // stretch to full screen
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  // The white/dark card that slides up from the bottom
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '90%', // prevent card from covering the entire screen
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  // Colored header strip at the top of the card
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 2,
  },
  // Scrollable body below the header
  cardBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // Large amount entry row with currency prefix
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
    gap: 8,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4, // align baseline with input text
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: '700',
    borderBottomWidth: 2,
    paddingBottom: 4,
  },
  // Container for a labelled form field (label + input/chips)
  fieldBlock: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  // Horizontal scroll container for chip groups
  chipsScroll: {
    flexGrow: 0,
  },
  // Individual selectable chip (category or wallet)
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Generic single-line text input (source label, notes header)
  textField: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 8 : 10,
    fontSize: 15,
  },
  // Multi-line notes textarea
  notesField: {
    minHeight: 64,
    textAlignVertical: 'top', // Android: start text from top-left
  },
  // Row of Cancel + Save buttons
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnCancel: {
    borderWidth: 1.5,
  },
  btnSave: {
    // backgroundColor is set inline using headerColor
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default QuickAddScreen;

// QuickAddScreen — modern bottom-sheet quick-entry form launched from the home screen widget.
//
// Design highlights:
//   • Animated bottom-sheet with backdrop fade-in
//   • In-sheet mode switcher — user can flip between Expense / Received without reopening
//   • Large hero amount input with currency symbol prefix
//   • Quick-preset row (₹100 ∙ ₹500 ∙ ₹1k ∙ ₹2k) for zero-friction entry
//   • Grouped form card: category chips → wallet chips → notes — all in one scroll area
//   • Save button shows animated checkmark on success then auto-closes
//
// Deep-link params:
//   expense-tracker://quick-add?type=expense  → Expense tab pre-selected
//   expense-tracker://quick-add?type=income   → Received tab pre-selected

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
import {
  useAppStore,
  selectCategories,
  selectWallets,
  selectSettings,
} from '../store';
import { formatAmountInput } from '../utils/helpers';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Mode controls which set of form fields are shown and which color is active */
type QuickAddType = 'expense' | 'income';

/** Quick preset amounts shown as a row of chips below the amount input */
const PRESETS = [100, 500, 1000, 2000] as const;

// ── Component ──────────────────────────────────────────────────────────────────

const QuickAddScreen = () => {
  const { theme } = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const route = useRoute<any>();

  // ── Mode: pre-seeded by deep-link param, switchable inside the form ────────
  const [mode, setMode] = useState<QuickAddType>(
    route.params?.type === 'income' ? 'income' : 'expense'
  );
  const isExpense = mode === 'expense'; // convenience flag used throughout render

  // ── Store subscriptions ────────────────────────────────────────────────────
  const categories   = useAppStore(selectCategories);
  const wallets      = useAppStore(selectWallets);
  const settings     = useAppStore(selectSettings);
  const addExpense   = useAppStore((s) => s.addExpense);
  const updateWallet = useAppStore((s) => s.updateWallet);
  const loadWallets  = useAppStore((s) => s.loadWallets);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [amount, setAmount] = useState('');
  // Default category: the one marked isDefault, or first if none
  const [selectedCategoryName, setSelectedCategoryName] = useState(() => {
    const def = categories.find((c) => c.isDefault);
    return def?.name || categories[0]?.name || '';
  });
  // Default wallet: the one marked isDefault, or first
  const [selectedWalletId, setSelectedWalletId] = useState(() => {
    const def = wallets.find((w) => w.isDefault) || wallets[0];
    return def?.id || '';
  });
  const [source, setSource] = useState('');  // income-only: free-text source label
  const [notes,  setNotes]  = useState('');  // optional memo for both modes
  const [saving, setSaving] = useState(false); // prevent double-tap during async save
  const [saved,  setSaved]  = useState(false); // success state — triggers checkmark animation

  // ── Refs ────────────────────────────────────────────────────────────────────
  const amountRef   = useRef<TextInput>(null);          // focus amount after sheet settles
  const savedScale  = useRef(new Animated.Value(0)).current; // scale-in for checkmark icon

  // ── Animations: backdrop fade + sheet slide-up fire in parallel ───────────
  const slideAnim    = useRef(new Animated.Value(520)).current; // starts below viewport
  const backdropOpacity = useRef(new Animated.Value(0)).current; // starts invisible

  useEffect(() => {
    // Run both animations simultaneously for a polished entrance
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,          // slide sheet to its resting position
        useNativeDriver: true,
        tension: 68,         // spring stiffness — snappy but not jarring
        friction: 12,        // damping — minimal overshoot
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,          // fade backdrop to full opacity
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Focus the amount input only after animation completes to avoid layout jank
      amountRef.current?.focus();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Accent color: red for expense, green for income ───────────────────────
  const accentColor = isExpense ? theme.colors.expense : theme.colors.income;

  // ── Currency symbol derived from settings ────────────────────────────────
  const currencySymbol =
    settings.defaultCurrency === 'INR' ? '₹'
    : settings.defaultCurrency === 'USD' ? '$'
    : settings.defaultCurrency === 'EUR' ? '€'
    : settings.defaultCurrency === 'GBP' ? '£'
    : settings.defaultCurrency; // fallback: show the code itself

  // ── Amount sanitisation ────────────────────────────────────────────────────
  /** Strip non-numeric chars; enforce one decimal point; cap at 10 int + 2 decimal digits */
  const handleAmountChange = useCallback((text: string) => {
    let cleaned = text.replace(/[^0-9.]/g, ''); // remove anything that isn't a digit or dot
    const parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join(''); // keep first dot only
    if (parts[0].length > 10) parts[0] = parts[0].slice(0, 10);              // cap integer digits
    if (parts.length === 2 && parts[1].length > 2) parts[1] = parts[1].slice(0, 2); // cap decimals
    setAmount(parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts[0]);
  }, []);

  /** Tap a preset chip to fill the amount field instantly */
  const applyPreset = useCallback((value: number) => {
    setAmount(value.toString()); // set raw numeric string (no formatting)
    amountRef.current?.focus();  // bring keyboard back if dismissed
  }, []);

  // ── Close with reverse animations ─────────────────────────────────────────
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 560,        // slide sheet back below viewport
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,          // fade backdrop back to transparent
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => navigation.goBack()); // navigate back after animations finish
  }, [navigation, slideAnim, backdropOpacity]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    // Guard: require a non-zero positive amount
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than zero.');
      return;
    }
    // Guard: a wallet must be associated with every entry
    if (!selectedWalletId) {
      Alert.alert('No Wallet', 'Please select a wallet first.');
      return;
    }

    setSaving(true);
    try {
      if (isExpense) {
        // Expense path: persist a standard debit transaction record
        await addExpense({
          amount: parseFloat(amount),
          category: selectedCategoryName,
          date: new Date().toISOString().split('T')[0], // YYYY-MM-DD today
          // Merge source + notes into a single notes string if both are filled
          notes: [source.trim(), notes.trim()].filter(Boolean).join(' • '),
          tags: [],
          currency: settings.defaultCurrency,
          isRecurring: false,
          walletId: selectedWalletId,
        });
      } else {
        // Income path: credit the selected wallet's currentBalance directly
        const wallet = wallets.find((w) => w.id === selectedWalletId);
        if (!wallet) throw new Error('Wallet not found');
        await updateWallet(selectedWalletId, {
          currentBalance: wallet.currentBalance + parseFloat(amount),
        });
        await loadWallets(); // refresh wallet list so HomeScreen shows updated balance
      }

      // Notify widget instances to re-render — no-op if bridge is absent (iOS / Expo Go)
      try {
        NativeModules.WidgetBridge?.refreshWidgets();
        NativeModules.WidgetBridge?.clearPendingEntry();
      } catch { /* ignore: bridge only available on Android with native build */ }

      // Show animated checkmark then auto-dismiss
      setSaved(true);
      Animated.spring(savedScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }).start();
      setTimeout(handleClose, 750); // short pause so user sees the success state
    } catch {
      Alert.alert('Error', 'Could not save the entry. Please try again.');
      setSaving(false);
    }
  }, [
    amount, selectedCategoryName, selectedWalletId, source, notes,
    isExpense, addExpense, updateWallet, loadWallets, wallets,
    settings, handleClose, savedScale,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.overlay}>

      {/* ── Animated backdrop: fades in behind the sheet ── */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      {/* ── Bottom sheet: slides up from off-screen ── */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <SafeAreaView edges={['bottom']}>

          {/* ── Drag handle pill — visual affordance for "swipe to dismiss" ── */}
          <View style={styles.dragHandleRow}>
            <View style={[styles.dragPill, { backgroundColor: theme.colors.border }]} />
          </View>

          {/* ── Mode switcher: Expense | Received segmented control ── */}
          {/* User can switch mode without closing and re-opening the sheet */}
          <View style={[styles.modeSwitcher, { backgroundColor: theme.colors.inputBackground }]}>
            {/* Expense tab */}
            <TouchableOpacity
              style={[
                styles.modeTab,
                isExpense && { backgroundColor: accentColor }, // active = filled with accent
              ]}
              onPress={() => setMode('expense')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="arrow-top-right"
                size={15}
                color={isExpense ? '#fff' : theme.colors.textSecondary}
              />
              <Text style={[styles.modeTabText, { color: isExpense ? '#fff' : theme.colors.textSecondary }]}>
                Expense
              </Text>
            </TouchableOpacity>

            {/* Received tab */}
            <TouchableOpacity
              style={[
                styles.modeTab,
                !isExpense && { backgroundColor: accentColor }, // active = filled with accent
              ]}
              onPress={() => setMode('income')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="arrow-bottom-left"
                size={15}
                color={!isExpense ? '#fff' : theme.colors.textSecondary}
              />
              <Text style={[styles.modeTabText, { color: !isExpense ? '#fff' : theme.colors.textSecondary }]}>
                Received
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Hero amount input — the primary interaction point ── */}
          {/* Tapping anywhere in the area focuses the hidden TextInput */}
          <TouchableWithoutFeedback onPress={() => amountRef.current?.focus()}>
            <View style={[styles.amountSection, { borderBottomColor: theme.colors.border }]}>
              {/* Currency prefix: colored with accent to reinforce active mode */}
              <Text style={[styles.currencySymbol, { color: accentColor }]}>
                {currencySymbol}
              </Text>
              <TextInput
                ref={amountRef}
                style={[styles.amountInput, { color: theme.colors.text }]}
                value={formatAmountInput(amount)}
                onChangeText={handleAmountChange}
                placeholder="0"
                placeholderTextColor={theme.colors.border} // very subtle placeholder
                keyboardType="decimal-pad"
                maxLength={13}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
          </TouchableWithoutFeedback>

          {/* ── Quick-preset amount chips ── */}
          {/* Tapping a chip fills the amount field instantly — zero extra keystrokes */}
          <View style={styles.presetRow}>
            {PRESETS.map((v) => {
              const isActive = amount === v.toString(); // highlight if this preset is current
              return (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: isActive
                        ? accentColor + '18'  // very faint accent fill when active
                        : theme.colors.inputBackground,
                      borderColor: isActive ? accentColor : 'transparent',
                      borderWidth: isActive ? 1.5 : 0,
                    },
                  ]}
                  onPress={() => applyPreset(v)}
                >
                  <Text
                    style={[
                      styles.presetText,
                      { color: isActive ? accentColor : theme.colors.textSecondary },
                    ]}
                  >
                    {/* Format: ₹100, ₹500, ₹1k, ₹2k */}
                    {currencySymbol}{v >= 1000 ? `${v / 1000}k` : v}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Scrollable form area + save button ── */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            {/* ── Grouped form card ── */}
            <View style={[styles.formCard, { backgroundColor: theme.colors.surfaceVariant }]}>

              {/* CATEGORY — visible only for Expense mode */}
              {isExpense && (
                <>
                  <Text style={[styles.formLabel, { color: theme.colors.textTertiary }]}>CATEGORY</Text>
                  {/* Horizontal scrolling chips for fast category switching */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipsRow}
                    contentContainerStyle={{ paddingRight: 8 }}
                  >
                    {categories.map((cat) => {
                      const sel = cat.name === selectedCategoryName;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: sel ? cat.color + '22' : theme.colors.surface,
                              borderColor: sel ? cat.color : theme.colors.border,
                              borderWidth: 1,
                            },
                          ]}
                          onPress={() => setSelectedCategoryName(cat.name)}
                        >
                          <MaterialCommunityIcons
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            name={cat.icon as any}
                            size={13}
                            color={sel ? cat.color : theme.colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.chipText,
                              { color: sel ? cat.color : theme.colors.textSecondary },
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <View style={[styles.formDivider, { backgroundColor: theme.colors.border }]} />
                </>
              )}

              {/* SOURCE — visible only for Income mode */}
              {!isExpense && (
                <>
                  <Text style={[styles.formLabel, { color: theme.colors.textTertiary }]}>SOURCE</Text>
                  <TextInput
                    style={[styles.inlineInput, { color: theme.colors.text }]}
                    value={source}
                    onChangeText={setSource}
                    placeholder="Salary, Freelance, Gift…"
                    placeholderTextColor={theme.colors.textTertiary}
                    returnKeyType="next"
                  />
                  <View style={[styles.formDivider, { backgroundColor: theme.colors.border }]} />
                </>
              )}

              {/* WALLET — shown in both modes; label changes by mode */}
              <Text style={[styles.formLabel, { color: theme.colors.textTertiary }]}>
                {isExpense ? 'PAY FROM' : 'CREDIT TO'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsRow}
                contentContainerStyle={{ paddingRight: 8 }}
              >
                {wallets.map((w) => {
                  const sel = w.id === selectedWalletId;
                  return (
                    <TouchableOpacity
                      key={w.id}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: sel ? theme.colors.primary + '1A' : theme.colors.surface,
                          borderColor: sel ? theme.colors.primary : theme.colors.border,
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => setSelectedWalletId(w.id)}
                    >
                      <MaterialCommunityIcons
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        name={w.iconName as any}
                        size={13}
                        color={sel ? theme.colors.primary : theme.colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          { color: sel ? theme.colors.primary : theme.colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {w.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={[styles.formDivider, { backgroundColor: theme.colors.border }]} />

              {/* NOTES — optional memo, always shown */}
              <Text style={[styles.formLabel, { color: theme.colors.textTertiary }]}>NOTES</Text>
              <TextInput
                style={[
                  styles.inlineInput,
                  styles.notesInput,
                  { color: theme.colors.text },
                ]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional note…"
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                numberOfLines={2}
                returnKeyType="done"
                blurOnSubmit
                textAlignVertical="top" // Android: pin text to top of multiline field
              />

            </View>{/* end formCard */}

            {/* ── Save button — full-width, accent-colored, shows check on success ── */}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                {
                  backgroundColor: accentColor,
                  opacity: saving && !saved ? 0.72 : 1, // dim while saving, restore on success
                },
              ]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saved ? (
                // Success state: animated scale-in checkmark
                <Animated.View style={{ transform: [{ scale: savedScale }] }}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#fff" />
                </Animated.View>
              ) : (
                <>
                  {/* Mode-appropriate icon to the left of the label */}
                  <MaterialCommunityIcons
                    name={
                      saving
                        ? 'loading'
                        : isExpense
                        ? 'arrow-top-right'
                        : 'arrow-bottom-left'
                    }
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.saveBtnText}>
                    {saving ? 'Saving…' : isExpense ? 'Save Expense' : 'Save Payment'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

          </ScrollView>

        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Fills the screen; bottom-aligns everything so the sheet sits at the bottom edge
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  // Full-screen semi-transparent black backdrop behind the sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },

  // The white/dark bottom-sheet card that slides up
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '93%', // never cover the full screen so users always see context
    elevation: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },

  // Drag handle: centered row containing the pill
  dragHandleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 6,
  },
  dragPill: {
    width: 36,    // wide enough to be obvious
    height: 4,
    borderRadius: 2,
  },

  // Segmented mode-switcher pill container
  modeSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,  // slightly smaller radius than the container for the inset look
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Hero amount row: currency symbol + large number input
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  currencySymbol: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 52, // vertically aligns the symbol with the large text input baseline
  },
  amountInput: {
    flex: 1,
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: -1.5, // tight tracking for a bold hero-number feel
    paddingVertical: 0,   // remove default Android input padding
  },

  // Quick-preset chips row below the amount input
  presetRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Grouped form card containing all detail fields
  formCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    gap: 0, // gaps handled by formDivider and label marginTop
  },
  formLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.9, // spaced-out uppercase label
    marginBottom: 9,
    marginTop: 4,
  },
  formDivider: {
    height: StyleSheet.hairlineWidth, // thinnest possible line on the device
    marginVertical: 14,
  },

  // Horizontal chip scrollers (category / wallet)
  chipsRow: {
    flexGrow: 0,
    marginBottom: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20, // pill shape
    marginRight: 7,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 80, // prevent very long wallet names from stretching chips
  },

  // Inline text inputs inside the form card (no border, no background)
  inlineInput: {
    fontSize: 15,
    paddingVertical: Platform.OS === 'android' ? 2 : 4,
    paddingHorizontal: 0,
  },
  notesInput: {
    minHeight: 46, // two visible lines on most devices
  },

  // Full-width save/submit button at the bottom
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

export default QuickAddScreen;

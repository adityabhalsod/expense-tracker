// Lend & Borrow screen — track money lent to and borrowed from other people
// Supports partial repayments, due dates with overdue badges, and settling/reopening records

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectDebts, selectSettings } from '../store';
import { formatCurrency, formatDate } from '../utils/helpers';
import { Debt, DebtType } from '../types';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import ProgressBar from '../components/common/ProgressBar';
import GradientCard from '../components/common/GradientCard';

type Filter = 'all' | DebtType | 'settled';

// Initials avatar text for a person's name
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

const DebtsScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const debts = useAppStore(selectDebts);
  const settings = useAppStore(selectSettings);
  const loadDebts = useAppStore((s) => s.loadDebts);
  const addDebt = useAppStore((s) => s.addDebt);
  const updateDebt = useAppStore((s) => s.updateDebt);
  const recordDebtPayment = useAppStore((s) => s.recordDebtPayment);
  const deleteDebt = useAppStore((s) => s.deleteDebt);
  const currency = settings.defaultCurrency || 'INR';

  const [filter, setFilter] = useState<Filter>('all');

  // Add/edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<DebtType>('lent');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Repayment modal state
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Refresh when the screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadDebts();
    }, [loadDebts]),
  );

  // Totals across open records
  const { toReceive, toPay } = useMemo(() => {
    let receive = 0;
    let pay = 0;
    for (const d of debts) {
      if (d.isSettled) continue;
      const left = d.amount - d.paidAmount;
      if (d.type === 'lent') receive += left;
      else pay += left;
    }
    return { toReceive: receive, toPay: pay };
  }, [debts]);

  const visible = useMemo(() => {
    switch (filter) {
      case 'lent':
      case 'borrowed':
        return debts.filter((d) => d.type === filter && !d.isSettled);
      case 'settled':
        return debts.filter((d) => d.isSettled);
      default:
        return debts.filter((d) => !d.isSettled);
    }
  }, [debts, filter]);

  const resetForm = () => {
    setEditingId(null);
    setType('lent');
    setPerson('');
    setAmount('');
    setDueDate(undefined);
    setNotes('');
  };

  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (d: Debt) => {
    setEditingId(d.id);
    setType(d.type);
    setPerson(d.person);
    setAmount(String(d.amount));
    setDueDate(d.dueDate);
    setNotes(d.notes ?? '');
    setShowForm(true);
  };

  const handleSave = async () => {
    const value = parseFloat(amount.replace(/,/g, ''));
    if (!person.trim()) {
      Alert.alert(t.common.error, t.debts.invalidPerson);
      return;
    }
    if (!value || value <= 0) {
      Alert.alert(t.common.error, t.debts.invalidAmount);
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const existing = debts.find((d) => d.id === editingId);
        const paid = Math.min(existing?.paidAmount ?? 0, value);
        await updateDebt(editingId, {
          type,
          person: person.trim(),
          amount: value,
          paidAmount: paid,
          dueDate: dueDate ?? '',
          notes: notes.trim(),
          isSettled: paid >= value,
        });
      } else {
        await addDebt({
          type,
          person: person.trim(),
          amount: value,
          paidAmount: 0,
          currency,
          date: format(new Date(), 'yyyy-MM-dd'),
          dueDate,
          notes: notes.trim() || undefined,
          isSettled: false,
        });
      }
      setShowForm(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!payingDebt) return;
    const value = parseFloat(paymentAmount.replace(/,/g, ''));
    if (!value || value <= 0) {
      Alert.alert(t.common.error, t.debts.invalidAmount);
      return;
    }
    await recordDebtPayment(payingDebt.id, value);
    setPayingDebt(null);
    setPaymentAmount('');
  };

  const handleLongPress = (d: Debt) => {
    Alert.alert(d.person, undefined, [
      { text: t.common.edit, onPress: () => openEdit(d) },
      d.isSettled
        ? { text: t.debts.reopen, onPress: () => updateDebt(d.id, { isSettled: false }) }
        : { text: t.debts.markSettled, onPress: () => updateDebt(d.id, { isSettled: true, paidAmount: d.amount }) },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: () =>
          Alert.alert(t.debts.deleteTitle, t.debts.deleteMsg, [
            { text: t.common.cancel, style: 'cancel' },
            { text: t.common.delete, style: 'destructive', onPress: () => deleteDebt(d.id) },
          ]),
      },
      { text: t.common.cancel, style: 'cancel' },
    ]);
  };

  // Human-friendly due status line and its colour
  const dueStatus = (d: Debt): { text: string; color: string } | null => {
    if (d.isSettled) return { text: t.debts.settled, color: theme.colors.success };
    if (!d.dueDate) return null;
    const days = differenceInCalendarDays(parseISO(d.dueDate), new Date());
    if (days < 0) return { text: t.debts.overdueByDays.replace('{n}', String(-days)), color: theme.colors.error };
    if (days === 0) return { text: t.debts.dueToday, color: theme.colors.warning };
    return {
      text: t.debts.dueInDays.replace('{n}', String(days)),
      color: days <= 3 ? theme.colors.warning : theme.colors.textSecondary,
    };
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t.debts.active },
    { key: 'lent', label: t.debts.lent },
    { key: 'borrowed', label: t.debts.borrowed },
    { key: 'settled', label: t.debts.settled },
  ];

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Summary hero */}
        <GradientCard style={styles.hero}>
          <Text style={styles.heroCaption}>{t.debts.subtitle}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroCol}>
              <View style={styles.heroLabelRow}>
                <MaterialCommunityIcons name="arrow-bottom-left" size={16} color="#BBF7D0" />
                <Text style={styles.heroLabel}>{t.debts.youWillGet}</Text>
              </View>
              <Text style={styles.heroValue}>{formatCurrency(toReceive, currency)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroCol}>
              <View style={styles.heroLabelRow}>
                <MaterialCommunityIcons name="arrow-top-right" size={16} color="#FECACA" />
                <Text style={styles.heroLabel}>{t.debts.youOwe}</Text>
              </View>
              <Text style={styles.heroValue}>{formatCurrency(toPay, currency)}</Text>
            </View>
          </View>
        </GradientCard>

        {/* Segmented filter */}
        <View style={[styles.segment, { backgroundColor: theme.colors.surfaceVariant }]}>
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.segmentItem, active && { backgroundColor: theme.colors.surface }]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? theme.colors.text : theme.colors.textSecondary },
                    active && { fontWeight: '700' },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {visible.length === 0 ? (
          <EmptyState
            icon="handshake-outline"
            title={t.debts.noDebts}
            subtitle={t.debts.noDebtsHint}
            actionLabel={t.debts.addDebt}
            onAction={openNew}
          />
        ) : (
          visible.map((d) => {
            const left = d.amount - d.paidAmount;
            const tone = d.type === 'lent' ? theme.colors.income : theme.colors.expense;
            const status = dueStatus(d);
            return (
              <Card key={d.id} onPress={() => handleLongPress(d)} onLongPress={() => openEdit(d)}>
                <View style={styles.row}>
                  <View style={[styles.avatar, { backgroundColor: tone + '1F' }]}>
                    <Text style={[styles.avatarText, { color: tone }]}>{initials(d.person) || '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.person, { color: theme.colors.text }]} numberOfLines={1}>
                      {d.person}
                    </Text>
                    <Text style={[styles.meta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                      {d.type === 'lent' ? t.debts.owesYou : t.debts.youOweTo} · {formatDate(d.date, 'dd MMM')}
                      {d.notes ? ` · ${d.notes}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.amount, { color: d.isSettled ? theme.colors.textTertiary : tone }]}>
                      {formatCurrency(d.isSettled ? d.amount : left, d.currency)}
                    </Text>
                    {status && <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>}
                  </View>
                </View>

                {!d.isSettled && d.paidAmount > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <ProgressBar progress={d.paidAmount / d.amount} color={tone} height={6} />
                    <Text style={[styles.progressText, { color: theme.colors.textTertiary }]}>
                      {formatCurrency(d.paidAmount, d.currency)} {t.debts.paid} · {formatCurrency(d.amount, d.currency)}
                    </Text>
                  </View>
                )}

                {!d.isSettled && (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => {
                        setPayingDebt(d);
                        setPaymentAmount('');
                      }}
                      style={[styles.actionChip, { backgroundColor: theme.colors.chipBackground }]}
                    >
                      <MaterialCommunityIcons name="cash-plus" size={16} color={theme.colors.chipText} />
                      <Text style={[styles.actionText, { color: theme.colors.chipText }]}>{t.debts.recordPayment}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => updateDebt(d.id, { isSettled: true, paidAmount: d.amount })}
                      style={[styles.actionChip, { backgroundColor: theme.colors.success + '1A' }]}
                    >
                      <MaterialCommunityIcons name="check-circle-outline" size={16} color={theme.colors.success} />
                      <Text style={[styles.actionText, { color: theme.colors.success }]}>{t.debts.markSettled}</Text>
                    </Pressable>
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Floating add button */}
      <Pressable
        onPress={openNew}
        accessibilityLabel={t.debts.addDebt}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
      >
        <MaterialCommunityIcons name="plus" size={26} color={theme.colors.onPrimary} />
        <Text style={[styles.fabText, { color: theme.colors.onPrimary }]}>{t.debts.addDebt}</Text>
      </Pressable>

      {/* Add / edit sheet */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheetBackdrop, { backgroundColor: theme.colors.overlay }]}
        >
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
              {editingId ? t.debts.editDebt : t.debts.addDebt}
            </Text>

            {/* Type toggle */}
            <View style={[styles.segment, styles.segmentInSheet, { backgroundColor: theme.colors.surfaceVariant }]}>
              {(['lent', 'borrowed'] as DebtType[]).map((k) => {
                const active = type === k;
                const color = k === 'lent' ? theme.colors.income : theme.colors.expense;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setType(k)}
                    style={[styles.segmentItem, active && { backgroundColor: color }]}
                  >
                    <Text style={[styles.segmentText, { color: active ? '#FFFFFF' : theme.colors.textSecondary }]}>
                      {k === 'lent' ? t.debts.lent : t.debts.borrowed}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{t.debts.person}</Text>
            <TextInput
              value={person}
              onChangeText={setPerson}
              placeholder={t.debts.personPlaceholder}
              placeholderTextColor={theme.colors.textTertiary}
              style={inputStyle}
            />

            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{t.debts.amount}</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              keyboardType="decimal-pad"
              placeholderTextColor={theme.colors.textTertiary}
              style={[inputStyle, styles.amountInput]}
            />

            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{t.debts.dueDate}</Text>
            <View style={styles.dueRow}>
              <Pressable onPress={() => setShowDatePicker(true)} style={[inputStyle, styles.dueInput]}>
                <MaterialCommunityIcons name="calendar" size={18} color={theme.colors.textSecondary} />
                <Text style={{ color: dueDate ? theme.colors.text : theme.colors.textTertiary, fontSize: 15 }}>
                  {dueDate ? formatDate(dueDate) : t.debts.noDueDate}
                </Text>
              </Pressable>
              {dueDate && (
                <Pressable onPress={() => setDueDate(undefined)} hitSlop={8}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>{t.debts.clearDueDate}</Text>
                </Pressable>
              )}
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={dueDate ? parseISO(dueDate) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_event, selected) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selected) setDueDate(format(selected, 'yyyy-MM-dd'));
                }}
              />
            )}

            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{t.debts.notes}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t.debts.notesPlaceholder}
              placeholderTextColor={theme.colors.textTertiary}
              style={inputStyle}
            />

            <View style={styles.sheetButtons}>
              <Button
                title={t.common.cancel}
                variant="secondary"
                onPress={() => setShowForm(false)}
                style={{ flex: 1 }}
              />
              <Button title={t.debts.save} onPress={handleSave} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Record payment sheet */}
      <Modal visible={!!payingDebt} transparent animationType="fade" onRequestClose={() => setPayingDebt(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.centerBackdrop, { backgroundColor: theme.colors.overlay }]}
        >
          <View style={[styles.dialog, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>{t.debts.recordPayment}</Text>
            {payingDebt && (
              <Text style={[styles.meta, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
                {payingDebt.person} · {formatCurrency(payingDebt.amount - payingDebt.paidAmount, payingDebt.currency)}{' '}
                {t.debts.remaining}
              </Text>
            )}
            <TextInput
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder={t.debts.paymentAmount}
              keyboardType="decimal-pad"
              autoFocus
              placeholderTextColor={theme.colors.textTertiary}
              style={[inputStyle, styles.amountInput]}
            />
            {payingDebt && (
              <Pressable
                onPress={() => setPaymentAmount(String(payingDebt.amount - payingDebt.paidAmount))}
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              >
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                  {formatCurrency(payingDebt.amount - payingDebt.paidAmount, payingDebt.currency)}
                </Text>
              </Pressable>
            )}
            <View style={styles.sheetButtons}>
              <Button
                title={t.common.cancel}
                variant="secondary"
                onPress={() => setPayingDebt(null)}
                style={{ flex: 1 }}
              />
              <Button title={t.debts.save} onPress={handleRecordPayment} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { margin: 16, marginBottom: 8 },
  heroCaption: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500', marginBottom: 16 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroCol: { flex: 1 },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  heroDivider: { width: 1, height: 44, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 16 },
  segment: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 12, padding: 4, borderRadius: 14 },
  segmentInSheet: { marginHorizontal: 0, marginTop: 4 },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segmentText: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  person: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 17, fontWeight: '800' },
  status: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  progressText: { fontSize: 11, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionText: { fontSize: 12, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    height: 54,
    borderRadius: 27,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { fontSize: 15, fontWeight: '700' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
  amountInput: { fontSize: 22, fontWeight: '700' },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dueInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  centerBackdrop: { flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 24, padding: 20 },
});

export default DebtsScreen;

// Bills & Subscriptions screen — every active recurring expense with its next due date
// Shows the total monthly/yearly commitment and groups bills into "upcoming" (next 7 days) and "later"

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectCategories, selectSettings } from '../store';
import { formatCurrency, formatDate } from '../utils/helpers';
import { UpcomingBill } from '../types';
import { loadUpcomingBills } from '../services/financialInsights';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import GradientCard from '../components/common/GradientCard';
import IconBadge from '../components/common/IconBadge';
import SectionHeader from '../components/common/SectionHeader';

const BillsScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const categories = useAppStore(selectCategories);
  const settings = useAppStore(selectSettings);
  const currency = settings.defaultCurrency || 'INR';
  const [bills, setBills] = useState<UpcomingBill[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setBills(await loadUpcomingBills());
    } catch (e) {
      console.warn('Failed to load bills:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const monthlyTotal = useMemo(() => bills.reduce((s, b) => s + b.monthlyCost, 0), [bills]);
  const upcoming = useMemo(() => bills.filter((b) => b.daysUntil <= 7), [bills]);
  const later = useMemo(() => bills.filter((b) => b.daysUntil > 7), [bills]);

  const categoryInfo = useCallback(
    (name: string) => {
      const c = categories.find((x) => x.name === name);
      return { icon: c?.icon ?? 'repeat', color: c?.color ?? theme.colors.primary };
    },
    [categories, theme.colors.primary],
  );

  const dueLabel = (b: UpcomingBill) => {
    if (b.daysUntil <= 0) return t.bills.dueToday;
    if (b.daysUntil === 1) return t.bills.dueTomorrow;
    return t.bills.inDays.replace('{n}', String(b.daysUntil));
  };

  const renderBill = (b: UpcomingBill) => {
    const info = categoryInfo(b.category);
    const urgent = b.daysUntil <= 2;
    return (
      <Card key={b.key} style={styles.billCard}>
        <View style={styles.row}>
          <IconBadge icon={info.icon} color={info.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
              {b.name}
            </Text>
            <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
              {t.frequencies[b.frequency]} · {formatDate(b.nextDate, 'EEE, dd MMM')}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.amount, { color: theme.colors.text }]}>{formatCurrency(b.amount, b.currency)}</Text>
            <View
              style={[
                styles.duePill,
                { backgroundColor: (urgent ? theme.colors.warning : theme.colors.primary) + '1F' },
              ]}
            >
              <Text style={[styles.dueText, { color: urgent ? theme.colors.warning : theme.colors.primary }]}>
                {dueLabel(b)}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={theme.colors.primary}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
        />
      }
    >
      <GradientCard style={styles.hero}>
        <Text style={styles.heroLabel}>{t.bills.monthlyCost}</Text>
        <Text style={styles.heroValue}>{formatCurrency(monthlyTotal, currency)}</Text>
        <View style={styles.heroFooter}>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipText}>
              {formatCurrency(monthlyTotal * 12, currency)} {t.bills.yearlyCost.toLowerCase()}
            </Text>
          </View>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipText}>{t.bills.activeCount.replace('{n}', String(bills.length))}</Text>
          </View>
        </View>
      </GradientCard>

      {bills.length === 0 ? (
        <EmptyState
          icon="calendar-sync-outline"
          title={t.bills.noBills}
          subtitle={t.bills.noBillsHint}
          actionLabel={t.bills.addRecurring}
          onAction={() => navigation.navigate('AddExpense', {})}
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <SectionHeader title={t.bills.next7Days} />
              {upcoming.map(renderBill)}
            </>
          )}
          {later.length > 0 && (
            <>
              <SectionHeader title={t.bills.later} />
              {later.map(renderBill)}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  hero: { margin: 16, marginBottom: 4 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroValue: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 },
  heroFooter: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  heroChip: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  heroChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  billCard: { paddingVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800' },
  duePill: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  dueText: { fontSize: 11, fontWeight: '700' },
});

export default BillsScreen;

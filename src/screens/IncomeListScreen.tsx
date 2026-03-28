// Income history list screen showing all recorded income with sorting
// Follows the same design pattern as AllExpensesScreen for consistency

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectIncome, selectWallets, selectSettings } from '../store';
import Card from '../components/common/Card';
import { formatCurrency, formatRelativeDate } from '../utils/helpers';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Income } from '../types';
import { INCOME_SOURCES } from '../constants';

const IncomeListScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();

  // Store subscriptions via selectors
  const income = useAppStore(selectIncome);
  const wallets = useAppStore(selectWallets);
  const settings = useAppStore(selectSettings);
  const loadIncome = useAppStore((s) => s.loadIncome);
  const deleteIncome = useAppStore((s) => s.deleteIncome);

  const [refreshing, setRefreshing] = useState(false);

  // Reload income when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadIncome(100);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadIncome(100);
    setRefreshing(false);
  };

  // Get icon and color for an income source
  const getSourceInfo = useCallback((source: string) => {
    const src = INCOME_SOURCES.find(s => s.value === source);
    return { icon: src?.icon || 'cash', color: src?.color || '#10B981', label: src?.label || source };
  }, []);

  // Find wallet name by ID
  const getWalletName = useCallback((walletId: string) => {
    const wallet = wallets.find(w => w.id === walletId);
    return wallet?.nickname || wallet?.name || 'Unknown';
  }, [wallets]);

  // Calculate total income across all records
  const totalIncome = useMemo(
    () => income.reduce((sum, i) => sum + i.amount, 0),
    [income]
  );

  // Confirm and delete an income record
  const handleDelete = (id: string) => {
    Alert.alert(
      t.income.deleteTitle,
      t.income.deleteMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: () => deleteIncome(id),
        },
      ],
    );
  };

  // Render a single income row
  const renderIncomeItem = ({ item }: { item: Income }) => {
    const sourceInfo = getSourceInfo(item.source);
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('AddIncome', { incomeId: item.id })}
        onLongPress={() => handleDelete(item.id)}
      >
        <Card style={styles.incomeCard}>
          <View style={styles.incomeRow}>
            {/* Source icon circle */}
            <View style={[styles.sourceIcon, { backgroundColor: sourceInfo.color + '20' }]}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <MaterialCommunityIcons name={sourceInfo.icon as any} size={24} color={sourceInfo.color} />
            </View>
            {/* Source name, wallet, and date */}
            <View style={styles.incomeInfo}>
              <Text style={[styles.sourceLabel, { color: theme.colors.text }]}>{sourceInfo.label}</Text>
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="wallet" size={12} color={theme.colors.textTertiary} />
                <Text style={[styles.walletLabel, { color: theme.colors.textSecondary }]}>
                  {getWalletName(item.walletId)}
                </Text>
                <Text style={[styles.dateLabel, { color: theme.colors.textTertiary }]}>
                  • {formatRelativeDate(item.date)}
                </Text>
              </View>
            </View>
            {/* Income amount in green */}
            <Text style={[styles.incomeAmount, { color: theme.colors.income }]}>
              +{formatCurrency(item.amount, item.currency)}
            </Text>
          </View>
          {/* Notes if present */}
          {item.notes ? (
            <Text style={[styles.incomeNotes, { color: theme.colors.textTertiary }]} numberOfLines={1}>
              {item.notes}
            </Text>
          ) : null}
          {/* Recurring badge */}
          {item.isRecurring && (
            <View style={[styles.recurringBadge, { backgroundColor: theme.colors.chipBackground }]}>
              <MaterialCommunityIcons name="repeat" size={12} color={theme.colors.chipText} />
              <Text style={[styles.recurringText, { color: theme.colors.chipText }]}>
                {item.recurringFrequency || 'Recurring'}
              </Text>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Total income summary card */}
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.income }]}>
        <Text style={styles.summaryLabel}>{t.income.totalIncome}</Text>
        <Text style={styles.summaryAmount}>{formatCurrency(totalIncome, settings.defaultCurrency)}</Text>
        <Text style={styles.summaryCount}>
          {income.length} {income.length === 1 ? t.common.transaction : t.common.transactions}
        </Text>
      </View>

      {/* Income list */}
      <FlatList
        data={income}
        keyExtractor={(item) => item.id}
        renderItem={renderIncomeItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={income.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cash-plus" size={64} color={theme.colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.textSecondary }]}>{t.income.noIncome}</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textTertiary }]}>{t.income.addFirstIncome}</Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: theme.colors.income }]}
              onPress={() => navigation.navigate('AddIncome', {})}
            >
              <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
              <Text style={styles.emptyButtonText}>{t.income.addIncome}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB for adding new income */}
      {income.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.income }]}
          onPress={() => navigation.navigate('AddIncome', {})}
        >
          <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryCard: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
  },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
  summaryAmount: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', marginTop: 4 },
  summaryCount: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  listContent: { paddingBottom: 100 },
  emptyContainer: { flexGrow: 1 },
  incomeCard: { paddingVertical: 12 },
  incomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  incomeInfo: { flex: 1 },
  sourceLabel: { fontSize: 15, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  walletLabel: { fontSize: 12 },
  dateLabel: { fontSize: 12 },
  incomeAmount: { fontSize: 16, fontWeight: '700' },
  incomeNotes: { fontSize: 12, marginTop: 6, marginLeft: 56 },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 56,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  recurringText: { fontSize: 11, fontWeight: '500' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});

export default IncomeListScreen;

// Wallet management screen displaying all wallets as payment sources
// Shows wallet cards with balance, type badge, icon, and color-coded visuals

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectWallets } from '../store';
import Card from '../components/common/Card';
import { formatCurrency } from '../utils/helpers';
import { Wallet, WalletType } from '../types';

// Map wallet type to display label and icon
const WALLET_TYPE_META: Record<WalletType, { icon: string; label: string }> = {
  cash: { icon: 'cash', label: 'Cash' },
  bank_account: { icon: 'bank', label: 'Bank' },
  digital_wallet: { icon: 'wallet-outline', label: 'Digital' },
  credit_card: { icon: 'credit-card-outline', label: 'Card' },
  other: { icon: 'dots-horizontal-circle-outline', label: 'Other' },
};

const WalletScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  // Subscribe to individual store slices to avoid full-store re-renders
  const wallets = useAppStore(selectWallets);
  const loadWallets = useAppStore((s) => s.loadWallets);
  const loadCurrentWallet = useAppStore((s) => s.loadCurrentWallet);
  const deleteWallet = useAppStore((s) => s.deleteWallet);

  // Refresh wallet data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadWallets();
      loadCurrentWallet();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Aggregate total balance across all wallets
  const totalBalance = useMemo(
    () => wallets.reduce((sum, w) => sum + w.currentBalance, 0),
    [wallets]
  );

  // Aggregate total initial balance across all wallets
  const totalInitial = useMemo(
    () => wallets.reduce((sum, w) => sum + w.initialBalance, 0),
    [wallets]
  );

  // Calculate total spent across all wallets
  const totalSpent = useMemo(() => totalInitial - totalBalance, [totalInitial, totalBalance]);

  // Calculate spending percentage for progress bar
  const spentPercentage = useMemo(
    () => totalInitial > 0 ? Math.min((totalSpent / totalInitial) * 100, 100) : 0,
    [totalSpent, totalInitial]
  );

  // Determine progress bar color based on percentage
  const getProgressColor = useCallback(() => {
    if (spentPercentage < 50) return theme.colors.success;
    if (spentPercentage < 80) return theme.colors.warning;
    return theme.colors.error;
  }, [spentPercentage, theme.colors]);

  // Confirm and delete a wallet by ID
  const handleDelete = (wallet: Wallet) => {
    Alert.alert(
      t.common.delete,
      `${t.walletSetup?.deleteConfirm || 'Are you sure you want to delete this wallet?'}`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: () => deleteWallet(wallet.id),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Screen header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t.wallet.title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {wallets.length} {wallets.length === 1 ? 'wallet' : 'wallets'}
          </Text>
        </View>

        {wallets.length > 0 ? (
          <>
            {/* Aggregate balance summary card */}
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.primary }]}>
              {/* Total remaining balance (large emphasis) */}
              <Text style={styles.summaryLabel}>{t.wallet.remainingBalance}</Text>
              <Text style={styles.summaryBalance}>{formatCurrency(totalBalance)}</Text>

              {/* Spending progress bar */}
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <View
                    style={[styles.progressFill, { width: `${spentPercentage}%`, backgroundColor: getProgressColor() }]}
                  />
                </View>
                <Text style={styles.progressText}>{spentPercentage.toFixed(0)}% {t.wallet.spent}</Text>
              </View>

              {/* Income / Expense summary row */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  {/* Green-tinted icon background for starting balance */}
                  <View style={[styles.summaryIcon, { backgroundColor: 'rgba(76, 217, 100, 0.3)' }]}>
                    <MaterialCommunityIcons name="arrow-down" size={16} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.summaryItemLabel}>{t.wallet.startingBalance}</Text>
                    <Text style={styles.summaryItemAmount}>{formatCurrency(totalInitial)}</Text>
                  </View>
                </View>
                <View style={styles.summaryItem}>
                  {/* Red-tinted icon background for total spent */}
                  <View style={[styles.summaryIcon, { backgroundColor: 'rgba(255, 69, 58, 0.3)' }]}>
                    <MaterialCommunityIcons name="arrow-up" size={16} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.summaryItemLabel}>{t.wallet.totalSpent}</Text>
                    <Text style={[styles.summaryItemAmount, { color: '#FFB4B4' }]}>{formatCurrency(totalSpent)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Quick action row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => navigation.navigate('AddExpense', {})}
              >
                <MaterialCommunityIcons name="minus-circle" size={28} color={theme.colors.error} />
                <Text style={[styles.actionText, { color: theme.colors.text }]}>{t.wallet.addExpense}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => navigation.navigate('WalletSetup')}
              >
                <MaterialCommunityIcons name="plus-circle" size={28} color={theme.colors.success} />
                <Text style={[styles.actionText, { color: theme.colors.text }]}>{t.wallet.createWallet}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => navigation.navigate('BudgetSetup')}
              >
                <MaterialCommunityIcons name="target" size={28} color={theme.colors.warning} />
                <Text style={[styles.actionText, { color: theme.colors.text }]}>{t.wallet.budgets}</Text>
              </TouchableOpacity>
            </View>

            {/* Wallet list section header */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t.wallet.walletHistory}</Text>
            </View>

            {/* Individual wallet cards */}
            {wallets.map((wallet) => {
              const typeMeta = WALLET_TYPE_META[wallet.type] || WALLET_TYPE_META.other;
              const walletSpent = wallet.initialBalance - wallet.currentBalance;
              const walletPct = wallet.initialBalance > 0
                ? Math.min((walletSpent / wallet.initialBalance) * 100, 100) : 0;
              return (
                <TouchableOpacity
                  key={wallet.id}
                  onPress={() => navigation.navigate('WalletSetup', { walletId: wallet.id })}
                  onLongPress={() => handleDelete(wallet)}
                  activeOpacity={0.7}
                >
                  <Card style={styles.walletCard}>
                    <View style={styles.walletRow}>
                      {/* Wallet icon with color background */}
                      <View style={[styles.walletIcon, { backgroundColor: wallet.color + '20' }]}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <MaterialCommunityIcons name={wallet.iconName as any} size={26} color={wallet.color} />
                      </View>

                      {/* Wallet details: name, type badge, balance */}
                      <View style={styles.walletInfo}>
                        <View style={styles.walletNameRow}>
                          <Text style={[styles.walletName, { color: theme.colors.text }]} numberOfLines={1}>
                            {wallet.nickname || wallet.name}
                          </Text>
                          {/* Default badge */}
                          {wallet.isDefault && (
                            <View style={[styles.defaultBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                              <Text style={[styles.defaultBadgeText, { color: theme.colors.primary }]}>
                                {t.walletSetup?.default || 'Default'}
                              </Text>
                            </View>
                          )}
                        </View>
                        {/* Type badge with icon */}
                        <View style={styles.typeBadge}>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          <MaterialCommunityIcons name={typeMeta.icon as any} size={12} color={theme.colors.textTertiary} />
                          <Text style={[styles.typeText, { color: theme.colors.textTertiary }]}>
                            {typeMeta.label}
                            {wallet.bankName ? ` · ${wallet.bankName}` : ''}
                          </Text>
                        </View>
                        {/* Mini progress bar */}
                        <View style={[styles.miniProgress, { backgroundColor: theme.colors.border }]}>
                          <View style={[styles.miniProgressFill, { width: `${walletPct}%`, backgroundColor: wallet.color }]} />
                        </View>
                      </View>

                      {/* Balance and spent amount on the right */}
                      <View style={styles.walletRight}>
                        <Text style={[styles.walletBalance, { color: theme.colors.text }]}>
                          {formatCurrency(wallet.currentBalance, wallet.currency)}
                        </Text>
                        <Text style={[styles.walletSpent, { color: theme.colors.expense }]}>
                          -{formatCurrency(walletSpent, wallet.currency)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          // Empty state — prompt to create first wallet
          <Card style={styles.setupCard}>
            <View style={styles.setupContent}>
              <MaterialCommunityIcons name="wallet-plus" size={64} color={theme.colors.primary} />
              <Text style={[styles.setupTitle, { color: theme.colors.text }]}>{t.wallet.setupTitle}</Text>
              <Text style={[styles.setupSubtitle, { color: theme.colors.textSecondary }]}>
                {t.wallet.setupSubtitle}
              </Text>
              <TouchableOpacity
                style={[styles.createBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => navigation.navigate('WalletSetup')}
              >
                <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
                <Text style={styles.createBtnText}>{t.wallet.createWallet}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Bottom spacer for tab bar clearance */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating action button to add new wallet */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('WalletSetup')}
      >
        <MaterialCommunityIcons name="wallet-plus" size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 2 },
  // Aggregate summary card
  summaryCard: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
  },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  summaryBalance: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 8,
  },
  progressContainer: { marginVertical: 12 },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginTop: 6 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  summaryItemLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  summaryItemAmount: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  // Action buttons
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1, padding: 14, borderRadius: 16,
    alignItems: 'center', borderWidth: 0.5, gap: 6,
  },
  actionText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  // Section header
  sectionHeader: { paddingHorizontal: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  // Individual wallet cards
  walletCard: { paddingVertical: 12, paddingHorizontal: 4 },
  walletRow: { flexDirection: 'row', alignItems: 'center' },
  walletIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  walletInfo: { flex: 1, marginRight: 8 },
  walletNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletName: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  defaultBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  defaultBadgeText: { fontSize: 10, fontWeight: '700' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  typeText: { fontSize: 11 },
  miniProgress: { height: 3, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  miniProgressFill: { height: '100%', borderRadius: 2 },
  walletRight: { alignItems: 'flex-end' },
  walletBalance: { fontSize: 15, fontWeight: '700' },
  walletSpent: { fontSize: 12, marginTop: 2 },
  // Empty state
  setupCard: { marginTop: 40 },
  setupContent: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  setupTitle: { fontSize: 22, fontWeight: '700' },
  setupSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8,
  },
  createBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  // FAB
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6,
  },
});

export default WalletScreen;

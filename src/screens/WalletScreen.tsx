// Wallet management screen displaying monthly balance, income tracking, and wallet history
// Shows starting balance, total expenses, and remaining balance prominently

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppStore } from '../store';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { formatCurrency } from '../utils/helpers';
import { MONTH_NAMES } from '../constants';

const WalletScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { currentWallet, wallets, loadWallets, loadCurrentWallet } = useAppStore();

  // Refresh wallet data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadWallets();
      loadCurrentWallet();
    }, [])
  );

  // Get current month and year for display
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-indexed month
  const currentYear = now.getFullYear();

  // Calculate wallet metrics for the progress indicator
  const totalSpent = currentWallet ? currentWallet.initialBalance - currentWallet.currentBalance : 0;
  const spentPercentage = currentWallet && currentWallet.initialBalance > 0
    ? Math.min((totalSpent / currentWallet.initialBalance) * 100, 100) // Cap at 100%
    : 0;

  // Determine color based on spending level (green/yellow/red)
  const getProgressColor = () => {
    if (spentPercentage < 50) return theme.colors.success; // Under half spent
    if (spentPercentage < 80) return theme.colors.warning; // Approaching limit
    return theme.colors.error; // Over budget
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Screen header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Wallet</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </Text>
        </View>

        {currentWallet ? (
          <>
            {/* Main wallet balance card */}
            <View style={[styles.walletCard, { backgroundColor: theme.colors.primary }]}>
              {/* Wallet name and edit button */}
              <View style={styles.walletHeader}>
                <Text style={styles.walletName}>{currentWallet.name}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('WalletSetup', { walletId: currentWallet.id })}>
                  <MaterialCommunityIcons name="pencil" size={20} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              {/* Large remaining balance display */}
              <Text style={styles.balanceLabel}>Remaining Balance</Text>
              <Text style={styles.balanceAmount}>
                {formatCurrency(currentWallet.currentBalance, currentWallet.currency)}
              </Text>

              {/* Visual progress bar showing spent percentage */}
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${spentPercentage}%`, backgroundColor: getProgressColor() },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>{spentPercentage.toFixed(0)}% spent</Text>
              </View>

              {/* Income and expense summary at bottom of card */}
              <View style={styles.summaryRow}>
                {/* Starting balance (income) */}
                <View style={styles.summaryItem}>
                  <View style={styles.summaryIcon}>
                    <MaterialCommunityIcons name="arrow-down" size={16} color={theme.colors.success} />
                  </View>
                  <View>
                    <Text style={styles.summaryLabel}>Starting Balance</Text>
                    <Text style={styles.summaryAmount}>
                      {formatCurrency(currentWallet.initialBalance, currentWallet.currency)}
                    </Text>
                  </View>
                </View>
                {/* Total spent (expenses) */}
                <View style={styles.summaryItem}>
                  <View style={styles.summaryIcon}>
                    <MaterialCommunityIcons name="arrow-up" size={16} color={theme.colors.error} />
                  </View>
                  <View>
                    <Text style={styles.summaryLabel}>Total Spent</Text>
                    <Text style={[styles.summaryAmount, { color: '#FFB4B4' }]}>
                      {formatCurrency(totalSpent, currentWallet.currency)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Quick action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => navigation.navigate('AddExpense', {})}
              >
                <MaterialCommunityIcons name="plus-circle" size={28} color={theme.colors.primary} />
                <Text style={[styles.actionText, { color: theme.colors.text }]}>Add Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => navigation.navigate('WalletSetup', { walletId: currentWallet.id })}
              >
                <MaterialCommunityIcons name="wallet-plus" size={28} color={theme.colors.success} />
                <Text style={[styles.actionText, { color: theme.colors.text }]}>Edit Wallet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => navigation.navigate('BudgetSetup')}
              >
                <MaterialCommunityIcons name="target" size={28} color={theme.colors.warning} />
                <Text style={[styles.actionText, { color: theme.colors.text }]}>Budgets</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          // Setup prompt when no wallet exists for current month
          <Card style={styles.setupCard}>
            <View style={styles.setupContent}>
              <MaterialCommunityIcons name="wallet-plus" size={64} color={theme.colors.primary} />
              <Text style={[styles.setupTitle, { color: theme.colors.text }]}>Set Up Your Wallet</Text>
              <Text style={[styles.setupSubtitle, { color: theme.colors.textSecondary }]}>
                Add your monthly salary or starting balance to begin tracking your finances for {MONTH_NAMES[currentMonth - 1]}.
              </Text>
              <Button
                title="Create Wallet"
                onPress={() => navigation.navigate('WalletSetup')}
                variant="primary"
                size="large"
              />
            </View>
          </Card>
        )}

        {/* Wallet history section showing past months */}
        <View style={styles.historyHeader}>
          <Text style={[styles.historyTitle, { color: theme.colors.text }]}>Wallet History</Text>
        </View>

        {wallets.length > 0 ? (
          wallets.map((wallet) => (
            <Card key={wallet.id} style={styles.historyCard}>
              <View style={styles.historyRow}>
                <View>
                  {/* Month and year label */}
                  <Text style={[styles.historyMonth, { color: theme.colors.text }]}>
                    {MONTH_NAMES[wallet.month - 1]} {wallet.year}
                  </Text>
                  {/* Balance ratio display */}
                  <Text style={[styles.historyBalance, { color: theme.colors.textSecondary }]}>
                    {formatCurrency(wallet.currentBalance, wallet.currency)} / {formatCurrency(wallet.initialBalance, wallet.currency)}
                  </Text>
                </View>
                {/* Spent amount and percentage */}
                <View style={styles.historyRight}>
                  <Text style={[styles.historySpent, { color: theme.colors.expense }]}>
                    -{formatCurrency(wallet.initialBalance - wallet.currentBalance, wallet.currency)}
                  </Text>
                  <Text style={[styles.historyPercent, { color: theme.colors.textTertiary }]}>
                    {wallet.initialBalance > 0
                      ? ((wallet.initialBalance - wallet.currentBalance) / wallet.initialBalance * 100).toFixed(0)
                      : 0}% spent
                  </Text>
                </View>
              </View>
            </Card>
          ))
        ) : (
          <Card>
            <Text style={[styles.noHistory, { color: theme.colors.textSecondary }]}>No wallet history yet</Text>
          </Card>
        )}

        {/* Bottom spacer for tab bar clearance */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 2 },
  walletCard: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
  },
  walletHeader: {
    flexDirection: 'row', // Name and edit button side by side
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletName: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 40, // Prominent balance display
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 8,
  },
  progressContainer: { marginVertical: 16 },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginTop: 6 },
  summaryRow: {
    flexDirection: 'row', // Income and expense side by side
    justifyContent: 'space-between',
    marginTop: 8,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  summaryAmount: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row', // Three action buttons in a row
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    gap: 6,
  },
  actionText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  setupCard: { marginTop: 8 },
  setupContent: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  setupTitle: { fontSize: 22, fontWeight: '700' },
  setupSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  historyHeader: { paddingHorizontal: 20, marginBottom: 8 },
  historyTitle: { fontSize: 18, fontWeight: '700' },
  historyCard: { paddingVertical: 12 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyMonth: { fontSize: 15, fontWeight: '600' },
  historyBalance: { fontSize: 12, marginTop: 2 },
  historyRight: { alignItems: 'flex-end' },
  historySpent: { fontSize: 15, fontWeight: '700' },
  historyPercent: { fontSize: 11, marginTop: 2 },
  noHistory: { textAlign: 'center', paddingVertical: 20, fontSize: 14 },
});

export default WalletScreen;

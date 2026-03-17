// UPI Payment notifications history screen
// Shows detected UPI transactions with status (processed/pending)
// Allows users to tap unprocessed notifications to add as expense/income

import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectUPINotifications } from '../store';
import { UPINotification } from '../types';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency } from '../utils/helpers';

// Filter options for the notification list
type FilterType = 'all' | 'pending' | 'processed';

const UPIPaymentsScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const upiNotifications = useAppStore(selectUPINotifications);
  const settings = useAppStore((state) => state.settings);
  const [filter, setFilter] = useState<FilterType>('all');

  // Apply the selected filter to the notification list
  const filteredNotifications = useMemo(() => {
    switch (filter) {
      case 'pending':
        return upiNotifications.filter((n) => !n.isProcessed);
      case 'processed':
        return upiNotifications.filter((n) => n.isProcessed);
      default:
        return upiNotifications;
    }
  }, [upiNotifications, filter]);

  // Format the timestamp into a readable date/time string
  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
  }, []);

  // Render a filter chip button
  const renderFilterChip = (filterType: FilterType, label: string) => (
    <TouchableOpacity
      key={filterType}
      style={[
        styles.filterChip,
        { borderColor: theme.colors.border },
        filter === filterType && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
      ]}
      onPress={() => setFilter(filterType)}
    >
      <Text style={[
        styles.filterText,
        { color: filter === filterType ? '#FFF' : theme.colors.textSecondary },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // Render a single notification card
  const renderItem = ({ item }: { item: UPINotification }) => {
    const isCredit = item.transactionType === 'credit';
    const statusColor = isCredit ? theme.colors.success : theme.colors.primary;

    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        {/* Transaction type indicator and app info */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: statusColor + '15' }]}>
            <MaterialCommunityIcons
              name={isCredit ? 'arrow-down-circle' : 'arrow-up-circle'}
              size={20}
              color={statusColor}
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.appName, { color: theme.colors.text }]}>{item.appName}</Text>
            <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
              {formatTime(item.timestamp)}
            </Text>
          </View>
          {/* Amount display */}
          <Text style={[styles.amount, { color: statusColor }]}>
            {isCredit ? '+' : '-'}{formatCurrency(item.amount, settings.defaultCurrency)}
          </Text>
        </View>

        {/* Notification message excerpt */}
        <Text
          style={[styles.message, { color: theme.colors.textSecondary }]}
          numberOfLines={2}
        >
          {item.message}
        </Text>

        {/* Processed status indicator */}
        <View style={styles.cardFooter}>
          <View style={[
            styles.statusBadge,
            {
              backgroundColor: item.isProcessed
                ? theme.colors.success + '15'
                : theme.colors.warning + '15',
            },
          ]}>
            <MaterialCommunityIcons
              name={item.isProcessed ? 'check-circle' : 'clock-outline'}
              size={14}
              color={item.isProcessed ? theme.colors.success : theme.colors.warning}
            />
            <Text style={[
              styles.statusText,
              { color: item.isProcessed ? theme.colors.success : theme.colors.warning },
            ]}>
              {item.isProcessed
                ? (t.upiPayments?.processed || 'Processed')
                : (t.upiPayments?.pending || 'Pending')
              }
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Filter chips row */}
      <View style={styles.filterRow}>
        {renderFilterChip('all', t.upiPayments?.all || 'All')}
        {renderFilterChip('pending', t.upiPayments?.pendingFilter || 'Pending')}
        {renderFilterChip('processed', t.upiPayments?.processedFilter || 'Processed')}
      </View>

      {/* Notification list */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="cellphone-nfc"
            title={t.upiPayments?.emptyTitle || 'No UPI Notifications'}
            subtitle={t.upiPayments?.emptySubtitle || 'UPI payment notifications will appear here when detected'}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Full-screen container
  container: {
    flex: 1,
  },
  // Filter chips horizontal row
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  // Individual filter chip
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // List padding
  list: {
    padding: 16,
    paddingTop: 4,
  },
  // Notification card
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  // Card header with icon, info, and amount
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  // Transaction type icon badge
  typeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  // App name and time container
  headerInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 15,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 1,
  },
  // Transaction amount
  amount: {
    fontSize: 17,
    fontWeight: '700',
  },
  // Notification message text
  message: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    paddingLeft: 46,
  },
  // Card footer with status
  cardFooter: {
    flexDirection: 'row',
    paddingLeft: 46,
  },
  // Status badge (pending/processed)
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default UPIPaymentsScreen;

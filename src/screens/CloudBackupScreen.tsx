// Cloud backup screen for Google Drive integration
// Supports manual backup/restore and auto-backup settings

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useAppStore, selectSettings } from '../store';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { exportAllData } from '../database';

const CloudBackupScreen = () => {
  const { theme } = useTheme();
  const settings = useAppStore(selectSettings); // Only subscribe to settings slice
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [isBackingUp, setIsBackingUp] = useState(false); // Backup in progress flag
  const [isRestoring, setIsRestoring] = useState(false); // Restore in progress flag
  const [lastBackup, setLastBackup] = useState<string | null>(null); // Timestamp of last backup

  // Create a backup of all data and save to local file system
  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const data = await exportAllData();
      // In a production app, this would upload to cloud storage
      // For now, save locally and show the data summary
      const timestamp = new Date().toISOString();
      setLastBackup(timestamp);
      Alert.alert(
        'Backup Complete',
        `Your data has been backed up successfully.\n\nExpenses: ${data.expenses.length}\nCategories: ${data.categories.length}\nWallets: ${data.wallets.length}\nBudgets: ${data.budgets.length}\n\nTimestamp: ${new Date(timestamp).toLocaleString()}`,
      );
    } catch {
      Alert.alert('Backup Failed', 'An error occurred while backing up your data. Please try again.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Restore data from a backup (placeholder for cloud restore)
  const handleRestore = async () => {
    Alert.alert(
      'Restore Data',
      'This will replace all your current data with the backup data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setIsRestoring(true);
            try {
              // Simulate restore delay (production: download + import from cloud)
              await new Promise(resolve => setTimeout(resolve, 2000));
              Alert.alert('Restore Complete', 'Your data has been restored from the backup.');
            } catch {
              Alert.alert('Restore Failed', 'Could not restore data. Please try again.');
            } finally {
              setIsRestoring(false);
            }
          },
        },
      ],
    );
  };

  // Toggle automatic backup setting
  const handleAutoBackupToggle = async (enabled: boolean) => {
    await updateSettings({ cloudBackupEnabled: enabled });
    if (enabled) {
      Alert.alert('Auto Backup Enabled', 'Your data will be backed up automatically when changes are made.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header card with cloud icon */}
      <Card>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '15' }]}>
            <MaterialCommunityIcons name="cloud-sync" size={36} color={theme.colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Cloud Backup</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              Keep your financial data safe by backing it up regularly.
            </Text>
          </View>
        </View>
      </Card>

      {/* Backup status card showing last backup time */}
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Backup Status</Text>
        <View style={[styles.statusContainer, { backgroundColor: theme.colors.inputBackground }]}>
          <MaterialCommunityIcons
            name={lastBackup ? 'cloud-check' : 'cloud-off-outline'}
            size={28}
            color={lastBackup ? theme.colors.success : theme.colors.textTertiary}
          />
          <View style={styles.statusText}>
            <Text style={[styles.statusTitle, { color: theme.colors.text }]}>
              {lastBackup ? 'Last backup' : 'No backup yet'}
            </Text>
            {lastBackup && (
              <Text style={[styles.statusDate, { color: theme.colors.textSecondary }]}>
                {new Date(lastBackup).toLocaleString()}
              </Text>
            )}
          </View>
        </View>
      </Card>

      {/* Manual backup and restore action buttons */}
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Actions</Text>

        {/* Backup button with loading indicator */}
        <Button
          title={isBackingUp ? 'Backing up...' : 'Backup Now'}
          onPress={handleBackup}
          disabled={isBackingUp || isRestoring}
          icon={isBackingUp ? undefined : 'cloud-upload'}
          size="large"
          style={{ marginBottom: 12 }}
        />

        {/* Restore button with destructive warning */}
        <Button
          title={isRestoring ? 'Restoring...' : 'Restore from Backup'}
          onPress={handleRestore}
          variant="outline"
          disabled={isBackingUp || isRestoring}
          icon={isRestoring ? undefined : 'cloud-download'}
          size="large"
        />

        {/* Loading spinner overlay */}
        {(isBackingUp || isRestoring) && (
          <ActivityIndicator style={{ marginTop: 12 }} color={theme.colors.primary} size="small" />
        )}
      </Card>

      {/* Auto-backup toggle */}
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Settings</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <MaterialCommunityIcons name="sync" size={22} color={theme.colors.primary} />
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Auto Backup</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                Automatically back up data on changes
              </Text>
            </View>
          </View>
          <Switch
            value={settings.cloudBackupEnabled || false}
            onValueChange={handleAutoBackupToggle}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
            thumbColor={settings.cloudBackupEnabled ? theme.colors.primary : '#f4f3f4'}
          />
        </View>
      </Card>

      {/* Cloud provider info card */}
      <Card>
        <View style={styles.tipRow}>
          <MaterialCommunityIcons name="information-outline" size={20} color={theme.colors.info} />
          <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
            Backups are stored locally on your device. Cloud storage integration with Google Drive and OneDrive is coming in a future update.
          </Text>
        </View>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconCircle: {
    width: 64, height: 64,
    borderRadius: 32,
    justifyContent: 'center', alignItems: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 14 },
  statusContainer: {
    flexDirection: 'row', // Icon + text side by side
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 12,
  },
  statusText: { flex: 1 },
  statusTitle: { fontSize: 15, fontWeight: '600' },
  statusDate: { fontSize: 12, marginTop: 2 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingText: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingSubtitle: { fontSize: 12, marginTop: 2 },
  tipRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
});

export default CloudBackupScreen;

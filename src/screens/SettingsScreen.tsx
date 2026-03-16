// Settings screen with theme toggle, currency selection, and navigation to sub-settings
// Central hub for all app configuration options

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppStore } from '../store';
import { CURRENCIES } from '../constants';

const SettingsScreen = () => {
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { settings, updateSettings } = useAppStore();

  // Toggle between light, dark, and system theme modes
  const cycleTheme = () => {
    const modes = ['light', 'dark', 'system'] as const;
    const currentIndex = modes.indexOf(themeMode);
    const nextMode = modes[(currentIndex + 1) % modes.length]; // Cycle to next mode
    setThemeMode(nextMode);
  };

  // Get display label for the current theme mode
  const getThemeLabel = () => {
    switch (themeMode) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
    }
  };

  // Show currency picker as an alert dialog
  const showCurrencyPicker = () => {
    Alert.alert(
      'Select Currency',
      undefined,
      CURRENCIES.map(c => ({
        text: `${c.symbol} ${c.name} (${c.code})`,
        onPress: () => updateSettings({ defaultCurrency: c.code }), // Update default currency
      }))
    );
  };

  // Reusable settings row component for consistent layout
  const SettingsRow = ({ icon, label, value, onPress, rightElement }: {
    icon: string; label: string; value?: string; onPress?: () => void; rightElement?: React.ReactNode;
  }) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.colors.border }]}
      onPress={onPress}
      disabled={!onPress && !rightElement} // Disable if no action
    >
      <View style={styles.rowLeft}>
        <MaterialCommunityIcons name={icon as any} size={22} color={theme.colors.primary} />
        <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {value && <Text style={[styles.rowValue, { color: theme.colors.textSecondary }]}>{value}</Text>}
        {rightElement || (onPress && <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textTertiary} />)}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Screen header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>
        </View>

        {/* Appearance section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>APPEARANCE</Text>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingsRow icon="theme-light-dark" label="Theme" value={getThemeLabel()} onPress={cycleTheme} />
          <SettingsRow
            icon="brightness-6"
            label="Dark Mode"
            rightElement={
              <Switch
                value={isDark}
                onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')} // Direct toggle
                trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
                thumbColor={isDark ? theme.colors.primary : '#f4f3f4'}
              />
            }
          />
        </View>

        {/* General preferences section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>GENERAL</Text>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingsRow
            icon="currency-usd"
            label="Default Currency"
            value={`${CURRENCIES.find(c => c.code === settings.defaultCurrency)?.symbol} ${settings.defaultCurrency}`}
            onPress={showCurrencyPicker}
          />
          <SettingsRow icon="shape" label="Categories" onPress={() => navigation.navigate('CategoryManagement')} />
          <SettingsRow icon="target" label="Budgets" onPress={() => navigation.navigate('BudgetSetup')} />
        </View>

        {/* Data management section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>DATA</Text>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingsRow icon="download" label="Export Reports" onPress={() => navigation.navigate('ExportReport')} />
          <SettingsRow icon="cloud-upload" label="Cloud Backup" onPress={() => navigation.navigate('CloudBackup')} />
        </View>

        {/* Security section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>SECURITY</Text>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingsRow icon="lock" label="App Lock" onPress={() => navigation.navigate('Security')} />
          <SettingsRow
            icon="bell"
            label="Notifications"
            rightElement={
              <Switch
                value={settings.enableNotifications}
                onValueChange={(val) => updateSettings({ enableNotifications: val })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
                thumbColor={settings.enableNotifications ? theme.colors.primary : '#f4f3f4'}
              />
            }
          />
        </View>

        {/* About section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>ABOUT</Text>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingsRow icon="information" label="Version" value="1.0.0" />
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600', // Bold section headers
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    letterSpacing: 0.5, // Slight letter spacing for uppercase labels
  },
  section: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 0.5,
    overflow: 'hidden', // Clip children to rounded corners
  },
  row: {
    flexDirection: 'row', // Icon, label, and value in a row
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowValue: { fontSize: 14 },
});

export default SettingsScreen;

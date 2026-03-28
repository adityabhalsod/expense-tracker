// Settings screen with theme toggle, currency selection, and navigation to sub-settings
// Central hub for all app configuration options

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppStore, selectSettings } from '../store';
import { CURRENCIES } from '../constants';
import { useLanguage, LANGUAGES } from '../i18n';
import Constants from 'expo-constants'; // Provides access to app.json config at runtime

const SettingsScreen = () => {
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const settings = useAppStore(selectSettings); // Only subscribe to settings slice
  const updateSettings = useAppStore((s) => s.updateSettings);
  const clearAllData = useAppStore((s) => s.clearAllData);
  const resetDatabase = useAppStore((s) => s.resetDatabase);
  const { t, language, setLanguage } = useLanguage();
  const [showCurrencyModal, setShowCurrencyModal] = useState(false); // Currency picker modal visibility
  const [showLanguageModal, setShowLanguageModal] = useState(false); // Language picker modal visibility
  const [isResetting, setIsResetting] = useState(false); // Prevent double-tap during reset

  // Handle clearing all transactional data while keeping categories/settings
  const handleClearAllData = () => {
    Alert.alert(
      t.settings.resetData,
      t.settings.resetDataConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await clearAllData();
              Alert.alert(t.common.success || 'Success', t.settings.resetSuccess);
            } catch {
              Alert.alert(t.common.error, t.settings.resetFailed);
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  // Handle full database reset — drops all tables, recreates schema
  const handleResetDatabase = () => {
    Alert.alert(
      t.settings.resetDatabase,
      t.settings.resetDatabaseConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await resetDatabase();
              Alert.alert(t.common.success || 'Success', t.settings.resetSuccess);
            } catch {
              Alert.alert(t.common.error, t.settings.resetFailed);
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

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
      case 'light': return t.settings.light;
      case 'dark': return t.settings.dark;
      case 'system': return t.settings.system;
    }
  };

  // Get display label for the current language
  const getLanguageLabel = () => {
    const lang = LANGUAGES.find(l => l.code === language);
    return lang?.nativeLabel || 'English';
  };

  // Open modal-based currency picker (Alert.alert only supports 3 buttons on Android)
  const showCurrencyPicker = () => {
    setShowCurrencyModal(true);
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
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
          <Text style={[styles.title, { color: theme.colors.text }]}>{t.settings.title}</Text>
        </View>

        {/* Appearance section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{t.settings.appearance}</Text>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingsRow icon="theme-light-dark" label={t.settings.theme} value={getThemeLabel()} onPress={cycleTheme} />
          <SettingsRow
            icon="brightness-6"
            label={t.settings.darkMode}
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
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{t.settings.general}</Text>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingsRow
            icon="translate"
            label={t.settings.language}
            value={getLanguageLabel()}
            onPress={() => setShowLanguageModal(true)}
          />
          <SettingsRow
            icon="currency-usd"
            label={t.settings.defaultCurrency}
            value={`${CURRENCIES.find(c => c.code === settings.defaultCurrency)?.symbol} ${settings.defaultCurrency}`}
            onPress={showCurrencyPicker}
          />
          <SettingsRow icon="shape" label={t.settings.categories} onPress={() => navigation.navigate('CategoryManagement')} />
          <SettingsRow icon="target" label={t.settings.budgets} onPress={() => navigation.navigate('BudgetSetup')} />
        </View>

        {/* Data management section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{t.settings.data}</Text>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingsRow icon="download" label={t.settings.exportReports} onPress={() => navigation.navigate('ExportReport')} />
          {/* Cloud Backup feature commented out for now */}
          {/* <SettingsRow icon="cloud-upload" label="Cloud Backup" onPress={() => navigation.navigate('CloudBackup')} /> */}
        </View>

        {/* Security section */}
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{t.settings.security}</Text>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <SettingsRow icon="lock" label={t.settings.appLock} onPress={() => navigation.navigate('Security')} />
          <SettingsRow
            icon="bell"
            label={t.settings.notifications}
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
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{t.settings.about}</Text>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {/* Version is read dynamically from app.json via expo-constants */}
          <SettingsRow icon="information" label={t.settings.version} value={Constants.expoConfig?.version ?? '—'} />
        </View>

        {/* Danger zone — reset actions */}
        <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>{t.settings.dangerZone}</Text>
        <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: '#EF444430' }]}>
          {/* Clear transactional data only (expenses, wallets, budgets, notifications) */}
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={handleClearAllData}
            disabled={isResetting}
          >
            <View style={styles.dangerRowLeft}>
              <View style={[styles.dangerIconBg, { backgroundColor: '#FEF2F2' }]}>
                <MaterialCommunityIcons name="delete-sweep" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dangerLabel, { color: theme.colors.text }]}>
                  {t.settings.resetData}
                </Text>
                <Text style={[styles.dangerDesc, { color: theme.colors.textSecondary }]}>
                  {t.settings.resetDataDesc}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          {/* Full factory reset — drop all tables and start from scratch */}
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={handleResetDatabase}
            disabled={isResetting}
          >
            <View style={styles.dangerRowLeft}>
              <View style={[styles.dangerIconBg, { backgroundColor: '#FEF2F2' }]}>
                <MaterialCommunityIcons name="database-remove" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dangerLabel, { color: theme.colors.text }]}>
                  {t.settings.resetDatabase}
                </Text>
                <Text style={[styles.dangerDesc, { color: theme.colors.textSecondary }]}>
                  {t.settings.resetDatabaseDesc}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Currency picker modal with full list of currencies */}
      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)} // Android back button closes modal
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            {/* Modal header with title and close button */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t.settings.selectCurrency}</Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {/* Scrollable list of all available currencies */}
            <FlatList
              data={CURRENCIES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.currencyRow,
                    {
                      borderBottomColor: theme.colors.border,
                      backgroundColor: settings.defaultCurrency === item.code
                        ? theme.colors.primary + '15' // Highlight selected currency
                        : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    updateSettings({ defaultCurrency: item.code }); // Save selected currency
                    setShowCurrencyModal(false); // Close modal after selection
                  }}
                >
                  <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>{item.symbol}</Text>
                  <View style={styles.currencyInfo}>
                    <Text style={[styles.currencyName, { color: theme.colors.text }]}>{item.name}</Text>
                    <Text style={[styles.currencyCode, { color: theme.colors.textSecondary }]}>{item.code}</Text>
                  </View>
                  {/* Checkmark for currently selected currency */}
                  {settings.defaultCurrency === item.code && (
                    <MaterialCommunityIcons name="check-circle" size={22} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Language picker modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t.settings.selectLanguage}</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.currencyRow,
                    {
                      borderBottomColor: theme.colors.border,
                      backgroundColor: language === item.code
                        ? theme.colors.primary + '15'
                        : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    setLanguage(item.code);
                    setShowLanguageModal(false);
                  }}
                >
                  <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>
                    {item.code === 'en' ? '🇬🇧' : item.code === 'gu' ? '🇮🇳' : '🇮🇳'}
                  </Text>
                  <View style={styles.currencyInfo}>
                    <Text style={[styles.currencyName, { color: theme.colors.text }]}>{item.nativeLabel}</Text>
                    <Text style={[styles.currencyCode, { color: theme.colors.textSecondary }]}>{item.label}</Text>
                  </View>
                  {language === item.code && (
                    <MaterialCommunityIcons name="check-circle" size={22} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  // Currency picker modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent backdrop
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%', // Limit modal height to 70% of screen
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    gap: 14,
  },
  currencySymbol: { fontSize: 20, fontWeight: '700', width: 36, textAlign: 'center' },
  currencyInfo: { flex: 1 },
  currencyName: { fontSize: 15, fontWeight: '500' },
  currencyCode: { fontSize: 12, marginTop: 2 },
  // Danger zone row layout
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dangerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  // Red-tinted icon background for danger actions
  dangerIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  dangerDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default SettingsScreen;

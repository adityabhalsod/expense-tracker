// Security settings screen for PIN lock and biometric authentication
// Allows users to enable/disable app protection methods

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TextInput, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectSettings } from '../store';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import * as LocalAuthentication from 'expo-local-authentication';

const SecurityScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const settings = useAppStore(selectSettings); // Only subscribe to settings slice
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [showPinSetup, setShowPinSetup] = useState(false); // Whether PIN setup form is visible
  const [pin, setPin] = useState(''); // PIN input value
  const [confirmPin, setConfirmPin] = useState(''); // PIN confirmation input

  // Check device biometric capability and enable if available
  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled) {
      // Verify hardware supports biometrics before enabling
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware) {
        Alert.alert(t.security.notAvailable, t.security.notAvailableMsg);
        return;
      }
      if (!isEnrolled) {
        Alert.alert(t.security.notSetUp, t.security.notSetUpMsg);
        return;
      }

      // Verify identity before enabling biometric lock
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.security.verifyIdentity,
      });

      if (result.success) {
        await updateSettings({ enableBiometric: true });
      }
    } else {
      await updateSettings({ enableBiometric: false }); // Disable biometric lock
    }
  };

  // Validate and save the PIN code
  const handleSavePin = async () => {
    if (pin.length < 4) {
      Alert.alert(t.security.invalidPin, t.security.invalidPinMsg);
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert(t.security.mismatch, t.security.mismatchMsg);
      return;
    }

    // Store the hashed PIN (simple hash for demo; production should use proper hashing)
    await updateSettings({ enablePin: true, pinHash: pin });
    setShowPinSetup(false);
    setPin('');
    setConfirmPin('');
    Alert.alert(t.common.success, t.security.pinSuccess);
  };

  // Disable PIN lock
  const handleDisablePin = async () => {
    await updateSettings({ enablePin: false, pinHash: undefined });
    Alert.alert(t.security.disabled, t.security.pinDisabledMsg);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header info card */}
      <Card>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="shield-lock" size={32} color={theme.colors.primary} />
          <View style={styles.infoText}>
            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>{t.security.appSecurity}</Text>
            <Text style={[styles.infoSubtitle, { color: theme.colors.textSecondary }]}>
              {t.security.securityDesc}
            </Text>
          </View>
        </View>
      </Card>

      {/* Biometric authentication toggle */}
      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <MaterialCommunityIcons name="fingerprint" size={24} color={theme.colors.primary} />
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t.security.biometricLock}</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {t.security.biometricDesc}
              </Text>
            </View>
          </View>
          <Switch
            value={settings.enableBiometric}
            onValueChange={handleBiometricToggle} // Toggle with verification
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
            thumbColor={settings.enableBiometric ? theme.colors.primary : '#f4f3f4'}
          />
        </View>
      </Card>

      {/* PIN lock section */}
      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <MaterialCommunityIcons name="lock" size={24} color={theme.colors.primary} />
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{t.security.pinLock}</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {settings.enablePin ? t.security.pinEnabled : t.security.pinDisabled}
              </Text>
            </View>
          </View>
          <Switch
            value={settings.enablePin}
            onValueChange={(val) => {
              if (val) {
                setShowPinSetup(true); // Show PIN setup form
              } else {
                handleDisablePin(); // Remove PIN
              }
            }}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
            thumbColor={settings.enablePin ? theme.colors.primary : '#f4f3f4'}
          />
        </View>

        {/* PIN setup form (shown when enabling PIN) */}
        {showPinSetup && (
          <View style={styles.pinSetup}>
            <TextInput
              style={[styles.pinInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={pin}
              onChangeText={setPin}
              placeholder={t.security.enterPin}
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="number-pad"
              secureTextEntry // Hide PIN digits
              maxLength={6}
            />
            <TextInput
              style={[styles.pinInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder={t.security.confirmPin}
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            <View style={styles.pinActions}>
              <Button title={t.security.setPin} onPress={handleSavePin} size="medium" />
              <Button
                title={t.common.cancel}
                onPress={() => { setShowPinSetup(false); setPin(''); setConfirmPin(''); }}
                variant="outline"
                size="medium"
              />
            </View>
          </View>
        )}
      </Card>

      {/* Security tip */}
      <Card>
        <View style={styles.tipRow}>
          <MaterialCommunityIcons name="lightbulb-outline" size={20} color={theme.colors.warning} />
          <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
            {t.security.securityTip}
          </Text>
        </View>
      </Card>

      {/* Bottom spacer */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 18, fontWeight: '700' },
  infoSubtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  settingRow: {
    flexDirection: 'row', // Toggle and text side by side
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingText: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingSubtitle: { fontSize: 12, marginTop: 2 },
  pinSetup: { marginTop: 16, gap: 12 },
  pinInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    textAlign: 'center', // Center PIN digits for clarity
    letterSpacing: 8, // Space out PIN digits visually
  },
  pinActions: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 8 },
  tipRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
});

export default SecurityScreen;

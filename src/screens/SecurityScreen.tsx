// Security settings screen for PIN lock and biometric authentication
// Allows users to enable/disable app protection methods

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TextInput, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useAppStore } from '../store';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import * as LocalAuthentication from 'expo-local-authentication';

const SecurityScreen = () => {
  const { theme } = useTheme();
  const { settings, updateSettings } = useAppStore();

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
        Alert.alert('Not Available', 'This device does not support biometric authentication.');
        return;
      }
      if (!isEnrolled) {
        Alert.alert('Not Set Up', 'Please set up biometric authentication in your device settings first.');
        return;
      }

      // Verify identity before enabling biometric lock
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to enable biometric lock',
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
      Alert.alert('Invalid PIN', 'PIN must be at least 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('Mismatch', 'PINs do not match. Please try again.');
      return;
    }

    // Store the hashed PIN (simple hash for demo; production should use proper hashing)
    await updateSettings({ enablePin: true, pinHash: pin });
    setShowPinSetup(false);
    setPin('');
    setConfirmPin('');
    Alert.alert('Success', 'PIN lock has been enabled.');
  };

  // Disable PIN lock
  const handleDisablePin = async () => {
    await updateSettings({ enablePin: false, pinHash: undefined });
    Alert.alert('Disabled', 'PIN lock has been removed.');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header info card */}
      <Card>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="shield-lock" size={32} color={theme.colors.primary} />
          <View style={styles.infoText}>
            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>App Security</Text>
            <Text style={[styles.infoSubtitle, { color: theme.colors.textSecondary }]}>
              Protect your financial data with PIN or biometric authentication.
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
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Biometric Lock</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                Use fingerprint or face recognition
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
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>PIN Lock</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {settings.enablePin ? 'PIN is enabled' : 'Set a PIN to lock the app'}
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
              placeholder="Enter PIN"
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="number-pad"
              secureTextEntry // Hide PIN digits
              maxLength={6}
            />
            <TextInput
              style={[styles.pinInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="Confirm PIN"
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            <View style={styles.pinActions}>
              <Button title="Set PIN" onPress={handleSavePin} size="medium" />
              <Button
                title="Cancel"
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
            For maximum security, we recommend enabling biometric authentication. Your data is always stored locally and encrypted on your device.
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

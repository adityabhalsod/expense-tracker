// PIN/Biometric authentication gate screen
// Shown on app launch when security is enabled, before granting access
// Supports three modes: biometric-only, PIN-only, or both

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectSettings } from '../store';
import * as LocalAuthentication from 'expo-local-authentication';

interface Props {
  onAuthenticated: () => void; // Callback when user successfully authenticates
}

const PinLockScreen = ({ onAuthenticated }: Props) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const settings = useAppStore(selectSettings); // Only subscribe to settings slice

  const [pin, setPin] = useState(''); // Current PIN input
  const [error, setError] = useState(''); // Error message for wrong PIN
  const [attempts, setAttempts] = useState(0); // Failed attempt counter
  const [showPinPad, setShowPinPad] = useState(false); // Controls PIN pad visibility
  const [biometricFailed, setBiometricFailed] = useState(false); // Tracks biometric failure

  // Determine the authentication mode
  const hasPinEnabled = settings.enablePin && settings.pinHash;
  const hasBiometricEnabled = settings.enableBiometric;

  // Attempt biometric authentication
  const handleBiometric = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.pinLock.unlockPrompt,
        cancelLabel: hasPinEnabled ? t.pinLock.usePin : t.common.cancel,
        disableDeviceFallback: true,
      });

      if (result.success) {
        onAuthenticated();
      } else {
        // Biometric failed or was cancelled
        setBiometricFailed(true);
        if (hasPinEnabled) {
          // Fall back to PIN pad if PIN is also enabled
          setShowPinPad(true);
        }
      }
    } catch {
      setBiometricFailed(true);
      if (hasPinEnabled) {
        setShowPinPad(true);
      }
    }
  }, [onAuthenticated, hasPinEnabled, t]);

  // On mount, decide what to show first
  useEffect(() => {
    if (hasBiometricEnabled) {
      // Start with biometric prompt (PIN pad hidden until biometric fails)
      handleBiometric();
    } else if (hasPinEnabled) {
      // No biometric — show PIN pad immediately
      setShowPinPad(true);
    } else {
      // Neither enabled — should not reach here, but skip the lock
      onAuthenticated();
    }
  }, []);

  // Handle number pad key press
  const handleKeyPress = (digit: string) => {
    if (pin.length >= 6) return; // Max PIN length is 6
    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    // Auto-verify once PIN reaches expected length
    const expectedLength = settings.pinHash?.length || 4;
    if (newPin.length === expectedLength) {
      if (newPin === settings.pinHash) {
        onAuthenticated(); // Correct PIN
      } else {
        // Wrong PIN — vibrate and show error
        Vibration.vibrate(200);
        setAttempts(prev => prev + 1);
        setError(t.pinLock.incorrectPin);
        setPin('');

        // Lock out after 5 failed attempts
        if (attempts >= 4) {
          Alert.alert(t.pinLock.tooManyAttempts, t.pinLock.tooManyAttemptsMsg);
        }
      }
    }
  };

  // Delete last digit from PIN input
  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  // Biometric-only screen (no PIN pad) — shown when only biometric is enabled
  if (hasBiometricEnabled && !hasPinEnabled && !showPinPad) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <View style={[styles.lockIcon, { backgroundColor: theme.colors.primary + '15' }]}>
            <MaterialCommunityIcons name="fingerprint" size={48} color={theme.colors.primary} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t.pinLock.unlockPrompt}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {t.pinLock.subtitle}
          </Text>
        </View>

        {biometricFailed && (
          <Text style={[styles.error, { color: theme.colors.error, marginBottom: 16 }]}>
            {t.pinLock.biometricFailed || 'Authentication failed. Try again.'}
          </Text>
        )}

        {/* Retry biometric button */}
        <TouchableOpacity
          style={[styles.biometricRetryBtn, { backgroundColor: theme.colors.primary }]}
          onPress={handleBiometric}
        >
          <MaterialCommunityIcons name="fingerprint" size={28} color="#FFFFFF" />
          <Text style={styles.biometricRetryText}>{t.pinLock.tapToUnlock || 'Tap to Unlock'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Wait for biometric to finish before showing PIN pad
  if (hasBiometricEnabled && hasPinEnabled && !showPinPad) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <View style={[styles.lockIcon, { backgroundColor: theme.colors.primary + '15' }]}>
            <MaterialCommunityIcons name="lock" size={40} color={theme.colors.primary} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t.pinLock.unlockPrompt}</Text>
        </View>
      </View>
    );
  }

  // Number pad layout (1-9, biometric/spacer, 0, delete)
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'biometric', '0', 'delete'];

  // PIN pad screen (shown for PIN-only or after biometric fallback)
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Lock icon and title */}
      <View style={styles.header}>
        <View style={[styles.lockIcon, { backgroundColor: theme.colors.primary + '15' }]}>
          <MaterialCommunityIcons name="lock" size={40} color={theme.colors.primary} />
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t.pinLock.enterPin}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {t.pinLock.subtitle}
        </Text>
      </View>

      {/* PIN dots indicator showing entered digits */}
      <View style={styles.dotsRow}>
        {Array.from({ length: settings.pinHash?.length || 4 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < pin.length ? theme.colors.primary : 'transparent',
                borderColor: error ? theme.colors.error : theme.colors.border,
              },
            ]}
          />
        ))}
      </View>

      {/* Error message */}
      {error ? (
        <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
      ) : (
        <View style={{ height: 20 }} />
      )}

      {/* Number pad grid */}
      <View style={styles.keypad}>
        {keys.map((key) => {
          if (key === 'biometric') {
            // Show biometric button only if biometric is enabled
            return hasBiometricEnabled ? (
              <TouchableOpacity
                key={key}
                style={[styles.key, { backgroundColor: theme.colors.inputBackground }]}
                onPress={handleBiometric}
              >
                <MaterialCommunityIcons name="fingerprint" size={28} color={theme.colors.primary} />
              </TouchableOpacity>
            ) : (
              <View key={key} style={styles.key} /> // Empty spacer
            );
          }

          if (key === 'delete') {
            return (
              <TouchableOpacity
                key={key}
                style={[styles.key, { backgroundColor: theme.colors.inputBackground }]}
                onPress={handleDelete}
              >
                <MaterialCommunityIcons name="backspace-outline" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={key}
              style={[styles.key, { backgroundColor: theme.colors.inputBackground }]}
              onPress={() => handleKeyPress(key)}
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, { color: theme.colors.text }]}>{key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  header: { alignItems: 'center', marginBottom: 40 },
  lockIcon: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 6 },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2,
  },
  error: { fontSize: 13, fontWeight: '600', height: 20 },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap', // 3-column grid layout
    justifyContent: 'center',
    gap: 16,
    marginTop: 24,
    maxWidth: 280,
  },
  key: {
    width: 72, height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: { fontSize: 28, fontWeight: '600' },
  biometricRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  biometricRetryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default PinLockScreen;

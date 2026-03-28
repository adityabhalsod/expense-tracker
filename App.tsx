// Main application entry point
// Wraps the app with ThemeProvider and initializes the store on startup

import React, { useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/theme';
import { LanguageProvider, useLanguage } from './src/i18n';
import AppNavigator from './src/navigation';
import { useAppStore, selectIsInitialized, selectSettings } from './src/store';
import { processRecurringExpenses } from './src/services/recurringExpenses';
import { requestNotificationPermissions, checkBudgetNotifications, scheduleWeeklyDigest } from './src/services/notifications';
import PinLockScreen from './src/components/PinLockScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@onboarding_completed';

// Loading screen displayed while the app initializes data from SQLite
const LoadingScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
        {t.common.loading}
      </Text>
    </View>
  );
};

// Inner app component that handles store initialization and security gate
const AppContent = () => {
  const { theme, isDark } = useTheme();
  const isInitialized = useAppStore(selectIsInitialized);
  const settings = useAppStore(selectSettings);
  const initialize = useAppStore((s) => s.initialize);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Security gate state
  const [showOnboarding, setShowOnboarding] = useState(false); // First-launch onboarding

  // Determine if security gate should show
  // PIN requires both the toggle AND a stored PIN hash; biometric just needs the toggle
  const needsAuth = ((settings.enablePin && !!settings.pinHash) || settings.enableBiometric) && !isAuthenticated;

  // Initialize the database, process recurring expenses, check budgets, and set up onboarding
  useEffect(() => {
    const boot = async () => {
      await initialize();

      // Check if this is the first launch (show onboarding)
      const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!onboardingDone) {
        setShowOnboarding(true);
      }

      // Process any due recurring expenses after data is loaded
      try {
        await processRecurringExpenses();
      } catch (e) {
        console.warn('Recurring expenses processing failed:', e);
      }
      // Request notification permissions and check budget thresholds
      try {
        const hasPermission = await requestNotificationPermissions();
        if (hasPermission) {
          await checkBudgetNotifications();
          // Schedule weekly digest notification (every Sunday 9 AM)
          await scheduleWeeklyDigest();
        }
      } catch (e) {
        console.warn('Notification setup skipped:', e);
      }
    };
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      {!isInitialized ? (
        <LoadingScreen />
      ) : needsAuth ? (
        <PinLockScreen onAuthenticated={() => setIsAuthenticated(true)} />
      ) : (
        <>
          <AppNavigator initialRoute={showOnboarding ? 'Onboarding' : 'MainTabs'} />
        </>
      )}
    </>
  );
};

// Root component wrapping everything with required providers
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

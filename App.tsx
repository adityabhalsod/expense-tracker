// Main application entry point
// Wraps the app with ThemeProvider and initializes the store on startup

import React, { useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/theme';
import AppNavigator from './src/navigation';
import { useAppStore } from './src/store';
import { processRecurringExpenses } from './src/services/recurringExpenses';
import { requestNotificationPermissions, checkBudgetNotifications } from './src/services/notifications';
import PinLockScreen from './src/components/PinLockScreen';

// Loading screen displayed while the app initializes data from SQLite
const LoadingScreen = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
        Loading your data...
      </Text>
    </View>
  );
};

// Inner app component that handles store initialization and security gate
const AppContent = () => {
  const { theme, isDark } = useTheme();
  const { isInitialized, initialize, settings } = useAppStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Security gate state

  // Initialize the database, process recurring expenses, and check budgets
  useEffect(() => {
    const boot = async () => {
      await initialize();
      // Process any due recurring expenses after data is loaded
      await processRecurringExpenses();
      // Request notification permissions and check budget thresholds
      const hasPermission = await requestNotificationPermissions();
      if (hasPermission) {
        await checkBudgetNotifications();
      }
    };
    boot();
  }, []);

  // Determine if security gate should show
  const needsAuth = (settings.enablePin || settings.enableBiometric) && !isAuthenticated;

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
        <AppNavigator />
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
          <AppContent />
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

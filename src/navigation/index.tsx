// Main navigation configuration with bottom tabs and stack navigator
// Combines tab-based main navigation with stack-based modal screens

import React, { Suspense } from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { RootStackParamList, TabParamList } from '../types';

// Tab screens loaded eagerly (always visible)
import HomeScreen from '../screens/HomeScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import WalletScreen from '../screens/WalletScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Stack screens lazy-loaded to reduce initial bundle size
const AddExpenseScreen = React.lazy(() => import('../screens/AddExpenseScreen'));
const ExpenseDetailScreen = React.lazy(() => import('../screens/ExpenseDetailScreen'));
const CategoryManagementScreen = React.lazy(() => import('../screens/CategoryManagementScreen'));
const WalletSetupScreen = React.lazy(() => import('../screens/WalletSetupScreen'));
const ExportReportScreen = React.lazy(() => import('../screens/ExportReportScreen'));
const SearchScreen = React.lazy(() => import('../screens/SearchScreen'));
const SecurityScreen = React.lazy(() => import('../screens/SecurityScreen'));
const BudgetSetupScreen = React.lazy(() => import('../screens/BudgetSetupScreen'));
const AllExpensesScreen = React.lazy(() => import('../screens/AllExpensesScreen'));
// QuickAdd is lazy-loaded — only needed when app is opened via widget deep link
const QuickAddScreen = React.lazy(() => import('../screens/QuickAddScreen'));

// Minimal fallback spinner shown while a lazy screen loads
const LazyFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" />
  </View>
);

// Wrap a lazy component with Suspense for safe rendering
const withSuspense = (Component: React.LazyExoticComponent<React.ComponentType<any>>) => {
  return (props: any) => (
    <Suspense fallback={<LazyFallback />}>
      <Component {...props} />
    </Suspense>
  );
};

// Create typed navigators for type-safe route parameters
const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Deep-link / URL mapping for React Navigation.
 * Handles the expense-tracker:// scheme used by the home screen widget.
 *
 * Widget deep links:
 *   expense-tracker://quick-add?type=expense  →  QuickAdd { type: 'expense' }
 *   expense-tracker://quick-add?type=income   →  QuickAdd { type: 'income' }
 */
const linking: LinkingOptions<RootStackParamList> = {
  // URL prefixes this config should handle
  prefixes: ['expense-tracker://'],
  config: {
    screens: {
      MainTabs: '', // default route
      // QuickAdd maps to the /quick-add path; the "type" query param becomes a route param
      QuickAdd: {
        path: 'quick-add',
        parse: {
          // Ensure type is always 'expense' or 'income' — default to expense if unexpected
          type: (value: string) => (value === 'income' ? 'income' : 'expense'),
        },
      },
    },
  },
};

// Bottom tab navigator with 5 main sections of the app
const TabNavigator = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false, // Hide default header (screens manage their own)
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar, // Theme-aware tab bar background
          borderTopColor: theme.colors.border, // Subtle top border
          borderTopWidth: 0.5,
          height: 60, // Comfortable touch target height
          paddingBottom: 8,
          paddingTop: 4,
          elevation: 8, // Android shadow
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 1,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: theme.colors.primary, // Active tab icon color
        tabBarInactiveTintColor: theme.colors.tabBarInactive, // Inactive tab icon color
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* Home dashboard tab */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t.tabs.home,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
      />
      {/* Expense list tab */}
      <Tab.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{
          tabBarLabel: t.tabs.expenses,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="format-list-bulleted" size={size} color={color} />
          ),
        }}
      />
      {/* Analytics tab with charts and reports */}
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: t.tabs.analytics,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-arc" size={size} color={color} />
          ),
        }}
      />
      {/* Wallet and balance management tab */}
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          tabBarLabel: t.tabs.wallet,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="wallet" size={size} color={color} />
          ),
        }}
      />
      {/* App settings tab */}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t.tabs.settings,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// Root stack navigator combining tabs with modal/detail screens
const AppNavigator = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface, // Theme-aware header background
          },
          headerTintColor: theme.colors.text, // Header text and back button color
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          contentStyle: {
            backgroundColor: theme.colors.background, // Screen background color
          },
          animation: 'slide_from_right', // Smooth native slide transition
        }}
      >
        {/* Main tab navigator as the home screen */}
        <Stack.Screen name="MainTabs" component={TabNavigator} options={{ headerShown: false }} />
        {/* Add/Edit expense form */}
        <Stack.Screen name="AddExpense" component={withSuspense(AddExpenseScreen)} options={{ title: t.addExpense.title }} />
        {/* Single expense detail view */}
        <Stack.Screen name="ExpenseDetail" component={withSuspense(ExpenseDetailScreen)} options={{ title: t.expenseDetail.title }} />
        {/* Category management CRUD screen */}
        <Stack.Screen name="CategoryManagement" component={withSuspense(CategoryManagementScreen)} options={{ title: t.categoryManagement.title }} />
        {/* Wallet creation/edit form */}
        <Stack.Screen name="WalletSetup" component={withSuspense(WalletSetupScreen)} options={{ title: t.walletSetup.title }} />
        {/* Export report configuration */}
        <Stack.Screen name="ExportReport" component={withSuspense(ExportReportScreen)} options={{ title: t.exportReport.title }} />
        {/* Search and filter screen */}
        <Stack.Screen name="Search" component={withSuspense(SearchScreen)} options={{ title: t.search.title }} />
        {/* Security settings (PIN/Biometric) */}
        <Stack.Screen name="Security" component={withSuspense(SecurityScreen)} options={{ title: t.security.title }} />
        {/* Cloud Backup feature commented out for now */}
        {/* <Stack.Screen name="CloudBackup" component={CloudBackupScreen} options={{ title: 'Cloud Backup' }} /> */}
        {/* Budget setup and management */}
        <Stack.Screen name="BudgetSetup" component={withSuspense(BudgetSetupScreen)} options={{ title: t.budget.title }} />
        {/* All expenses view with full list */}
        <Stack.Screen name="AllExpenses" component={withSuspense(AllExpensesScreen)} options={{ title: t.allExpenses.title }} />
        {/*
            QuickAdd — transparent modal launched from the widget deep link.
            presentation='transparentModal' lets the dimmed backdrop show the screen behind.
            animation='fade' matches a bottom-sheet slide-up feel (slide handled inside the screen).
        */}
        <Stack.Screen
          name="QuickAdd"
          component={withSuspense(QuickAddScreen)}
          options={{
            headerShown: false,         // no header — card has its own colored header strip
            presentation: 'transparentModal', // show screen background as semi-transparent
            animation: 'fade',          // fade-in overlay; card slides up via Animated.spring
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

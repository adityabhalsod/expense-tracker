// Main navigation configuration with bottom tabs and stack navigator
// Combines tab-based main navigation with stack-based modal screens

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { RootStackParamList, TabParamList } from '../types';

// Screen imports for tab navigation
import HomeScreen from '../screens/HomeScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import WalletScreen from '../screens/WalletScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Screen imports for stack navigation (modals and detail views)
import AddExpenseScreen from '../screens/AddExpenseScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import CategoryManagementScreen from '../screens/CategoryManagementScreen';
import WalletSetupScreen from '../screens/WalletSetupScreen';
import ExportReportScreen from '../screens/ExportReportScreen';
import SearchScreen from '../screens/SearchScreen';
import SecurityScreen from '../screens/SecurityScreen';
import CloudBackupScreen from '../screens/CloudBackupScreen';
import BudgetSetupScreen from '../screens/BudgetSetupScreen';
import AllExpensesScreen from '../screens/AllExpensesScreen';

// Create typed navigators for type-safe route parameters
const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

// Bottom tab navigator with 5 main sections of the app
const TabNavigator = () => {
  const { theme } = useTheme();

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

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface, // Theme-aware header background
            elevation: 0, // Remove Android shadow
            shadowOpacity: 0, // Remove iOS shadow
          },
          headerTintColor: theme.colors.text, // Header text and back button color
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          cardStyle: {
            backgroundColor: theme.colors.background, // Screen background color
          },
        }}
      >
        {/* Main tab navigator as the home screen */}
        <Stack.Screen name="MainTabs" component={TabNavigator} options={{ headerShown: false }} />
        {/* Add/Edit expense form */}
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add Expense' }} />
        {/* Single expense detail view */}
        <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: 'Expense Detail' }} />
        {/* Category management CRUD screen */}
        <Stack.Screen name="CategoryManagement" component={CategoryManagementScreen} options={{ title: 'Categories' }} />
        {/* Wallet creation/edit form */}
        <Stack.Screen name="WalletSetup" component={WalletSetupScreen} options={{ title: 'Wallet Setup' }} />
        {/* Export report configuration */}
        <Stack.Screen name="ExportReport" component={ExportReportScreen} options={{ title: 'Export Report' }} />
        {/* Search and filter screen */}
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
        {/* Security settings (PIN/Biometric) */}
        <Stack.Screen name="Security" component={SecurityScreen} options={{ title: 'Security' }} />
        {/* Cloud backup configuration */}
        <Stack.Screen name="CloudBackup" component={CloudBackupScreen} options={{ title: 'Cloud Backup' }} />
        {/* Budget setup and management */}
        <Stack.Screen name="BudgetSetup" component={BudgetSetupScreen} options={{ title: 'Budget Setup' }} />
        {/* All expenses view with full list */}
        <Stack.Screen name="AllExpenses" component={AllExpensesScreen} options={{ title: 'All Expenses' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

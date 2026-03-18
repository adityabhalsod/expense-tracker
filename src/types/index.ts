// Core type definitions for the Personal Expense Tracker application

// Expense record representing a single financial transaction
export interface Expense {
  id: string; // Unique identifier for the expense
  amount: number; // Transaction amount in the selected currency
  category: string; // Category name (e.g., Food, Transport)
  subcategory?: string; // Optional subcategory for finer classification
  date: string; // ISO date string of when the expense occurred
  notes?: string; // Optional description or memo
  tags: string[]; // Searchable tags for quick filtering
  currency: string; // Currency code (e.g., USD, INR)
  isRecurring: boolean; // Whether this expense repeats automatically
  recurringFrequency?: RecurringFrequency; // How often the expense repeats
  recurringEndDate?: string; // When the recurring expense stops
  createdAt: string; // Timestamp of record creation
  updatedAt: string; // Timestamp of last modification
  walletId: string; // Associated wallet for balance deduction
}

// Category for organizing expenses into groups
export interface Category {
  id: string; // Unique identifier for the category
  name: string; // Display name of the category
  icon: string; // Icon name from MaterialCommunityIcons
  color: string; // Hex color code for visual identification
  isDefault: boolean; // Whether this is a system-provided category
  budget?: number; // Optional monthly budget limit for this category
  order: number; // Sort order in the category list
}

// Supported wallet/payment source types
export type WalletType = 'cash' | 'bank_account' | 'digital_wallet' | 'credit_card' | 'other';

// Wallet representing a financial account or payment source
export interface Wallet {
  id: string; // Unique identifier for the wallet
  name: string; // Display name (e.g., "HDFC Savings", "Cash")
  type: WalletType; // Type of payment source (bank, cash, etc.)
  initialBalance: number; // Starting balance when wallet was created
  currentBalance: number; // Remaining balance after expenses
  currency: string; // Currency code for this wallet
  bankName?: string; // Bank name for bank accounts (e.g., "HDFC Bank")
  nickname?: string; // Short alias for quick identification
  iconName: string; // MaterialCommunityIcons icon name for display
  color: string; // Hex color for visual identification in lists
  isDefault: boolean; // Whether this is the default wallet for new expenses
  metadata?: string; // Encrypted JSON blob for any extra non-critical data
  createdAt: string; // Timestamp of wallet creation
  updatedAt: string; // Timestamp of last modification
}

// Budget rule for a specific category or overall spending
export interface Budget {
  id: string; // Unique identifier for the budget
  categoryId?: string; // Optional category-specific budget (null = overall)
  amount: number; // Budget limit amount
  period: BudgetPeriod; // Time period for the budget
  month: number; // Month number for monthly budgets
  year: number; // Year for the budget period
  notifyAt: number; // Percentage threshold to trigger notification (e.g., 80)
  walletId?: string; // Optional wallet/payment source association
}

// Frequency options for recurring expenses
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

// Time periods for budget tracking (daily through yearly)
export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// Time range filter options for analytics and reports
export type TimeRange = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom';

// Export format options for report generation
export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'pdf';

// Chart type options for analytics visualizations
export type ChartType = 'pie' | 'bar' | 'line';

// Supported currency with display details
export interface Currency {
  code: string; // ISO 4217 currency code (e.g., USD)
  symbol: string; // Display symbol (e.g., $)
  name: string; // Full name (e.g., United States Dollar)
}

// App-level settings stored in secure storage
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'; // Appearance mode preference
  language: 'en' | 'gu' | 'hi'; // Display language preference
  defaultCurrency: string; // Default currency code for new expenses
  enableBiometric: boolean; // Whether biometric lock is enabled
  enablePin: boolean; // Whether PIN lock is enabled
  pinHash?: string; // Hashed PIN for verification
  enableNotifications: boolean; // Whether budget notifications are active
  cloudBackupEnabled: boolean; // Whether auto cloud backup is enabled
  cloudProvider?: 'google_drive' | 'onedrive'; // Selected cloud provider
  lastBackupDate?: string; // Timestamp of last successful backup
}

// Analytics summary for a given time period
export interface AnalyticsSummary {
  totalExpenses: number; // Sum of all expenses in the period
  totalIncome: number; // Sum of all income/wallet deposits
  categoryBreakdown: CategoryBreakdown[]; // Spending per category
  dailyTrend: DailyTrend[]; // Daily spending trend data
  topCategories: CategoryBreakdown[]; // Highest spending categories
  averageDaily: number; // Average daily spending
  comparisonPercentage: number; // Change vs previous period
}

// Spending amount for a specific category
export interface CategoryBreakdown {
  categoryId: string; // Category identifier
  categoryName: string; // Category display name
  categoryColor: string; // Category color for charts
  categoryIcon: string; // Category icon name
  amount: number; // Total spent in this category
  percentage: number; // Percentage of total spending
  count: number; // Number of transactions
}

// Daily spending data point for trend charts
export interface DailyTrend {
  date: string; // ISO date string
  amount: number; // Total spent on this day
}

// Navigation parameter types for type-safe routing
export type RootStackParamList = {
  MainTabs: undefined; // Bottom tab navigator
  AddExpense: { expenseId?: string }; // Add or edit expense form
  ExpenseDetail: { expenseId: string }; // Single expense view
  CategoryManagement: undefined; // Category CRUD screen
  WalletSetup: { walletId?: string }; // Add or edit wallet
  ExportReport: undefined; // Export configuration screen
  Search: undefined; // Search and filter screen
  Security: undefined; // PIN and biometric settings
  CloudBackup: undefined; // Cloud backup settings
  BudgetSetup: undefined; // Budget configuration
  AllExpenses: undefined; // Full expense list view
  QuickAdd: { type: 'expense' | 'income' }; // Widget quick-add modal (expense or income)
};

// Bottom tab navigator parameter types
export type TabParamList = {
  Home: undefined; // Dashboard/home screen
  Expenses: undefined; // Expense list tab
  Analytics: undefined; // Analytics dashboard tab
  Wallet: undefined; // Wallet management tab
  Settings: undefined; // App settings tab
};




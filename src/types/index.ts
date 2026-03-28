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

// Income record representing money received into a wallet
export interface Income {
  id: string; // Unique identifier for the income
  amount: number; // Income amount received
  source: string; // Source of income (e.g., Salary, Freelance)
  date: string; // ISO date string of when the income was received
  notes?: string; // Optional description or memo
  walletId: string; // Wallet the income is credited to
  currency: string; // Currency code (e.g., USD, INR)
  isRecurring: boolean; // Whether this income repeats automatically
  recurringFrequency?: RecurringFrequency; // How often the income repeats
  createdAt: string; // Timestamp of record creation
  updatedAt: string; // Timestamp of last modification
}

// Predefined income source categories for quick selection
export type IncomeSource = 'salary' | 'freelance' | 'business' | 'investment' | 'rental' | 'gift' | 'refund' | 'other';

// Transfer record representing money moved between wallets
export interface Transfer {
  id: string; // Unique identifier for the transfer
  amount: number; // Transfer amount
  fromWalletId: string; // Source wallet to debit from
  toWalletId: string; // Destination wallet to credit
  date: string; // ISO date string of when the transfer occurred
  notes?: string; // Optional description or memo
  currency: string; // Currency code
  createdAt: string; // Timestamp of record creation
}

// Receipt / photo attachment linked to an expense
export interface Receipt {
  id: string; // Unique identifier for the receipt
  expenseId: string; // Parent expense this receipt belongs to
  uri: string; // Local file URI to the saved image
  thumbnailUri?: string; // Optional smaller thumbnail version
  createdAt: string; // When the receipt was captured/attached
}

// Savings goal for tracking progress toward a financial target
export interface SavingsGoal {
  id: string; // Unique identifier for the goal
  name: string; // Goal display name (e.g., "Emergency Fund")
  targetAmount: number; // Target savings amount to reach
  currentAmount: number; // Amount saved so far
  deadline?: string; // Optional deadline date in ISO format
  icon: string; // MaterialCommunityIcons icon name
  color: string; // Hex color for visual identity
  createdAt: string; // Timestamp of goal creation
  updatedAt: string; // Timestamp of last modification
}

// Expense template for quick reuse of frequent transactions
export interface ExpenseTemplate {
  id: string; // Unique identifier for the template
  name: string; // Template display name (e.g., "Morning Coffee")
  amount: number; // Default amount for this template
  category: string; // Default category name
  notes?: string; // Optional default notes
  walletId?: string; // Default wallet to deduct from
  icon: string; // MaterialCommunityIcons icon name
  color: string; // Hex color for visual identity
  usageCount: number; // Number of times this template was used
  createdAt: string; // Timestamp of template creation
}

// User streak data for gamification tracking
export interface UserStreak {
  currentStreak: number; // Current consecutive days with logged activity
  longestStreak: number; // All-time longest streak
  lastActiveDate: string; // ISO date of last logged expense/income
  totalDaysActive: number; // Total days with at least one transaction
  badges: Badge[]; // Earned badges/achievements
}

// Achievement badge for the gamification system
export interface Badge {
  id: string; // Unique badge identifier (e.g., "streak_7")
  name: string; // Display name of the badge
  description: string; // How to earn this badge
  icon: string; // MaterialCommunityIcons icon name
  earnedAt?: string | null; // ISO date when badge was earned (undefined/null = locked)
}

// Smart monthly insight generated from spending analysis
export interface MonthlyInsight {
  type: 'spending_up' | 'spending_down' | 'category_spike' | 'savings_positive' | 'savings_negative' | 'new_high' | 'streak' | 'warning' | 'positive' | 'info'; // Type of insight
  title: string; // Short headline for the insight
  description: string; // Detailed explanation of the insight
  icon: string; // MaterialCommunityIcons icon name for display
  color: string; // Accent color for the insight card
  value?: number; // Optional numeric value (e.g., percentage change)
}

// Onboarding step configuration for the walkthrough flow
export interface OnboardingStep {
  id: string; // Step identifier
  title: string; // Step headline
  description: string; // Step explanation text
  image: string; // MaterialCommunityIcons name for illustration
  color: string; // Background accent color
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
  AddIncome: { incomeId?: string }; // Add or edit income form
  IncomeList: undefined; // Full income list view
  Transfer: undefined; // Wallet-to-wallet transfer form
  MonthlyInsights: undefined; // Smart monthly insights screen
  SavingsGoals: undefined; // Savings goals management screen
  ExpenseTemplates: undefined; // Expense templates/favorites screen
  CalendarHeatmap: undefined; // Calendar heatmap view screen
  Streaks: undefined; // Streaks & gamification screen
  Onboarding: undefined; // Onboarding walkthrough (first launch)
};

// Bottom tab navigator parameter types
export type TabParamList = {
  Home: undefined; // Dashboard/home screen
  Expenses: undefined; // Expense list tab
  Analytics: undefined; // Analytics dashboard tab
  Wallet: undefined; // Wallet management tab
  Settings: undefined; // App settings tab
};




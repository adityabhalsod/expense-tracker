// Constants used throughout the Personal Expense Tracker application

import { Category, Currency, PaymentMethod } from '../types';

// Default expense categories with icons and colors for initial app setup
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Food & Dining', icon: 'food', color: '#FF6B6B', isDefault: true, order: 1 },
  { name: 'Transport', icon: 'car', color: '#4ECDC4', isDefault: true, order: 2 },
  { name: 'Shopping', icon: 'shopping', color: '#45B7D1', isDefault: true, order: 3 },
  { name: 'Entertainment', icon: 'movie-open', color: '#96CEB4', isDefault: true, order: 4 },
  { name: 'Bills & Utilities', icon: 'flash', color: '#FFEAA7', isDefault: true, order: 5 },
  { name: 'Health', icon: 'hospital-box', color: '#DDA0DD', isDefault: true, order: 6 },
  { name: 'Education', icon: 'school', color: '#98D8C8', isDefault: true, order: 7 },
  { name: 'Travel', icon: 'airplane', color: '#F7DC6F', isDefault: true, order: 8 },
  { name: 'Groceries', icon: 'cart', color: '#82E0AA', isDefault: true, order: 9 },
  { name: 'Rent', icon: 'home', color: '#F0B27A', isDefault: true, order: 10 },
  { name: 'Insurance', icon: 'shield-check', color: '#85C1E9', isDefault: true, order: 11 },
  { name: 'Personal Care', icon: 'face-man-shimmer', color: '#D7BDE2', isDefault: true, order: 12 },
  { name: 'Gifts & Donations', icon: 'gift', color: '#F5B7B1', isDefault: true, order: 13 },
  { name: 'Subscriptions', icon: 'repeat', color: '#AED6F1', isDefault: true, order: 14 },
  { name: 'Other', icon: 'dots-horizontal', color: '#BDC3C7', isDefault: true, order: 15 },
];

// Payment method display labels for the UI
export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: 'cash' },
  { value: 'credit_card', label: 'Credit Card', icon: 'credit-card' },
  { value: 'debit_card', label: 'Debit Card', icon: 'credit-card-outline' },
  { value: 'upi', label: 'UPI', icon: 'cellphone' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: 'bank' },
  { value: 'wallet', label: 'Digital Wallet', icon: 'wallet' },
  { value: 'other', label: 'Other', icon: 'dots-horizontal' },
];

// Supported currencies with their symbols and names
export const CURRENCIES: Currency[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
];

// Color palette used for chart segments and category defaults
export const CHART_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#82E0AA', '#F0B27A',
  '#85C1E9', '#D7BDE2', '#F5B7B1', '#AED6F1', '#BDC3C7',
];

// Default app settings applied on first launch
export const DEFAULT_SETTINGS = {
  theme: 'system' as const, // Follow system appearance
  defaultCurrency: 'INR', // Default currency for new expenses
  defaultPaymentMethod: 'cash' as PaymentMethod, // Default payment method
  enableBiometric: false, // Biometric lock off by default
  enablePin: false, // PIN lock off by default
  enableNotifications: true, // Budget notifications enabled
  cloudBackupEnabled: false, // Cloud backup off by default
};

// Month names for display in wallet and analytics screens
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

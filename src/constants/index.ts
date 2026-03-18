// Constants used throughout the Personal Expense Tracker application

import { Category, Currency } from '../types';

// Default expense categories with icons and colors for initial app setup
// Only 'Food & Dining' is marked as default — used as the pre-selected category across the app
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Food & Dining', icon: 'food', color: '#FF6B6B', isDefault: true, order: 1 },
  { name: 'Transport', icon: 'car', color: '#4ECDC4', isDefault: false, order: 2 },
  { name: 'Shopping', icon: 'shopping', color: '#45B7D1', isDefault: false, order: 3 },
  { name: 'Entertainment', icon: 'movie-open', color: '#96CEB4', isDefault: false, order: 4 },
  { name: 'Bills & Utilities', icon: 'flash', color: '#FFEAA7', isDefault: false, order: 5 },
  { name: 'Health', icon: 'hospital-box', color: '#DDA0DD', isDefault: false, order: 6 },
  { name: 'Education', icon: 'school', color: '#98D8C8', isDefault: false, order: 7 },
  { name: 'Travel', icon: 'airplane', color: '#F7DC6F', isDefault: false, order: 8 },
  { name: 'Groceries', icon: 'cart', color: '#82E0AA', isDefault: false, order: 9 },
  { name: 'Rent', icon: 'home', color: '#F0B27A', isDefault: false, order: 10 },
  { name: 'Insurance', icon: 'shield-check', color: '#85C1E9', isDefault: false, order: 11 },
  { name: 'Personal Care', icon: 'face-man-shimmer', color: '#D7BDE2', isDefault: false, order: 12 },
  { name: 'Gifts & Donations', icon: 'gift', color: '#F5B7B1', isDefault: false, order: 13 },
  { name: 'Subscriptions', icon: 'repeat', color: '#AED6F1', isDefault: false, order: 14 },
  { name: 'Other', icon: 'dots-horizontal', color: '#BDC3C7', isDefault: false, order: 15 },
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
  language: 'en' as const, // Default language is English
  defaultCurrency: 'INR', // Default currency for new expenses
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

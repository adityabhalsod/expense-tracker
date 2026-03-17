// Global state management using Zustand for expense tracking
// Provides reactive state for expenses, categories, wallets, budgets, payment sources, and UPI notifications

import { create } from 'zustand';
import { Expense, Category, Wallet, Budget, AppSettings, UPINotification } from '../types';
import * as db from '../database';
import { DEFAULT_SETTINGS } from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Settings storage key for async persistence
const SETTINGS_KEY = '@expense_tracker_settings';

// Main application store interface
interface AppStore {
  // State slices
  expenses: Expense[]; // All loaded expenses
  categories: Category[]; // All available categories
  wallets: Wallet[]; // All wallet/payment source records
  currentWallet: Wallet | null; // Default wallet for quick access
  budgets: Budget[]; // Budget rules
  upiNotifications: UPINotification[]; // Detected UPI payment notifications
  settings: AppSettings; // App configuration
  isLoading: boolean; // Global loading indicator
  isInitialized: boolean; // Whether initial data load is complete

  // Initialization
  initialize: () => Promise<void>; // Load all data from database on app startup

  // Expense actions
  loadExpenses: (limit?: number, offset?: number) => Promise<void>; // Fetch expenses with pagination
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Expense>; // Create new expense
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>; // Modify existing expense
  deleteExpense: (id: string) => Promise<void>; // Remove expense record
  searchExpenses: (query: string) => Promise<Expense[]>; // Search by keyword

  // Category actions
  loadCategories: () => Promise<void>; // Refresh categories from database
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category>; // Create new category
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>; // Modify category
  deleteCategory: (id: string) => Promise<void>; // Remove custom category

  // Wallet actions
  loadWallets: () => Promise<void>; // Refresh all wallets from database
  loadCurrentWallet: () => Promise<void>; // Load the default wallet
  addWallet: (wallet: Omit<Wallet, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Wallet>; // Create wallet
  updateWallet: (id: string, updates: Partial<Wallet>) => Promise<void>; // Modify wallet
  deleteWallet: (id: string) => Promise<void>; // Remove wallet

  // Budget actions
  loadBudgets: (month: number, year: number) => Promise<void>; // Load budgets for period
  addBudget: (budget: Omit<Budget, 'id'>) => Promise<Budget>; // Create budget rule
  updateBudget: (id: string, updates: Partial<Budget>) => Promise<void>; // Modify budget
  deleteBudget: (id: string) => Promise<void>; // Remove budget rule

  // Settings actions
  loadSettings: () => Promise<void>; // Load app settings from storage
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>; // Save settings changes

  // UPI notification actions
  loadUPINotifications: (limit?: number) => Promise<void>; // Load UPI notifications
  addUPINotification: (notification: UPINotification) => Promise<void>; // Save detected notification
  markUPINotificationProcessed: (id: string) => Promise<void>; // Mark notification as processed

  // Database reset actions
  clearAllData: () => Promise<void>; // Clear transactional data, keep categories/settings
  resetDatabase: () => Promise<void>; // Full factory reset — drop & recreate all tables
}

// Create the Zustand store with all actions and state
export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state values
  expenses: [],
  categories: [],
  wallets: [],
  currentWallet: null,
  budgets: [],
  upiNotifications: [], // UPI notifications loaded on init
  settings: DEFAULT_SETTINGS as AppSettings, // Start with default settings
  isLoading: true,
  isInitialized: false,

  // Load all data from SQLite on app startup
  initialize: async () => {
    try {
      set({ isLoading: true });
      // Load all data sources in parallel for faster startup
      await Promise.all([
        get().loadCategories(),
        get().loadExpenses(50), // Load first 50 expenses
        get().loadWallets(),
        get().loadCurrentWallet(),
        get().loadSettings(),
        get().loadUPINotifications(50),
      ]);
      // Load budgets for current month after wallets are loaded
      const now = new Date();
      await get().loadBudgets(now.getMonth() + 1, now.getFullYear());
      set({ isLoading: false, isInitialized: true });
    } catch (error) {
      console.error('Failed to initialize app:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  // Fetch expenses from database with optional pagination
  loadExpenses: async (limit?: number, offset?: number) => {
    const expenses = await db.getAllExpenses(limit, offset);
    set({ expenses });
  },

  // Create a new expense record and update local state
  addExpense: async (expense) => {
    const newExpense = await db.addExpense(expense);
    set((state) => ({ expenses: [newExpense, ...state.expenses] })); // Prepend new expense
    await get().loadCurrentWallet(); // Refresh wallet balance after deduction
    await get().loadWallets(); // Refresh all wallet balances
    return newExpense;
  },

  // Update an expense and refresh related state
  updateExpense: async (id, updates) => {
    await db.updateExpense(id, updates);
    // Reload to get consistent state from database
    await get().loadExpenses(50);
    await get().loadCurrentWallet();
    await get().loadWallets();
  },

  // Delete an expense and restore wallet balance
  deleteExpense: async (id) => {
    await db.deleteExpense(id);
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) })); // Remove from local state
    await get().loadCurrentWallet(); // Refresh balance after restoration
    await get().loadWallets();
  },

  // Search expenses by keyword across notes, categories, and tags
  searchExpenses: async (query) => {
    return db.searchExpenses(query);
  },

  // Refresh the categories list from database
  loadCategories: async () => {
    const categories = await db.getAllCategories();
    set({ categories });
  },

  // Add a new category to the database and state
  addCategory: async (category) => {
    const newCategory = await db.addCategory(category);
    set((state) => ({ categories: [...state.categories, newCategory] }));
    return newCategory;
  },

  // Update a category and refresh state
  updateCategory: async (id, updates) => {
    await db.updateCategory(id, updates);
    await get().loadCategories(); // Reload all for consistent ordering
  },

  // Delete a category and refresh state
  deleteCategory: async (id) => {
    await db.deleteCategory(id);
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
  },

  // Load all wallet records from database
  loadWallets: async () => {
    const wallets = await db.getAllWallets();
    set({ wallets });
  },

  // Load the default wallet (isDefault=true or first wallet)
  loadCurrentWallet: async () => {
    const wallet = await db.getDefaultWallet();
    set({ currentWallet: wallet });
  },

  // Create a new wallet and update state
  addWallet: async (wallet) => {
    // If this wallet is being set as default, clear existing defaults first
    if (wallet.isDefault) {
      await db.clearDefaultWallet();
    }
    const newWallet = await db.addWallet(wallet);
    set((state) => ({
      wallets: [newWallet, ...state.wallets],
      currentWallet: newWallet.isDefault ? newWallet : state.currentWallet,
    }));
    return newWallet;
  },

  // Update wallet details and refresh state
  updateWallet: async (id, updates) => {
    // If setting as default, clear existing defaults first
    if (updates.isDefault) {
      await db.clearDefaultWallet();
    }
    await db.updateWallet(id, updates);
    await get().loadCurrentWallet();
    await get().loadWallets();
  },

  // Delete a wallet and remove from state
  deleteWallet: async (id) => {
    await db.deleteWallet(id);
    set((state) => ({
      wallets: state.wallets.filter((w) => w.id !== id),
      currentWallet: state.currentWallet?.id === id ? null : state.currentWallet,
    }));
    await get().loadCurrentWallet(); // Re-derive default if deleted wallet was default
  },

  // Load budgets for a specific month/year period
  loadBudgets: async (month, year) => {
    const budgets = await db.getBudgetsByMonth(month, year);
    set({ budgets });
  },

  // Create a new budget and add to state
  addBudget: async (budget) => {
    const newBudget = await db.addBudget(budget);
    set((state) => ({ budgets: [...state.budgets, newBudget] }));
    return newBudget;
  },

  // Update budget and refresh state
  updateBudget: async (id, updates) => {
    await db.updateBudget(id, updates);
    const now = new Date();
    await get().loadBudgets(now.getMonth() + 1, now.getFullYear());
  },

  // Delete a budget rule
  deleteBudget: async (id) => {
    await db.deleteBudget(id);
    set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) }));
  },

  // Load app settings from AsyncStorage
  loadSettings: async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        set({ settings: { ...DEFAULT_SETTINGS, ...settings } }); // Merge with defaults
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },

  // Save updated settings to AsyncStorage
  updateSettings: async (updates) => {
    const current = get().settings;
    const newSettings = { ...current, ...updates };
    set({ settings: newSettings });
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  },

  // ── UPI Notification Actions ────────────────────────────────────────

  // Load UPI notifications with optional limit
  loadUPINotifications: async (limit) => {
    const upiNotifications = await db.getAllUPINotifications(limit);
    set({ upiNotifications });
  },

  // Save a newly detected UPI notification to the database and state
  addUPINotification: async (notification) => {
    await db.addUPINotification(notification);
    set((state) => ({ upiNotifications: [notification, ...state.upiNotifications] }));
  },

  // Mark a UPI notification as processed and update state
  markUPINotificationProcessed: async (id) => {
    await db.markUPINotificationProcessed(id);
    set((state) => ({
      upiNotifications: state.upiNotifications.map((n) =>
        n.id === id ? { ...n, isProcessed: true } : n
      ),
    }));
  },

  // Clear all transactional data (expenses, wallets, budgets, notifications)
  // Preserves categories and app settings for quick fresh start
  clearAllData: async () => {
    await db.clearAllData();
    // Reset transactional state slices to empty, keep categories and settings
    set({
      expenses: [],
      wallets: [],
      currentWallet: null,
      budgets: [],
      upiNotifications: [],
    });
  },

  // Full factory reset — drops all tables, recreates schema, reseeds defaults
  // Also clears persisted settings from AsyncStorage
  resetDatabase: async () => {
    await db.resetDatabase();
    await AsyncStorage.removeItem(SETTINGS_KEY);
    // Reset everything back to initial defaults
    set({
      expenses: [],
      categories: [],
      wallets: [],
      currentWallet: null,
      budgets: [],
      upiNotifications: [],
      settings: DEFAULT_SETTINGS as AppSettings,
    });
    // Reload seeded categories from the fresh database
    await get().loadCategories();
  },
}));

// Granular selectors to avoid unnecessary re-renders
// Components should use these instead of subscribing to the full store
export const selectExpenses = (state: AppStore) => state.expenses;
export const selectCategories = (state: AppStore) => state.categories;
export const selectCurrentWallet = (state: AppStore) => state.currentWallet;
export const selectWallets = (state: AppStore) => state.wallets;
export const selectBudgets = (state: AppStore) => state.budgets;
export const selectSettings = (state: AppStore) => state.settings;
export const selectIsLoading = (state: AppStore) => state.isLoading;
export const selectIsInitialized = (state: AppStore) => state.isInitialized;
export const selectUPINotifications = (state: AppStore) => state.upiNotifications;

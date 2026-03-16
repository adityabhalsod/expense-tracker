// Global state management using Zustand for expense tracking
// Provides reactive state for expenses, categories, wallets, and budgets

import { create } from 'zustand';
import { Expense, Category, Wallet, Budget, AppSettings } from '../types';
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
  wallets: Wallet[]; // All wallet records
  currentWallet: Wallet | null; // Active month's wallet
  budgets: Budget[]; // Budget rules
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
  loadWallets: () => Promise<void>; // Refresh all wallets
  loadCurrentWallet: () => Promise<void>; // Load current month's wallet
  addWallet: (wallet: Omit<Wallet, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Wallet>; // Create wallet
  updateWallet: (id: string, updates: Partial<Wallet>) => Promise<void>; // Modify wallet

  // Budget actions
  loadBudgets: (month: number, year: number) => Promise<void>; // Load budgets for period
  addBudget: (budget: Omit<Budget, 'id'>) => Promise<Budget>; // Create budget rule
  updateBudget: (id: string, updates: Partial<Budget>) => Promise<void>; // Modify budget
  deleteBudget: (id: string) => Promise<void>; // Remove budget rule

  // Settings actions
  loadSettings: () => Promise<void>; // Load app settings from storage
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>; // Save settings changes
}

// Create the Zustand store with all actions and state
export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state values
  expenses: [],
  categories: [],
  wallets: [],
  currentWallet: null,
  budgets: [],
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
    return newExpense;
  },

  // Update an expense and refresh related state
  updateExpense: async (id, updates) => {
    await db.updateExpense(id, updates);
    // Reload to get consistent state from database
    await get().loadExpenses(50);
    await get().loadCurrentWallet();
  },

  // Delete an expense and restore wallet balance
  deleteExpense: async (id) => {
    await db.deleteExpense(id);
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) })); // Remove from local state
    await get().loadCurrentWallet(); // Refresh balance after restoration
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

  // Load (or null) the wallet for the current month
  loadCurrentWallet: async () => {
    const now = new Date();
    const wallet = await db.getWalletByMonth(now.getMonth() + 1, now.getFullYear());
    set({ currentWallet: wallet });
  },

  // Create a new wallet and update state
  addWallet: async (wallet) => {
    const newWallet = await db.addWallet(wallet);
    set((state) => ({ wallets: [newWallet, ...state.wallets], currentWallet: newWallet }));
    return newWallet;
  },

  // Update wallet details and refresh state
  updateWallet: async (id, updates) => {
    await db.updateWallet(id, updates);
    await get().loadCurrentWallet();
    await get().loadWallets();
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
}));

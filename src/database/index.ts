// SQLite database service for offline-first data persistence
// Uses expo-sqlite for local storage on the device

import * as SQLite from 'expo-sqlite';
import { Paths, Directory, File } from 'expo-file-system';
import { Expense, Category, Wallet, Budget } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';
import * as Crypto from 'expo-crypto';

// Singleton database instance shared across the app
let db: SQLite.SQLiteDatabase | null = null;

// Generate a UUID v4 string using expo-crypto for unique record IDs
const generateId = (): string => {
  return Crypto.randomUUID();
};

// Fix corrupted SQLite directory: if a regular file exists where the directory should be, remove it
const ensureSQLiteDirectory = async (): Promise<void> => {
  try {
    const sqlitePath = new Directory(Paths.document, 'SQLite').uri;
    const info = Paths.info(sqlitePath);
    if (info.exists && info.isDirectory === false) {
      // A file is blocking the directory path — remove it so expo-sqlite can create the directory
      const blocker = new File(Paths.document, 'SQLite');
      blocker.delete();
    }
  } catch (e) {
    console.warn('SQLite directory check failed:', e);
  }
};

// Initialize and return the SQLite database connection
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db; // Return existing connection if already open
  await ensureSQLiteDirectory(); // Fix path conflict before opening DB
  db = await SQLite.openDatabaseAsync('expense_tracker.db');
  await initializeDatabase(db); // Create tables on first open
  return db;
};

// Create all required tables and seed default data if tables are empty
const initializeDatabase = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  // Enable WAL mode for better concurrent read/write performance
  await database.execAsync('PRAGMA journal_mode = WAL;');

  // Create categories table for expense classification
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      isDefault INTEGER NOT NULL DEFAULT 0,
      budget REAL,
      "order" INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Create expenses table as the primary transaction store
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      date TEXT NOT NULL,
      paymentMethod TEXT NOT NULL DEFAULT 'cash',
      notes TEXT,
      tags TEXT DEFAULT '[]',
      currency TEXT NOT NULL DEFAULT 'INR',
      isRecurring INTEGER NOT NULL DEFAULT 0,
      recurringFrequency TEXT,
      recurringEndDate TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      walletId TEXT,
      FOREIGN KEY (walletId) REFERENCES wallets(id)
    );
  `);

  // Create wallets table for monthly balance tracking
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      initialBalance REAL NOT NULL DEFAULT 0,
      currentBalance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // Create budgets table for spending limit tracking
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY NOT NULL,
      categoryId TEXT,
      amount REAL NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      notifyAt INTEGER NOT NULL DEFAULT 80,
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );
  `);

  // Create indexes for common query patterns to optimize performance
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_expenses_wallet ON expenses(walletId);
    CREATE INDEX IF NOT EXISTS idx_wallets_month_year ON wallets(month, year);
  `);

  // Seed default categories if the categories table is empty
  const categoryCount = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (categoryCount && categoryCount.count === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await database.runAsync(
        'INSERT INTO categories (id, name, icon, color, isDefault, "order") VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), cat.name, cat.icon, cat.color, cat.isDefault ? 1 : 0, cat.order]
      );
    }
  }
};

// ==================== CATEGORY OPERATIONS ====================

// Retrieve all categories sorted by their display order
export const getAllCategories = async (): Promise<Category[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>('SELECT * FROM categories ORDER BY "order" ASC');
  // Map raw rows to typed Category objects
  return rows.map(row => ({
    ...row,
    isDefault: row.isDefault === 1,
  }));
};

// Insert a new category and return the created record
export const addCategory = async (category: Omit<Category, 'id'>): Promise<Category> => {
  const database = await getDatabase();
  const id = generateId(); // Generate unique ID
  await database.runAsync(
    'INSERT INTO categories (id, name, icon, color, isDefault, budget, "order") VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, category.name, category.icon, category.color, category.isDefault ? 1 : 0, category.budget || null, category.order]
  );
  return { id, ...category }; // Return complete category with generated ID
};

// Update an existing category by ID
export const updateCategory = async (id: string, category: Partial<Category>): Promise<void> => {
  const database = await getDatabase();
  // Build SET clause dynamically from provided fields
  const fields: string[] = [];
  const values: any[] = [];

  if (category.name !== undefined) { fields.push('name = ?'); values.push(category.name); }
  if (category.icon !== undefined) { fields.push('icon = ?'); values.push(category.icon); }
  if (category.color !== undefined) { fields.push('color = ?'); values.push(category.color); }
  if (category.budget !== undefined) { fields.push('budget = ?'); values.push(category.budget); }
  if (category.order !== undefined) { fields.push('"order" = ?'); values.push(category.order); }

  if (fields.length === 0) return; // No fields to update
  values.push(id); // Append ID for WHERE clause
  await database.runAsync(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
};

// Remove a category by ID (prevents deletion of default categories from UI)
export const deleteCategory = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM categories WHERE id = ?', [id]);
};

// ==================== EXPENSE OPERATIONS ====================

// Retrieve all expenses ordered by most recent first
export const getAllExpenses = async (limit?: number, offset?: number): Promise<Expense[]> => {
  const database = await getDatabase();
  let query = 'SELECT * FROM expenses ORDER BY date DESC, createdAt DESC';
  const params: any[] = [];

  // Apply pagination if limit is specified
  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
    if (offset) {
      query += ' OFFSET ?';
      params.push(offset);
    }
  }

  const rows = await database.getAllAsync<any>(query, params);
  return rows.map(parseExpenseRow); // Parse each row into typed Expense
};

// Get expenses within a specific date range for reports and analytics
export const getExpensesByDateRange = async (startDate: string, endDate: string): Promise<Expense[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC',
    [startDate, endDate]
  );
  return rows.map(parseExpenseRow);
};

// Get expenses filtered by category name
export const getExpensesByCategory = async (category: string): Promise<Expense[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM expenses WHERE category = ? ORDER BY date DESC',
    [category]
  );
  return rows.map(parseExpenseRow);
};

// Search expenses by matching notes, category, or tags
export const searchExpenses = async (query: string): Promise<Expense[]> => {
  const database = await getDatabase();
  const searchTerm = `%${query}%`; // Wildcard match for LIKE queries
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM expenses WHERE notes LIKE ? OR category LIKE ? OR tags LIKE ? ORDER BY date DESC',
    [searchTerm, searchTerm, searchTerm]
  );
  return rows.map(parseExpenseRow);
};

// Insert a new expense and deduct from the associated wallet balance
export const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> => {
  const database = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString(); // Current timestamp for audit fields

  await database.runAsync(
    `INSERT INTO expenses (id, amount, category, subcategory, date, paymentMethod, notes, tags, currency, isRecurring, recurringFrequency, recurringEndDate, createdAt, updatedAt, walletId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, expense.amount, expense.category, expense.subcategory || null,
      expense.date, expense.paymentMethod, expense.notes || null,
      JSON.stringify(expense.tags), expense.currency, expense.isRecurring ? 1 : 0,
      expense.recurringFrequency || null, expense.recurringEndDate || null,
      now, now, expense.walletId || null,
    ]
  );

  // Deduct expense amount from the associated wallet
  if (expense.walletId) {
    await database.runAsync(
      'UPDATE wallets SET currentBalance = currentBalance - ?, updatedAt = ? WHERE id = ?',
      [expense.amount, now, expense.walletId]
    );
  }

  return { id, ...expense, createdAt: now, updatedAt: now };
};

// Update an existing expense and adjust the wallet balance accordingly
export const updateExpense = async (id: string, updates: Partial<Expense>): Promise<void> => {
  const database = await getDatabase();
  const now = new Date().toISOString();

  // Fetch existing expense to calculate wallet balance difference
  const existing = await database.getFirstAsync<any>('SELECT * FROM expenses WHERE id = ?', [id]);
  if (!existing) return;

  const fields: string[] = ['updatedAt = ?'];
  const values: any[] = [now];

  // Build dynamic update query from provided fields
  if (updates.amount !== undefined) { fields.push('amount = ?'); values.push(updates.amount); }
  if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
  if (updates.subcategory !== undefined) { fields.push('subcategory = ?'); values.push(updates.subcategory); }
  if (updates.date !== undefined) { fields.push('date = ?'); values.push(updates.date); }
  if (updates.paymentMethod !== undefined) { fields.push('paymentMethod = ?'); values.push(updates.paymentMethod); }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
  if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
  if (updates.isRecurring !== undefined) { fields.push('isRecurring = ?'); values.push(updates.isRecurring ? 1 : 0); }
  if (updates.recurringFrequency !== undefined) { fields.push('recurringFrequency = ?'); values.push(updates.recurringFrequency); }

  values.push(id);
  await database.runAsync(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`, values);

  // Adjust wallet balance if the amount changed
  if (updates.amount !== undefined && existing.walletId) {
    const diff = updates.amount - existing.amount; // Positive = more spent, negative = less spent
    await database.runAsync(
      'UPDATE wallets SET currentBalance = currentBalance - ?, updatedAt = ? WHERE id = ?',
      [diff, now, existing.walletId]
    );
  }
};

// Delete an expense and restore its amount to the wallet balance
export const deleteExpense = async (id: string): Promise<void> => {
  const database = await getDatabase();
  // Fetch expense to restore wallet balance before deletion
  const existing = await database.getFirstAsync<any>('SELECT * FROM expenses WHERE id = ?', [id]);
  if (!existing) return;

  await database.runAsync('DELETE FROM expenses WHERE id = ?', [id]);

  // Restore the deleted expense amount back to the wallet
  if (existing.walletId) {
    const now = new Date().toISOString();
    await database.runAsync(
      'UPDATE wallets SET currentBalance = currentBalance + ?, updatedAt = ? WHERE id = ?',
      [existing.amount, now, existing.walletId]
    );
  }
};

// Get a single expense by its ID
export const getExpenseById = async (id: string): Promise<Expense | null> => {
  const database = await getDatabase();
  const row = await database.getFirstAsync<any>('SELECT * FROM expenses WHERE id = ?', [id]);
  return row ? parseExpenseRow(row) : null;
};

// Count total number of expense records
export const getExpenseCount = async (): Promise<number> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM expenses');
  return result?.count || 0;
};

// ==================== WALLET OPERATIONS ====================

// Get the wallet for a specific month and year
export const getWalletByMonth = async (month: number, year: number): Promise<Wallet | null> => {
  const database = await getDatabase();
  const row = await database.getFirstAsync<any>(
    'SELECT * FROM wallets WHERE month = ? AND year = ?',
    [month, year]
  );
  return row || null;
};

// Get all wallets ordered by most recent first
export const getAllWallets = async (): Promise<Wallet[]> => {
  const database = await getDatabase();
  return database.getAllAsync<Wallet>('SELECT * FROM wallets ORDER BY year DESC, month DESC');
};

// Create a new wallet for a specific month/year period
export const addWallet = async (wallet: Omit<Wallet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Wallet> => {
  const database = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  await database.runAsync(
    'INSERT INTO wallets (id, name, initialBalance, currentBalance, currency, month, year, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, wallet.name, wallet.initialBalance, wallet.currentBalance, wallet.currency, wallet.month, wallet.year, now, now]
  );

  return { id, ...wallet, createdAt: now, updatedAt: now };
};

// Update wallet details (e.g., changing the initial balance)
export const updateWallet = async (id: string, updates: Partial<Wallet>): Promise<void> => {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const fields: string[] = ['updatedAt = ?'];
  const values: any[] = [now];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.initialBalance !== undefined) { fields.push('initialBalance = ?'); values.push(updates.initialBalance); }
  if (updates.currentBalance !== undefined) { fields.push('currentBalance = ?'); values.push(updates.currentBalance); }

  values.push(id);
  await database.runAsync(`UPDATE wallets SET ${fields.join(', ')} WHERE id = ?`, values);
};

// ==================== BUDGET OPERATIONS ====================

// Get all budgets for a specific month and year
export const getBudgetsByMonth = async (month: number, year: number): Promise<Budget[]> => {
  const database = await getDatabase();
  return database.getAllAsync<Budget>(
    'SELECT * FROM budgets WHERE month = ? AND year = ?',
    [month, year]
  );
};

// Create a new budget rule
export const addBudget = async (budget: Omit<Budget, 'id'>): Promise<Budget> => {
  const database = await getDatabase();
  const id = generateId();
  await database.runAsync(
    'INSERT INTO budgets (id, categoryId, amount, period, month, year, notifyAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, budget.categoryId || null, budget.amount, budget.period, budget.month, budget.year, budget.notifyAt]
  );
  return { id, ...budget };
};

// Update an existing budget rule
export const updateBudget = async (id: string, updates: Partial<Budget>): Promise<void> => {
  const database = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.amount !== undefined) { fields.push('amount = ?'); values.push(updates.amount); }
  if (updates.notifyAt !== undefined) { fields.push('notifyAt = ?'); values.push(updates.notifyAt); }
  if (updates.categoryId !== undefined) { fields.push('categoryId = ?'); values.push(updates.categoryId); }

  if (fields.length === 0) return;
  values.push(id);
  await database.runAsync(`UPDATE budgets SET ${fields.join(', ')} WHERE id = ?`, values);
};

// Delete a budget rule by ID
export const deleteBudget = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
};

// ==================== ANALYTICS QUERIES ====================

// Get total spending for a date range, grouped by category
export const getCategoryTotals = async (startDate: string, endDate: string): Promise<{ category: string; total: number; count: number }[]> => {
  const database = await getDatabase();
  return database.getAllAsync<{ category: string; total: number; count: number }>(
    `SELECT category, SUM(amount) as total, COUNT(*) as count
     FROM expenses WHERE date >= ? AND date <= ?
     GROUP BY category ORDER BY total DESC`,
    [startDate, endDate]
  );
};

// Get daily spending totals for a date range (used for trend charts)
export const getDailyTotals = async (startDate: string, endDate: string): Promise<{ date: string; total: number }[]> => {
  const database = await getDatabase();
  return database.getAllAsync<{ date: string; total: number }>(
    `SELECT date, SUM(amount) as total
     FROM expenses WHERE date >= ? AND date <= ?
     GROUP BY date ORDER BY date ASC`,
    [startDate, endDate]
  );
};

// Get total spending for a specific date range
export const getTotalExpenses = async (startDate: string, endDate: string): Promise<number> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date <= ?',
    [startDate, endDate]
  );
  return result?.total || 0;
};

// Get monthly spending totals for yearly trend analysis
export const getMonthlyTotals = async (year: number): Promise<{ month: number; total: number }[]> => {
  const database = await getDatabase();
  return database.getAllAsync<{ month: number; total: number }>(
    `SELECT CAST(strftime('%m', date) AS INTEGER) as month, SUM(amount) as total
     FROM expenses WHERE strftime('%Y', date) = ?
     GROUP BY month ORDER BY month ASC`,
    [year.toString()]
  );
};

// ==================== DATA EXPORT ====================

// Export all data as a JSON object for backup purposes
export const exportAllData = async (): Promise<{ expenses: Expense[]; categories: Category[]; wallets: Wallet[]; budgets: Budget[] }> => {
  const database = await getDatabase();
  const expenses = (await database.getAllAsync<any>('SELECT * FROM expenses ORDER BY date DESC')).map(parseExpenseRow);
  const categories = await database.getAllAsync<any>('SELECT * FROM categories ORDER BY "order" ASC');
  const wallets = await database.getAllAsync<Wallet>('SELECT * FROM wallets ORDER BY year DESC, month DESC');
  const budgets = await database.getAllAsync<Budget>('SELECT * FROM budgets');
  return { expenses, categories: categories.map((c: any) => ({ ...c, isDefault: c.isDefault === 1 })), wallets, budgets };
};

// ==================== HELPER FUNCTIONS ====================

// Convert a raw database row to a typed Expense object
const parseExpenseRow = (row: any): Expense => ({
  ...row,
  tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [], // Parse JSON tags string
  isRecurring: row.isRecurring === 1, // Convert SQLite integer to boolean
});

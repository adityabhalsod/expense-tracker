// SQLite database service for offline-first data persistence
// Uses expo-sqlite for local storage on the device

import * as SQLite from 'expo-sqlite';
import { Expense, Category, Wallet, Budget } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';
import * as Crypto from 'expo-crypto';
import { encryptData, decryptData } from '../utils/encryption';

// Singleton database instance shared across the app
let db: SQLite.SQLiteDatabase | null = null;
// Promise lock to prevent concurrent initialization races
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Generate a UUID v4 string using expo-crypto for unique record IDs
const generateId = (): string => {
  return Crypto.randomUUID();
};

// Initialize and return the SQLite database connection (serialized to prevent race conditions)
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db; // Return existing connection if already open
  if (dbInitPromise) return dbInitPromise; // Wait for in-progress init instead of racing

  dbInitPromise = (async () => {
    try {
      const database = await SQLite.openDatabaseAsync('expense_tracker.db');
      await initializeDatabase(database); // Create tables on first open
      db = database;
      return database;
    } catch (e) {
      dbInitPromise = null; // Allow retry on failure
      throw e;
    }
  })();

  return dbInitPromise;
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

  // Create wallets table for multi-wallet payment source tracking
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'cash',
      initialBalance REAL NOT NULL DEFAULT 0,
      currentBalance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      bankName TEXT,
      nickname TEXT,
      iconName TEXT NOT NULL DEFAULT 'wallet',
      color TEXT NOT NULL DEFAULT '#4ECDC4',
      isDefault INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
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


  // --- Migrations: add new wallet columns for existing databases upgrading from v1 ---
  // These must run BEFORE index creation since indexes reference these new columns
  const walletMigrationColumns = [
    { name: 'type', sql: "ALTER TABLE wallets ADD COLUMN type TEXT NOT NULL DEFAULT 'cash'" },
    { name: 'bankName', sql: 'ALTER TABLE wallets ADD COLUMN bankName TEXT' },
    { name: 'nickname', sql: 'ALTER TABLE wallets ADD COLUMN nickname TEXT' },
    { name: 'iconName', sql: "ALTER TABLE wallets ADD COLUMN iconName TEXT NOT NULL DEFAULT 'wallet'" },
    { name: 'color', sql: "ALTER TABLE wallets ADD COLUMN color TEXT NOT NULL DEFAULT '#4ECDC4'" },
    { name: 'isDefault', sql: 'ALTER TABLE wallets ADD COLUMN isDefault INTEGER NOT NULL DEFAULT 0' },
    { name: 'metadata', sql: 'ALTER TABLE wallets ADD COLUMN metadata TEXT' },
  ];
  for (const col of walletMigrationColumns) {
    try {
      await database.execAsync(col.sql);
    } catch {
      // Column already exists — ignore the duplicate column error
    }
  }

  // Migration: drop legacy NOT NULL month/year columns by recreating wallets table
  // SQLite cannot ALTER columns, so we copy data to temp, recreate, and copy back
  try {
    const colCheck = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(wallets)"
    );
    const hasMonth = colCheck.some(c => c.name === 'month');
    if (hasMonth) {
      // Old schema has month/year — need to recreate table without them
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS wallets_v2 (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'cash',
          initialBalance REAL NOT NULL DEFAULT 0,
          currentBalance REAL NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'INR',
          bankName TEXT,
          nickname TEXT,
          iconName TEXT NOT NULL DEFAULT 'wallet',
          color TEXT NOT NULL DEFAULT '#4ECDC4',
          isDefault INTEGER NOT NULL DEFAULT 0,
          metadata TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);
      // Copy existing wallet rows, mapping old columns to new schema
      await database.execAsync(`
        INSERT OR IGNORE INTO wallets_v2 (id, name, type, initialBalance, currentBalance, currency, bankName, nickname, iconName, color, isDefault, metadata, createdAt, updatedAt)
        SELECT id, name,
          COALESCE(type, 'cash'),
          COALESCE(initialBalance, 0),
          COALESCE(currentBalance, 0),
          COALESCE(currency, 'INR'),
          bankName, nickname,
          COALESCE(iconName, 'wallet'),
          COALESCE(color, '#4ECDC4'),
          COALESCE(isDefault, 0),
          metadata, createdAt, updatedAt
        FROM wallets;
      `);
      // Swap tables: drop old, rename new
      await database.execAsync('DROP TABLE wallets;');
      await database.execAsync('ALTER TABLE wallets_v2 RENAME TO wallets;');
    }
  } catch (e) {
    console.warn('Wallet table migration (month/year removal) skipped:', e);
  }

  // Migration: add walletId column to expenses for wallet FK
  try {
    await database.execAsync('ALTER TABLE expenses ADD COLUMN walletId TEXT');
  } catch {
    // Column already exists — ignore
  }

  // Migration: add walletId column to budgets for wallet-specific budget tracking
  try {
    await database.execAsync('ALTER TABLE budgets ADD COLUMN walletId TEXT');
  } catch {
    // Column already exists — ignore
  }

  // Create indexes for common query patterns to optimize performance
  // Safe to run now because all columns (including migrated ones) exist
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_expenses_wallet ON expenses(walletId);
    CREATE INDEX IF NOT EXISTS idx_wallets_type ON wallets(type);
    CREATE INDEX IF NOT EXISTS idx_wallets_default ON wallets(isDefault);
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
  if (category.isDefault !== undefined) { fields.push('isDefault = ?'); values.push(category.isDefault ? 1 : 0); }
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

// Set a category as the default and clear previous default flags
export const setDefaultCategory = async (id: string): Promise<void> => {
  const database = await getDatabase();
  // Clear isDefault from all categories first
  await database.runAsync('UPDATE categories SET isDefault = 0 WHERE isDefault = 1');
  // Set the new default category
  await database.runAsync('UPDATE categories SET isDefault = 1 WHERE id = ?', [id]);
};

// Delete multiple categories by their IDs in a single batch
export const deleteMultipleCategories = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const database = await getDatabase();
  // Build parameterized placeholders for IN clause
  const placeholders = ids.map(() => '?').join(',');
  await database.runAsync(`DELETE FROM categories WHERE id IN (${placeholders})`, ids);
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
    `INSERT INTO expenses (id, amount, category, subcategory, date, notes, tags, currency, isRecurring, recurringFrequency, recurringEndDate, createdAt, updatedAt, walletId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, expense.amount, expense.category, expense.subcategory || null,
      expense.date, expense.notes || null,
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

// Delete multiple expenses by IDs and restore each amount to its wallet
export const deleteMultipleExpenses = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const database = await getDatabase();
  const now = new Date().toISOString();
  const placeholders = ids.map(() => '?').join(',');

  // Fetch all targeted expenses to restore wallet balances
  const rows = await database.getAllAsync<any>(
    `SELECT id, amount, walletId FROM expenses WHERE id IN (${placeholders})`, ids
  );

  // Delete all matching expenses in one query
  await database.runAsync(`DELETE FROM expenses WHERE id IN (${placeholders})`, ids);

  // Restore each expense amount back to its respective wallet
  for (const row of rows) {
    if (row.walletId) {
      await database.runAsync(
        'UPDATE wallets SET currentBalance = currentBalance + ?, updatedAt = ? WHERE id = ?',
        [row.amount, now, row.walletId]
      );
    }
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

// Get the default wallet (marked as default, or first wallet as fallback)
export const getDefaultWallet = async (): Promise<Wallet | null> => {
  const database = await getDatabase();
  // Try to find the wallet marked as default first
  let row = await database.getFirstAsync<any>(
    'SELECT * FROM wallets WHERE isDefault = 1 LIMIT 1'
  );
  // Fall back to the first created wallet if no default is set
  if (!row) {
    row = await database.getFirstAsync<any>(
      'SELECT * FROM wallets ORDER BY createdAt ASC LIMIT 1'
    );
  }
  return row ? await parseWalletRow(row) : null;
};

// Get all wallets ordered by default first, then by name
export const getAllWallets = async (): Promise<Wallet[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM wallets ORDER BY isDefault DESC, name ASC'
  );
  // Decrypt sensitive fields for each wallet before returning
  const wallets: Wallet[] = [];
  for (const row of rows) {
    wallets.push(await parseWalletRow(row));
  }
  return wallets;
};

// Create a new wallet/payment source with encrypted sensitive fields
export const addWallet = async (wallet: Omit<Wallet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Wallet> => {
  const database = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  // Encrypt sensitive fields before storing
  const encryptedMetadata = wallet.metadata ? await encryptData(wallet.metadata) : null;

  await database.runAsync(
    `INSERT INTO wallets (id, name, type, initialBalance, currentBalance, currency, bankName, nickname, iconName, color, isDefault, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, wallet.name, wallet.type, wallet.initialBalance, wallet.currentBalance,
      wallet.currency, wallet.bankName || null,
      wallet.nickname || null, wallet.iconName, wallet.color,
      wallet.isDefault ? 1 : 0, encryptedMetadata, now, now,
    ]
  );

  return { id, ...wallet, createdAt: now, updatedAt: now };
};

// Update wallet details with re-encrypted sensitive fields
export const updateWallet = async (id: string, updates: Partial<Wallet>): Promise<void> => {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const fields: string[] = ['updatedAt = ?'];
  const values: any[] = [now];

  // Build dynamic SET clause from provided fields
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type); }
  if (updates.initialBalance !== undefined) { fields.push('initialBalance = ?'); values.push(updates.initialBalance); }
  if (updates.currentBalance !== undefined) { fields.push('currentBalance = ?'); values.push(updates.currentBalance); }
  if (updates.bankName !== undefined) { fields.push('bankName = ?'); values.push(updates.bankName); }
  if (updates.nickname !== undefined) { fields.push('nickname = ?'); values.push(updates.nickname); }
  if (updates.iconName !== undefined) { fields.push('iconName = ?'); values.push(updates.iconName); }
  if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
  if (updates.isDefault !== undefined) { fields.push('isDefault = ?'); values.push(updates.isDefault ? 1 : 0); }

  // Re-encrypt sensitive fields if they are being updated
  if (updates.metadata !== undefined) {
    fields.push('metadata = ?');
    values.push(updates.metadata ? await encryptData(updates.metadata) : null);
  }

  values.push(id);
  await database.runAsync(`UPDATE wallets SET ${fields.join(', ')} WHERE id = ?`, values);
};

// Delete a wallet by ID
export const deleteWallet = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM wallets WHERE id = ?', [id]);
};

// Clear the default flag from all wallets (used before setting a new default)
export const clearDefaultWallet = async (): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('UPDATE wallets SET isDefault = 0 WHERE isDefault = 1');
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

// Create a new budget rule with optional wallet association
export const addBudget = async (budget: Omit<Budget, 'id'>): Promise<Budget> => {
  const database = await getDatabase();
  const id = generateId();
  await database.runAsync(
    'INSERT INTO budgets (id, categoryId, amount, period, month, year, notifyAt, walletId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, budget.categoryId || null, budget.amount, budget.period, budget.month, budget.year, budget.notifyAt, budget.walletId || null]
  );
  return { id, ...budget };
};

// Update an existing budget rule including period and wallet
export const updateBudget = async (id: string, updates: Partial<Budget>): Promise<void> => {
  const database = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.amount !== undefined) { fields.push('amount = ?'); values.push(updates.amount); }
  if (updates.notifyAt !== undefined) { fields.push('notifyAt = ?'); values.push(updates.notifyAt); }
  if (updates.categoryId !== undefined) { fields.push('categoryId = ?'); values.push(updates.categoryId); }
  if (updates.period !== undefined) { fields.push('period = ?'); values.push(updates.period); }
  if (updates.walletId !== undefined) { fields.push('walletId = ?'); values.push(updates.walletId || null); }

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
  const walletRows = await database.getAllAsync<any>('SELECT * FROM wallets ORDER BY isDefault DESC, name ASC');
  const wallets: Wallet[] = [];
  for (const row of walletRows) {
    wallets.push(await parseWalletRow(row));
  }
  const budgets = await database.getAllAsync<Budget>('SELECT * FROM budgets');
  return { expenses, categories: categories.map((c: any) => ({ ...c, isDefault: c.isDefault === 1 })), wallets, budgets };
};

// ==================== DATABASE RESET FUNCTIONS ====================

// Clear all row data from transactional tables but preserve table structure and categories
// Useful for "start fresh" without losing categories or app structure
export const clearAllData = async (): Promise<void> => {
  const database = await getDatabase();
  // Delete all rows from data tables in dependency order (children first)
  await database.execAsync(`
    DELETE FROM expenses;
    DELETE FROM budgets;
    DELETE FROM wallets;
  `);
};

// Drop all tables and reinitialize the database from scratch
// This is a full factory reset — all data including categories is lost
export const resetDatabase = async (): Promise<void> => {
  const database = await getDatabase();
  // Drop every table in reverse-dependency order
  await database.execAsync(`
    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS budgets;
    DROP TABLE IF EXISTS wallets;
    DROP TABLE IF EXISTS categories;
  `);
  // Recreate all tables and re-seed default categories
  await initializeDatabase(database);
};

// ==================== HELPER FUNCTIONS ====================

// Convert a raw database row to a typed Wallet object with decrypted fields
const parseWalletRow = async (row: any): Promise<Wallet> => ({
  ...row,
  isDefault: row.isDefault === 1,
  metadata: row.metadata ? await decryptData(row.metadata) : undefined,
});

// Convert a raw database row to a typed Expense object
const parseExpenseRow = (row: any): Expense => ({
  ...row,
  tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [], // Parse JSON tags string
  isRecurring: row.isRecurring === 1, // Convert SQLite integer to boolean
});

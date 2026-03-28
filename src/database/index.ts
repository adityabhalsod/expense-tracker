// SQLite database service for offline-first data persistence
// Uses expo-sqlite for local storage on the device

import * as SQLite from 'expo-sqlite';
import { Expense, Category, Wallet, Budget, Income, Transfer, Receipt, SavingsGoal, ExpenseTemplate } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';
import * as Crypto from 'expo-crypto';
import { encryptData, decryptData } from '../utils/encryption';

// SQLite bind parameter type for query values
type BindValue = string | number | null;

// Raw category row from SQLite (isDefault stored as 0/1 integer)
interface RawCategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: number;
  budget: number | null;
  order: number;
}

// Raw expense row from SQLite (booleans as 0/1, tags as JSON string)
interface RawExpenseRow {
  id: string;
  amount: number;
  category: string;
  subcategory: string | null;
  date: string;
  paymentMethod: string;
  notes: string | null;
  tags: string;
  currency: string;
  isRecurring: number;
  recurringFrequency: string | null;
  recurringEndDate: string | null;
  createdAt: string;
  updatedAt: string;
  walletId: string | null;
}

// Raw wallet row from SQLite (isDefault stored as 0/1 integer)
interface RawWalletRow {
  id: string;
  name: string;
  type: string;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  bankName: string | null;
  nickname: string | null;
  iconName: string;
  color: string;
  isDefault: number;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

// Raw income row from SQLite (isRecurring stored as 0/1 integer)
interface RawIncomeRow {
  id: string;
  amount: number;
  source: string;
  date: string;
  notes: string | null;
  walletId: string;
  currency: string;
  isRecurring: number;
  recurringFrequency: string | null;
  createdAt: string;
  updatedAt: string;
}

// Raw user streak row from SQLite
interface RawUserStreakRow {
  id: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  totalDaysActive: number;
}

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

  // Create income table for tracking money received into wallets
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS income (
      id TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL,
      source TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      walletId TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      isRecurring INTEGER NOT NULL DEFAULT 0,
      recurringFrequency TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (walletId) REFERENCES wallets(id)
    );
  `);

  // Create transfers table for wallet-to-wallet money movements
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL,
      fromWalletId TEXT NOT NULL,
      toWalletId TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      currency TEXT NOT NULL DEFAULT 'INR',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (fromWalletId) REFERENCES wallets(id),
      FOREIGN KEY (toWalletId) REFERENCES wallets(id)
    );
  `);

  // Create receipts table for photo attachments linked to expenses
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY NOT NULL,
      expenseId TEXT NOT NULL,
      uri TEXT NOT NULL,
      thumbnailUri TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (expenseId) REFERENCES expenses(id) ON DELETE CASCADE
    );
  `);

  // Create savings goals table for financial target tracking
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      targetAmount REAL NOT NULL,
      currentAmount REAL NOT NULL DEFAULT 0,
      deadline TEXT,
      icon TEXT NOT NULL DEFAULT 'piggy-bank',
      color TEXT NOT NULL DEFAULT '#10B981',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // Create expense templates table for quick-add favorites
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS expense_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      notes TEXT,
      walletId TEXT,
      icon TEXT NOT NULL DEFAULT 'star',
      color TEXT NOT NULL DEFAULT '#F59E0B',
      usageCount INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );
  `);

  // Create user_streaks table for gamification tracking (single row)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS user_streaks (
      id INTEGER PRIMARY KEY DEFAULT 1,
      currentStreak INTEGER NOT NULL DEFAULT 0,
      longestStreak INTEGER NOT NULL DEFAULT 0,
      lastActiveDate TEXT,
      totalDaysActive INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Create badges table for earned achievements
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      earnedAt TEXT
    );
  `);

  // Seed initial streak row if it doesn't exist
  const streakRow = await database.getFirstAsync<{ id: number }>('SELECT id FROM user_streaks WHERE id = 1');
  if (!streakRow) {
    await database.runAsync('INSERT INTO user_streaks (id, currentStreak, longestStreak, totalDaysActive) VALUES (1, 0, 0, 0)');
  }


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
    CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
    CREATE INDEX IF NOT EXISTS idx_income_wallet ON income(walletId);
    CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date);
    CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(fromWalletId);
    CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(toWalletId);
    CREATE INDEX IF NOT EXISTS idx_receipts_expense ON receipts(expenseId);
    CREATE INDEX IF NOT EXISTS idx_goals_deadline ON savings_goals(deadline);
    CREATE INDEX IF NOT EXISTS idx_templates_usage ON expense_templates(usageCount DESC);
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
  const rows = await database.getAllAsync<RawCategoryRow>('SELECT * FROM categories ORDER BY "order" ASC');
  // Map raw rows to typed Category objects
  return rows.map(row => ({
    ...row,
    isDefault: row.isDefault === 1,
    budget: row.budget ?? undefined,
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
  const values: BindValue[] = [];

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
  const params: (string | number)[] = [];

  // Apply pagination if limit is specified
  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
    if (offset) {
      query += ' OFFSET ?';
      params.push(offset);
    }
  }

  const rows = await database.getAllAsync<RawExpenseRow>(query, params);
  return rows.map(parseExpenseRow); // Parse each row into typed Expense
};

// Get expenses within a specific date range for reports and analytics
export const getExpensesByDateRange = async (startDate: string, endDate: string): Promise<Expense[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<RawExpenseRow>(
    'SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC',
    [startDate, endDate]
  );
  return rows.map(parseExpenseRow);
};

// Get expenses filtered by category name
export const getExpensesByCategory = async (category: string): Promise<Expense[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<RawExpenseRow>(
    'SELECT * FROM expenses WHERE category = ? ORDER BY date DESC',
    [category]
  );
  return rows.map(parseExpenseRow);
};

// Search expenses by matching notes, category, or tags
export const searchExpenses = async (query: string): Promise<Expense[]> => {
  const database = await getDatabase();
  const searchTerm = `%${query}%`; // Wildcard match for LIKE queries
  const rows = await database.getAllAsync<RawExpenseRow>(
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
  const existing = await database.getFirstAsync<RawExpenseRow>('SELECT * FROM expenses WHERE id = ?', [id]);
  if (!existing) return;

  const fields: string[] = ['updatedAt = ?'];
  const values: BindValue[] = [now];

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
  const existing = await database.getFirstAsync<RawExpenseRow>('SELECT * FROM expenses WHERE id = ?', [id]);
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
  const rows = await database.getAllAsync<{ id: string; amount: number; walletId: string | null }>(
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
  const row = await database.getFirstAsync<RawExpenseRow>('SELECT * FROM expenses WHERE id = ?', [id]);
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
  let row = await database.getFirstAsync<RawWalletRow>(
    'SELECT * FROM wallets WHERE isDefault = 1 LIMIT 1'
  );
  // Fall back to the first created wallet if no default is set
  if (!row) {
    row = await database.getFirstAsync<RawWalletRow>(
      'SELECT * FROM wallets ORDER BY createdAt ASC LIMIT 1'
    );
  }
  return row ? await parseWalletRow(row) : null;
};

// Get all wallets ordered by default first, then by name
export const getAllWallets = async (): Promise<Wallet[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<RawWalletRow>(
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
  const values: BindValue[] = [now];

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
  const values: BindValue[] = [];

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

// ==================== INCOME OPERATIONS ====================

// Retrieve all income records ordered by most recent first
export const getAllIncome = async (limit?: number, offset?: number): Promise<Income[]> => {
  const database = await getDatabase();
  let query = 'SELECT * FROM income ORDER BY date DESC, createdAt DESC';
  const params: (string | number)[] = [];
  // Apply pagination if limit is specified
  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
    if (offset) {
      query += ' OFFSET ?';
      params.push(offset);
    }
  }
  const rows = await database.getAllAsync<RawIncomeRow>(query, params);
  return rows.map(parseIncomeRow);
};

// Insert a new income record and credit the associated wallet balance
export const addIncome = async (income: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>): Promise<Income> => {
  const database = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO income (id, amount, source, date, notes, walletId, currency, isRecurring, recurringFrequency, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, income.amount, income.source, income.date, income.notes || null,
     income.walletId, income.currency, income.isRecurring ? 1 : 0,
     income.recurringFrequency || null, now, now]
  );
  // Credit income amount to the associated wallet
  if (income.walletId) {
    await database.runAsync(
      'UPDATE wallets SET currentBalance = currentBalance + ?, updatedAt = ? WHERE id = ?',
      [income.amount, now, income.walletId]
    );
  }
  return { id, ...income, createdAt: now, updatedAt: now };
};

// Update an existing income record and adjust wallet balance
export const updateIncome = async (id: string, updates: Partial<Income>): Promise<void> => {
  const database = await getDatabase();
  const now = new Date().toISOString();
  // Fetch existing income to calculate wallet balance difference
  const existing = await database.getFirstAsync<RawIncomeRow>('SELECT * FROM income WHERE id = ?', [id]);
  if (!existing) return;
  const fields: string[] = ['updatedAt = ?'];
  const values: BindValue[] = [now];
  if (updates.amount !== undefined) { fields.push('amount = ?'); values.push(updates.amount); }
  if (updates.source !== undefined) { fields.push('source = ?'); values.push(updates.source); }
  if (updates.date !== undefined) { fields.push('date = ?'); values.push(updates.date); }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
  if (updates.isRecurring !== undefined) { fields.push('isRecurring = ?'); values.push(updates.isRecurring ? 1 : 0); }
  if (updates.recurringFrequency !== undefined) { fields.push('recurringFrequency = ?'); values.push(updates.recurringFrequency); }
  values.push(id);
  await database.runAsync(`UPDATE income SET ${fields.join(', ')} WHERE id = ?`, values);
  // Adjust wallet balance if the amount changed
  if (updates.amount !== undefined && existing.walletId) {
    const diff = updates.amount - existing.amount;
    await database.runAsync(
      'UPDATE wallets SET currentBalance = currentBalance + ?, updatedAt = ? WHERE id = ?',
      [diff, now, existing.walletId]
    );
  }
};

// Delete an income record and reverse the wallet credit
export const deleteIncome = async (id: string): Promise<void> => {
  const database = await getDatabase();
  const existing = await database.getFirstAsync<RawIncomeRow>('SELECT * FROM income WHERE id = ?', [id]);
  if (!existing) return;
  await database.runAsync('DELETE FROM income WHERE id = ?', [id]);
  // Reverse the income credit from the wallet
  if (existing.walletId) {
    const now = new Date().toISOString();
    await database.runAsync(
      'UPDATE wallets SET currentBalance = currentBalance - ?, updatedAt = ? WHERE id = ?',
      [existing.amount, now, existing.walletId]
    );
  }
};

// Get a single income record by ID
export const getIncomeById = async (id: string): Promise<Income | null> => {
  const database = await getDatabase();
  const row = await database.getFirstAsync<RawIncomeRow>('SELECT * FROM income WHERE id = ?', [id]);
  return row ? parseIncomeRow(row) : null;
};

// ==================== TRANSFER OPERATIONS ====================

// Retrieve all transfer records ordered by most recent first
export const getAllTransfers = async (limit?: number): Promise<Transfer[]> => {
  const database = await getDatabase();
  let query = 'SELECT * FROM transfers ORDER BY date DESC, createdAt DESC';
  const params: (string | number)[] = [];
  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
  }
  return database.getAllAsync<Transfer>(query, params);
};

// Create a wallet-to-wallet transfer: debit source, credit destination
export const addTransfer = async (transfer: Omit<Transfer, 'id' | 'createdAt'>): Promise<Transfer> => {
  const database = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO transfers (id, amount, fromWalletId, toWalletId, date, notes, currency, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, transfer.amount, transfer.fromWalletId, transfer.toWalletId,
     transfer.date, transfer.notes || null, transfer.currency, now]
  );
  // Debit source wallet
  await database.runAsync(
    'UPDATE wallets SET currentBalance = currentBalance - ?, updatedAt = ? WHERE id = ?',
    [transfer.amount, now, transfer.fromWalletId]
  );
  // Credit destination wallet
  await database.runAsync(
    'UPDATE wallets SET currentBalance = currentBalance + ?, updatedAt = ? WHERE id = ?',
    [transfer.amount, now, transfer.toWalletId]
  );
  return { id, ...transfer, createdAt: now };
};

// Delete a transfer and reverse the wallet adjustments
export const deleteTransfer = async (id: string): Promise<void> => {
  const database = await getDatabase();
  const existing = await database.getFirstAsync<Transfer>('SELECT * FROM transfers WHERE id = ?', [id]);
  if (!existing) return;
  await database.runAsync('DELETE FROM transfers WHERE id = ?', [id]);
  const now = new Date().toISOString();
  // Reverse: credit back to source wallet
  await database.runAsync(
    'UPDATE wallets SET currentBalance = currentBalance + ?, updatedAt = ? WHERE id = ?',
    [existing.amount, now, existing.fromWalletId]
  );
  // Reverse: debit back from destination wallet
  await database.runAsync(
    'UPDATE wallets SET currentBalance = currentBalance - ?, updatedAt = ? WHERE id = ?',
    [existing.amount, now, existing.toWalletId]
  );
};

// ==================== ANALYTICS QUERIES ====================

// Get total income for a date range
export const getTotalIncome = async (startDate: string, endDate: string): Promise<number> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE date >= ? AND date <= ?',
    [startDate, endDate]
  );
  return result?.total || 0;
};

// Get income grouped by source for a date range
export const getIncomeBySource = async (startDate: string, endDate: string): Promise<{ source: string; total: number; count: number }[]> => {
  const database = await getDatabase();
  return database.getAllAsync<{ source: string; total: number; count: number }>(
    `SELECT source, SUM(amount) as total, COUNT(*) as count
     FROM income WHERE date >= ? AND date <= ?
     GROUP BY source ORDER BY total DESC`,
    [startDate, endDate]
  );
};

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

// Get category spending grouped by week number for stacked bar charts
export const getCategoryTotalsByWeek = async (startDate: string, endDate: string): Promise<{ week: string; category: string; total: number }[]> => {
  const database = await getDatabase();
  return database.getAllAsync<{ week: string; category: string; total: number }>(
    `SELECT strftime('%Y-W%W', date) as week, category, SUM(amount) as total
     FROM expenses WHERE date >= ? AND date <= ?
     GROUP BY week, category ORDER BY week ASC, total DESC`,
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
export const exportAllData = async (): Promise<{ expenses: Expense[]; categories: Category[]; wallets: Wallet[]; budgets: Budget[]; income: Income[]; transfers: Transfer[]; savingsGoals: SavingsGoal[]; templates: ExpenseTemplate[] }> => {
  const database = await getDatabase();
  const expenses = (await database.getAllAsync<RawExpenseRow>('SELECT * FROM expenses ORDER BY date DESC')).map(parseExpenseRow);
  const categories = await database.getAllAsync<RawCategoryRow>('SELECT * FROM categories ORDER BY "order" ASC');
  const walletRows = await database.getAllAsync<RawWalletRow>('SELECT * FROM wallets ORDER BY isDefault DESC, name ASC');
  const wallets: Wallet[] = [];
  for (const row of walletRows) {
    wallets.push(await parseWalletRow(row));
  }
  const budgets = await database.getAllAsync<Budget>('SELECT * FROM budgets');
  const income = (await database.getAllAsync<RawIncomeRow>('SELECT * FROM income ORDER BY date DESC')).map(parseIncomeRow);
  const transfers = await database.getAllAsync<Transfer>('SELECT * FROM transfers ORDER BY date DESC');
  const savingsGoals = await database.getAllAsync<SavingsGoal>('SELECT * FROM savings_goals ORDER BY createdAt DESC');
  const templates = await database.getAllAsync<ExpenseTemplate>('SELECT * FROM expense_templates ORDER BY usageCount DESC');
  return { expenses, categories: categories.map((c: RawCategoryRow) => ({ ...c, isDefault: c.isDefault === 1, budget: c.budget ?? undefined })), wallets, budgets, income, transfers, savingsGoals, templates };
};

// ==================== DATABASE RESET FUNCTIONS ====================

// Clear all row data from transactional tables but preserve table structure and categories
// Useful for "start fresh" without losing categories or app structure
export const clearAllData = async (): Promise<void> => {
  const database = await getDatabase();
  // Delete all rows from data tables in dependency order (children first)
  await database.execAsync(`
    DELETE FROM receipts;
    DELETE FROM expenses;
    DELETE FROM budgets;
    DELETE FROM income;
    DELETE FROM transfers;
    DELETE FROM wallets;
    DELETE FROM savings_goals;
    DELETE FROM expense_templates;
    DELETE FROM badges;
    DELETE FROM user_streaks;
  `);
  // Re-seed streak row after clear
  await database.runAsync('INSERT OR IGNORE INTO user_streaks (id, currentStreak, longestStreak, totalDaysActive) VALUES (1, 0, 0, 0)');
};

// Drop all tables and reinitialize the database from scratch
// This is a full factory reset — all data including categories is lost
export const resetDatabase = async (): Promise<void> => {
  const database = await getDatabase();
  // Drop every table in reverse-dependency order
  await database.execAsync(`
    DROP TABLE IF EXISTS receipts;
    DROP TABLE IF EXISTS badges;
    DROP TABLE IF EXISTS user_streaks;
    DROP TABLE IF EXISTS expense_templates;
    DROP TABLE IF EXISTS savings_goals;
    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS budgets;
    DROP TABLE IF EXISTS income;
    DROP TABLE IF EXISTS transfers;
    DROP TABLE IF EXISTS wallets;
    DROP TABLE IF EXISTS categories;
  `);
  // Recreate all tables and re-seed default categories
  await initializeDatabase(database);
};

// ==================== HELPER FUNCTIONS ====================

// Convert a raw database row to a typed Wallet object with decrypted fields
const parseWalletRow = async (row: RawWalletRow): Promise<Wallet> => ({
  ...row,
  type: row.type as Wallet['type'],
  bankName: row.bankName ?? undefined,
  nickname: row.nickname ?? undefined,
  isDefault: row.isDefault === 1,
  metadata: row.metadata ? await decryptData(row.metadata) : undefined,
});

// Convert a raw database row to a typed Expense object
const parseExpenseRow = (row: RawExpenseRow): Expense => ({
  ...row,
  subcategory: row.subcategory ?? undefined,
  notes: row.notes ?? undefined,
  tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [], // Parse JSON tags string
  isRecurring: row.isRecurring === 1, // Convert SQLite integer to boolean
  recurringFrequency: (row.recurringFrequency ?? undefined) as Expense['recurringFrequency'],
  recurringEndDate: row.recurringEndDate ?? undefined,
  walletId: row.walletId ?? '',
});

// Convert a raw database row to a typed Income object
const parseIncomeRow = (row: RawIncomeRow): Income => ({
  ...row,
  notes: row.notes ?? undefined,
  isRecurring: row.isRecurring === 1, // Convert SQLite integer to boolean
  recurringFrequency: (row.recurringFrequency ?? undefined) as Income['recurringFrequency'],
});

// ==================== RECEIPT OPERATIONS ====================

// Fetch all receipts for a specific expense
export const getReceiptsByExpense = async (expenseId: string): Promise<Receipt[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Receipt>(
    'SELECT * FROM receipts WHERE expenseId = ? ORDER BY createdAt DESC', [expenseId]
  );
  return rows;
};

// Add a new receipt attachment to an expense
export const addReceipt = async (receipt: Omit<Receipt, 'id' | 'createdAt'>): Promise<Receipt> => {
  const database = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO receipts (id, expenseId, uri, thumbnailUri, createdAt) VALUES (?, ?, ?, ?, ?)',
    [id, receipt.expenseId, receipt.uri, receipt.thumbnailUri || null, now]
  );
  return { id, ...receipt, createdAt: now };
};

// Delete a receipt attachment by ID
export const deleteReceipt = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM receipts WHERE id = ?', [id]);
};

// Delete all receipts for a given expense
export const deleteReceiptsByExpense = async (expenseId: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM receipts WHERE expenseId = ?', [expenseId]);
};

// ==================== SAVINGS GOAL OPERATIONS ====================

// Fetch all savings goals ordered by deadline
export const getAllSavingsGoals = async (): Promise<SavingsGoal[]> => {
  const database = await getDatabase();
  return database.getAllAsync<SavingsGoal>('SELECT * FROM savings_goals ORDER BY deadline ASC, createdAt DESC');
};

// Create a new savings goal
export const addSavingsGoal = async (goal: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavingsGoal> => {
  const database = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO savings_goals (id, name, targetAmount, currentAmount, deadline, icon, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, goal.name, goal.targetAmount, goal.currentAmount || 0, goal.deadline || null, goal.icon, goal.color, now, now]
  );
  return { id, ...goal, currentAmount: goal.currentAmount || 0, createdAt: now, updatedAt: now };
};

// Update an existing savings goal
export const updateSavingsGoal = async (id: string, updates: Partial<SavingsGoal>): Promise<void> => {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: BindValue[] = [];
  // Build dynamic SET clause from provided updates
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.targetAmount !== undefined) { fields.push('targetAmount = ?'); values.push(updates.targetAmount); }
  if (updates.currentAmount !== undefined) { fields.push('currentAmount = ?'); values.push(updates.currentAmount); }
  if (updates.deadline !== undefined) { fields.push('deadline = ?'); values.push(updates.deadline); }
  if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }
  if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
  fields.push('updatedAt = ?'); values.push(now);
  values.push(id);
  await database.runAsync(`UPDATE savings_goals SET ${fields.join(', ')} WHERE id = ?`, values);
};

// Delete a savings goal by ID
export const deleteSavingsGoal = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM savings_goals WHERE id = ?', [id]);
};

// ==================== EXPENSE TEMPLATE OPERATIONS ====================

// Fetch all templates sorted by most used first
export const getAllExpenseTemplates = async (): Promise<ExpenseTemplate[]> => {
  const database = await getDatabase();
  return database.getAllAsync<ExpenseTemplate>('SELECT * FROM expense_templates ORDER BY usageCount DESC, createdAt DESC');
};

// Create a new expense template
export const addExpenseTemplate = async (template: Omit<ExpenseTemplate, 'id' | 'usageCount' | 'createdAt'>): Promise<ExpenseTemplate> => {
  const database = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO expense_templates (id, name, amount, category, notes, walletId, icon, color, usageCount, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
    [id, template.name, template.amount, template.category, template.notes || null, template.walletId || null, template.icon, template.color, now]
  );
  return { id, ...template, usageCount: 0, createdAt: now };
};

// Increment usage count when a template is used to create an expense
export const incrementTemplateUsage = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('UPDATE expense_templates SET usageCount = usageCount + 1 WHERE id = ?', [id]);
};

// Delete an expense template by ID
export const deleteExpenseTemplate = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM expense_templates WHERE id = ?', [id]);
};

// ==================== STREAK & GAMIFICATION OPERATIONS ====================

// Get the current user streak data
export const getUserStreak = async (): Promise<{ currentStreak: number; longestStreak: number; lastActiveDate: string | null; totalDaysActive: number }> => {
  const database = await getDatabase();
  const row = await database.getFirstAsync<RawUserStreakRow>('SELECT * FROM user_streaks WHERE id = 1');
  return {
    currentStreak: row?.currentStreak || 0,
    longestStreak: row?.longestStreak || 0,
    lastActiveDate: row?.lastActiveDate || null,
    totalDaysActive: row?.totalDaysActive || 0,
  };
};

// Update the user streak after logging activity (expense or income)
export const updateUserStreak = async (today: string): Promise<{ currentStreak: number; longestStreak: number; totalDaysActive: number }> => {
  const database = await getDatabase();
  const row = await database.getFirstAsync<RawUserStreakRow>('SELECT * FROM user_streaks WHERE id = 1');
  let current = row?.currentStreak || 0;
  let longest = row?.longestStreak || 0;
  let totalDays = row?.totalDaysActive || 0;
  const lastDate = row?.lastActiveDate;

  if (lastDate === today) {
    // Already logged today — no streak change needed
    return { currentStreak: current, longestStreak: longest, totalDaysActive: totalDays };
  }

  // Check if yesterday was the last active day for streak continuity
  const yesterdayDate = new Date(today);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];

  if (lastDate === yesterday) {
    current += 1; // Consecutive day — extend streak
  } else {
    current = 1; // Streak broken — restart at 1
  }
  if (current > longest) longest = current; // Update longest streak record
  totalDays += 1; // Increment total active days

  await database.runAsync(
    'UPDATE user_streaks SET currentStreak = ?, longestStreak = ?, lastActiveDate = ?, totalDaysActive = ? WHERE id = 1',
    [current, longest, today, totalDays]
  );
  return { currentStreak: current, longestStreak: longest, totalDaysActive: totalDays };
};

// Get all earned badges
export const getAllBadges = async (): Promise<{ id: string; name: string; description: string; icon: string; earnedAt: string | null }[]> => {
  const database = await getDatabase();
  return database.getAllAsync('SELECT * FROM badges ORDER BY earnedAt DESC');
};

// Award a badge if not already earned
export const awardBadge = async (badge: { id: string; name: string; description: string; icon: string }): Promise<boolean> => {
  const database = await getDatabase();
  const exists = await database.getFirstAsync<{ id: string }>('SELECT id FROM badges WHERE id = ?', [badge.id]);
  if (exists) return false; // Badge already earned
  const now = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO badges (id, name, description, icon, earnedAt) VALUES (?, ?, ?, ?, ?)',
    [badge.id, badge.name, badge.description, badge.icon, now]
  );
  return true; // Newly awarded
};

// ==================== CALENDAR / DAILY EXPENSE MAP ====================

// Get daily expense totals for a full month (for heatmap display)
export const getDailyExpenseTotals = async (year: number, month: number): Promise<{ date: string; total: number }[]> => {
  const database = await getDatabase();
  // Build date range for the given month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
  return database.getAllAsync<{ date: string; total: number }>(
    'SELECT date, SUM(amount) as total FROM expenses WHERE date >= ? AND date < ? GROUP BY date ORDER BY date',
    [startDate, endDate]
  );
};

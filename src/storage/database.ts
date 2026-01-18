/**
 * Database Manager
 * SQLite database operations with migrations
 */

import { Database } from 'bun:sqlite';
import type {
  DatabaseConfig,
  DatabaseStats,
  QueryOptions,
  QueryFilter,
  BatchResult,
  Migration,
  StorageManager,
} from './types';

/** Default database configuration */
export const DEFAULT_DB_CONFIG: DatabaseConfig = {
  path: ':memory:',
  walMode: true,
  busyTimeout: 5000,
  foreignKeys: true,
  autoMigrate: true,
};

/** Database migrations */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      -- Market data table
      CREATE TABLE IF NOT EXISTS market_data (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL,
        source TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
      CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_market_data_symbol_timestamp ON market_data(symbol, timestamp);

      -- Factor data table
      CREATE TABLE IF NOT EXISTS factor_data (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        value REAL NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_factor_data_symbol ON factor_data(symbol);
      CREATE INDEX IF NOT EXISTS idx_factor_data_category ON factor_data(category);

      -- Backtest results table
      CREATE TABLE IF NOT EXISTS backtest_results (
        id TEXT PRIMARY KEY,
        strategy_id TEXT NOT NULL,
        strategy_name TEXT NOT NULL,
        start_date INTEGER NOT NULL,
        end_date INTEGER NOT NULL,
        initial_capital REAL NOT NULL,
        final_value REAL NOT NULL,
        total_return REAL NOT NULL,
        sharpe_ratio REAL,
        max_drawdown REAL,
        total_trades INTEGER NOT NULL,
        win_rate REAL,
        config TEXT NOT NULL,
        metrics TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_results(strategy_id);

      -- Portfolios table
      CREATE TABLE IF NOT EXISTS portfolios (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cash REAL NOT NULL,
        total_value REAL NOT NULL,
        positions TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Trades table
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        portfolio_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        commission REAL NOT NULL,
        slippage REAL NOT NULL,
        pnl REAL,
        pnl_percent REAL,
        holding_period_days INTEGER,
        signal_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
      );
      CREATE INDEX IF NOT EXISTS idx_trades_portfolio ON trades(portfolio_id);
      CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);

      -- Signals table
      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        action TEXT NOT NULL,
        strength REAL NOT NULL,
        confidence REAL NOT NULL,
        strategy_id TEXT NOT NULL,
        strategy_name TEXT NOT NULL,
        factors TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
      CREATE INDEX IF NOT EXISTS idx_signals_expires ON signals(expires_at);

      -- Migrations tracking table
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `,
    down: `
      DROP TABLE IF EXISTS signals;
      DROP TABLE IF EXISTS trades;
      DROP TABLE IF EXISTS portfolios;
      DROP TABLE IF EXISTS backtest_results;
      DROP TABLE IF EXISTS factor_data;
      DROP TABLE IF EXISTS market_data;
      DROP TABLE IF EXISTS _migrations;
    `,
  },
];

/**
 * Database Manager
 * Handles SQLite database operations
 */
export class DatabaseManager implements StorageManager {
  private db: Database | null = null;
  private config: DatabaseConfig;
  private initialized = false;

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = { ...DEFAULT_DB_CONFIG, ...config };
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.db = new Database(this.config.path);

    // Configure database
    if (this.config.walMode) {
      this.db.run('PRAGMA journal_mode = WAL');
    }
    if (this.config.busyTimeout) {
      this.db.run(`PRAGMA busy_timeout = ${this.config.busyTimeout}`);
    }
    if (this.config.foreignKeys) {
      this.db.run('PRAGMA foreign_keys = ON');
    }

    // Run migrations if enabled
    if (this.config.autoMigrate) {
      await this.runMigrations();
    }

    this.initialized = true;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * Check if database is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.db) return false;
      this.db.query('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Get current version
    let currentVersion = 0;
    try {
      const result = this.db
        .query<{ version: number }, []>(
          'SELECT MAX(version) as version FROM _migrations'
        )
        .get();
      currentVersion = result?.version ?? 0;
    } catch {
      // Table doesn't exist yet, will be created in first migration
    }

    // Run pending migrations
    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        this.db.run(migration.up);
        this.db.run(
          'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
          [migration.version, migration.name, Date.now()]
        );
      }
    }
  }

  /**
   * Insert a record
   */
  insert<T extends Record<string, unknown>>(
    table: string,
    record: T
  ): string {
    if (!this.db) throw new Error('Database not initialized');

    const id = record.id as string ?? this.generateId();
    const now = Date.now();
    const data = {
      ...record,
      id,
      created_at: now,
      updated_at: now,
    };

    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((col) => this.serializeValue(data[col]));

    const columnsSnake = columns.map((c) => this.toSnakeCase(c));
    const sql = `INSERT INTO ${table} (${columnsSnake.join(', ')}) VALUES (${placeholders})`;

    this.db.run(sql, values);
    return id;
  }

  /**
   * Update a record
   */
  update<T extends Record<string, unknown>>(
    table: string,
    id: string,
    updates: Partial<T>
  ): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const data = { ...updates, updated_at: Date.now() };
    const columns = Object.keys(data);
    const setClause = columns
      .map((c) => `${this.toSnakeCase(c)} = ?`)
      .join(', ');
    const values = columns.map((col) => this.serializeValue(data[col]));

    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    const result = this.db.run(sql, [...values, id]);

    return result.changes > 0;
  }

  /**
   * Delete a record
   */
  delete(table: string, id: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return result.changes > 0;
  }

  /**
   * Find a record by ID
   */
  findById<T>(table: string, id: string): T | null {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db
      .query(`SELECT * FROM ${table} WHERE id = ?`)
      .get(id) as Record<string, unknown> | null;

    if (!result) return null;
    return this.deserializeRow<T>(result);
  }

  /**
   * Find records with filters
   */
  find<T>(
    table: string,
    filters: QueryFilter[] = [],
    options: QueryOptions = {}
  ): T[] {
    if (!this.db) throw new Error('Database not initialized');

    let sql = `SELECT * FROM ${table}`;
    const values: unknown[] = [];

    // Build WHERE clause
    if (filters.length > 0) {
      const conditions = filters.map((f) => {
        const column = this.toSnakeCase(f.field);
        if (f.operator === 'in') {
          const vals = f.value as unknown[];
          const placeholders = vals.map(() => '?').join(', ');
          values.push(...vals);
          return `${column} IN (${placeholders})`;
        }
        values.push(f.value);
        return `${column} ${f.operator} ?`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ORDER BY
    if (options.orderBy) {
      const direction = options.order?.toUpperCase() ?? 'ASC';
      sql += ` ORDER BY ${this.toSnakeCase(options.orderBy)} ${direction}`;
    }

    // Add LIMIT and OFFSET
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    const results = this.db.query(sql).all(...values) as Record<
      string,
      unknown
    >[];
    return results.map((row) => this.deserializeRow<T>(row));
  }

  /**
   * Count records
   */
  count(table: string, filters: QueryFilter[] = []): number {
    if (!this.db) throw new Error('Database not initialized');

    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const values: unknown[] = [];

    if (filters.length > 0) {
      const conditions = filters.map((f) => {
        values.push(f.value);
        return `${this.toSnakeCase(f.field)} ${f.operator} ?`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = this.db.query<{ count: number }, unknown[]>(sql).get(...values);
    return result?.count ?? 0;
  }

  /**
   * Execute raw SQL
   */
  execute(sql: string, params: unknown[] = []): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql, params);
  }

  /**
   * Query raw SQL
   */
  query<T>(sql: string, params: unknown[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    const results = this.db.query(sql).all(...params) as Record<
      string,
      unknown
    >[];
    return results.map((row) => this.deserializeRow<T>(row));
  }

  /**
   * Run in transaction
   */
  transaction<T>(fn: () => T): T {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.transaction(fn)();
  }

  /**
   * Batch insert
   */
  batchInsert<T extends Record<string, unknown>>(
    table: string,
    records: T[]
  ): BatchResult {
    if (!this.db) throw new Error('Database not initialized');

    const result: BatchResult = { success: 0, failed: 0, errors: [] };

    this.transaction(() => {
      for (const record of records) {
        try {
          this.insert(table, record);
          result.success++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            id: record.id as string ?? 'unknown',
            error: (error as Error).message,
          });
        }
      }
    });

    return result;
  }

  /**
   * Get database statistics
   */
  getStats(): DatabaseStats {
    if (!this.db) throw new Error('Database not initialized');

    const tables = new Map<string, number>();
    let totalRecords = 0;

    // Get table counts
    const tableNames = [
      'market_data',
      'factor_data',
      'backtest_results',
      'portfolios',
      'trades',
      'signals',
    ];

    for (const tableName of tableNames) {
      try {
        const count = this.count(tableName);
        tables.set(tableName, count);
        totalRecords += count;
      } catch {
        // Table might not exist
      }
    }

    // Get database size
    const pageCount = this.db
      .query<{ page_count: number }, []>('PRAGMA page_count')
      .get()?.page_count ?? 0;
    const pageSize = this.db
      .query<{ page_size: number }, []>('PRAGMA page_size')
      .get()?.page_size ?? 4096;
    const sizeBytes = pageCount * pageSize;

    return { tables, totalRecords, sizeBytes };
  }

  /**
   * Optimize database
   */
  optimize(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('VACUUM');
    this.db.run('ANALYZE');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert snake_case to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Serialize value for storage
   */
  private serializeValue(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  /**
   * Deserialize row from database
   */
  private deserializeRow<T>(row: Record<string, unknown>): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      const camelKey = this.toCamelCase(key);

      // Try to parse JSON for object fields
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          result[camelKey] = JSON.parse(value);
        } catch {
          result[camelKey] = value;
        }
      } else {
        result[camelKey] = value;
      }
    }

    return result as T;
  }
}

/**
 * Create database manager instance
 */
export function createDatabaseManager(
  config: Partial<DatabaseConfig> = {}
): DatabaseManager {
  return new DatabaseManager(config);
}

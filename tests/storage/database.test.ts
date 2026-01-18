/**
 * Database Manager Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { DatabaseManager, createDatabaseManager } from '../../src/storage/database';

describe('DatabaseManager', () => {
  let db: DatabaseManager;

  beforeEach(async () => {
    db = createDatabaseManager({ path: ':memory:' });
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('initialization', () => {
    test('should initialize database', async () => {
      const healthy = await db.isHealthy();
      expect(healthy).toBe(true);
    });

    test('should run migrations', async () => {
      const stats = db.getStats();
      expect(stats.tables.has('market_data')).toBe(true);
      expect(stats.tables.has('portfolios')).toBe(true);
      expect(stats.tables.has('trades')).toBe(true);
    });

    test('should not re-initialize', async () => {
      // Second initialize should be a no-op
      await db.initialize();
      const healthy = await db.isHealthy();
      expect(healthy).toBe(true);
    });
  });

  describe('CRUD operations', () => {
    test('should insert record', () => {
      const id = db.insert('portfolios', {
        name: 'Test Portfolio',
        cash: 100000,
        totalValue: 100000,
        positions: [],
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    test('should find record by id', () => {
      const id = db.insert('portfolios', {
        name: 'Test Portfolio',
        cash: 100000,
        totalValue: 100000,
        positions: [],
      });

      const record = db.findById<{ name: string }>('portfolios', id);

      expect(record).not.toBeNull();
      expect(record!.name).toBe('Test Portfolio');
    });

    test('should update record', () => {
      const id = db.insert('portfolios', {
        name: 'Old Name',
        cash: 100000,
        totalValue: 100000,
        positions: [],
      });

      const success = db.update('portfolios', id, { name: 'New Name' });

      expect(success).toBe(true);

      const record = db.findById<{ name: string }>('portfolios', id);
      expect(record!.name).toBe('New Name');
    });

    test('should delete record', () => {
      const id = db.insert('portfolios', {
        name: 'To Delete',
        cash: 0,
        totalValue: 0,
        positions: [],
      });

      const success = db.delete('portfolios', id);
      expect(success).toBe(true);

      const record = db.findById('portfolios', id);
      expect(record).toBeNull();
    });

    test('should return false for non-existent update', () => {
      const success = db.update('portfolios', 'non-existent', { name: 'X' });
      expect(success).toBe(false);
    });

    test('should return false for non-existent delete', () => {
      const success = db.delete('portfolios', 'non-existent');
      expect(success).toBe(false);
    });
  });

  describe('find with filters', () => {
    beforeEach(() => {
      db.insert('market_data', {
        symbol: 'AAPL',
        timestamp: 1000,
        open: 150,
        high: 155,
        low: 145,
        close: 152,
        volume: 1000000,
        source: 'test',
      });
      db.insert('market_data', {
        symbol: 'GOOGL',
        timestamp: 1000,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 500000,
        source: 'test',
      });
      db.insert('market_data', {
        symbol: 'AAPL',
        timestamp: 2000,
        open: 152,
        high: 160,
        low: 150,
        close: 158,
        volume: 1200000,
        source: 'test',
      });
    });

    test('should filter by equality', () => {
      const results = db.find('market_data', [
        { field: 'symbol', operator: '=', value: 'AAPL' },
      ]);

      expect(results.length).toBe(2);
    });

    test('should filter by comparison', () => {
      const results = db.find('market_data', [
        { field: 'timestamp', operator: '>', value: 1500 },
      ]);

      expect(results.length).toBe(1);
    });

    test('should combine multiple filters', () => {
      const results = db.find('market_data', [
        { field: 'symbol', operator: '=', value: 'AAPL' },
        { field: 'timestamp', operator: '>=', value: 2000 },
      ]);

      expect(results.length).toBe(1);
    });

    test('should order results', () => {
      const results = db.find<{ timestamp: number }>(
        'market_data',
        [{ field: 'symbol', operator: '=', value: 'AAPL' }],
        { orderBy: 'timestamp', order: 'desc' }
      );

      expect(results[0].timestamp).toBe(2000);
      expect(results[1].timestamp).toBe(1000);
    });

    test('should limit results', () => {
      const results = db.find(
        'market_data',
        [],
        { limit: 1 }
      );

      expect(results.length).toBe(1);
    });

    test('should offset results', () => {
      const results = db.find<{ symbol: string }>(
        'market_data',
        [],
        { orderBy: 'timestamp', order: 'asc', offset: 1, limit: 1 }
      );

      expect(results.length).toBe(1);
    });
  });

  describe('count', () => {
    beforeEach(() => {
      // Create portfolio first (trades have foreign key)
      db.insert('portfolios', {
        id: 'p1',
        name: 'Test Portfolio',
        cash: 100000,
        totalValue: 100000,
        positions: [],
      });
      db.insert('trades', {
        portfolioId: 'p1',
        symbol: 'AAPL',
        side: 'buy',
        quantity: 100,
        price: 150,
        commission: 1,
        slippage: 0.5,
      });
      db.insert('trades', {
        portfolioId: 'p1',
        symbol: 'GOOGL',
        side: 'buy',
        quantity: 50,
        price: 100,
        commission: 0.5,
        slippage: 0.25,
      });
    });

    test('should count all records', () => {
      const count = db.count('trades');
      expect(count).toBe(2);
    });

    test('should count with filter', () => {
      const count = db.count('trades', [
        { field: 'symbol', operator: '=', value: 'AAPL' },
      ]);
      expect(count).toBe(1);
    });
  });

  describe('batch operations', () => {
    test('should batch insert', () => {
      const records = [
        { symbol: 'AAPL', timestamp: 1, open: 1, high: 1, low: 1, close: 1, volume: 1, source: 'test' },
        { symbol: 'GOOGL', timestamp: 2, open: 2, high: 2, low: 2, close: 2, volume: 2, source: 'test' },
        { symbol: 'MSFT', timestamp: 3, open: 3, high: 3, low: 3, close: 3, volume: 3, source: 'test' },
      ];

      const result = db.batchInsert('market_data', records);

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(db.count('market_data')).toBe(3);
    });
  });

  describe('transactions', () => {
    test('should execute in transaction', () => {
      const result = db.transaction(() => {
        db.insert('portfolios', { name: 'P1', cash: 100, totalValue: 100, positions: [] });
        db.insert('portfolios', { name: 'P2', cash: 200, totalValue: 200, positions: [] });
        return db.count('portfolios');
      });

      expect(result).toBe(2);
    });
  });

  describe('raw queries', () => {
    test('should execute raw SQL', () => {
      db.execute(
        'INSERT INTO portfolios (id, name, cash, total_value, positions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['test-id', 'Raw', 1000, 1000, '[]', Date.now(), Date.now()]
      );

      const record = db.findById<{ name: string }>('portfolios', 'test-id');
      expect(record!.name).toBe('Raw');
    });

    test('should query raw SQL', () => {
      db.insert('portfolios', { name: 'P1', cash: 100, totalValue: 100, positions: [] });
      db.insert('portfolios', { name: 'P2', cash: 200, totalValue: 200, positions: [] });

      const results = db.query<{ total: number }>(
        'SELECT SUM(cash) as total FROM portfolios'
      );

      expect(results[0].total).toBe(300);
    });
  });

  describe('statistics', () => {
    test('should return database stats', () => {
      // Create portfolio with known ID first
      const portfolioId = db.insert('portfolios', { name: 'P1', cash: 100, totalValue: 100, positions: [] });
      db.insert('trades', {
        portfolioId,
        symbol: 'AAPL',
        side: 'buy',
        quantity: 100,
        price: 150,
        commission: 1,
        slippage: 0.5,
      });

      const stats = db.getStats();

      expect(stats.tables.get('portfolios')).toBe(1);
      expect(stats.tables.get('trades')).toBe(1);
      expect(stats.totalRecords).toBe(2);
      expect(stats.sizeBytes).toBeGreaterThan(0);
    });
  });

  describe('JSON serialization', () => {
    test('should serialize objects', () => {
      const id = db.insert('portfolios', {
        name: 'With Positions',
        cash: 100000,
        totalValue: 150000,
        positions: [
          { symbol: 'AAPL', quantity: 100, avgCost: 150 },
          { symbol: 'GOOGL', quantity: 50, avgCost: 100 },
        ],
        metadata: { strategy: 'momentum', risk: 'medium' },
      });

      const record = db.findById<{
        positions: Array<{ symbol: string }>;
        metadata: { strategy: string };
      }>('portfolios', id);

      expect(record!.positions).toHaveLength(2);
      expect(record!.positions[0].symbol).toBe('AAPL');
      expect(record!.metadata.strategy).toBe('momentum');
    });
  });

  describe('close', () => {
    test('should close database', async () => {
      await db.close();

      const healthy = await db.isHealthy();
      expect(healthy).toBe(false);
    });
  });
});

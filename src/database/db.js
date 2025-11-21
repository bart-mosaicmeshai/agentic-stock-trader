import Database from 'better-sqlite3';
import { createTables } from './schema.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseService {
  constructor(dbPath = null) {
    const defaultPath = path.join(process.cwd(), 'data', 'trading.db');
    this.dbPath = dbPath || defaultPath;
    this.db = null;
  }

  initialize() {
    // Ensure data directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    createTables(this.db);

    // Initialize cash balance if not exists
    this.initializeCashBalance();

    console.log(`✓ Database connected: ${this.dbPath}`);
  }

  initializeCashBalance() {
    const initialCapital = parseFloat(process.env.INITIAL_CAPITAL || '100000');
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO cash_balance (id, balance, updated_at)
      VALUES (1, ?, datetime('now'))
    `);
    stmt.run(initialCapital);
  }

  // Cash balance operations
  getCashBalance() {
    const stmt = this.db.prepare('SELECT balance FROM cash_balance WHERE id = 1');
    const result = stmt.get();
    return result ? result.balance : 0;
  }

  updateCashBalance(newBalance) {
    const stmt = this.db.prepare(`
      UPDATE cash_balance
      SET balance = ?, updated_at = datetime('now')
      WHERE id = 1
    `);
    stmt.run(newBalance);
  }

  // Portfolio operations
  getPortfolio() {
    const stmt = this.db.prepare('SELECT * FROM portfolio ORDER BY symbol');
    return stmt.all();
  }

  getPosition(symbol) {
    const stmt = this.db.prepare('SELECT * FROM portfolio WHERE symbol = ?');
    return stmt.get(symbol);
  }

  updatePosition(symbol, quantity, averageCost, currentPrice = null) {
    const stmt = this.db.prepare(`
      INSERT INTO portfolio (symbol, quantity, average_cost, current_price, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(symbol) DO UPDATE SET
        quantity = ?,
        average_cost = ?,
        current_price = ?,
        updated_at = datetime('now')
    `);
    stmt.run(symbol, quantity, averageCost, currentPrice, quantity, averageCost, currentPrice);
  }

  removePosition(symbol) {
    const stmt = this.db.prepare('DELETE FROM portfolio WHERE symbol = ?');
    stmt.run(symbol);
  }

  // Trade operations
  recordTrade(tradeDate, symbol, action, quantity, price, reasoning = null) {
    const totalValue = quantity * price;
    const stmt = this.db.prepare(`
      INSERT INTO trades (trade_date, symbol, action, quantity, price, total_value, reasoning, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const result = stmt.run(tradeDate, symbol, action, quantity, price, totalValue, reasoning);
    return result.lastInsertRowid;
  }

  getTrades(startDate = null, endDate = null) {
    let query = 'SELECT * FROM trades';
    const params = [];

    if (startDate && endDate) {
      query += ' WHERE trade_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ' WHERE trade_date >= ?';
      params.push(startDate);
    }

    query += ' ORDER BY trade_date DESC, created_at DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  // Daily snapshot operations
  recordDailySnapshot(snapshotDate, cashBalance, holdingsValue, previousValue = null) {
    const totalValue = cashBalance + holdingsValue;
    let dailyReturn = null;
    let cumulativeReturn = null;

    if (previousValue && previousValue > 0) {
      dailyReturn = ((totalValue - previousValue) / previousValue) * 100;
    }

    const initialCapital = parseFloat(process.env.INITIAL_CAPITAL || '100000');
    cumulativeReturn = ((totalValue - initialCapital) / initialCapital) * 100;

    const stmt = this.db.prepare(`
      INSERT INTO daily_snapshots (snapshot_date, cash_balance, holdings_value, total_value, daily_return, cumulative_return, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(snapshot_date) DO UPDATE SET
        cash_balance = ?,
        holdings_value = ?,
        total_value = ?,
        daily_return = ?,
        cumulative_return = ?,
        created_at = datetime('now')
    `);
    stmt.run(
      snapshotDate, cashBalance, holdingsValue, totalValue, dailyReturn, cumulativeReturn,
      cashBalance, holdingsValue, totalValue, dailyReturn, cumulativeReturn
    );
  }

  getSnapshots(startDate = null, endDate = null) {
    let query = 'SELECT * FROM daily_snapshots';
    const params = [];

    if (startDate && endDate) {
      query += ' WHERE snapshot_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ' WHERE snapshot_date >= ?';
      params.push(startDate);
    }

    query += ' ORDER BY snapshot_date ASC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  getLatestSnapshot() {
    const stmt = this.db.prepare(`
      SELECT * FROM daily_snapshots
      ORDER BY snapshot_date DESC
      LIMIT 1
    `);
    return stmt.get();
  }

  // Trading signal operations
  recordSignal(signalDate, symbol, signalType, confidence, reasoning = null, executed = 0) {
    const stmt = this.db.prepare(`
      INSERT INTO trading_signals (signal_date, symbol, signal_type, confidence, reasoning, executed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    return stmt.run(signalDate, symbol, signalType, confidence, reasoning, executed);
  }

  markSignalExecuted(signalId) {
    const stmt = this.db.prepare('UPDATE trading_signals SET executed = 1 WHERE id = ?');
    stmt.run(signalId);
  }

  // Backtest operations
  createBacktestRun(startDate, endDate, initialCapital) {
    const stmt = this.db.prepare(`
      INSERT INTO backtest_runs (start_date, end_date, initial_capital, final_value, total_return, total_trades, created_at)
      VALUES (?, ?, ?, 0, 0, 0, datetime('now'))
    `);
    const result = stmt.run(startDate, endDate, initialCapital);
    return result.lastInsertRowid;
  }

  updateBacktestRun(backtestId, finalValue, totalReturn, totalTrades, winRate, sharpeRatio, maxDrawdown) {
    const stmt = this.db.prepare(`
      UPDATE backtest_runs
      SET final_value = ?, total_return = ?, total_trades = ?, win_rate = ?, sharpe_ratio = ?, max_drawdown = ?
      WHERE id = ?
    `);
    stmt.run(finalValue, totalReturn, totalTrades, winRate, sharpeRatio, maxDrawdown, backtestId);
  }

  recordBacktestTrade(backtestId, tradeDate, symbol, action, quantity, price, reasoning = null) {
    const totalValue = quantity * price;
    const stmt = this.db.prepare(`
      INSERT INTO backtest_trades (backtest_run_id, trade_date, symbol, action, quantity, price, total_value, reasoning)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(backtestId, tradeDate, symbol, action, quantity, price, totalValue, reasoning);
  }

  getBacktestRuns() {
    const stmt = this.db.prepare('SELECT * FROM backtest_runs ORDER BY created_at DESC');
    return stmt.all();
  }

  getBacktestTrades(backtestId) {
    const stmt = this.db.prepare('SELECT * FROM backtest_trades WHERE backtest_run_id = ? ORDER BY trade_date');
    return stmt.all(backtestId);
  }

  close() {
    if (this.db) {
      this.db.close();
      console.log('✓ Database connection closed');
    }
  }
}

export default DatabaseService;

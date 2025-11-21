/**
 * Database schema for the agentic stock trader
 */

export const createTables = (db) => {
  // Portfolio state table - tracks current holdings
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      quantity REAL NOT NULL,
      average_cost REAL NOT NULL,
      current_price REAL,
      updated_at TEXT NOT NULL,
      UNIQUE(symbol)
    )
  `);

  // Cash balance table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_balance (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      balance REAL NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Trades table - all executed trades
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      total_value REAL NOT NULL,
      reasoning TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Daily snapshots - portfolio value at end of each trading day
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL UNIQUE,
      cash_balance REAL NOT NULL,
      holdings_value REAL NOT NULL,
      total_value REAL NOT NULL,
      daily_return REAL,
      cumulative_return REAL,
      created_at TEXT NOT NULL
    )
  `);

  // Trading signals - agent's analysis and decisions
  db.exec(`
    CREATE TABLE IF NOT EXISTS trading_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      signal_type TEXT NOT NULL CHECK (signal_type IN ('BUY', 'SELL', 'HOLD')),
      confidence REAL CHECK (confidence >= 0 AND confidence <= 1),
      reasoning TEXT,
      executed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  // Backtest runs - metadata for backtesting sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS backtest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      initial_capital REAL NOT NULL,
      final_value REAL NOT NULL,
      total_return REAL NOT NULL,
      total_trades INTEGER NOT NULL,
      win_rate REAL,
      sharpe_ratio REAL,
      max_drawdown REAL,
      created_at TEXT NOT NULL
    )
  `);

  // Backtest trades - trades from backtesting runs
  db.exec(`
    CREATE TABLE IF NOT EXISTS backtest_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      backtest_run_id INTEGER NOT NULL,
      trade_date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      total_value REAL NOT NULL,
      reasoning TEXT,
      FOREIGN KEY (backtest_run_id) REFERENCES backtest_runs(id)
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(trade_date);
    CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
    CREATE INDEX IF NOT EXISTS idx_snapshots_date ON daily_snapshots(snapshot_date);
    CREATE INDEX IF NOT EXISTS idx_signals_date ON trading_signals(signal_date);
    CREATE INDEX IF NOT EXISTS idx_backtest_trades_run ON backtest_trades(backtest_run_id);
  `);

  console.log('✓ Database schema initialized');
};

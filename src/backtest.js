#!/usr/bin/env node
import 'dotenv/config';
import DatabaseService from './database/db.js';
import { BacktestEngine, TradingStrategy } from './core/backtest-engine.js';

/**
 * Example trading strategy for backtesting
 * Replace this with your actual MCP-based strategy
 */
class ExampleStrategy extends TradingStrategy {
  async generateSignals(date, state) {
    // TODO: Implement your actual trading strategy here
    // This is just a placeholder that doesn't make any trades

    // Example: You would fetch market data via MCP and analyze it
    // const marketData = await mcpMarketDataServer.getPrice('AAPL', date);
    // const signals = await mcpAnalysisServer.analyzeAndGenerateSignals(marketData);

    // For now, return empty array (no trades)
    return [];

    // Example signal format:
    // return [
    //   {
    //     symbol: 'AAPL',
    //     action: 'BUY',
    //     quantity: 10,
    //     price: 150.00,
    //     reasoning: 'Strong upward trend detected'
    //   }
    // ];
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const startDate = args[0] || '2024-01-01';
  const endDate = args[1] || '2024-12-31';
  const initialCapital = parseFloat(args[2] || process.env.INITIAL_CAPITAL || '100000');

  console.log('🔬 Backtesting Mode\n');

  let db = null;

  try {
    // Initialize database (use separate database for backtesting)
    db = new DatabaseService('./data/backtest.db');
    db.initialize();

    // Create trading strategy
    const strategy = new ExampleStrategy();

    // Create backtest engine
    const backtestEngine = new BacktestEngine(db, strategy);

    // Run backtest
    await backtestEngine.runBacktest(startDate, endDate, initialCapital);

    console.log('\n✓ Backtest completed');
    console.log('\nNote: This used an example strategy. Implement your actual MCP-based');
    console.log('trading logic in src/backtest.js to test your real strategy.');

  } catch (error) {
    console.error('Error running backtest:', error);
    process.exit(1);
  } finally {
    if (db) db.close();
  }
}

// Show usage if --help is passed
if (process.argv.includes('--help')) {
  console.log('Backtesting Tool\n');
  console.log('Usage: npm run backtest [startDate] [endDate] [initialCapital]\n');
  console.log('Arguments:');
  console.log('  startDate      - Start date in YYYY-MM-DD format (default: 2024-01-01)');
  console.log('  endDate        - End date in YYYY-MM-DD format (default: 2024-12-31)');
  console.log('  initialCapital - Starting capital (default: from .env or 100000)\n');
  console.log('Examples:');
  console.log('  npm run backtest');
  console.log('  npm run backtest 2024-06-01 2024-12-31');
  console.log('  npm run backtest 2024-01-01 2024-12-31 50000');
  process.exit(0);
}

main();

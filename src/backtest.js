#!/usr/bin/env node
import 'dotenv/config';
import DatabaseService from './database/db.js';
import { BacktestEngine, TradingStrategy } from './core/backtest-engine.js';
import { MarketDataClient, AnalysisClient } from './utils/mcp-client.js';
import { HistoricalDataCache } from './utils/cache.js';

/**
 * MCP-based trading strategy for backtesting
 * Note: For backtesting, we simulate historical data since Alpha Vantage
 * doesn't provide exact historical prices for specific times
 */
class MCPBacktestStrategy extends TradingStrategy {
  constructor() {
    super();
    this.marketDataClient = null;
    this.analysisClient = null;
    this.cache = new HistoricalDataCache();
    this.watchlist = process.env.WATCHLIST?.split(',') || ['AAPL', 'GOOGL', 'MSFT'];
    this.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE || '0.2');
    this.minConfidence = parseFloat(process.env.MIN_CONFIDENCE || '0.6');
    this.historicalData = {}; // Cache historical data
  }

  async initialize() {
    console.log('Initializing MCP clients for backtesting...');
    this.marketDataClient = new MarketDataClient();
    this.analysisClient = new AnalysisClient();

    await this.marketDataClient.connect();
    await this.analysisClient.connect();

    // Fetch and cache historical data for all symbols
    console.log('Fetching historical data (using cache when available)...');
    for (const symbol of this.watchlist) {
      try {
        // Try to get from cache first
        let data = this.cache.get(symbol, 'full');

        if (!data) {
          // Cache miss - fetch from API
          console.log(`  🌐 Fetching ${symbol} from API...`);
          data = await this.marketDataClient.getHistoricalPrices(symbol, 'full');

          // Save to cache
          this.cache.set(symbol, data, 'full');
        }

        this.historicalData[symbol] = data.prices;
        const dateRange = data.prices.length > 0
          ? `${data.prices[data.prices.length - 1].date} to ${data.prices[0].date}`
          : 'no dates';
        console.log(`  ✓ ${symbol}: ${data.prices.length} data points (${dateRange})`);
      } catch (error) {
        console.error(`  ✗ ${symbol}: ${error.message}`);
      }
    }

    // Show cache stats
    const stats = this.cache.getStats();
    console.log(`\n📦 Cache: ${stats.files} files, ${stats.totalSizeMB} MB`);
    console.log('✓ Initialization complete\n');
  }

  async generateSignals(date, state) {
    const signals = [];
    const debugSignals = []; // Track all signals for debugging

    // Analyze each symbol in watchlist for buy opportunities
    for (const symbol of this.watchlist) {
      // Skip if we already have a position
      if (state.positions.has(symbol)) {
        continue;
      }

      const signal = await this.analyzeBuyOpportunity(symbol, date, state);
      if (signal) {
        signals.push(signal);
        debugSignals.push({ symbol, ...signal });
      }
    }

    // Evaluate existing positions for sell signals
    for (const [symbol, position] of state.positions) {
      const sellSignal = await this.evaluateSellOpportunity(symbol, date, state, position);
      if (sellSignal) {
        signals.push(sellSignal);
        debugSignals.push({ symbol, ...sellSignal });
      }
    }

    // Debug: Show first few days of signals
    if (debugSignals.length > 0 && Math.random() < 0.05) {  // 5% sample
      console.log(`[DEBUG ${date}] Signals:`, debugSignals.map(s => `${s.symbol}:${s.action}(${s.confidence || 'N/A'})`).join(', '));
    }

    return signals;
  }

  async analyzeBuyOpportunity(symbol, date, state) {
    const historicalPrices = this.getHistoricalPricesUpToDate(symbol, date);

    if (!historicalPrices || historicalPrices.length < 50) {
      return null;
    }

    // Get price for this date (or closest previous trading day)
    const currentPrice = this.getPriceForDate(symbol, date);
    if (!currentPrice) {
      // No data for this date (weekend/holiday) - skip
      return null;
    }

    // Generate signals using analysis
    try {
      const analysis = await this.analysisClient.generateSignals(symbol, historicalPrices);

      // Debug: Log occasionally to see what's happening
      if (Math.random() < 0.01) {  // 1% sample
        console.log(`[DEBUG] ${symbol} on ${date}: ${analysis.signal} (conf: ${(analysis.confidence * 100).toFixed(1)}%, need: ${(this.minConfidence * 100).toFixed(0)}%)`);
      }

      if (analysis.signal === 'BUY' && analysis.confidence >= this.minConfidence) {
        // Calculate position size
        const portfolioValue = state.cash + Array.from(state.positions.values())
          .reduce((sum, pos) => sum + (pos.quantity * pos.averageCost), 0);

        const maxInvestment = portfolioValue * this.maxPositionSize;
        const quantity = Math.floor(maxInvestment / currentPrice);

        if (quantity >= 1 && (quantity * currentPrice) <= state.cash) {
          return {
            symbol,
            action: 'BUY',
            quantity,
            price: currentPrice,
            reasoning: analysis.reasons.join('; '),
          };
        }
      }
    } catch (error) {
      // Ignore errors during backtesting
    }

    return null;
  }

  async evaluateSellOpportunity(symbol, date, state, position) {
    const historicalPrices = this.getHistoricalPricesUpToDate(symbol, date);

    if (!historicalPrices || historicalPrices.length < 50) {
      return null;
    }

    const currentPrice = this.getPriceForDate(symbol, date);
    if (!currentPrice) {
      return null;
    }

    const profitLoss = ((currentPrice - position.averageCost) / position.averageCost) * 100;

    // Stop loss
    if (profitLoss < -10) {
      return {
        symbol,
        action: 'SELL',
        quantity: position.quantity,
        price: currentPrice,
        reasoning: `Stop loss triggered (${profitLoss.toFixed(2)}%)`,
      };
    }

    // Take profit
    if (profitLoss > 15) {
      return {
        symbol,
        action: 'SELL',
        quantity: position.quantity,
        price: currentPrice,
        reasoning: `Take profit (${profitLoss.toFixed(2)}%)`,
      };
    }

    // Check technical signals
    try {
      const analysis = await this.analysisClient.generateSignals(symbol, historicalPrices);

      if (analysis.signal === 'SELL' && analysis.confidence >= 0.7) {
        return {
          symbol,
          action: 'SELL',
          quantity: position.quantity,
          price: currentPrice,
          reasoning: `Technical sell signal (${profitLoss.toFixed(2)}% P/L)`,
        };
      }

      // Sell on moderate profit with weak signal
      if (profitLoss > 5 && analysis.signal === 'SELL' && analysis.confidence >= 0.5) {
        return {
          symbol,
          action: 'SELL',
          quantity: position.quantity,
          price: currentPrice,
          reasoning: `Moderate profit + sell signal (${profitLoss.toFixed(2)}%)`,
        };
      }
    } catch (error) {
      // Ignore errors
    }

    return null;
  }

  getHistoricalPricesUpToDate(symbol, date) {
    const allPrices = this.historicalData[symbol];
    if (!allPrices) return null;

    // Filter prices up to and including the given date
    return allPrices.filter(p => p.date <= date).slice(0, 100);
  }

  getPriceForDate(symbol, date) {
    const prices = this.historicalData[symbol];
    if (!prices) return null;

    // Try exact match first
    let dayPrice = prices.find(p => p.date === date);

    // If no exact match (weekend/holiday), find most recent previous trading day
    if (!dayPrice) {
      const sortedPrices = prices.filter(p => p.date <= date).sort((a, b) => b.date.localeCompare(a.date));
      dayPrice = sortedPrices[0];
    }

    return dayPrice ? dayPrice.close : null;
  }

  async cleanup() {
    if (this.marketDataClient) {
      await this.marketDataClient.disconnect();
    }
    if (this.analysisClient) {
      await this.analysisClient.disconnect();
    }
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
  let strategy = null;

  try {
    // Initialize database (use separate database for backtesting)
    db = new DatabaseService('./data/backtest.db');
    db.initialize();

    // Create and initialize MCP-based trading strategy
    strategy = new MCPBacktestStrategy();
    await strategy.initialize();

    // Create backtest engine
    const backtestEngine = new BacktestEngine(db, strategy);

    // Run backtest
    await backtestEngine.runBacktest(startDate, endDate, initialCapital);

    console.log('\n✓ Backtest completed');

  } catch (error) {
    console.error('Error running backtest:', error);
    process.exit(1);
  } finally {
    if (strategy) {
      await strategy.cleanup();
    }
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

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
    console.log('Watchlist:', this.watchlist);
    console.log('MIN_CONFIDENCE:', this.minConfidence);
    console.log('MAX_POSITION_SIZE:', this.maxPositionSize);
    this.marketDataClient = new MarketDataClient();
    this.analysisClient = new AnalysisClient();

    await this.marketDataClient.connect();
    await this.analysisClient.connect();

    // Fetch and cache historical data for all symbols
    console.log('Fetching historical data (using cache when available)...');
    for (const symbol of this.watchlist) {
      try {
        // Try to get from cache first (compact = last 100 days for free tier)
        let data = this.cache.get(symbol, 'compact');

        if (!data) {
          // Cache miss - fetch from API
          console.log(`  🌐 Fetching ${symbol} from API...`);
          // Use 'compact' for free tier (last 100 days, ~3-4 months)
          data = await this.marketDataClient.getHistoricalPrices(symbol, 'compact');

          // Save to cache
          this.cache.set(symbol, data, 'compact');
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

    // Debug first day
    if (date === '2025-09-16') {
      console.log(`\n[${date}] Analyzing watchlist:`, this.watchlist);
    }

    // Analyze each symbol in watchlist for buy opportunities
    for (const symbol of this.watchlist) {
      // Skip if we already have a position
      if (state.positions.has(symbol)) {
        continue;
      }

      if (date === '2025-09-16') {
        console.log(`  Analyzing ${symbol} for BUY...`);
      }

      const signal = await this.analyzeBuyOpportunity(symbol, date, state);

      if (date === '2025-09-16') {
        console.log(`    Result: ${signal ? signal.action : 'No signal'}`);
      }

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

    // Debug: Show all signals (deterministic output)
    if (debugSignals.length > 0) {
      console.log(`[DEBUG ${date}] Signals:`, debugSignals.map(s => {
        const conf = s.confidence !== undefined ? `${(s.confidence * 100).toFixed(1)}%` : 'N/A';
        return `${s.symbol}:${s.action}(${conf})`;
      }).join(', '));
    }

    return signals;
  }

  async analyzeBuyOpportunity(symbol, date, state) {
    const historicalPrices = this.getHistoricalPricesUpToDate(symbol, date);

    if (date === '2025-09-16') {
      console.log(`    ${symbol}: historicalPrices=${historicalPrices?.length || 0} points`);
    }

    if (!historicalPrices || historicalPrices.length < 50) {
      if (date === '2025-09-16') {
        console.log(`    ${symbol}: SKIPPED - not enough data (need 50, have ${historicalPrices?.length || 0})`);
      }
      return null;
    }

    // Get price for this date (or closest previous trading day)
    const currentPrice = this.getPriceForDate(symbol, date);
    if (date === '2025-09-16') {
      console.log(`    ${symbol}: currentPrice=${currentPrice || 'none'}`);
    }

    if (!currentPrice) {
      // No data for this date (weekend/holiday) - skip
      if (date === '2025-09-16') {
        console.log(`    ${symbol}: SKIPPED - no price for this date`);
      }
      return null;
    }

    // Generate signals using analysis
    try {
      const analysis = await this.analysisClient.generateSignals(symbol, historicalPrices);

      // Debug: Show ALL signals on first day, all BUY signals, and sample others
      const emoji = analysis.signal === 'BUY' ? '🟢' : analysis.signal === 'SELL' ? '🔴' : '⚪';
      const passed = analysis.confidence >= this.minConfidence ? '✅' : '❌';

      // Show first 2 days for ALL stocks, all BUY signals, and sample others
      const isEarlyDay = date === '2025-09-16' || date === '2025-09-17';
      if (isEarlyDay || analysis.signal === 'BUY') {
        const indicators = analysis.indicators ? `RSI:${analysis.indicators.rsi?.toFixed(1) || '?'} SMA20:${analysis.indicators.sma20?.toFixed(2) || '?'} Price:${analysis.currentPrice?.toFixed(2) || '?'}` : '';
        const rawConf = analysis.rawConfidence !== undefined ? `raw=${analysis.rawConfidence.toFixed(2)}` : '';
        console.log(`[${date}] ${emoji} ${symbol}: ${analysis.signal} ${(analysis.confidence * 100).toFixed(1)}% ${passed} ${rawConf} ${indicators}`);
        if (isEarlyDay) {
          console.log(`  Reasons: ${analysis.reasons?.join('; ') || 'none'}`);
        }
      }

      // Force output for first trading day to debug
      if (date === '2025-09-16') {
        console.log(`  [DEBUG] ${symbol} raw analysis:`, JSON.stringify(analysis.reasons || []));
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
    // Note: allPrices is in descending order (newest first), so we need to reverse
    const filtered = allPrices.filter(p => p.date <= date);
    // Return in ascending order (oldest first) - analysis server expects this
    return filtered.reverse().slice(-100); // Take last 100 days (most recent)
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

  // Filter out flags
  const nonFlagArgs = args.filter(arg => !arg.startsWith('--'));

  // Parse command line arguments
  const startDate = nonFlagArgs[0] || '2024-01-01';
  const endDate = nonFlagArgs[1] || '2024-12-31';
  const initialCapital = parseFloat(nonFlagArgs[2] || process.env.INITIAL_CAPITAL || '100000');

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

    // Check if --with-positions flag is passed
    const startWithPositions = process.argv.includes('--with-positions');

    // Run backtest
    await backtestEngine.runBacktest(startDate, endDate, initialCapital, startWithPositions);

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

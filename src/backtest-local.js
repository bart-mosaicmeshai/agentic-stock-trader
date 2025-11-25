#!/usr/bin/env node
/**
 * Local LLM Backtesting Script
 *
 * Uses Local LLM (via LM Studio) to make trading decisions on historical data.
 *
 * WARNING: This is SLOW! Each trading day requires 5-10 seconds for LLM analysis.
 * A 6-month backtest (120 trading days) could take 10-20 minutes.
 *
 * Make sure LM Studio is running with Local Server started before running this.
 */

import 'dotenv/config';
import DatabaseService from './database/db.js';
import { BacktestEngine, TradingStrategy } from './core/backtest-engine.js';
import { LocalLLMAgent } from './agents/local-llm-agent.js';
import { PortfolioManager } from './core/portfolio-manager.js';
import { HistoricalDataCache } from './utils/cache.js';

/**
 * LLM-based backtesting strategy
 * Uses LocalLLMAgent to make decisions on historical data
 */
class LLMBacktestStrategy extends TradingStrategy {
  constructor(db, initialCapital) {
    super();
    this.db = db;
    this.cache = new HistoricalDataCache();
    this.watchlist = process.env.WATCHLIST?.split(',') || ['AAPL'];
    this.historicalData = {};

    // Create a virtual portfolio manager for the backtest
    this.portfolio = new PortfolioManager(db);
    this.agent = null;
    this.initialCapital = initialCapital;

    // Track progress
    this.totalDays = 0;
    this.currentDay = 0;
  }

  async initialize() {
    console.log('🤖 Initializing Local LLM agent for backtesting...');
    console.log('⚠️  Make sure LM Studio is running with Local Server started!\n');

    // Initialize the LLM agent
    this.agent = new LocalLLMAgent(this.db, this.portfolio);
    await this.agent.initialize();

    // Fetch and cache historical data
    console.log('📦 Fetching historical data (using cache when available)...');
    for (const symbol of this.watchlist) {
      try {
        // Use 'compact' for free tier (last 100 days, ~3-4 months)
        let data = this.cache.get(symbol, 'compact');

        if (!data) {
          console.log(`  🌐 Fetching ${symbol} from API...`);
          data = await this.agent.marketDataClient.getHistoricalPrices(symbol, 'compact');
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

    const stats = this.cache.getStats();
    console.log(`\n📦 Cache: ${stats.files} files, ${stats.totalSizeMB} MB`);
    console.log('✓ Initialization complete\n');
  }

  async generateSignals(date, state) {
    this.currentDay++;
    const progress = ((this.currentDay / this.totalDays) * 100).toFixed(1);
    console.log(`\n[${progress}%] 📅 ${date} - Local LLM analyzing (Day ${this.currentDay}/${this.totalDays})...`);

    const signals = [];

    // Update portfolio state to match backtest state
    // This is a bit hacky but necessary to make the LLM see the right context
    this.updateVirtualPortfolio(state);

    // For each symbol in watchlist, let the LLM analyze
    for (const symbol of this.watchlist) {
      // Skip if we already have a position
      if (state.positions.has(symbol)) {
        console.log(`  ℹ️  ${symbol}: Already have position, checking for sell signals...`);
        const sellSignal = await this.evaluateSellOpportunity(symbol, date, state);
        if (sellSignal) {
          signals.push(sellSignal);
        }
        continue;
      }

      // Check if we have enough data
      const historicalPrices = this.getHistoricalPricesUpToDate(symbol, date);
      if (!historicalPrices || historicalPrices.length < 50) {
        console.log(`  ⚠️  ${symbol}: Insufficient historical data (${historicalPrices?.length || 0} points)`);
        continue;
      }

      const currentPrice = this.getPriceForDate(symbol, date);
      if (!currentPrice) {
        console.log(`  ⚠️  ${symbol}: No price data for ${date}`);
        continue;
      }

      // Use LLM to analyze this symbol
      try {
        console.log(`  🤖 Analyzing ${symbol}...`);
        const decision = await this.analyzeSingleSymbol(symbol, date, historicalPrices, currentPrice);

        if (decision && decision.action === 'BUY' && decision.confidence >= this.agent.minConfidence) {
          // Calculate position size
          const portfolioValue = state.cash + Array.from(state.positions.values())
            .reduce((sum, pos) => sum + (pos.quantity * pos.averageCost), 0);

          const maxInvestment = portfolioValue * this.agent.maxPositionSize;
          const quantity = Math.floor(maxInvestment / currentPrice);

          if (quantity > 0 && (quantity * currentPrice) <= state.cash) {
            signals.push({
              symbol,
              action: 'BUY',
              quantity,
              price: currentPrice,
              reasoning: decision.reasoning,
              confidence: decision.confidence,
            });

            console.log(`  ✅ BUY signal: ${quantity} shares @ $${currentPrice.toFixed(2)} (confidence: ${(decision.confidence * 100).toFixed(1)}%)`);
          }
        } else if (decision) {
          console.log(`  ⏸️  ${decision.action}: ${decision.reasoning.substring(0, 80)}... (confidence: ${(decision.confidence * 100).toFixed(1)}%)`);
        }
      } catch (error) {
        console.error(`  ❌ Error analyzing ${symbol}:`, error.message);
      }
    }

    return signals;
  }

  /**
   * Use LLM to analyze a single symbol
   */
  async analyzeSingleSymbol(symbol, date, historicalPrices, currentPrice) {
    // Build a simplified context for the LLM
    const summary = this.portfolio.getPortfolioSummary();

    const systemPrompt = `You are analyzing ${symbol} for trading on ${date}.

Portfolio State:
- Cash: $${summary.cash.toFixed(2)}
- Total Value: $${summary.totalValue.toFixed(2)}
- Max position size: ${(this.agent.maxPositionSize * 100)}%

You have access to ${historicalPrices.length} days of historical price data.
Current price: $${currentPrice.toFixed(2)}

Use the available tools to perform technical analysis and make a BUY/HOLD decision.
Respond with your decision in JSON format:
{
  "action": "BUY" or "HOLD",
  "symbol": "${symbol}",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze ${symbol} and provide your trading decision.` },
      ];

      let continueLoop = true;
      let decision = null;
      let loopCount = 0;
      const maxLoops = 10;

      while (continueLoop && loopCount < maxLoops) {
        loopCount++;

        const response = await this.agent.client.chat.completions.create({
          model: this.agent.model,
          messages: messages,
          tools: this.buildHistoricalTools(historicalPrices, currentPrice),
          tool_choice: 'auto',
        });

        const message = response.choices[0].message;

        // Handle tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          messages.push(message);

          for (const toolCall of message.tool_calls) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await this.executeHistoricalTool(
                toolCall.function.name,
                args,
                historicalPrices,
                symbol
              );

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              });
            } catch (error) {
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message }),
              });
            }
          }
        } else {
          // Final response - try to extract decision
          try {
            const jsonMatch = message.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              decision = JSON.parse(jsonMatch[0]);
            }
          } catch (e) {
            // Failed to parse - treat as HOLD
            decision = {
              action: 'HOLD',
              symbol,
              confidence: 0.5,
              reasoning: 'Unable to parse LLM response',
            };
          }

          continueLoop = false;
        }
      }

      return decision;
    } catch (error) {
      console.error(`Error in LLM analysis:`, error.message);
      return null;
    }
  }

  /**
   * Build tool definitions for historical analysis
   */
  buildHistoricalTools(historicalPrices, currentPrice) {
    return [
      {
        type: 'function',
        function: {
          name: 'get_historical_prices',
          description: 'Get historical price data',
          parameters: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
            },
            required: ['symbol'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calculate_sma',
          description: 'Calculate Simple Moving Average',
          parameters: {
            type: 'object',
            properties: {
              period: { type: 'number' },
            },
            required: ['period'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calculate_rsi',
          description: 'Calculate Relative Strength Index',
          parameters: {
            type: 'object',
            properties: {
              period: { type: 'number' },
            },
            required: ['period'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'detect_trend',
          description: 'Detect price trend',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
    ];
  }

  /**
   * Execute tools on historical data
   */
  async executeHistoricalTool(toolName, args, historicalPrices, symbol) {
    const prices = historicalPrices.map(p => p.close);

    switch (toolName) {
      case 'get_historical_prices':
        return { prices: historicalPrices };

      case 'calculate_sma':
        return await this.agent.analysisClient.calculateSMA(prices, args.period || 20);

      case 'calculate_rsi':
        return await this.agent.analysisClient.calculateRSI(prices, args.period || 14);

      case 'detect_trend':
        return await this.agent.analysisClient.detectTrend(prices);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Evaluate sell opportunities for existing positions
   */
  async evaluateSellOpportunity(symbol, date, state) {
    const position = state.positions.get(symbol);
    if (!position) return null;

    const currentPrice = this.getPriceForDate(symbol, date);
    if (!currentPrice) return null;

    const profitLoss = ((currentPrice - position.averageCost) / position.averageCost) * 100;

    // Stop loss: -10%
    if (profitLoss <= -10) {
      console.log(`  🛑 STOP LOSS triggered for ${symbol}: ${profitLoss.toFixed(2)}%`);
      return {
        symbol,
        action: 'SELL',
        quantity: position.quantity,
        price: currentPrice,
        reasoning: `Stop loss triggered (${profitLoss.toFixed(2)}%)`,
      };
    }

    // Take profit: +15%
    if (profitLoss >= 15) {
      console.log(`  💰 TAKE PROFIT triggered for ${symbol}: ${profitLoss.toFixed(2)}%`);
      return {
        symbol,
        action: 'SELL',
        quantity: position.quantity,
        price: currentPrice,
        reasoning: `Take profit triggered (${profitLoss.toFixed(2)}%)`,
      };
    }

    return null;
  }

  /**
   * Update virtual portfolio to match backtest state
   */
  updateVirtualPortfolio(state) {
    // This is a simplified sync - in reality we'd need to fully reconstruct the portfolio state
    // For now, just update cash
    // The portfolio manager reads from database, so we'd need to actually modify the DB
    // This is a limitation of the current architecture
  }

  getHistoricalPricesUpToDate(symbol, date) {
    const allPrices = this.historicalData[symbol];
    if (!allPrices) return null;

    // Filter prices up to and including the given date
    // Note: allPrices is in descending order (newest first), so we need to reverse
    const filtered = allPrices.filter(p => p.date <= date);
    // Return in ascending order (oldest first) - LLM expects chronological order
    return filtered.reverse().slice(-100); // Take last 100 days (most recent)
  }

  getPriceForDate(symbol, date) {
    const prices = this.historicalData[symbol];
    if (!prices) return null;

    let dayPrice = prices.find(p => p.date === date);

    if (!dayPrice) {
      const sortedPrices = prices.filter(p => p.date <= date).sort((a, b) => b.date.localeCompare(a.date));
      dayPrice = sortedPrices[0];
    }

    return dayPrice ? dayPrice.close : null;
  }

  async cleanup() {
    if (this.agent) {
      await this.agent.cleanup();
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  const startDate = args[0] || '2025-10-01';
  const endDate = args[1] || '2025-11-24';
  const initialCapital = parseFloat(args[2] || process.env.INITIAL_CAPITAL || '100000');

  console.log('🤖 Local LLM Backtesting Mode\n');
  console.log('⚠️  WARNING: This will be slow! Expect 5-10 seconds per trading day.');
  console.log('⚠️  Make sure LM Studio is running with Local Server started.\n');

  let db = null;
  let strategy = null;

  try {
    // Use separate database for LLM backtests
    db = new DatabaseService('./data/backtest-local.db');
    db.initialize();

    // Create LLM backtest strategy
    strategy = new LLMBacktestStrategy(db, initialCapital);
    await strategy.initialize();

    // Create backtest engine
    const backtestEngine = new BacktestEngine(db, strategy);

    // Estimate time
    const daysDiff = Math.floor((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    const tradingDays = Math.floor(daysDiff * 5/7); // Rough estimate
    const estimatedMinutes = Math.ceil(tradingDays * 7 / 60);

    strategy.totalDays = tradingDays;

    console.log(`📊 Estimated ${tradingDays} trading days, ~${estimatedMinutes} minutes\n`);
    console.log('Starting backtest...\n');

    const startTime = Date.now();

    // Run backtest
    await backtestEngine.runBacktest(startDate, endDate, initialCapital);

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n✓ Backtest completed in ${duration} minutes`);
    console.log('\nView results with: npm run report -- --backtest');

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

// Show usage
if (process.argv.includes('--help')) {
  console.log('Local LLM Backtesting Tool\n');
  console.log('Usage: npm run backtest:local [startDate] [endDate] [initialCapital]\n');
  console.log('Prerequisites:');
  console.log('  - LM Studio must be running');
  console.log('  - Local Server must be started in LM Studio');
  console.log('  - A model must be loaded (e.g., Hermes-3-8B)\n');
  console.log('Arguments:');
  console.log('  startDate      - Start date in YYYY-MM-DD format (default: 2025-10-01)');
  console.log('  endDate        - End date in YYYY-MM-DD format (default: 2025-11-24)');
  console.log('  initialCapital - Starting capital (default: from .env or 100000)\n');
  console.log('Examples:');
  console.log('  npm run backtest:local');
  console.log('  npm run backtest:local 2025-10-01 2025-11-24');
  console.log('  npm run backtest:local 2025-09-01 2025-11-24 50000\n');
  console.log('⚠️  WARNING: This is SLOW! Each trading day takes 5-10 seconds.');
  console.log('   A 1-month backtest (~20 days) will take 2-3 minutes.');
  console.log('   A 6-month backtest (~120 days) will take 10-20 minutes.\n');
  process.exit(0);
}

main();

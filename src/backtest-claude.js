#!/usr/bin/env node
/**
 * Claude Haiku Backtesting Script
 *
 * Uses Claude Haiku (via Anthropic API) to make trading decisions on historical data.
 *
 * COST ESTIMATES (Claude 3 Haiku: $0.25/M input, $1.25/M output):
 * - Per symbol per day: ~$0.0011 (2K input + 500 output tokens)
 * - 1 symbol, 2 months (~50 days): ~$0.06
 * - 5 symbols, 2 months (typical): ~$0.10-0.15 (not all symbols analyzed every day)
 * - 5 symbols, 2 months (worst case): ~$0.28 (all symbols every day)
 *
 * Make sure ANTHROPIC_API_KEY is set in .env before running this.
 */

import 'dotenv/config';
import DatabaseService from './database/db.js';
import { BacktestEngine, TradingStrategy } from './core/backtest-engine.js';
import { LLMTradingAgent } from './agents/llm-trading-agent.js';
import { PortfolioManager } from './core/portfolio-manager.js';
import { HistoricalDataCache } from './utils/cache.js';

/**
 * Claude-based backtesting strategy
 * Uses LLMTradingAgent to make decisions on historical data
 */
class ClaudeBacktestStrategy extends TradingStrategy {
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
    console.log('🤖 Initializing Claude Haiku agent for backtesting...');
    console.log('⚠️  Make sure ANTHROPIC_API_KEY is set in .env!\n');

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not found in environment');
    }

    // Initialize the Claude agent
    this.agent = new LLMTradingAgent(this.db, this.portfolio);
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
    console.log(`\n[${progress}%] 📅 ${date} - Claude analyzing (Day ${this.currentDay}/${this.totalDays})...`);

    const signals = [];

    // Update portfolio state to match backtest state
    this.updateVirtualPortfolio(state);

    // For each symbol in watchlist, let Claude analyze
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

      // Use Claude to analyze this symbol
      try {
        console.log(`  🤖 Analyzing ${symbol} with Claude...`);
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
   * Use Claude to analyze a single symbol
   */
  async analyzeSingleSymbol(symbol, date, historicalPrices, currentPrice) {
    // Build a simplified context for Claude
    const summary = this.portfolio.getPortfolioSummary();

    const systemPrompt = `You are a stock trading AI analyzing ${symbol} for trading on ${date}.

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
        {
          role: 'user',
          content: `Analyze ${symbol} for ${date} and provide your trading decision. Historical data available for the last ${historicalPrices.length} days. Current price: $${currentPrice.toFixed(2)}.`
        },
      ];

      let continueLoop = true;
      let decision = null;
      let loopCount = 0;
      const maxLoops = 10;

      while (continueLoop && loopCount < maxLoops) {
        loopCount++;

        const response = await this.agent.anthropic.messages.create({
          model: this.agent.model,
          max_tokens: 2000,
          system: systemPrompt,
          messages: messages,
          tools: this.buildHistoricalTools(historicalPrices, currentPrice),
        });

        // Handle tool use
        if (response.stop_reason === 'tool_use') {
          messages.push({
            role: 'assistant',
            content: response.content
          });

          const toolResults = [];

          for (const block of response.content) {
            if (block.type === 'tool_use') {
              try {
                const result = await this.executeHistoricalTool(
                  block.name,
                  block.input,
                  historicalPrices,
                  symbol
                );

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(result),
                });
              } catch (error) {
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify({ error: error.message }),
                  is_error: true,
                });
              }
            }
          }

          messages.push({
            role: 'user',
            content: toolResults,
          });
        } else {
          // Final response - extract decision
          const textContent = response.content.find(block => block.type === 'text');

          if (textContent) {
            try {
              const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                decision = JSON.parse(jsonMatch[0]);
              } else {
                // Try to parse entire text as JSON
                decision = JSON.parse(textContent.text);
              }
            } catch (e) {
              // Failed to parse - treat as HOLD
              decision = {
                action: 'HOLD',
                symbol,
                confidence: 0.5,
                reasoning: 'Unable to parse Claude response: ' + textContent.text.substring(0, 100),
              };
            }
          }

          continueLoop = false;
        }
      }

      return decision;
    } catch (error) {
      console.error(`Error in Claude analysis:`, error.message);
      return null;
    }
  }

  /**
   * Build tool definitions for historical analysis (Claude format)
   */
  buildHistoricalTools(historicalPrices, currentPrice) {
    return [
      {
        name: 'get_historical_prices',
        description: 'Get historical price data for the symbol',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Stock ticker symbol',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'calculate_sma',
        description: 'Calculate Simple Moving Average',
        input_schema: {
          type: 'object',
          properties: {
            period: {
              type: 'number',
              description: 'Period for SMA (e.g., 20, 50, 200)',
            },
          },
          required: ['period'],
        },
      },
      {
        name: 'calculate_rsi',
        description: 'Calculate Relative Strength Index',
        input_schema: {
          type: 'object',
          properties: {
            period: {
              type: 'number',
              description: 'Period for RSI (typically 14)',
            },
          },
          required: ['period'],
        },
      },
      {
        name: 'detect_trend',
        description: 'Detect price trend (uptrend, downtrend, or sideways)',
        input_schema: {
          type: 'object',
          properties: {},
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
    // Return in ascending order (oldest first) - Claude expects chronological order
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

  const startDate = args[0] || '2025-09-15';
  const endDate = args[1] || '2025-11-24';
  const initialCapital = parseFloat(args[2] || process.env.INITIAL_CAPITAL || '100000');

  console.log('🤖 Claude Haiku Backtesting Mode\n');
  console.log('💰 Cost Estimate: ~$0.001-0.002 per trading day');

  let db = null;
  let strategy = null;

  try {
    // Use separate database for Claude backtests
    db = new DatabaseService('./data/backtest-claude.db');
    db.initialize();

    // Create Claude backtest strategy
    strategy = new ClaudeBacktestStrategy(db, initialCapital);
    await strategy.initialize();

    // Create backtest engine
    const backtestEngine = new BacktestEngine(db, strategy);

    // Estimate time and cost
    const daysDiff = Math.floor((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    const tradingDays = Math.floor(daysDiff * 5/7); // Rough estimate
    const estimatedCost = (tradingDays * 0.0015).toFixed(2);

    strategy.totalDays = tradingDays;

    console.log(`📊 Estimated ${tradingDays} trading days, ~$${estimatedCost} API cost\n`);
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
  console.log('Claude Haiku Backtesting Tool\n');
  console.log('Usage: npm run backtest:claude [startDate] [endDate] [initialCapital]\n');
  console.log('Prerequisites:');
  console.log('  - ANTHROPIC_API_KEY must be set in .env');
  console.log('  - Internet connection required for API calls\n');
  console.log('Arguments:');
  console.log('  startDate      - Start date in YYYY-MM-DD format (default: 2025-09-15)');
  console.log('  endDate        - End date in YYYY-MM-DD format (default: 2025-11-24)');
  console.log('  initialCapital - Starting capital (default: from .env or 100000)\n');
  console.log('Examples:');
  console.log('  npm run backtest:claude');
  console.log('  npm run backtest:claude 2025-09-15 2025-11-24');
  console.log('  npm run backtest:claude 2025-09-15 2025-11-24 50000\n');
  console.log('💰 Cost: ~$0.001-0.002 per trading day (40 days = ~$0.04-0.08)');
  process.exit(0);
}

main();

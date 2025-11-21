/**
 * AI Trading Agent
 * Makes intelligent trading decisions using MCP servers
 */

import { MarketDataClient, AnalysisClient } from '../utils/mcp-client.js';

export class TradingAgent {
  constructor(db, portfolioManager) {
    this.db = db;
    this.portfolio = portfolioManager;
    this.marketDataClient = null;
    this.analysisClient = null;
    this.watchlist = process.env.WATCHLIST?.split(',') || ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];
    this.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE || '0.2'); // 20% of portfolio
    this.minConfidence = parseFloat(process.env.MIN_CONFIDENCE || '0.6'); // 60% confidence
  }

  /**
   * Initialize MCP clients
   */
  async initialize() {
    console.log('Initializing trading agent...');

    this.marketDataClient = new MarketDataClient();
    this.analysisClient = new AnalysisClient();

    await this.marketDataClient.connect();
    await this.analysisClient.connect();

    console.log('✓ MCP clients connected');
  }

  /**
   * Main trading logic - analyze and execute trades
   */
  async executeTradingCycle(tradeDate) {
    console.log(`\n🤖 Trading Agent analyzing market for ${tradeDate}...`);

    const decisions = [];

    // Analyze each symbol in watchlist
    for (const symbol of this.watchlist) {
      try {
        const decision = await this.analyzeSymbol(symbol, tradeDate);
        if (decision) {
          decisions.push(decision);
        }
      } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error.message);
      }
    }

    // Analyze current positions for potential sells
    const positions = this.portfolio.getPortfolioSummary().positions;
    for (const position of positions) {
      try {
        const sellDecision = await this.evaluatePosition(position, tradeDate);
        if (sellDecision) {
          decisions.push(sellDecision);
        }
      } catch (error) {
        console.error(`Error evaluating position ${position.symbol}:`, error.message);
      }
    }

    // Sort decisions by confidence
    decisions.sort((a, b) => b.confidence - a.confidence);

    // Execute top decisions
    console.log(`\n📋 Found ${decisions.length} trading opportunities`);

    for (const decision of decisions) {
      if (decision.confidence < this.minConfidence) {
        console.log(`⏭️  Skipping ${decision.symbol}: confidence too low (${(decision.confidence * 100).toFixed(1)}%)`);
        continue;
      }

      try {
        await this.executeDecision(decision, tradeDate);
      } catch (error) {
        console.error(`Error executing decision for ${decision.symbol}:`, error.message);
      }
    }

    // Record signals
    for (const decision of decisions) {
      this.db.recordSignal(
        tradeDate,
        decision.symbol,
        decision.action,
        decision.confidence,
        decision.reasoning,
        decision.executed ? 1 : 0
      );
    }

    console.log('✓ Trading cycle completed\n');
  }

  /**
   * Analyze a symbol for buy opportunities
   */
  async analyzeSymbol(symbol, tradeDate) {
    console.log(`  Analyzing ${symbol}...`);

    // Fetch historical prices
    const priceData = await this.marketDataClient.getHistoricalPrices(symbol, 'compact');

    if (!priceData.prices || priceData.prices.length < 50) {
      console.log(`    ⚠️  Insufficient data for ${symbol}`);
      return null;
    }

    // Generate signals using analysis server
    const signals = await this.analysisClient.generateSignals(symbol, priceData.prices);

    // Only consider buy signals here
    if (signals.signal !== 'BUY') {
      console.log(`    ℹ️  ${symbol}: ${signals.signal} (confidence: ${(signals.confidence * 100).toFixed(1)}%)`);
      return null;
    }

    console.log(`    ✅ ${symbol}: BUY signal detected (confidence: ${(signals.confidence * 100).toFixed(1)}%)`);

    return {
      symbol,
      action: 'BUY',
      price: signals.currentPrice,
      confidence: signals.confidence,
      reasoning: signals.reasons.join('; '),
      indicators: signals.indicators,
      executed: false,
    };
  }

  /**
   * Evaluate existing position for sell opportunities
   */
  async evaluatePosition(position, tradeDate) {
    console.log(`  Evaluating position ${position.symbol}...`);

    // Fetch current price data
    const priceData = await this.marketDataClient.getHistoricalPrices(position.symbol, 'compact');

    if (!priceData.prices || priceData.prices.length < 50) {
      return null;
    }

    // Generate signals
    const signals = await this.analysisClient.generateSignals(position.symbol, priceData.prices);
    const currentPrice = signals.currentPrice;

    // Calculate profit/loss
    const profitLoss = ((currentPrice - position.average_cost) / position.average_cost) * 100;

    // Sell conditions
    const reasons = [];
    let shouldSell = false;
    let confidence = 0;

    // 1. Technical sell signal with high confidence
    if (signals.signal === 'SELL' && signals.confidence > 0.7) {
      shouldSell = true;
      confidence = signals.confidence;
      reasons.push('Strong technical sell signal');
    }

    // 2. Stop loss (-10%)
    if (profitLoss < -10) {
      shouldSell = true;
      confidence = Math.max(confidence, 0.9);
      reasons.push(`Stop loss triggered (${profitLoss.toFixed(2)}%)`);
    }

    // 3. Take profit (+15%)
    if (profitLoss > 15) {
      shouldSell = true;
      confidence = Math.max(confidence, 0.8);
      reasons.push(`Take profit target reached (${profitLoss.toFixed(2)}%)`);
    }

    // 4. Moderate profit with sell signal
    if (profitLoss > 5 && signals.signal === 'SELL' && signals.confidence > 0.5) {
      shouldSell = true;
      confidence = Math.max(confidence, signals.confidence);
      reasons.push(`Moderate profit with sell signal (${profitLoss.toFixed(2)}%)`);
    }

    if (!shouldSell) {
      console.log(`    ✓ ${position.symbol}: HOLD (P/L: ${profitLoss.toFixed(2)}%)`);
      return null;
    }

    console.log(`    📤 ${position.symbol}: SELL signal (P/L: ${profitLoss.toFixed(2)}%, confidence: ${(confidence * 100).toFixed(1)}%)`);

    return {
      symbol: position.symbol,
      action: 'SELL',
      price: currentPrice,
      quantity: position.quantity,
      confidence,
      reasoning: reasons.join('; '),
      profitLoss,
      executed: false,
    };
  }

  /**
   * Execute a trading decision
   */
  async executeDecision(decision, tradeDate) {
    const summary = this.portfolio.getPortfolioSummary();

    if (decision.action === 'BUY') {
      // Calculate position size
      const maxInvestment = summary.totalValue * this.maxPositionSize;
      const quantity = Math.floor(maxInvestment / decision.price);

      if (quantity < 1) {
        console.log(`  ⚠️  ${decision.symbol}: Position too small to execute`);
        return;
      }

      const totalCost = quantity * decision.price;

      // Check if we have enough cash
      if (totalCost > summary.cash) {
        console.log(`  ⚠️  ${decision.symbol}: Insufficient cash ($${totalCost.toFixed(2)} needed, $${summary.cash.toFixed(2)} available)`);
        return;
      }

      // Execute buy
      this.portfolio.executeBuy(
        decision.symbol,
        quantity,
        decision.price,
        tradeDate,
        decision.reasoning
      );

      decision.executed = true;
      decision.quantity = quantity;

    } else if (decision.action === 'SELL') {
      // Execute sell
      this.portfolio.executeSell(
        decision.symbol,
        decision.quantity,
        decision.price,
        tradeDate,
        decision.reasoning
      );

      decision.executed = true;
    }
  }

  /**
   * Update prices for all positions
   */
  async updatePositionPrices() {
    const positions = this.portfolio.getPortfolioSummary().positions;

    if (positions.length === 0) {
      return;
    }

    console.log('Updating position prices...');
    const priceMap = {};

    for (const position of positions) {
      try {
        const quote = await this.marketDataClient.getCurrentPrice(position.symbol);
        priceMap[position.symbol] = quote.price;
      } catch (error) {
        console.error(`Error fetching price for ${position.symbol}:`, error.message);
      }
    }

    this.portfolio.updatePrices(priceMap);
    console.log('✓ Prices updated');
  }

  /**
   * Cleanup - disconnect MCP clients
   */
  async cleanup() {
    if (this.marketDataClient) {
      await this.marketDataClient.disconnect();
    }
    if (this.analysisClient) {
      await this.analysisClient.disconnect();
    }
    console.log('✓ MCP clients disconnected');
  }
}

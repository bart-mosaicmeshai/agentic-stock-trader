#!/usr/bin/env node
import 'dotenv/config';
import DatabaseService from './database/db.js';
import { PortfolioManager } from './core/portfolio-manager.js';
import { TradingScheduler, getCurrentETTime, areMarketsOpen } from './core/scheduler.js';
import { Reporter } from './utils/reporter.js';
import { TradingAgent } from './agents/trading-agent.js';

console.log('🤖 Agentic Stock Trader');
console.log('Trading Mode:', process.env.TRADING_MODE || 'paper');
console.log('Initial Capital: $' + (process.env.INITIAL_CAPITAL || '100000'));
console.log('Current Time (ET):', getCurrentETTime());
console.log('Markets Open:', areMarketsOpen() ? 'Yes' : 'No');
console.log('');

/**
 * MCP-based Trading Engine
 * Uses AI agent with MCP servers for market data and analysis
 */
class MCPTradingEngine {
  constructor(db, portfolioManager) {
    this.db = db;
    this.portfolio = portfolioManager;
    this.agent = new TradingAgent(db, portfolioManager);
  }

  async initialize() {
    await this.agent.initialize();
  }

  async runDailyTrading() {
    const today = new Date().toISOString().split('T')[0];

    console.log(`\n📊 Running trading for ${today}...`);

    try {
      // Execute trading cycle using AI agent
      await this.agent.executeTradingCycle(today);

      // Update prices for all positions
      await this.agent.updatePositionPrices();

      // Take daily snapshot
      this.portfolio.takeDailySnapshot(today);

      console.log('✓ Daily trading completed');
    } catch (error) {
      console.error('Error during trading:', error);
      throw error;
    }
  }

  async cleanup() {
    await this.agent.cleanup();
  }
}

// Main application entry point
async function main() {
  let db = null;
  let tradingEngine = null;

  try {
    // Initialize database
    db = new DatabaseService();
    db.initialize();

    // Initialize portfolio manager
    const portfolioManager = new PortfolioManager(db);

    // Initialize trading engine
    tradingEngine = new MCPTradingEngine(db, portfolioManager);

    // Initialize reporter
    const reporter = new Reporter(db);

    // Display current status
    reporter.displayPortfolio();
    reporter.displayPerformance();

    // Check command line arguments
    const args = process.argv.slice(2);

    if (args.includes('--run-now')) {
      // Run trading immediately
      await tradingEngine.initialize();
      await tradingEngine.runDailyTrading();
      await tradingEngine.cleanup();
      reporter.displayPortfolio();
      if (db) db.close();
    } else if (args.includes('--report')) {
      // Just show report
      reporter.displayRecentTrades();
      reporter.displayPerformance();
      if (db) db.close();
    } else if (args.includes('--schedule')) {
      // Initialize MCP clients for scheduled trading
      await tradingEngine.initialize();

      // Start scheduled trading
      const scheduler = new TradingScheduler(tradingEngine);
      scheduler.start();

      console.log('\n✓ Scheduler running. Press Ctrl+C to exit.');

      // Keep process alive
      process.stdin.resume();

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n\nShutting down...');
        scheduler.stop();
        await tradingEngine.cleanup();
        if (db) db.close();
        process.exit(0);
      });
    } else {
      console.log('\nUsage:');
      console.log('  npm start              - Show portfolio status');
      console.log('  npm start -- --run-now - Run trading immediately');
      console.log('  npm start -- --report  - Show detailed report');
      console.log('  npm start -- --schedule - Start daily scheduler (10am ET)');
      console.log('  npm run backtest       - Run backtesting');
      console.log('  npm run report         - Generate performance report');

      if (db) db.close();
    }
  } catch (error) {
    console.error('Error starting application:', error);
    if (tradingEngine) {
      await tradingEngine.cleanup();
    }
    if (db) db.close();
    process.exit(1);
  }
}

main();

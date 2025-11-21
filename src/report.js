#!/usr/bin/env node
import 'dotenv/config';
import DatabaseService from './database/db.js';
import { Reporter } from './utils/reporter.js';
import { PortfolioManager } from './core/portfolio-manager.js';

async function main() {
  const args = process.argv.slice(2);

  let db = null;

  try {
    // Initialize database
    db = new DatabaseService();
    db.initialize();

    const reporter = new Reporter(db);
    const portfolioManager = new PortfolioManager(db);

    console.log('📊 Trading Performance Report\n');

    // Display different reports based on arguments
    if (args.includes('--portfolio')) {
      reporter.displayPortfolio();
    } else if (args.includes('--trades')) {
      const limit = parseInt(args[args.indexOf('--trades') + 1]) || 20;
      reporter.displayRecentTrades(limit);
    } else if (args.includes('--backtest')) {
      reporter.displayBacktestResults();
    } else if (args.includes('--export')) {
      const filename = args[args.indexOf('--export') + 1] || 'performance.csv';
      reporter.exportToCSV(filename);
    } else if (args.includes('--stats')) {
      // Show detailed statistics
      const stats = portfolioManager.getTradeStatistics();
      const metrics = portfolioManager.getPerformanceMetrics();

      console.log('='.repeat(80));
      console.log('TRADING STATISTICS');
      console.log('='.repeat(80));

      console.log('\nTrade Summary:');
      console.log(`  Total Trades: ${stats.totalTrades}`);
      console.log(`  Buy Trades: ${stats.buyTrades}`);
      console.log(`  Sell Trades: ${stats.sellTrades}`);
      console.log(`  Winning Trades: ${stats.winningTrades}`);
      console.log(`  Losing Trades: ${stats.losingTrades}`);
      console.log(`  Win Rate: ${stats.winRate.toFixed(2)}%`);
      console.log(`  Total P/L: $${stats.totalProfitLoss.toFixed(2)}`);

      if (metrics) {
        console.log('\nPerformance Metrics:');
        console.log(`  Initial Value: $${metrics.initialValue.toFixed(2)}`);
        console.log(`  Current Value: $${metrics.currentValue.toFixed(2)}`);
        console.log(`  Total Return: ${metrics.totalReturn >= 0 ? '+' : ''}${metrics.totalReturn.toFixed(2)}%`);
        console.log(`  Sharpe Ratio: ${metrics.sharpeRatio?.toFixed(3) || 'N/A'}`);
        console.log(`  Max Drawdown: ${metrics.maxDrawdown.toFixed(2)}%`);
        console.log(`  Trading Days: ${metrics.tradingDays}`);
      }

      console.log('='.repeat(80));
    } else {
      // Default: show all reports
      reporter.displayPortfolio();
      reporter.displayRecentTrades(10);
      reporter.displayPerformance();
      reporter.displayBacktestResults();
    }

  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  } finally {
    if (db) db.close();
  }
}

// Show usage if --help is passed
if (process.argv.includes('--help')) {
  console.log('Performance Report Tool\n');
  console.log('Usage: npm run report [options]\n');
  console.log('Options:');
  console.log('  --portfolio       Show current portfolio status');
  console.log('  --trades [N]      Show last N trades (default: 20)');
  console.log('  --backtest        Show backtest results');
  console.log('  --stats           Show detailed trading statistics');
  console.log('  --export [file]   Export performance to CSV (default: performance.csv)');
  console.log('  (no options)      Show all reports\n');
  console.log('Examples:');
  console.log('  npm run report');
  console.log('  npm run report -- --portfolio');
  console.log('  npm run report -- --trades 50');
  console.log('  npm run report -- --export results.csv');
  process.exit(0);
}

main();

#!/usr/bin/env node

/**
 * LLM-Powered Trading System Entry Point
 * Uses Claude to make AI-driven trading decisions with MCP tools
 */

import 'dotenv/config';
import DatabaseService from './database/db.js';
import { PortfolioManager } from './core/portfolio-manager.js';
import { LLMTradingAgent } from './agents/llm-trading-agent.js';
import { TradingScheduler } from './core/scheduler.js';

// Check for required API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY not found in .env file');
  console.error('Please add your Anthropic API key to .env:');
  console.error('  ANTHROPIC_API_KEY=sk-ant-...');
  console.error('\nGet your API key at: https://console.anthropic.com/');
  process.exit(1);
}

if (!process.env.ALPHA_VANTAGE_API_KEY) {
  console.error('❌ Error: ALPHA_VANTAGE_API_KEY not found in .env file');
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const shouldRunNow = args.includes('--run-now');
  const shouldSchedule = args.includes('--schedule');

  // Initialize components
  const db = new DatabaseService();
  db.initialize();

  const portfolio = new PortfolioManager(db);
  const agent = new LLMTradingAgent(db, portfolio);

  try {
    // Initialize MCP servers
    await agent.initialize();

    if (shouldRunNow) {
      console.log('🤖 Running LLM trading cycle immediately...\n');
      const today = new Date().toISOString().split('T')[0];
      await agent.executeTradingCycle(today);
      portfolio.takeDailySnapshot(today);

      // Show results
      console.log('\n' + '='.repeat(60));
      const summary = portfolio.getPortfolioSummary();
      console.log(`Portfolio Value: $${summary.totalValue.toFixed(2)}`);
      console.log(`Cash: $${summary.cash.toFixed(2)}`);
      if (summary.totalReturn !== null && summary.totalReturn !== undefined) {
        console.log(`Total Return: ${summary.totalReturn.toFixed(2)}%`);
      }
      console.log('='.repeat(60) + '\n');

    } else if (shouldSchedule) {
      console.log('🤖 Starting LLM Trading Agent with scheduled execution...\n');
      const scheduler = new TradingScheduler(async (date) => {
        await agent.executeTradingCycle(date);
        portfolio.takeDailySnapshot(date);
      });
      scheduler.start();
      console.log('✓ Scheduler running. Press Ctrl+C to stop.\n');

      // Keep process alive
      process.on('SIGINT', async () => {
        console.log('\n\nShutting down...');
        scheduler.stop();
        await agent.cleanup();
        process.exit(0);
      });

    } else {
      // Just show portfolio status
      console.log('\n' + '='.repeat(60));
      console.log('🤖 LLM Trading Agent - Portfolio Status');
      console.log('='.repeat(60));

      const summary = portfolio.getPortfolioSummary();

      console.log(`\n💰 Portfolio Value: $${summary.totalValue.toFixed(2)}`);
      console.log(`💵 Cash: $${summary.cash.toFixed(2)}`);
      console.log(`📊 Total Return: ${summary.totalReturn.toFixed(2)}%`);
      if (summary.dailyReturn !== null) {
        console.log(`📈 Daily Return: ${summary.dailyReturn.toFixed(2)}%`);
      }

      if (summary.positions.length > 0) {
        console.log('\n📦 Current Positions:');
        summary.positions.forEach(pos => {
          const plSign = pos.profit_loss_percent >= 0 ? '+' : '';
          console.log(`  ${pos.symbol}: ${pos.quantity} shares @ $${pos.average_cost.toFixed(2)}`);
          console.log(`    Current: $${pos.current_price.toFixed(2)} | P/L: ${plSign}${pos.profit_loss_percent.toFixed(2)}%`);
        });
      } else {
        console.log('\n📦 No positions');
      }

      console.log('\n' + '='.repeat(60));
      console.log('\nUsage:');
      console.log('  npm run start:llm                Run portfolio status (this screen)');
      console.log('  npm run start:llm -- --run-now   Execute trading cycle immediately');
      console.log('  npm run start:llm -- --schedule  Start daily scheduler (10am ET)');
      console.log('='.repeat(60) + '\n');

      await agent.cleanup();
    }

  } catch (error) {
    console.error('Fatal error:', error);
    await agent.cleanup();
    process.exit(1);
  }
}

main();

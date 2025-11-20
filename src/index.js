#!/usr/bin/env node
import 'dotenv/config';

console.log('🤖 Agentic Stock Trader starting...');
console.log('Trading Mode:', process.env.TRADING_MODE || 'paper');
console.log('Initial Capital:', process.env.INITIAL_CAPITAL || '100000');

// Main application entry point
async function main() {
  try {
    console.log('✓ System initialized');
    console.log('Ready to trade!');
  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
}

main();

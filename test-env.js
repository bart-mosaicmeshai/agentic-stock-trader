#!/usr/bin/env node
import 'dotenv/config';

console.log('=== Environment Variables ===');
console.log('WATCHLIST:', process.env.WATCHLIST);
console.log('MIN_CONFIDENCE:', process.env.MIN_CONFIDENCE);
console.log('MAX_POSITION_SIZE:', process.env.MAX_POSITION_SIZE);
console.log('============================');

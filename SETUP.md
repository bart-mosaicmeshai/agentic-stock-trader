# Quick Setup Guide

## Prerequisites

- Node.js (v18 or higher)
- Alpha Vantage API key (free tier available)

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Alpha Vantage API Key

1. Go to https://www.alphavantage.co/support/#api-key
2. Sign up for a free API key
3. Copy your API key

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```env
ALPHA_VANTAGE_API_KEY=your_actual_api_key_here
```

### 4. Customize Trading Strategy (Optional)

Edit your `.env` file to customize:

```env
# Which stocks to trade
WATCHLIST=AAPL,GOOGL,MSFT,AMZN,TSLA

# Starting capital
INITIAL_CAPITAL=100000

# Maximum 20% of portfolio per stock
MAX_POSITION_SIZE=0.2

# Minimum 60% confidence to execute trades
MIN_CONFIDENCE=0.6
```

## Quick Start

### View Portfolio Status

```bash
npm start
```

### Run Trading Once

```bash
npm start -- --run-now
```

This will:
- Analyze all symbols in your watchlist
- Generate buy/sell signals using technical analysis
- Execute trades if confidence is above threshold
- Update portfolio and record snapshot

### Start Daily Scheduler

```bash
npm start -- --schedule
```

Runs automatically every day at 10am ET (weekdays only).

### Run a Backtest

```bash
# Test over 6 months
npm run backtest 2024-01-01 2024-06-30

# View results
npm run report -- --backtest
```

### Generate Reports

```bash
# Full report
npm run report

# Just trades
npm run report -- --trades 20

# Statistics
npm run report -- --stats

# Export to CSV
npm run report -- --export results.csv
```

## Understanding the Output

### Trading Execution

When running `npm start -- --run-now`, you'll see:

```
🤖 Trading Agent analyzing market for 2024-01-15...

  Analyzing AAPL...
    ✅ AAPL: BUY signal detected (confidence: 72.5%)

  Analyzing GOOGL...
    ℹ️  GOOGL: HOLD (confidence: 45.2%)

📋 Found 1 trading opportunities

✓ BUY 85 AAPL @ $152.30 = $12945.50

✓ Prices updated
✓ Snapshot recorded for 2024-01-15: $100000.00
✓ Daily trading completed
```

### Signal Confidence

- **BUY**: Multiple bullish indicators align
  - Price above SMAs
  - RSI oversold (<30)
  - Strong recent momentum

- **SELL**: Bearish signals or profit targets
  - Price below SMAs
  - RSI overbought (>70)
  - Stop loss or take profit triggered

- **HOLD**: Mixed or weak signals

### Risk Management

Automatic protections:

- **Stop Loss**: Automatically sells at -10% loss
- **Take Profit**: Automatically sells at +15% gain
- **Position Sizing**: Never more than 20% per stock
- **Cash Reserve**: Always maintains available cash

## API Rate Limits

Alpha Vantage free tier:
- 25 requests per day
- 5 requests per minute

The system includes caching to minimize API calls. For backtesting or frequent trading, consider:
- Alpha Vantage premium ($49.99/month)
- Or implement a different data provider

## Troubleshooting

### "API rate limit reached"

Wait a few minutes or upgrade to premium API key.

### "Insufficient data for symbol"

The symbol may not have enough historical data (need 50+ days).

### No trades executed

This is normal if:
- Confidence scores are below MIN_CONFIDENCE threshold
- No clear buy/sell signals in current market conditions
- Insufficient cash for new positions

### MCP Server Errors

If you see MCP connection errors:
1. Check that Node.js version is 18+
2. Try `npm install` again
3. Check that MCP servers are executable

## Next Steps

1. **Paper Trading**: Run daily for 30 days with `npm start -- --schedule`
2. **Backtest**: Test different date ranges to validate strategy
3. **Optimize**: Adjust MIN_CONFIDENCE and MAX_POSITION_SIZE based on results
4. **Monitor**: Use `npm run report` daily to track performance

## Important Notes

⚠️ This is for **paper trading only**. Always thoroughly backtest and validate before considering real money trading.

⚠️ Past performance does not guarantee future results.

⚠️ The free Alpha Vantage API has rate limits. Plan your usage accordingly.

## Need Help?

- Check the main README.md for full documentation
- Review code comments in `src/agents/trading-agent.js` for logic details
- Examine `src/mcp-servers/` for available data and analysis tools

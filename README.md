# Agentic Stock Trader

An AI-powered stock trading system built with Model Context Protocol (MCP) and Claude that autonomously analyzes market data and makes trading decisions with full persistence and backtesting capabilities.

**Two Trading Modes:**
- **Rule-Based Agent**: Traditional technical analysis with fixed algorithms
- **LLM Agent** (NEW): Claude-powered AI that uses MCP tools for intelligent decision-making

## Overview

This project implements an agentic stock trading system that uses MCP servers to:
- Fetch real-time and historical stock market data
- Analyze market trends and patterns
- Generate trading signals
- Execute trades in paper trading mode
- Track and persist portfolio performance
- Backtest strategies against historical data
- Generate comprehensive performance reports

## Features

### 📊 Persistent Paper Trading
- All trades and portfolio state are stored in SQLite database
- Daily snapshots track performance over time
- Run daily for 30 days and evaluate results
- Resume trading sessions without losing data

### 🔬 Backtesting Engine
- Test strategies against historical data
- Simulates daily trading at 10am ET
- Comprehensive performance metrics (Sharpe ratio, win rate, max drawdown)
- Compare multiple backtest runs

### 📈 Performance Analytics
- Real-time portfolio tracking
- Daily and cumulative returns
- Trade statistics and win rates
- Export data to CSV for further analysis

### ⏰ Automated Scheduling
- Cron-based scheduler for daily trading at 10am ET
- Weekday-only execution (Monday-Friday)
- Manual execution for testing

## Architecture

```
src/
├── database/           # SQLite persistence layer
│   ├── schema.js      # Database schema and table definitions
│   └── db.js          # Database service with all operations
├── core/              # Core trading components
│   ├── portfolio-manager.js  # Portfolio state and trade execution
│   ├── scheduler.js          # Daily trading scheduler (10am ET)
│   └── backtest-engine.js    # Backtesting framework
├── utils/             # Utility functions
│   └── reporter.js    # Performance reporting and visualization
├── mcp-servers/       # MCP server implementations (to be implemented)
├── agents/            # Trading agents (to be implemented)
├── index.js           # Main application entry point
├── backtest.js        # Backtesting script
└── report.js          # Reporting script
```

The system uses the Model Context Protocol (MCP) to modularize trading components:
- **Market Data Server**: Provides stock prices, charts, and market information
- **Analysis Server**: Technical analysis indicators and pattern recognition
- **Trading Agent**: Main decision-making component that coordinates analysis and execution

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Alpha Vantage API Key

Get a free API key from Alpha Vantage:

1. Visit https://www.alphavantage.co/support/#api-key
2. Enter your email and click "GET FREE API KEY"
3. Copy your API key (starts with a letter, contains letters and numbers)

**Free Tier Limits**: 25 requests per day, 5 requests per minute

### 3. Get Anthropic API Key (for LLM Agent)

Get an API key from Anthropic:

1. Visit https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

**Note**: Only required if using the LLM-powered agent. The rule-based agent works without this.

### 4. Configure Environment

Copy `.env.example` to `.env` and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# API Keys
ALPHA_VANTAGE_API_KEY=your_actual_api_key_here
ANTHROPIC_API_KEY=sk-ant-your_key_here  # Required for LLM agent
FINNHUB_API_KEY=your_api_key_here  # Optional

# Trading Configuration
TRADING_MODE=paper
INITIAL_CAPITAL=100000  # Starting capital for paper trading

# Trading Strategy
WATCHLIST=AAPL,GOOGL,MSFT,AMZN,TSLA  # Stocks to trade
MAX_POSITION_SIZE=0.2  # Max 20% of portfolio per position
MIN_CONFIDENCE=0.6  # Min 60% confidence to execute trades

# MCP Configuration
MCP_SERVER_PORT=3000
```

### 5. Initialize Database

The database will be automatically created on first run in `data/trading.db`

## Usage

### Choose Your Trading Agent

#### **Rule-Based Agent** (Traditional)

Uses fixed technical analysis algorithms (SMA, RSI, MACD) with predetermined thresholds.

```bash
# View portfolio status
npm start

# Run trading immediately
npm start -- --run-now

# Start daily scheduler (10am ET)
npm start -- --schedule
```

#### **LLM Agent** (AI-Powered) ⭐ NEW

Uses Claude to make intelligent decisions by analyzing market data through MCP tools.

```bash
# View portfolio status
npm run start:llm

# Run trading immediately (Claude analyzes and trades)
npm run start:llm -- --run-now

# Start daily scheduler (10am ET)
npm run start:llm -- --schedule
```

**How the LLM Agent Works:**

1. Claude receives portfolio context and watchlist
2. Uses MCP tools to fetch market data (`get_historical_prices`)
3. Uses MCP tools to calculate indicators (`calculate_rsi`, `generate_signals`)
4. Analyzes current positions for sell opportunities
5. Makes reasoning-based decisions with confidence scores
6. Executes trades through the portfolio manager

**Example LLM Decision:**
```json
{
  "action": "BUY",
  "symbol": "AAPL",
  "quantity": 50,
  "confidence": 0.78,
  "reasoning": "Strong uptrend confirmed by SMA20 > SMA50, RSI at 45 (not overbought), recent momentum +5.2%. Technical indicators align for a buy opportunity.",
  "indicators_used": ["SMA", "RSI", "MACD", "trend_analysis"]
}
```

### Portfolio Status

Shows current holdings, cash, returns, and position details.

### Generate Reports

```bash
# Show all reports
npm run report

# Show only portfolio
npm run report -- --portfolio

# Show last 50 trades
npm run report -- --trades 50

# Show detailed statistics
npm run report -- --stats

# Show backtest results
npm run report -- --backtest

# Export performance to CSV
npm run report -- --export results.csv
```

### Run Backtests

```bash
# Backtest with recent dates (use current year data)
npm run backtest 2025-08-01 2025-11-15

# Backtest specific date range
npm run backtest 2025-06-01 2025-09-30

# Backtest with custom initial capital
npm run backtest 2025-08-01 2025-11-15 50000

# Show help
npm run backtest -- --help
```

Backtest data is stored in `data/backtest.db` separately from live paper trading data.

**Historical Data Caching:**
- First backtest run fetches data from API and caches locally
- Subsequent runs use cached data (zero API calls!)
- Cache expires after 1 day to ensure fresh data
- Cache stored in `cache/historical/` directory
- Allows unlimited backtesting without hitting API limits

## Agent Comparison: Rule-Based vs LLM

| Feature | Rule-Based Agent | LLM Agent (Claude) |
|---------|------------------|-------------------|
| **Decision Making** | Fixed algorithms | Adaptive reasoning |
| **Technical Analysis** | Pre-calculated signals | Dynamic tool usage |
| **Confidence Scoring** | Formula-based (0.25 + 0.3 + ...) | Context-aware judgment |
| **Reasoning** | Static templates | Natural language explanations |
| **Market Conditions** | Ignores broader context | Can consider nuance |
| **API Costs** | Alpha Vantage only | Alpha Vantage + Anthropic |
| **Execution Speed** | ~1-2 seconds | ~5-10 seconds |
| **Transparency** | Fully deterministic | Explainable (with reasoning) |
| **Adaptability** | Requires code changes | Can adjust to new patterns |
| **Best For** | Backtesting, research | Live trading, complex markets |

**Cost Comparison:**
- **Rule-Based**: Free (just Alpha Vantage API)
- **LLM**: ~$0.015 per trading cycle (input: 2K tokens @ $3/M, output: 500 tokens @ $15/M)

## Database Schema

The system uses SQLite with the following tables:

- **portfolio** - Current holdings (symbol, quantity, average cost)
- **cash_balance** - Available cash
- **trades** - All executed trades with reasoning
- **daily_snapshots** - Daily portfolio value and returns
- **trading_signals** - Agent decisions and confidence levels
- **backtest_runs** - Backtest metadata and results
- **backtest_trades** - Trades from backtesting sessions

All data persists between runs, allowing long-term evaluation.

## Trading Strategy Implementation

The system is now fully implemented with MCP-based trading logic:

### **Implemented MCP Servers**

1. **Market Data Server** (`src/mcp-servers/market-data-server.js`):
   - Fetches real-time and historical stock prices via Alpha Vantage API
   - Tools: `get_current_price`, `get_historical_prices`, `get_intraday_prices`, `search_symbols`
   - Includes response caching to respect API rate limits

2. **Analysis Server** (`src/mcp-servers/analysis-server.js`):
   - Technical analysis indicators: SMA, EMA, RSI, MACD, Bollinger Bands
   - Trend detection and signal generation
   - Tools: `calculate_sma`, `calculate_rsi`, `calculate_macd`, `detect_trend`, `generate_signals`

### **AI Trading Agent**

The `TradingAgent` (`src/agents/trading-agent.js`) implements intelligent trading decisions:

- **Buy Logic**: Analyzes watchlist symbols using technical indicators, confidence scoring
- **Sell Logic**: Stop loss (-10%), take profit (+15%), technical sell signals
- **Position Sizing**: Configurable max position size (default 20% of portfolio)
- **Risk Management**: Minimum confidence threshold (default 60%)

### **Configuration**

Customize trading behavior in `.env`:

```env
WATCHLIST=AAPL,GOOGL,MSFT,AMZN,TSLA  # Symbols to trade
MAX_POSITION_SIZE=0.2                 # Max 20% per position
MIN_CONFIDENCE=0.6                    # Min 60% confidence to trade
```

#### **Watchlist Configuration**

The watchlist determines which stocks the system analyzes and trades. You can configure any stocks you want:

**Examples:**

```env
# Conservative - Large Cap Tech (3 stocks)
WATCHLIST=AAPL,MSFT,GOOGL
MAX_POSITION_SIZE=0.33  # Can invest up to 99% if all trigger

# Diversified - Multiple Sectors (10 stocks)
WATCHLIST=AAPL,JPM,XOM,JNJ,WMT,DIS,BA,CAT,NVDA,AMD
MAX_POSITION_SIZE=0.15  # Spread across 10 stocks

# Aggressive - High Growth Tech
WATCHLIST=TSLA,NVDA,AMD,PLTR,SNOW,NET,CRWD,ZS
MAX_POSITION_SIZE=0.20

# Index Tracking - ETFs
WATCHLIST=SPY,QQQ
MAX_POSITION_SIZE=0.5   # 50% each

# Sector Focus - Energy
WATCHLIST=XOM,CVX,COP,SLB,EOG
MAX_POSITION_SIZE=0.25

# Sector Focus - Healthcare
WATCHLIST=JNJ,PFE,MRK,ABBV,LLY
MAX_POSITION_SIZE=0.25
```

**Sizing Guidelines:**

| Watchlist Size | API Calls/Day | Max Position Size | Strategy Type |
|----------------|---------------|-------------------|---------------|
| 2-3 stocks | ~6 calls | 30-50% | Concentrated |
| 5 stocks (default) | ~12 calls | 20% | Balanced |
| 8 stocks | ~20 calls | 12-15% | Diversified |
| 10+ stocks | 25+ calls | 10% | Highly Diversified |

**API Considerations:**
- **Free Alpha Vantage**: 25 requests/day → Recommended max 8 stocks
- **Premium Alpha Vantage** ($49.99/mo): 75+ requests/day → 20+ stocks possible
- Each stock analyzed requires 1-2 API calls per trading session

**Capital Allocation:**
- System uses position sizing, NOT all-in strategy
- Keeps cash available for opportunities (typically 40-80% stays in cash)
- Example: 5 stocks at 20% each = max 100% invested (if all trigger buy signals)
- Realistic: Usually only 1-3 positions trigger per day = 20-60% invested

### **How It Works**

1. **Daily Trading Cycle**:
   - Agent analyzes each symbol in watchlist
   - Fetches historical prices via Market Data Server
   - Generates buy/sell signals via Analysis Server
   - Executes trades based on confidence levels
   - Records all decisions in database

2. **Technical Analysis**:
   - SMA 20/50 for trend identification
   - EMA 12 for momentum
   - RSI 14 for overbought/oversold conditions
   - Recent price momentum analysis
   - Multi-factor confidence scoring

3. **Risk Management**:
   - Automatic stop loss at -10%
   - Take profit at +15%
   - Position sizing based on portfolio value
   - Confidence-based trade filtering

## Example: 30-Day Paper Trading Evaluation

```bash
# Day 1: Start the scheduler
npm start -- --schedule

# The system will automatically trade daily at 10am ET

# Any day: Check progress
npm run report -- --stats

# After 30 days: Generate final report
npm run report
npm run report -- --export 30day-results.csv
```

## Example: Backtesting

```bash
# Test your strategy over 6 months
npm run backtest 2024-01-01 2024-06-30 100000

# View results
npm run report -- --backtest

# Compare with another period
npm run backtest 2024-07-01 2024-12-31 100000
```

## Performance Metrics

The system calculates:

- **Total Return** - Percentage gain/loss
- **Daily Returns** - Day-over-day performance
- **Sharpe Ratio** - Risk-adjusted returns
- **Max Drawdown** - Largest peak-to-trough decline
- **Win Rate** - Percentage of profitable trades
- **Total P/L** - Absolute profit/loss in dollars

## Data Location

- **Paper Trading Database**: `data/trading.db`
- **Backtest Database**: `data/backtest.db`
- **Historical Data Cache**: `cache/historical/` (JSON files)
- **CSV Exports**: Current directory (customizable)

## Troubleshooting

### API Rate Limit Reached

**Error**: `API rate limit reached. Please try again later or use a premium API key.`

**Cause**: Alpha Vantage free tier allows 25 requests per day. Each backtest initialization uses 5 API calls (one per stock in watchlist).

**Solutions**:
1. **Wait for reset**: API limits reset at midnight UTC
2. **Use cached data**: After first successful run, subsequent backtests use cache (zero API calls)
3. **Reduce watchlist**: Temporarily use fewer stocks in `.env`
4. **Upgrade API**: Premium tier ($49.99/mo) provides 75+ requests/day

**Cache Benefits**:
```bash
# First run: Uses 5 API calls, caches data
npm run backtest 2025-08-01 2025-11-15

# Second run: Uses 0 API calls (from cache!)
npm run backtest 2025-08-01 2025-11-15

# Different date range: Still uses cache
npm run backtest 2025-09-01 2025-11-15
```

### No Trades Executed

**Observation**: Backtest or live trading shows 0 trades.

**This is normal!** The system is conservative and only trades when:
- Technical signals align (SMA, EMA, RSI, momentum)
- Confidence > 60% (or your `MIN_CONFIDENCE` setting)
- Sufficient cash available
- Risk management rules satisfied

**To see more trades**:
1. Lower confidence threshold in `.env`: `MIN_CONFIDENCE=0.5`
2. Try different time periods (some periods have clearer signals)
3. Adjust position sizing: `MAX_POSITION_SIZE=0.25`

### Markets Closed / Wrong Date

The system shows "Markets Open: No" because it checks current ET time. This is normal outside of 9:30 AM - 4:00 PM ET, Monday-Friday.

For backtesting, use dates within your cached data range (check output for date range).

## Next Steps & Best Practices

### Initial Setup Complete ✅

You've successfully:
- Installed and configured the system
- Set up Alpha Vantage API key
- Run your first trading cycle
- Implemented historical data caching

### Recommended Workflow

**Day 1: Populate Cache**
```bash
# Run one backtest to cache historical data
npm run backtest 2025-08-01 2025-11-15

# This uses 5 API calls and caches the data
```

**Day 1+: Experiment Freely**
```bash
# Try different confidence thresholds
# Edit .env: MIN_CONFIDENCE=0.5
npm run backtest 2025-08-01 2025-11-15

# Try different date ranges (uses same cache)
npm run backtest 2025-09-01 2025-11-15

# Try different position sizing
# Edit .env: MAX_POSITION_SIZE=0.15
npm run backtest 2025-08-01 2025-11-15

# View all backtest results
npm run report -- --backtest
```

**Daily: Live Trading**
```bash
# Manual run (1-2 API calls per watchlist stock)
npm start -- --run-now

# Or automated (once per day at 10am ET)
npm start -- --schedule
```

### 30-Day Evaluation Plan

#### Using Rule-Based Agent:
```bash
# Start automated trading
npm start -- --schedule
```

#### Using LLM Agent:
```bash
# Start LLM-powered trading
npm run start:llm -- --schedule
```

**Monitor Progress** (weekly):
```bash
npm run report -- --stats
npm run report -- --trades 20
```

**After 30 Days**:
```bash
npm run report
npm run report -- --export 30day-evaluation.csv
```

**Comparing Both Agents:**
Run both agents side-by-side using separate databases to compare performance:
```bash
# Use two terminal windows, each with different database path
# Or run them on different schedules
```

### Optimization Tips

1. **Test Strategies**: Use backtesting to validate before live trading
2. **Start Conservative**: Default 60% confidence is good for learning
3. **Monitor API Usage**: Check how many calls you use per day
4. **Review Trades**: Look at reasoning in reports to understand decisions
5. **Adjust Gradually**: Change one parameter at a time

### Cache Management

```bash
# Clear cache to force fresh data fetch
rm -rf cache/

# Clear specific symbol
rm cache/historical/AAPL_full.json

# Check cache size
du -sh cache/
```

Cache automatically expires after 1 day, so you'll get fresh data daily without manual clearing.

## Development

### Project Structure

- All persistence logic is in `src/database/`
- Core trading functionality in `src/core/`
- Utilities and reporting in `src/utils/`
- MCP servers to be implemented in `src/mcp-servers/`
- Trading agents to be implemented in `src/agents/`

### Adding New Features

1. Update database schema in `src/database/schema.js`
2. Add database operations to `src/database/db.js`
3. Implement business logic in appropriate core modules
4. Update reporters to display new metrics

## Roadmap

- [ ] Implement MCP market data server
- [ ] Implement MCP analysis server
- [ ] Create LLM-based trading agent
- [ ] Add real-time price updates
- [ ] Implement risk management rules
- [ ] Add notification system
- [ ] Web dashboard for monitoring

## Contributing

This project is in active development. Contributions welcome!

## License

MIT

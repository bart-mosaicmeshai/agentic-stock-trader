# Agentic Stock Trader

A **production-grade multi-agent stock trading system** demonstrating the Model Context Protocol (MCP) with three different AI approaches: rule-based algorithms, cloud LLMs (Claude), and local LLMs (LM Studio).

## 🚀 Quick Start

```bash
git clone https://github.com/bart-mosaicmeshai/agentic-stock-trader.git
cd agentic-stock-trader
npm install
cp .env.example .env
# Add your API keys to .env

# Run with Claude (recommended)
npm run start:llm -- --run-now

# OR run with local LLM (100% private)
npm run start:local -- --run-now

# OR run with rule-based (fastest)
npm start -- --run-now
```

**📚 New to the project?** Start with [QUICKSTART.md](./QUICKSTART.md)

## Three Agent Types

| Agent | Model | Speed | Cost | Privacy | Use Case |
|-------|-------|-------|------|---------|----------|
| **Rule-Based** | Deterministic | 1-2s | $0 | ✅ Local | Backtesting, research |
| **Claude Haiku** | claude-3-haiku | 5-10s | ~$0.001/trade | ☁️ Cloud | Live trading, smart decisions |
| **Local LLM** | LM Studio | 3-10s | $0 | ✅ Private | Unlimited experiments |

**All three agents use the SAME MCP tools!** This demonstrates MCP's portability.

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

#### **Claude Agent** (Cloud AI) ⭐ RECOMMENDED

Uses Claude Haiku to make intelligent decisions by analyzing market data through MCP tools.

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

#### **Local LLM Agent** (Private AI) 🔒 NEW

Uses a local LLM via LM Studio for 100% private trading with zero API costs.

**Prerequisites:**
1. Install LM Studio from https://lmstudio.ai/
2. Download a compatible model (e.g., Hermes-3-8B, Qwen 2.5, Llama 3.3)
3. Start the Local Server in LM Studio (runs on http://localhost:1234)

```bash
# View portfolio status
npm run start:local

# Run trading immediately (Local LLM analyzes and trades)
npm run start:local -- --run-now

# Start daily scheduler (10am ET)
npm run start:local -- --schedule
```

**Benefits:**
- 🏠 100% Private - No data leaves your machine
- 💰 Free - Zero API costs after setup
- 🚀 Unlimited - No rate limits
- 🔧 Customizable - Can fine-tune models

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

#### Using Claude Agent:
```bash
# Start Claude-powered trading
npm run start:llm -- --schedule
```

#### Using Local LLM Agent:
```bash
# Start local LLM-powered trading
npm run start:local -- --schedule
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

**Comparing All Three Agents:**
Run all three agents side-by-side to compare performance:
```bash
# Terminal 1: Rule-based
npm start -- --run-now

# Terminal 2: Claude
npm run start:llm -- --run-now

# Terminal 3: Local LLM
npm run start:local -- --run-now
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

## 📖 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get running in 5 minutes
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Deep dive into system design
- **[LLM-AGENT-GUIDE.md](./LLM-AGENT-GUIDE.md)** - Complete guide to using Claude agent
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and updates

## Project Structure

```
src/
├── agents/                    # Three trading agents
│   ├── trading-agent.js       # Rule-based (deterministic)
│   ├── llm-trading-agent.js   # Claude Haiku (cloud AI)
│   └── local-llm-agent.js     # LM Studio (local AI)
│
├── mcp-servers/               # MCP tool servers
│   ├── market-data-server.js  # Stock price data
│   └── analysis-server.js     # Technical indicators
│
├── utils/
│   ├── mcp-client.js          # MCP client wrapper
│   └── reporter.js            # Performance reporting
│
├── core/
│   ├── portfolio-manager.js   # Portfolio state
│   ├── scheduler.js           # Daily automation
│   └── backtest-engine.js     # Historical testing
│
├── database/
│   ├── db.js                  # Database service
│   └── schema.js              # SQLite schema
│
├── index.js                   # Rule-based agent entry
├── index-llm.js               # Claude agent entry
├── index-local.js             # Local LLM agent entry
├── backtest.js                # Backtesting script
└── report.js                  # Reporting script
```

## What Makes This Special

### 1. **True MCP Implementation**
- Real MCP servers with stdio communication
- Tools work across different AI models
- Demonstrates MCP's portability

### 2. **Multi-Agent Architecture**
- Compare rule-based, cloud AI, and local AI
- Same tools, different intelligence
- Real-world AI comparison platform

### 3. **Production-Grade Features**
- SQLite persistence
- Historical data caching
- Error handling and logging
- Automated scheduling
- Comprehensive reporting

### 4. **Educational Value**
- See how agentic loops work
- Understand MCP protocol
- Compare AI decision-making
- Learn practical AI engineering

## Key Learnings

**About MCP:**
- MCP = "USB for AI" - universal tool standard
- Tools are reusable across any LLM
- Stdio communication enables process isolation
- Same tools work with Claude, local LLMs, future models

**About Agentic AI:**
- Agents don't execute tools directly
- Loop: Request → Execute locally → Return result → Repeat
- Tool calling != direct access
- Reasoning emerges from multi-turn interaction

**About Trading:**
- AI agents can be conservative (good!)
- Confidence scoring helps filter trades
- Reasoning transparency builds trust
- Backtesting validates strategies

## Performance Notes

From testing all three agents on AAPL (2025-11-21):

**Claude Haiku:**
- Decision: HOLD
- Confidence: 60%
- Reasoning: "Neutral/slightly bearish, sideways trading pattern"
- Tool calls: 5 (get_prices, SMA, RSI, MACD, trend)

**Local LLM (gpt-oss-20b):**
- Decision: HOLD
- Confidence: 55%
- Reasoning: "Weak sideways trend, RSI 42.6, no clear signals"
- Tool calls: 4 (get_prices, SMA, RSI, trend)

**Both agents agreed!** Conservative decisions with similar reasoning.

## Contributing

Contributions welcome! Areas for improvement:
- Additional MCP tools (news sentiment, earnings data)
- More sophisticated trading strategies
- Web dashboard for monitoring
- Additional model support (Ollama, etc.)
- Performance optimizations

## License

MIT

## Acknowledgments

Built with:
- [Anthropic Claude](https://www.anthropic.com/) - Cloud AI
- [LM Studio](https://lmstudio.ai/) - Local AI
- [Alpha Vantage](https://www.alphavantage.co/) - Market data
- [Model Context Protocol](https://modelcontextprotocol.io/) - Tool standard

---

**⭐ Star this repo if you found it useful!**

This project demonstrates production-grade agentic AI with MCP. Perfect for learning, research, and building your own AI agents.

# Agentic Stock Trader

An AI-powered stock trading system built with Model Context Protocol (MCP) that autonomously analyzes market data and makes trading decisions with full persistence and backtesting capabilities.

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

### 2. Configure Environment

Copy `.env.example` to `.env` and configure your settings:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# API Keys (add your keys)
ALPHA_VANTAGE_API_KEY=your_api_key_here
FINNHUB_API_KEY=your_api_key_here

# Trading Configuration
TRADING_MODE=paper
INITIAL_CAPITAL=100000
RISK_TOLERANCE=moderate

# MCP Configuration
MCP_SERVER_PORT=3000
```

### 3. Initialize Database

The database will be automatically created on first run in `data/trading.db`

## Usage

### View Portfolio Status

```bash
npm start
```

Shows current portfolio, positions, and performance summary.

### Run Trading Immediately

```bash
npm start -- --run-now
```

Executes trading logic immediately and records a daily snapshot.

### Start Daily Scheduler

```bash
npm start -- --schedule
```

Starts the cron scheduler to run trading daily at 10am ET (Monday-Friday). The process will keep running until stopped with Ctrl+C.

**For 30-day evaluation**: Run this command and let it execute daily. After 30 days, use the reporting tools to analyze performance.

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
# Backtest with defaults (2024-01-01 to 2024-12-31)
npm run backtest

# Backtest specific date range
npm run backtest 2024-06-01 2024-12-31

# Backtest with custom initial capital
npm run backtest 2024-01-01 2024-12-31 50000

# Show help
npm run backtest -- --help
```

Backtest data is stored in `data/backtest.db` separately from live paper trading data.

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

The current implementation includes placeholders for MCP-based trading logic. To implement your strategy:

1. **Create MCP Servers** in `src/mcp-servers/`:
   - Market data server for fetching prices
   - Analysis server for technical indicators

2. **Implement Trading Agent** in `src/agents/`:
   - Connect to MCP servers
   - Analyze market data
   - Generate trading signals

3. **Update Trading Engine** in `src/index.js`:
   - Replace `SimpleTradingEngine` with your MCP-based logic
   - Use `portfolioManager.executeBuy()` and `executeSell()` for trades

4. **Update Backtest Strategy** in `src/backtest.js`:
   - Implement `ExampleStrategy.generateSignals()`
   - Return signals in format: `{symbol, action, quantity, price, reasoning}`

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
- **CSV Exports**: Current directory (customizable)

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

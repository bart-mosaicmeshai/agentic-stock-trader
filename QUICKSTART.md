# Quick Start Guide

Get your agentic stock trading system running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Git
- Text editor

## Step 1: Clone & Install (30 seconds)

```bash
git clone https://github.com/bart-mosaicmeshai/agentic-stock-trader.git
cd agentic-stock-trader
npm install
```

## Step 2: Get API Keys (2 minutes)

### Alpha Vantage (Required for all agents)
1. Visit https://www.alphavantage.co/support/#api-key
2. Enter your email → Click "GET FREE API KEY"
3. Copy your key

### Anthropic (Only for Claude agent)
1. Visit https://console.anthropic.com/
2. Sign up / Log in
3. Navigate to API Keys
4. Create new key → Copy it

## Step 3: Configure Environment (30 seconds)

```bash
cp .env.example .env
```

Edit `.env`:
```env
ALPHA_VANTAGE_API_KEY=your_actual_key_here
ANTHROPIC_API_KEY=sk-ant-your_key_here  # If using Claude

# Optional: Customize
WATCHLIST=AAPL  # Start with one stock
INITIAL_CAPITAL=100000
MIN_CONFIDENCE=0.6
```

## Step 4: Choose Your Agent (1 minute)

### Option A: Rule-Based Agent (Fastest)
```bash
npm start -- --run-now
```

**Pros:** Instant, free, deterministic
**Use for:** Learning, backtesting

### Option B: Claude Haiku (Smartest)
```bash
npm run start:llm -- --run-now
```

**Pros:** Intelligent reasoning, adaptive
**Use for:** Live trading, research

### Option C: Local LLM (Most Private)

First, install LM Studio:
1. Download from https://lmstudio.ai/
2. Download a model (e.g., Hermes-3-8B)
3. Start Local Server

Then run:
```bash
npm run start:local -- --run-now
```

**Pros:** 100% private, free, unlimited
**Use for:** Private strategies, experimentation

## Step 5: Check Results (30 seconds)

```bash
# View reports
npm run report

# View trades
npm run report -- --trades 10

# Export data
npm run report -- --export results.csv
```

## What Just Happened?

Your agent:
1. ✅ Fetched historical stock data (Alpha Vantage)
2. ✅ Calculated technical indicators (SMA, RSI, MACD)
3. ✅ Analyzed market conditions
4. ✅ Made BUY/SELL/HOLD decision with reasoning
5. ✅ Saved everything to SQLite database

## Next Steps

### Run Daily Automated Trading
```bash
npm run start:llm -- --schedule
```
Runs every weekday at 10am ET.

### Backtest a Strategy
```bash
npm run backtest 2025-08-01 2025-11-15
```

### Compare All Three Agents
```bash
# Terminal 1
npm start -- --run-now

# Terminal 2
npm run start:llm -- --run-now

# Terminal 3 (if LM Studio running)
npm run start:local -- --run-now
```

## Customization

### Change Stocks
Edit `.env`:
```env
WATCHLIST=NVDA,TSLA,AAPL,MSFT
```

### Adjust Risk
```env
MAX_POSITION_SIZE=0.15  # Max 15% per stock
MIN_CONFIDENCE=0.7      # Higher threshold
```

### Change Models
```env
# For Claude
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# For LM Studio
LM_STUDIO_URL=http://localhost:1234/v1
```

## Troubleshooting

### "API rate limit reached"
**Solution:** Alpha Vantage free tier = 25 calls/day
- Wait for reset (midnight UTC)
- Use cached data (automatic after first run)
- Upgrade to premium ($49.99/mo)

### "Model not found" (Claude)
**Solution:** Model not available on your tier
```bash
node test-claude-model.js  # Find available models
```

### LM Studio not connecting
**Solution:** Make sure server is running
```bash
curl http://localhost:1234/v1/models
# Should return list of loaded models
```

### No trades executed
**Solution:** This is normal! Agent is conservative
- Market conditions might not favor trading
- Lower MIN_CONFIDENCE in .env
- Try different stocks in WATCHLIST

## Understanding the Output

```
🤖 LLM Trading Agent analyzing market for 2025-11-21...

💭 Claude is thinking... (stop_reason: tool_use)
  🔧 Using tool: get_historical_prices      ← Fetching data

💭 Claude is thinking... (stop_reason: tool_use)
  🔧 Using tool: calculate_rsi              ← Analyzing momentum

📊 Claude's Analysis:
Based on my analysis of AAPL:                ← Reasoning
- RSI is at 45 (neutral)
- Trend is sideways
- No clear signals

Decision: HOLD                               ← Final decision
Confidence: 60%
```

## Learning Path

1. **Day 1:** Run all three agents once, compare results
2. **Day 2:** Try backtesting different date ranges
3. **Day 3:** Modify watchlist, test different stocks
4. **Week 1:** Run scheduled daily trading
5. **Week 2:** Analyze 7 days of decisions
6. **Month 1:** Compare 30-day performance

## Pro Tips

1. **Start with one stock** to understand behavior
2. **Read the reasoning** in database/reports
3. **Compare agents** side by side
4. **Backtest first** before live paper trading
5. **Monitor API usage** to stay under limits
6. **Keep .env safe** - never commit API keys

## Commands Cheat Sheet

```bash
# View portfolio
npm start

# Execute trading
npm start -- --run-now           # Rule-based
npm run start:llm -- --run-now   # Claude
npm run start:local -- --run-now # Local LLM

# Start scheduler (10am ET daily)
npm run start:llm -- --schedule

# Reports
npm run report                   # All reports
npm run report -- --trades 20    # Last 20 trades
npm run report -- --stats        # Statistics
npm run report -- --export data.csv

# Backtesting
npm run backtest 2025-08-01 2025-11-15

# Testing
node test-claude-model.js        # Test Claude models
node test-lm-studio.js           # Test local LLM
```

## Support

- **Documentation:** See ARCHITECTURE.md, LLM-AGENT-GUIDE.md
- **Issues:** https://github.com/bart-mosaicmeshai/agentic-stock-trader/issues
- **Examples:** Check the README.md

## What You've Built

Congratulations! You now have:
- ✅ Three working AI agents
- ✅ Real MCP implementation
- ✅ Production-grade architecture
- ✅ Complete trading system
- ✅ Privacy options (cloud or local)

This is a **professional reference implementation** for agentic AI systems!

---

**Ready to go deeper?** Read ARCHITECTURE.md to understand how it all works.

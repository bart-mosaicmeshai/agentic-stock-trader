# Changelog

## [0.3.0] - 2025-11-27

### Added - Claude Haiku Backtest & 3-Agent Comparison

#### New Features
- **Claude Haiku Backtesting** using Anthropic API
  - Cloud AI-powered trading decisions on historical data
  - MCP tool usage for technical analysis (SMA, RSI, MACD, trend detection)
  - Natural language reasoning for each trading decision
  - Cost-effective: ~$0.10-0.15 per 2-month backtest (5 stocks)

#### New Files
- `src/backtest-claude.js` - Claude Haiku backtesting script with agentic loop
- `BACKTEST-COMPARISON.md` - Comprehensive 3-agent performance analysis
- New npm script: `npm run backtest:claude`

#### Backtest Results (Sep 15 - Nov 24, 2025)

**Rules-Based Engine:**
- Return: +6.25% | Win Rate: 100% | Sharpe: 15.87 | Cost: $0

**Local LLM (LM Studio):**
- Return: +6.13% | Win Rate: 100% | Sharpe: 11.22 | Cost: $0

**Claude Haiku (Anthropic API):**
- Return: +0.88% | Win Rate: 50% | Sharpe: 1.52 | Cost: ~$0.15

#### Key Findings
- **Rules-based engine won decisively** with highest returns and risk-adjusted performance
- **Local LLM achieved 98% of rules-based performance** at zero cost with AI reasoning
- **Claude underperformed** primarily due to AMZN stop loss (-11%) and conservative positioning
- Simple deterministic rules outperformed sophisticated AI reasoning in this market regime
- Local LLM offers best value: near-identical performance to rules-based, $0 cost, 100% private

#### Documentation
- Updated `README.md` with Claude Haiku backtest section and comparison table
- Added link to `BACKTEST-COMPARISON.md` in multiple locations
- Updated backtest results with 3-agent comparison
- Documented cost estimates for Claude backtesting

#### Configuration
- Backtest databases: `data/backtest.db`, `data/backtest-local.db`, `data/backtest-claude.db`
- All three agents use same historical data cache (zero redundant API calls)

### Usage Examples

```bash
# Claude Haiku backtest
npm run backtest:claude 2025-09-15 2025-11-24

# Local LLM backtest (requires LM Studio)
npm run backtest:local 2025-09-15 2025-11-24

# Rules-based backtest (fastest)
npm run backtest 2025-09-15 2025-11-24
```

### Recommendations

Based on 2-month backtest results:

1. **Best for most users:** Local LLM
   - 98% of rules-based performance
   - Zero cost
   - 100% private
   - AI reasoning transparency

2. **Best for speed/simplicity:** Rules-based
   - Highest returns (6.25%)
   - Deterministic behavior
   - Fastest execution

3. **Consider Claude when:**
   - Need best-in-class reasoning quality
   - Comparing cloud vs local AI
   - Research/learning purposes

---

## [0.2.0] - 2025-11-20

### Added - LLM Trading Agent

#### New Features
- **LLM-Powered Trading Agent** using Claude 3.5 Sonnet
  - Adaptive reasoning instead of fixed rules
  - Dynamic MCP tool usage for market analysis
  - Natural language explanations for all trading decisions
  - Context-aware confidence scoring

#### New Files
- `src/agents/llm-trading-agent.js` - Claude-powered trading agent
- `src/index-llm.js` - Entry point for LLM agent
- `LLM-AGENT-GUIDE.md` - Comprehensive guide for using the LLM agent
- `CHANGELOG.md` - This file

#### Dependencies
- Added `@anthropic-ai/sdk` (v0.70.1) for Claude integration

#### Configuration
- Added `ANTHROPIC_API_KEY` to `.env.example`
- New npm script: `npm run start:llm`

#### Documentation
- Updated `README.md` with LLM agent usage
- Added comparison table: Rule-Based vs LLM agent
- Added cost analysis for LLM usage
- Created detailed LLM agent guide

### How LLM Agent Works

The LLM agent leverages MCP (Model Context Protocol) as originally intended:

1. **Claude as Decision Maker**: Uses Claude 3.5 Sonnet to analyze markets
2. **MCP Tools**: Market data and analysis servers exposed as tools
3. **Agentic Loop**: Claude dynamically calls tools to gather information
4. **Reasoning**: Provides human-readable explanations for every decision
5. **Execution**: Validates and executes trades through portfolio manager

### Key Differences from Rule-Based Agent

| Aspect | Rule-Based | LLM Agent |
|--------|-----------|-----------|
| Logic | Deterministic formulas | AI reasoning |
| Flexibility | Requires code changes | Prompt engineering |
| Explainability | Static templates | Natural language |
| Cost | Free (API only) | ~$0.015/cycle |
| Speed | ~1-2 seconds | ~5-10 seconds |

### Usage Examples

```bash
# Run LLM agent once
npm run start:llm -- --run-now

# Start scheduled daily trading
npm run start:llm -- --schedule

# View portfolio
npm run start:llm
```

### Breaking Changes
None - LLM agent is additive, rule-based agent still works

### Migration Guide
No migration needed. To use LLM agent:
1. Get Anthropic API key from https://console.anthropic.com/
2. Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env`
3. Run `npm run start:llm` instead of `npm start`

---

## [0.1.0] - Previous

### Initial Release
- Rule-based trading agent with technical analysis
- MCP architecture with market data and analysis servers
- SQLite persistence layer
- Backtesting engine
- Performance reporting
- Historical data caching
- Scheduled daily trading at 10am ET

# Changelog

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

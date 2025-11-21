# LLM Trading Agent Guide

## Overview

The LLM Trading Agent uses Claude 3.5 Sonnet to make intelligent trading decisions by dynamically using MCP (Model Context Protocol) tools. Unlike the rule-based agent, Claude can reason about market conditions and adapt its strategy.

## How It Works

### 1. Agent Initialization

```javascript
const agent = new LLMTradingAgent(db, portfolioManager);
await agent.initialize(); // Starts MCP server processes
```

This spawns two MCP server processes:
- **market-data-server.js** - Provides stock price data
- **analysis-server.js** - Provides technical indicators

### 2. Trading Cycle

When you run `npm run start:llm -- --run-now`, here's what happens:

#### Step 1: Context Building
Claude receives:
- Current portfolio state (cash, positions, P/L)
- Watchlist symbols
- Trading rules (position size, confidence threshold)
- Risk management parameters

#### Step 2: Tool Discovery
Claude has access to these MCP tools:

**Market Data Tools:**
- `get_current_price` - Get real-time quote
- `get_historical_prices` - Get daily OHLCV data

**Analysis Tools:**
- `calculate_sma` - Simple Moving Average
- `calculate_rsi` - Relative Strength Index
- `calculate_macd` - MACD indicator
- `detect_trend` - Trend analysis
- `generate_signals` - Comprehensive buy/sell signals

#### Step 3: Analysis Loop
Claude enters an agentic loop:

1. **Assess**: "I need historical data for AAPL"
2. **Tool Call**: Uses `get_historical_prices('AAPL')`
3. **Receive Data**: Gets 100 days of price history
4. **Analyze**: "Let me check the RSI"
5. **Tool Call**: Uses `calculate_rsi(prices, 14)`
6. **Reason**: "RSI is 45, not overbought. Let me check trend..."
7. **Tool Call**: Uses `detect_trend(prices)`
8. **Decide**: "Strong uptrend + moderate RSI = BUY signal"

#### Step 4: Decision Output
Claude returns structured decisions:

```json
{
  "action": "BUY",
  "symbol": "AAPL",
  "confidence": 0.78,
  "reasoning": "Strong uptrend confirmed by SMA20 > SMA50, RSI at 45 (not overbought), recent momentum +5.2%. Technical indicators align for a buy opportunity.",
  "indicators_used": ["SMA", "RSI", "trend_analysis"]
}
```

#### Step 5: Execution
The agent:
- Validates confidence > MIN_CONFIDENCE (default 60%)
- Calculates position size (max 20% of portfolio)
- Checks cash availability
- Executes trade via PortfolioManager
- Records in database with Claude's reasoning

## Example Session Output

```
🤖 LLM Trading Agent analyzing market for 2025-11-20...

💭 Claude is thinking... (stop_reason: tool_use)
  🔧 Using tool: get_historical_prices
  🔧 Using tool: generate_signals

💭 Claude is thinking... (stop_reason: tool_use)
  🔧 Using tool: calculate_rsi
  🔧 Using tool: detect_trend

📊 Claude's Analysis:
Based on my analysis of the current market conditions:

**AAPL (Apple Inc.)**
- Current Price: $150.25
- RSI(14): 45.2 - Neutral territory, not overbought
- Trend: Strong uptrend (+8.3% over 20 days)
- SMA20: $148.50 (price above)
- Recent Momentum: +5.2% (last 5 days)

Decision: BUY 50 shares
Confidence: 78%
Reasoning: Technical indicators show strong bullish setup. The stock is in a clear uptrend with healthy RSI levels, suggesting room for continued growth without being overextended.

  ✅ BOUGHT 50 shares of AAPL @ $150.25 (Confidence: 78.0%)

✓ LLM Trading cycle completed

============================================================
Portfolio Value: $102,512.50
Cash: $92,487.50
Total Return: 2.51%
============================================================
```

## Configuration

### Environment Variables

```env
# Required
ANTHROPIC_API_KEY=sk-ant-your_key_here
ALPHA_VANTAGE_API_KEY=your_key_here

# Trading Parameters
WATCHLIST=AAPL,GOOGL,MSFT,AMZN,TSLA
MAX_POSITION_SIZE=0.2  # 20% max per stock
MIN_CONFIDENCE=0.6     # 60% confidence threshold
```

### Adjusting Agent Behavior

Edit the system prompt in `src/agents/llm-trading-agent.js`:

```javascript
const systemPrompt = `You are an expert stock trading AI agent...

Trading Rules:
1. For buy decisions: Only consider symbols from watchlist
2. For sell decisions: Evaluate positions for stop loss/take profit
3. Position sizing: Max ${this.maxPositionSize * 100}% per position
4. Risk management: Consider portfolio diversification

Your trading style: [CONSERVATIVE/BALANCED/AGGRESSIVE]
Focus on: [GROWTH/VALUE/MOMENTUM/DIVIDEND]
`;
```

## Advantages Over Rule-Based Agent

### 1. Adaptive Reasoning
**Rule-Based:**
```javascript
if (rsi < 30) confidence += 0.3; // Always adds 0.3
```

**LLM:**
```
"RSI is 28, technically oversold. However, considering the broader
downtrend and weak momentum, I'll wait for confirmation rather than
buying on this signal alone."
```

### 2. Context Awareness
**Rule-Based:** Ignores market regime, news, correlations

**LLM:** Can consider:
- "All tech stocks are down today"
- "This stock just broke support"
- "Portfolio is already 60% tech, need diversification"

### 3. Explainability
**Rule-Based:**
```
"BUY AAPL - Price above SMA20 and SMA50 (uptrend); RSI neutral"
```

**LLM:**
```
"I recommend buying AAPL because the technical setup is compelling.
The stock has been in a sustained uptrend, breaking above the 50-day
moving average with strong volume. The RSI at 45 suggests there's
room to run before becoming overbought. Recent earnings beat
expectations, and the momentum indicators are confirming the move.
Given our portfolio composition and risk parameters, a 20% position
makes sense here."
```

### 4. Tool Flexibility
**Rule-Based:** Always calculates all indicators

**LLM:** Uses tools strategically:
- "Let me check the trend first before calculating detailed indicators"
- "RSI looks good, no need to check MACD"
- "I'll look at historical data to see if this pattern has precedent"

## Cost Analysis

### Per Trading Cycle

**Typical Token Usage:**
- Input: ~2,000 tokens (portfolio context + tool results)
- Output: ~500 tokens (analysis + decision)
- Tool calls: 3-5 per symbol

**Cost per cycle:**
- Input: 2K tokens × $3/M = $0.006
- Output: 500 tokens × $15/M = $0.0075
- **Total: ~$0.015 per trading session**

**Monthly Cost (Daily Trading):**
- 22 trading days × $0.015 = **~$0.33/month**

Plus Alpha Vantage API costs (same as rule-based agent).

### Cost Optimization

1. **Reduce watchlist size** - Fewer symbols = fewer tool calls
2. **Cache aggressively** - Reuse market data within the same day
3. **Use batch analysis** - Analyze multiple symbols in one prompt
4. **Limit tool calls** - Add tool call budgets

## Debugging

### Enable Verbose Logging

```javascript
// In llm-trading-agent.js
console.log('Tool call:', block.name, block.input);
console.log('Tool result:', result);
console.log('Claude reasoning:', textContent.text);
```

### Monitor MCP Communication

```bash
# Watch MCP server logs
node src/mcp-servers/market-data-server.js
# In another terminal, run the agent
```

### Check Tool Execution

The agent logs every tool call:
```
🔧 Using tool: get_historical_prices
🔧 Using tool: calculate_rsi
🔧 Using tool: generate_signals
```

If tools fail, you'll see:
```
❌ Tool error: API rate limit reached
```

## Limitations

1. **API Latency**: Claude API calls add 2-5 seconds vs instant rule execution
2. **Cost**: Small but non-zero cost per decision
3. **Determinism**: Same inputs may produce slightly different outputs
4. **Rate Limits**: Anthropic API has rate limits (check your tier)
5. **Context Window**: Very large watchlists may exceed context limits

## Advanced Usage

### Custom System Prompts

Create trading personalities:

**Conservative:**
```javascript
"You are a risk-averse portfolio manager. Only buy when multiple
strong signals align. Prefer established blue-chip stocks. Set
tight stop losses."
```

**Momentum Trader:**
```javascript
"You are a momentum trader. Look for stocks with strong recent
performance and volume. Quick entries and exits. Ride the trend."
```

**Value Investor:**
```javascript
"You are a value investor. Look for oversold conditions, reversal
patterns, and fundamental strength. Patient with positions."
```

### Multi-Agent Systems

Run multiple LLM agents with different strategies:

```javascript
const conservativeAgent = new LLMTradingAgent(db, portfolio);
conservativeAgent.systemPrompt = conservativePrompt;

const aggressiveAgent = new LLMTradingAgent(db, portfolio);
aggressiveAgent.systemPrompt = aggressivePrompt;

// Vote on decisions
const decision = await voteOnDecisions([
  await conservativeAgent.analyze(),
  await aggressiveAgent.analyze()
]);
```

### Adding New MCP Tools

1. Add tool to MCP server:
```javascript
// In analysis-server.js
{
  name: 'detect_support_resistance',
  description: 'Find key support/resistance levels',
  inputSchema: { ... }
}
```

2. Implement handler:
```javascript
case 'detect_support_resistance':
  return this.findSupportResistance(args.prices);
```

3. Tool automatically available to Claude!

## Troubleshooting

### "ANTHROPIC_API_KEY not found"
```bash
# Check .env file exists
ls -la .env

# Verify key is set
cat .env | grep ANTHROPIC

# Restart after adding key
```

### "Tool call timeout"
- MCP server may have crashed
- Check server logs for errors
- Restart the agent

### "Confidence too low"
- Claude is being cautious (good!)
- Lower MIN_CONFIDENCE in .env
- Or wait for better market conditions

### Poor Trading Performance
- Adjust system prompt for your market regime
- Review Claude's reasoning in database
- Consider if rules need updating
- Backtest different prompts

## Best Practices

1. **Start conservative** - Use MIN_CONFIDENCE=0.7 initially
2. **Monitor reasoning** - Check database for decision quality
3. **Paper trade first** - Never start with real money
4. **Compare agents** - Run rule-based and LLM side-by-side
5. **Iterate prompts** - Adjust system prompt based on performance
6. **Review decisions** - Read Claude's reasoning to learn

## Next Steps

- Try running: `npm run start:llm -- --run-now`
- Review trade reasoning in database
- Experiment with different system prompts
- Compare performance vs rule-based agent
- Add custom MCP tools for your strategy

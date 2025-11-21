# Architecture Documentation

## Overview

This is a **multi-agent stock trading system** demonstrating the Model Context Protocol (MCP) with three different AI approaches: rule-based algorithms, cloud LLMs, and local LLMs.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Trading Agents                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Rule-Based  │  │   Claude    │  │  Local LLM  │        │
│  │   Agent     │  │   Haiku     │  │ (LM Studio) │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                 │                 │                │
│         └─────────────────┴─────────────────┘                │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                   ┌────────┴────────┐
                   │  MCP Clients    │
                   │  (Tool Wrapper) │
                   └────────┬────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
    ┌───────▼──────┐               ┌───────▼──────┐
    │ Market Data  │               │   Analysis   │
    │ MCP Server   │               │  MCP Server  │
    │              │               │              │
    │ Tools:       │               │ Tools:       │
    │ - get_price  │               │ - calc_sma   │
    │ - get_hist   │               │ - calc_rsi   │
    │ - search     │               │ - calc_macd  │
    └───────┬──────┘               └───────┬──────┘
            │                               │
            └───────────────┬───────────────┘
                            │
                    ┌───────▼────────┐
                    │  Stdio/IPC     │
                    │  Communication │
                    └────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Supporting Services                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Database   │  │  Portfolio   │  │  Scheduler   │    │
│  │   Service    │  │   Manager    │  │  (cron)      │    │
│  │  (SQLite)    │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Reporter    │  │  Backtest    │  │   Cache      │    │
│  │  (Analytics) │  │   Engine     │  │  Manager     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   External APIs                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Alpha Vantage│  │   Anthropic  │  │  LM Studio   │    │
│  │   (Market    │  │   (Claude)   │  │  (Local LLM) │    │
│  │    Data)     │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Three Agent Types

### 1. Rule-Based Agent
**File:** `src/agents/trading-agent.js`

**Architecture:**
```javascript
TradingAgent {
  - Uses MCP clients to fetch data
  - Applies deterministic formulas:
    * confidence = 0.25 (if uptrend)
    * confidence += 0.3 (if RSI < 30)
    * confidence += 0.15 (if price > EMA12)
  - Executes if confidence > threshold
}
```

**Characteristics:**
- ⚡ Fast (1-2 seconds)
- 💰 Free (no LLM costs)
- 🔒 Deterministic (same inputs = same output)
- 🔧 Requires code changes to adjust strategy

**Use Case:** Backtesting, high-frequency decisions, research

---

### 2. Cloud LLM Agent (Claude Haiku)
**File:** `src/agents/llm-trading-agent.js`

**Architecture:**
```javascript
LLMTradingAgent {
  1. Build context (portfolio, rules, watchlist)
  2. Call Claude API with tools
  3. AGENTIC LOOP:
     while (response.stop_reason === 'tool_use') {
       - Claude requests tool
       - Execute tool LOCALLY via MCP
       - Send result back to Claude
       - Claude analyzes and decides next step
     }
  4. Execute final decision
}
```

**Agentic Loop Example:**
```
User: "Analyze AAPL"
  ↓
Claude: "I need historical data" → tool_use
  ↓
Agent: Calls get_historical_prices → returns 100 data points
  ↓
Claude: "Let me check RSI" → tool_use
  ↓
Agent: Calls calculate_rsi → returns RSI=45.57
  ↓
Claude: "Let me check trend" → tool_use
  ↓
Agent: Calls detect_trend → returns SIDEWAYS
  ↓
Claude: "Based on analysis, HOLD" → end_turn
  ↓
Agent: Records decision with reasoning
```

**Characteristics:**
- 🧠 Intelligent reasoning
- 📊 Context-aware decisions
- 💬 Natural language explanations
- 💰 Small cost (~$0.001/trade)
- ☁️ Requires internet
- 🔐 Data sent to Anthropic

**Use Case:** Live trading, complex decisions, learning from AI reasoning

---

### 3. Local LLM Agent (LM Studio)
**File:** `src/agents/local-llm-agent.js`

**Architecture:**
```javascript
LocalLLMAgent {
  1. Connect to LM Studio (localhost:1234)
  2. Use OpenAI-compatible API
  3. Same agentic loop as Claude
  4. All processing happens locally
}
```

**Characteristics:**
- 🏠 100% Private (no data leaves your machine)
- 💰 Free (after GPU/hardware investment)
- 🚀 No rate limits
- 🎛️ Customizable (can fine-tune models)
- 🐢 Speed depends on hardware
- 🔧 Requires LM Studio setup

**Use Case:** Private trading, unlimited experiments, proprietary strategies

---

## MCP Implementation

### What is MCP?

**Model Context Protocol** = A standard way to give AI models access to external tools.

**The Name Explained:**
- **Model** = The AI (Claude, GPT, Llama)
- **Context** = Tools/data the model can access
- **Protocol** = Standardized interface

### MCP Architecture

#### Server Side (Tools)
```javascript
// src/mcp-servers/market-data-server.js
class MarketDataServer {
  setupHandlers() {
    // Define tools
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [
        {
          name: 'get_historical_prices',
          description: 'Get historical daily prices',
          inputSchema: { /* JSON schema */ }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, (request) => {
      const { name, arguments } = request.params;
      return this.fetchPrices(arguments.symbol);
    });
  }
}

// Runs as separate process via stdio
```

#### Client Side (Agent)
```javascript
// src/utils/mcp-client.js
class MarketDataClient {
  async connect() {
    // Spawns server process
    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['./src/mcp-servers/market-data-server.js']
    });
    await this.client.connect(this.transport);
  }

  async getHistoricalPrices(symbol) {
    // Calls tool via IPC
    return this.client.callTool('get_historical_prices', { symbol });
  }
}
```

#### Agent Side (Orchestration)
```javascript
// src/agents/llm-trading-agent.js
async executeTradingCycle() {
  // 1. Send tools to Claude
  const response = await anthropic.messages.create({
    tools: this.getMCPTools(),  // MCP tools as Claude tools
    messages: [...]
  });

  // 2. Claude responds with tool_use
  if (response.stop_reason === 'tool_use') {
    // 3. Execute tool LOCALLY
    const result = await this.executeMCPTool(
      toolName,
      toolInput
    );

    // 4. Send result back to Claude
    messages.push({ role: 'user', content: result });

    // 5. Continue loop
  }
}
```

### Why MCP?

**Without MCP:**
```javascript
// Every AI system reinvents tool calling
claudeAgent.addTool(customClaudeTool);
gptAgent.addFunction(customGPTFunction);
llamaAgent.addAction(customLlamaAction);
```

**With MCP:**
```javascript
// Write once, use with any model
mcpServer.defineTool('get_price', schema, handler);

// Works with:
- Claude (Anthropic SDK)
- GPT-4 (OpenAI SDK)
- Local LLMs (LM Studio)
- Future models...
```

**MCP is USB for AI** - Universal standard for connecting capabilities.

---

## Data Flow

### Example: LLM Agent Executes Trade

```
1. User runs: npm run start:llm -- --run-now
                ↓
2. LLMTradingAgent.initialize()
   - Spawns market-data-server.js (process 1)
   - Spawns analysis-server.js (process 2)
   - Opens stdio pipes for IPC
                ↓
3. LLMTradingAgent.executeTradingCycle()
   - Builds system prompt with portfolio context
   - Sends to Claude API with tool definitions
                ↓
4. Claude API Response (stop_reason: tool_use)
   {
     "content": [{
       "type": "tool_use",
       "name": "get_historical_prices",
       "input": { "symbol": "AAPL" }
     }]
   }
                ↓
5. Agent.executeMCPTool('get_historical_prices', {symbol: 'AAPL'})
   - Calls marketDataClient.callTool()
   - Sends JSON-RPC request via stdio to market-data-server
                ↓
6. market-data-server.js receives request
   - Calls Alpha Vantage API
   - Fetches 100 days of AAPL data
   - Returns via stdio
                ↓
7. Agent receives result (on local machine)
   - Formats as tool_result
   - Sends back to Claude API
                ↓
8. Claude analyzes data (in Anthropic cloud)
   - "RSI is 45, trend is sideways..."
   - Decides to call another tool OR make decision
                ↓
9. Loop continues until Claude returns decision
                ↓
10. Agent executes trade via PortfolioManager
                ↓
11. Database records:
    - Trade details
    - Claude's reasoning
    - Confidence score
                ↓
12. Daily snapshot saved
                ↓
13. Results displayed to user
```

---

## Database Schema

**File:** `src/database/schema.js`

```sql
-- Portfolio holdings
CREATE TABLE portfolio (
  symbol TEXT PRIMARY KEY,
  quantity INTEGER NOT NULL,
  average_cost REAL NOT NULL,
  last_updated TEXT NOT NULL
);

-- Available cash
CREATE TABLE cash_balance (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  balance REAL NOT NULL,
  last_updated TEXT NOT NULL
);

-- All trades
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_date TEXT NOT NULL,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  total_value REAL NOT NULL,
  reasoning TEXT,
  created_at TEXT NOT NULL
);

-- Daily portfolio snapshots
CREATE TABLE daily_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL UNIQUE,
  total_value REAL NOT NULL,
  cash_balance REAL NOT NULL,
  positions_value REAL NOT NULL,
  daily_return REAL,
  cumulative_return REAL,
  created_at TEXT NOT NULL
);

-- Trading signals (agent decisions)
CREATE TABLE trading_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_date TEXT NOT NULL,
  symbol TEXT NOT NULL,
  signal TEXT NOT NULL,
  confidence REAL NOT NULL,
  reasoning TEXT,
  executed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Backtest runs
CREATE TABLE backtest_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  initial_capital REAL NOT NULL,
  final_value REAL NOT NULL,
  total_return REAL NOT NULL,
  total_trades INTEGER NOT NULL,
  winning_trades INTEGER NOT NULL,
  losing_trades INTEGER NOT NULL,
  max_drawdown REAL,
  sharpe_ratio REAL,
  created_at TEXT NOT NULL
);
```

---

## Key Design Decisions

### 1. **Stdio Communication for MCP**
**Why:** Standard, language-agnostic, simple debugging

```javascript
// Parent process
const server = spawn('node', ['server.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Write request
server.stdin.write(JSON.stringify(request));

// Read response
server.stdout.on('data', (data) => {
  const response = JSON.parse(data);
});
```

### 2. **Separate Databases for Backtest vs Live**
**Why:** Don't mix simulated and real results

```
data/trading.db   -> Live paper trading
data/backtest.db  -> Historical simulations
```

### 3. **Historical Data Caching**
**Why:** Alpha Vantage has 25 API calls/day limit

```javascript
cache/historical/AAPL_full.json  // Cached for 24 hours
```

### 4. **Confidence Thresholds**
**Why:** Control risk by filtering low-confidence trades

```javascript
if (decision.confidence < MIN_CONFIDENCE) {
  console.log('Skipping: confidence too low');
  return;
}
```

### 5. **Position Sizing**
**Why:** Never risk more than 20% on one stock

```javascript
const maxInvestment = portfolioValue * 0.2;
const quantity = Math.floor(maxInvestment / price);
```

---

## Performance Comparison

### Speed
| Agent | Typical Execution Time |
|-------|----------------------|
| Rule-Based | 1-2 seconds |
| Claude Haiku | 5-10 seconds |
| Local LLM (8B) | 3-10 seconds |
| Local LLM (70B) | 15-60 seconds |

### Cost (per trading cycle)
| Agent | Cost |
|-------|------|
| Rule-Based | $0 |
| Claude Haiku | ~$0.001 |
| Local LLM | $0 (after hardware) |

### Quality of Decisions
| Agent | Reasoning | Adaptability | Consistency |
|-------|-----------|--------------|-------------|
| Rule-Based | None | Low | Perfect |
| Claude Haiku | Excellent | High | Good |
| Local LLM | Good | High | Fair |

---

## Security Considerations

### API Keys
```bash
# Never commit .env
echo ".env" >> .gitignore

# Keys stored locally
ALPHA_VANTAGE_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
```

### Data Privacy
| Agent | Where Data Goes |
|-------|----------------|
| Rule-Based | Only Alpha Vantage API |
| Claude Haiku | Anthropic servers + Alpha Vantage |
| Local LLM | Only Alpha Vantage API |

### Rate Limiting
```javascript
// MCP servers cache responses
const CACHE_TTL = 60000; // 1 minute
cache.set(key, result, ttl);
```

---

## Extensibility

### Adding New MCP Tools

1. **Define in MCP Server:**
```javascript
// src/mcp-servers/analysis-server.js
{
  name: 'calculate_bollinger_bands',
  description: 'Calculate Bollinger Bands',
  inputSchema: { /* schema */ }
}
```

2. **Implement Handler:**
```javascript
case 'calculate_bollinger_bands':
  return this.calculateBollingerBands(args.prices, args.period);
```

3. **Expose in Client:**
```javascript
// src/utils/mcp-client.js
async calculateBollingerBands(prices, period) {
  return this.callTool('calculate_bollinger_bands', { prices, period });
}
```

4. **Tool is now available to ALL agents!**

### Adding New Agents

```javascript
// src/agents/my-custom-agent.js
import { MarketDataClient, AnalysisClient } from '../utils/mcp-client.js';

export class MyCustomAgent {
  async initialize() {
    this.marketData = new MarketDataClient();
    await this.marketData.connect();
    // Now use any MCP tool!
  }
}
```

---

## Testing & Validation

### Unit Tests (Recommended)
```javascript
// Test MCP tools work
const client = new MarketDataClient();
await client.connect();
const prices = await client.getHistoricalPrices('AAPL');
assert(prices.length >= 100);
```

### Integration Tests
```bash
# Run actual trading cycle
npm run start:llm -- --run-now

# Check database
sqlite3 data/trading.db "SELECT * FROM trading_signals;"
```

### Backtesting
```bash
# Test strategy on historical data
npm run backtest 2025-08-01 2025-11-15
```

---

## Troubleshooting

### Issue: "Model not found" (Claude)
**Solution:** Check available models with your API tier
```bash
node test-claude-model.js
```

### Issue: "API rate limit reached"
**Solution:** Use cached data or upgrade Alpha Vantage tier
```bash
rm -rf cache/  # Force fresh data
```

### Issue: Local LLM not calling tools
**Solution:** Try a model trained for function calling
- Hermes 3
- Qwen 2.5
- Llama 3.3

### Issue: MCP server won't start
**Solution:** Check file permissions
```bash
chmod +x src/mcp-servers/*.js
```

---

## Future Enhancements

### Planned Features
- [ ] Real-time streaming from Claude
- [ ] Multi-agent voting system
- [ ] News sentiment analysis tool
- [ ] Risk management dashboard
- [ ] Webhook notifications
- [ ] REST API for remote access
- [ ] Web UI for monitoring

### MCP Tool Ideas
- `get_news_sentiment` - Analyze recent news
- `get_earnings_data` - Upcoming earnings
- `calculate_sharpe_ratio` - Risk-adjusted returns
- `detect_patterns` - Chart pattern recognition
- `get_sector_performance` - Sector rotation signals

---

## Conclusion

This system demonstrates **production-grade agentic AI** with:
- ✅ Real MCP implementation
- ✅ Multi-model support
- ✅ Practical application (trading)
- ✅ Complete persistence
- ✅ Privacy options
- ✅ Extensible architecture

It's a reference implementation for building agentic systems with MCP.

# Broker Integration Guide

## Overview

This guide explains how to integrate your trading agent with real brokers using MCP architecture. The same agent that paper trades can execute real trades with minimal changes.

## Why MCP Makes This Easy

**Current Setup:**
```javascript
// Agent calls MCP tools
const prices = await marketDataClient.getHistoricalPrices('AAPL');
const decision = await agent.analyze(prices);

// Simulated execution
portfolio.executeBuy(symbol, quantity, price);  // Paper trading
```

**With Broker MCP Server:**
```javascript
// Agent calls MCP tools (SAME CODE!)
const prices = await marketDataClient.getHistoricalPrices('AAPL');
const decision = await agent.analyze(prices);

// Real execution via MCP
await brokerClient.executeBuy(symbol, quantity);  // Real trading!
```

**Key Point:** Your agent logic doesn't change. You just add a new MCP server!

---

## Broker MCP Server Implementation

### 1. Create Broker MCP Server

```javascript
// src/mcp-servers/broker-server.js

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Alpaca from '@alpacahq/alpaca-trade-api';  // Or any broker SDK

class BrokerServer {
  constructor() {
    this.server = new Server({
      name: 'broker-server',
      version: '1.0.0',
    }, {
      capabilities: { tools: {} }
    });

    // Initialize broker API
    this.alpaca = new Alpaca({
      keyId: process.env.ALPACA_API_KEY,
      secretKey: process.env.ALPACA_SECRET_KEY,
      paper: process.env.TRADING_MODE === 'paper',  // Paper or live!
    });

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_account_info',
          description: 'Get account balance and buying power',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_positions',
          description: 'Get current stock positions',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'place_market_order',
          description: 'Place a market order (BUY or SELL)',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: { type: 'string', description: 'Stock symbol' },
              qty: { type: 'number', description: 'Quantity' },
              side: { type: 'string', enum: ['buy', 'sell'] },
            },
            required: ['symbol', 'qty', 'side'],
          },
        },
        {
          name: 'place_limit_order',
          description: 'Place a limit order with specific price',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              qty: { type: 'number' },
              side: { type: 'string', enum: ['buy', 'sell'] },
              limit_price: { type: 'number' },
            },
            required: ['symbol', 'qty', 'side', 'limit_price'],
          },
        },
        {
          name: 'cancel_order',
          description: 'Cancel an open order',
          inputSchema: {
            type: 'object',
            properties: {
              order_id: { type: 'string' },
            },
            required: ['order_id'],
          },
        },
        {
          name: 'get_open_orders',
          description: 'Get all open orders',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_account_info':
            return await this.getAccountInfo();
          case 'get_positions':
            return await this.getPositions();
          case 'place_market_order':
            return await this.placeMarketOrder(args);
          case 'place_limit_order':
            return await this.placeLimitOrder(args);
          case 'cancel_order':
            return await this.cancelOrder(args);
          case 'get_open_orders':
            return await this.getOpenOrders();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`,
          }],
          isError: true,
        };
      }
    });
  }

  async getAccountInfo() {
    const account = await this.alpaca.getAccount();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          cash: parseFloat(account.cash),
          portfolio_value: parseFloat(account.portfolio_value),
          buying_power: parseFloat(account.buying_power),
          equity: parseFloat(account.equity),
        }, null, 2),
      }],
    };
  }

  async getPositions() {
    const positions = await this.alpaca.getPositions();
    const formatted = positions.map(p => ({
      symbol: p.symbol,
      qty: parseInt(p.qty),
      avg_entry_price: parseFloat(p.avg_entry_price),
      current_price: parseFloat(p.current_price),
      market_value: parseFloat(p.market_value),
      unrealized_pl: parseFloat(p.unrealized_pl),
      unrealized_plpc: parseFloat(p.unrealized_plpc),
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ positions: formatted }, null, 2),
      }],
    };
  }

  async placeMarketOrder(args) {
    const { symbol, qty, side } = args;

    // Safety check
    if (process.env.TRADING_MODE === 'live' && !process.env.ALLOW_LIVE_TRADING) {
      throw new Error('Live trading not enabled. Set ALLOW_LIVE_TRADING=true');
    }

    const order = await this.alpaca.createOrder({
      symbol,
      qty,
      side,
      type: 'market',
      time_in_force: 'day',
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          order_id: order.id,
          symbol: order.symbol,
          qty: parseInt(order.qty),
          side: order.side,
          type: order.type,
          status: order.status,
          submitted_at: order.submitted_at,
        }, null, 2),
      }],
    };
  }

  async placeLimitOrder(args) {
    const { symbol, qty, side, limit_price } = args;

    if (process.env.TRADING_MODE === 'live' && !process.env.ALLOW_LIVE_TRADING) {
      throw new Error('Live trading not enabled');
    }

    const order = await this.alpaca.createOrder({
      symbol,
      qty,
      side,
      type: 'limit',
      time_in_force: 'day',
      limit_price,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          order_id: order.id,
          symbol: order.symbol,
          limit_price: parseFloat(order.limit_price),
          status: order.status,
        }, null, 2),
      }],
    };
  }

  async cancelOrder(args) {
    await this.alpaca.cancelOrder(args.order_id);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ status: 'cancelled', order_id: args.order_id }),
      }],
    };
  }

  async getOpenOrders() {
    const orders = await this.alpaca.getOrders({ status: 'open' });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ orders }, null, 2),
      }],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Broker Server running on stdio');
  }
}

const server = new BrokerServer();
server.run().catch(console.error);
```

### 2. Create Broker Client Wrapper

```javascript
// src/utils/mcp-client.js (add to existing file)

export class BrokerClient extends MCPClient {
  constructor() {
    super('./src/mcp-servers/broker-server.js');
  }

  async getAccountInfo() {
    return this.callTool('get_account_info', {});
  }

  async getPositions() {
    return this.callTool('get_positions', {});
  }

  async placeMarketOrder(symbol, qty, side) {
    return this.callTool('place_market_order', { symbol, qty, side });
  }

  async placeLimitOrder(symbol, qty, side, limitPrice) {
    return this.callTool('place_limit_order', {
      symbol, qty, side, limit_price: limitPrice
    });
  }

  async cancelOrder(orderId) {
    return this.callTool('cancel_order', { order_id: orderId });
  }

  async getOpenOrders() {
    return this.callTool('get_open_orders', {});
  }
}
```

### 3. Update Your Agent

```javascript
// src/agents/live-trading-agent.js

import { MarketDataClient, AnalysisClient, BrokerClient } from '../utils/mcp-client.js';

export class LiveTradingAgent extends LLMTradingAgent {
  async initialize() {
    await super.initialize();

    // Add broker client
    this.brokerClient = new BrokerClient();
    await this.brokerClient.connect();

    console.log('✓ Broker connected');
  }

  async executeDecision(decision, tradeDate) {
    if (decision.action === 'BUY') {
      // Get real account info
      const account = await this.brokerClient.getAccountInfo();

      // Calculate affordable quantity
      const maxInvestment = account.buying_power * this.maxPositionSize;
      const quantity = Math.floor(maxInvestment / decision.price);

      console.log(`Executing REAL trade: BUY ${quantity} ${decision.symbol}`);

      // EXECUTE REAL TRADE!
      const order = await this.brokerClient.placeMarketOrder(
        decision.symbol,
        quantity,
        'buy'
      );

      console.log(`Order placed: ${order.order_id}`);

      // Record in database
      this.db.recordTrade(/* ... */);

    } else if (decision.action === 'SELL') {
      // Get real positions
      const positions = await this.brokerClient.getPositions();
      const position = positions.positions.find(p => p.symbol === decision.symbol);

      if (position) {
        console.log(`Executing REAL trade: SELL ${position.qty} ${decision.symbol}`);

        const order = await this.brokerClient.placeMarketOrder(
          decision.symbol,
          position.qty,
          'sell'
        );

        console.log(`Order placed: ${order.order_id}`);
      }
    }
  }

  async cleanup() {
    await super.cleanup();
    if (this.brokerClient) {
      await this.brokerClient.disconnect();
    }
  }
}
```

---

## Supported Brokers

### 1. Alpaca (Easiest to start)
**Website:** https://alpaca.markets/

**Pros:**
- ✅ Free paper trading API
- ✅ Commission-free real trading
- ✅ Excellent API documentation
- ✅ Node.js SDK available
- ✅ No minimum balance

**Setup:**
```bash
npm install @alpacahq/alpaca-trade-api
```

```env
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret
TRADING_MODE=paper  # or 'live'
```

### 2. Interactive Brokers (Most powerful)
**Website:** https://www.interactivebrokers.com/

**Pros:**
- ✅ Professional-grade platform
- ✅ Global markets access
- ✅ Low commissions
- ✅ Advanced order types

**Cons:**
- More complex API
- $10k minimum for margin

### 3. TD Ameritrade (Good for US)
**Website:** https://www.tdameritrade.com/

**Pros:**
- ✅ Robust API
- ✅ No commission on stocks
- ✅ Real-time data included

### 4. Robinhood (Consumer-friendly)
**Website:** https://robinhood.com/

**Note:** Unofficial APIs available, but no official API

---

## Safety Features

### Multi-Layer Protection

```javascript
// 1. Environment Flag
if (process.env.TRADING_MODE === 'live' && !process.env.ALLOW_LIVE_TRADING) {
  throw new Error('Live trading not enabled');
}

// 2. Confidence Threshold
if (decision.confidence < 0.8) {  // Higher threshold for live!
  console.log('Confidence too low for live trading');
  return;
}

// 3. Maximum Position Size
const MAX_POSITION_VALUE = 1000;  // Never risk more than $1000
if (quantity * price > MAX_POSITION_VALUE) {
  quantity = Math.floor(MAX_POSITION_VALUE / price);
}

// 4. Daily Trade Limit
const tradesThreshold = await this.db.getTradesCount(today);
if (tradesThreshold >= 5) {
  console.log('Daily trade limit reached');
  return;
}

// 5. Loss Limit
const dailyPL = await this.calculateDailyPL();
if (dailyPL < -500) {  // Stop if down $500
  console.log('Daily loss limit reached');
  return;
}

// 6. Manual Approval (optional)
if (process.env.REQUIRE_MANUAL_APPROVAL) {
  const approved = await this.requestUserApproval(decision);
  if (!approved) return;
}
```

### Configuration

```env
# Broker
ALPACA_API_KEY=xxx
ALPACA_SECRET_KEY=xxx

# Trading Mode
TRADING_MODE=paper          # paper or live
ALLOW_LIVE_TRADING=false    # Safety lock

# Risk Limits (for live trading)
MAX_POSITION_SIZE=0.05      # 5% max per trade
MIN_CONFIDENCE=0.8          # 80% confidence minimum
MAX_DAILY_TRADES=5          # Limit trades per day
MAX_DAILY_LOSS=500          # Stop if loss exceeds $500
MAX_POSITION_VALUE=1000     # Never invest more than $1000

# Require approval
REQUIRE_MANUAL_APPROVAL=true  # Human-in-the-loop
```

---

## Migration Path: Paper → Live

### Phase 1: Paper Trading (Current)
```bash
# Test with simulated money
TRADING_MODE=paper npm run start:llm -- --run-now
```

**Goal:** Validate strategy for 30+ days

### Phase 2: Broker Paper Trading
```bash
# Use broker's paper trading API
ALPACA_API_KEY=paper_key npm run start:live -- --run-now
```

**Goal:** Test real broker integration without risk

### Phase 3: Live Trading (Small)
```bash
# Real money, tiny positions
TRADING_MODE=live
MAX_POSITION_VALUE=50  # Only $50 per trade
npm run start:live -- --run-now
```

**Goal:** Verify everything works with real money

### Phase 4: Full Live Trading
```bash
# Increase position sizes gradually
MAX_POSITION_VALUE=1000
npm run start:live -- --schedule
```

**Goal:** Production trading

---

## Example: Claude Decides + Real Execution

```
User: npm run start:live -- --run-now

🤖 Live Trading Agent analyzing market...

💭 Claude is thinking...
  🔧 Using tool: get_historical_prices
  🔧 Using tool: calculate_rsi
  🔧 Using tool: get_account_info      ← Real broker call!

📊 Claude's Analysis:
Strong buy signal for AAPL
RSI: 35 (oversold)
Trend: Uptrend
Account buying power: $10,000

Decision: BUY 5 shares of AAPL
Confidence: 85%

⚠️  REAL TRADE EXECUTION
  Symbol: AAPL
  Quantity: 5
  Side: BUY
  Type: Market Order

Confirm? (yes/no): yes

  🔧 Using tool: place_market_order     ← Real trade!

✅ Order executed!
  Order ID: 61e69015-8a91-4a2a-8e45-4a4e5c0e8e4a
  Status: filled
  Fill price: $189.50
  Total: $947.50
```

---

## Advanced Features

### 1. Limit Orders (Better Execution)

```javascript
// Instead of market orders
const order = await brokerClient.placeLimitOrder(
  symbol,
  quantity,
  'buy',
  price * 0.995  // 0.5% below current price
);

// Monitor and cancel if not filled
setTimeout(async () => {
  const orders = await brokerClient.getOpenOrders();
  if (orders.orders.find(o => o.id === order.order_id)) {
    await brokerClient.cancelOrder(order.order_id);
  }
}, 60000);  // Cancel after 1 minute
```

### 2. Stop Loss Orders

```javascript
// Place stop loss immediately after buy
const buyOrder = await brokerClient.placeMarketOrder(symbol, qty, 'buy');

// Set stop loss at -5%
const stopLoss = await brokerClient.placeStopOrder(
  symbol,
  qty,
  'sell',
  buyOrder.fill_price * 0.95
);
```

### 3. Portfolio Rebalancing

```javascript
// Claude can analyze entire portfolio
const positions = await brokerClient.getPositions();
const decision = await claude.analyzePortfolio(positions);

// Rebalance based on AI recommendation
for (const action of decision.actions) {
  if (action.type === 'reduce') {
    await brokerClient.placeMarketOrder(action.symbol, action.qty, 'sell');
  } else if (action.type === 'increase') {
    await brokerClient.placeMarketOrder(action.symbol, action.qty, 'buy');
  }
}
```

---

## Legal & Regulatory Considerations

### 1. Not Financial Advice
Add disclaimers:
```javascript
console.log('⚠️  DISCLAIMER: This is an experimental trading bot.');
console.log('⚠️  Not financial advice. Trade at your own risk.');
console.log('⚠️  Past performance does not guarantee future results.');
```

### 2. Pattern Day Trader Rule (US)
If account < $25k, limited to 3 day trades per 5 business days.

```javascript
// Check day trade count
const dayTrades = await this.calculateDayTrades();
if (dayTrades >= 3 && account.value < 25000) {
  console.log('Pattern day trader limit reached');
  return;
}
```

### 3. Wash Sale Rule (US)
Can't claim losses if you rebuy within 30 days.

### 4. Algorithmic Trading Regulations
Some jurisdictions require registration for algorithmic trading.

**Recommendation:** Consult with a financial advisor or lawyer before live trading.

---

## Monitoring & Alerting

### Send notifications on trades

```javascript
// Email notification
import nodemailer from 'nodemailer';

async notifyTrade(order) {
  await transporter.sendMail({
    to: process.env.ALERT_EMAIL,
    subject: `Trade Executed: ${order.side} ${order.symbol}`,
    text: `Order ID: ${order.order_id}\n` +
          `Status: ${order.status}\n` +
          `Quantity: ${order.qty}\n` +
          `Price: $${order.fill_price}`
  });
}

// Slack notification
import { WebClient } from '@slack/web-api';

async notifySlack(order) {
  await slack.chat.postMessage({
    channel: '#trading-alerts',
    text: `🤖 Trade executed: ${order.side} ${order.qty} ${order.symbol} @ $${order.fill_price}`
  });
}
```

---

## Testing Checklist

Before going live:

- [ ] Backtest strategy for 6+ months
- [ ] Paper trade for 30+ days
- [ ] Test broker API integration
- [ ] Verify all safety limits work
- [ ] Set up monitoring/alerts
- [ ] Test with small real money ($50-100)
- [ ] Have emergency stop mechanism
- [ ] Document your strategy
- [ ] Legal review (if trading significant capital)
- [ ] Tax tracking setup

---

## Conclusion

**YES, you can integrate with real brokers using MCP!**

**Benefits:**
- ✅ Same agent logic
- ✅ Just add new MCP server
- ✅ Gradual migration (paper → live)
- ✅ Multiple brokers supported
- ✅ Safety controls built-in

**The beauty of MCP:** Your agent doesn't care if it's calling a simulated portfolio or a real broker. It just calls tools. You control what happens behind those tools.

**Start with Alpaca paper trading**, validate your strategy, then cautiously move to live trading with small positions.

---

**Remember:** Trading involves risk. Start small, monitor closely, and never risk more than you can afford to lose! 📊💰

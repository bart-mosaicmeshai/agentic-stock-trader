/**
 * Local LLM Trading Agent
 * Uses a local LLM via LM Studio (OpenAI-compatible API)
 */

import OpenAI from 'openai';
import { MarketDataClient, AnalysisClient } from '../utils/mcp-client.js';

export class LocalLLMAgent {
  constructor(db, portfolioManager) {
    this.db = db;
    this.portfolio = portfolioManager;

    // LM Studio runs an OpenAI-compatible API at localhost:1234
    this.client = new OpenAI({
      baseURL: process.env.LM_STUDIO_URL || 'http://localhost:1234/v1',
      apiKey: 'lm-studio', // LM Studio doesn't need a real key
    });

    this.model = process.env.LOCAL_MODEL || 'local-model'; // LM Studio auto-detects loaded model
    this.watchlist = process.env.WATCHLIST?.split(',') || ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];
    this.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE || '0.2');
    this.minConfidence = parseFloat(process.env.MIN_CONFIDENCE || '0.6');

    // MCP clients
    this.marketDataClient = null;
    this.analysisClient = null;
  }

  /**
   * Initialize MCP clients
   */
  async initialize() {
    console.log('Initializing Local LLM trading agent with MCP clients...');

    this.marketDataClient = new MarketDataClient();
    this.analysisClient = new AnalysisClient();

    await this.marketDataClient.connect();
    await this.analysisClient.connect();

    console.log('✓ MCP clients connected');
  }

  /**
   * Convert MCP tool definitions for OpenAI format
   */
  getMCPTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'get_historical_prices',
          description: 'Get historical daily prices for a stock. Returns OHLCV data.',
          parameters: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: 'Stock ticker symbol',
              },
              outputsize: {
                type: 'string',
                description: 'compact (100 days) or full (20+ years)',
                enum: ['compact', 'full'],
              },
            },
            required: ['symbol'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calculate_sma',
          description: 'Calculate Simple Moving Average for given prices',
          parameters: {
            type: 'object',
            properties: {
              prices: {
                type: 'array',
                description: 'Array of price values',
                items: { type: 'number' },
              },
              period: {
                type: 'number',
                description: 'Period for SMA calculation (e.g., 20, 50, 200)',
              },
            },
            required: ['prices', 'period'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calculate_rsi',
          description: 'Calculate Relative Strength Index (RSI) for given prices',
          parameters: {
            type: 'object',
            properties: {
              prices: {
                type: 'array',
                description: 'Array of closing prices',
                items: { type: 'number' },
              },
              period: {
                type: 'number',
                description: 'Period for RSI calculation (typically 14)',
              },
            },
            required: ['prices'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'detect_trend',
          description: 'Detect price trend (uptrend, downtrend, sideways) using linear regression',
          parameters: {
            type: 'object',
            properties: {
              prices: {
                type: 'array',
                description: 'Array of closing prices',
                items: { type: 'number' },
              },
              lookback: {
                type: 'number',
                description: 'Number of periods to analyze (default 20)',
              },
            },
            required: ['prices'],
          },
        },
      },
    ];
  }

  /**
   * Execute MCP tool call
   */
  async executeMCPTool(toolName, toolInput) {
    const isMarketDataTool = ['get_current_price', 'get_historical_prices', 'get_intraday_prices', 'search_symbols'].includes(toolName);
    const client = isMarketDataTool ? this.marketDataClient : this.analysisClient;

    try {
      const result = await client.callTool(toolName, toolInput);
      return result;
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error.message);
      throw error;
    }
  }

  /**
   * Main trading logic - Local LLM makes decisions using MCP tools
   */
  async executeTradingCycle(tradeDate) {
    console.log(`\n🤖 Local LLM Trading Agent analyzing market for ${tradeDate}...`);

    const summary = this.portfolio.getPortfolioSummary();

    const systemPrompt = `You are an expert stock trading AI agent. Your goal is to maximize portfolio returns while managing risk.

Portfolio Configuration:
- Available cash: $${summary.cash.toFixed(2)}
- Total portfolio value: $${summary.totalValue.toFixed(2)}
- Max position size: ${(this.maxPositionSize * 100)}% of portfolio per stock
- Minimum confidence threshold: ${(this.minConfidence * 100)}%

Current Positions:
${summary.positions.length > 0 ? summary.positions.map(p =>
  `- ${p.symbol}: ${p.quantity} shares @ $${p.average_cost.toFixed(2)} (Current: $${p.current_price.toFixed(2)}, P/L: ${p.profit_loss_percent.toFixed(2)}%)`
).join('\n') : '- No positions'}

Watchlist: ${this.watchlist.join(', ')}

Use the available tools to analyze stocks and make trading decisions. After analysis, provide a decision with:
- action: BUY, SELL, or HOLD
- symbol: Stock ticker
- confidence: 0.0-1.0
- reasoning: Your analysis`;

    const userPrompt = `Analyze ${this.watchlist[0]} for trading on ${tradeDate}. Use tools to gather data and make a decision.`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      let continueLoop = true;
      const decisions = [];

      while (continueLoop) {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: messages,
          tools: this.getMCPTools(),
          tool_choice: 'auto',
        });

        const message = response.choices[0].message;
        console.log(`\n💭 Local LLM thinking... (finish_reason: ${response.choices[0].finish_reason})`);

        // Handle tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          // Add assistant's response to messages
          messages.push(message);

          // Execute each tool call
          for (const toolCall of message.tool_calls) {
            console.log(`  🔧 Using tool: ${toolCall.function.name}`);

            try {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await this.executeMCPTool(toolCall.function.name, args);

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              });
            } catch (error) {
              console.error(`  ❌ Tool error: ${error.message}`);
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message }),
              });
            }
          }
        } else {
          // No more tool calls, get final response
          console.log(`\n📊 Local LLM Analysis:\n${message.content}\n`);

          // Try to extract decision from response
          try {
            const jsonMatch = message.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const decision = JSON.parse(jsonMatch[0]);
              decisions.push(decision);
            }
          } catch (e) {
            console.log('  ℹ️  No structured decision found');
          }

          continueLoop = false;
        }
      }

      // Execute decisions
      for (const decision of decisions) {
        if (decision.action === 'HOLD') {
          console.log(`  ⏸️  Decision: HOLD - ${decision.reasoning}`);
          continue;
        }

        if (decision.confidence < this.minConfidence) {
          console.log(`  ⏭️  Skipping ${decision.symbol}: confidence too low (${(decision.confidence * 100).toFixed(1)}%)`);
          continue;
        }

        await this.executeDecision(decision, tradeDate);

        this.db.recordSignal(
          tradeDate,
          decision.symbol,
          decision.action,
          decision.confidence,
          decision.reasoning,
          1
        );
      }

      console.log('✓ Local LLM Trading cycle completed\n');

    } catch (error) {
      console.error('Error in Local LLM trading cycle:', error);
      throw error;
    }
  }

  /**
   * Execute a trading decision
   */
  async executeDecision(decision, tradeDate) {
    const summary = this.portfolio.getPortfolioSummary();

    if (decision.action === 'BUY') {
      if (!decision.price) {
        console.log(`  ⚠️  ${decision.symbol}: No price information, skipping`);
        return;
      }

      let quantity = decision.quantity;
      if (!quantity) {
        const maxInvestment = summary.totalValue * this.maxPositionSize;
        quantity = Math.floor(maxInvestment / decision.price);
      }

      if (quantity < 1) {
        console.log(`  ⚠️  ${decision.symbol}: Position too small to execute`);
        return;
      }

      const totalCost = quantity * decision.price;

      if (totalCost > summary.cash) {
        console.log(`  ⚠️  ${decision.symbol}: Insufficient cash`);
        return;
      }

      this.portfolio.executeBuy(
        decision.symbol,
        quantity,
        decision.price,
        tradeDate,
        decision.reasoning
      );

      console.log(`  ✅ BOUGHT ${quantity} shares of ${decision.symbol} @ $${decision.price.toFixed(2)}`);

    } else if (decision.action === 'SELL') {
      const position = summary.positions.find(p => p.symbol === decision.symbol);
      if (!position) {
        console.log(`  ⚠️  ${decision.symbol}: No position to sell`);
        return;
      }

      const quantity = decision.quantity || position.quantity;
      const price = decision.price || position.current_price;

      this.portfolio.executeSell(
        decision.symbol,
        quantity,
        price,
        tradeDate,
        decision.reasoning
      );

      console.log(`  ✅ SOLD ${quantity} shares of ${decision.symbol} @ $${price.toFixed(2)}`);
    }
  }

  /**
   * Cleanup - disconnect MCP clients
   */
  async cleanup() {
    if (this.marketDataClient) {
      await this.marketDataClient.disconnect();
      console.log('✓ Market data client disconnected');
    }
    if (this.analysisClient) {
      await this.analysisClient.disconnect();
      console.log('✓ Analysis client disconnected');
    }
  }
}

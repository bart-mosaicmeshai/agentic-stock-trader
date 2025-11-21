/**
 * LLM-Powered Trading Agent
 * Uses Claude to make intelligent trading decisions with MCP tool access
 */

import Anthropic from '@anthropic-ai/sdk';
import { MarketDataClient, AnalysisClient } from '../utils/mcp-client.js';

export class LLMTradingAgent {
  constructor(db, portfolioManager) {
    this.db = db;
    this.portfolio = portfolioManager;
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
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
    console.log('Initializing LLM trading agent with MCP clients...');

    this.marketDataClient = new MarketDataClient();
    this.analysisClient = new AnalysisClient();

    await this.marketDataClient.connect();
    await this.analysisClient.connect();

    console.log('✓ MCP clients connected');
  }

  /**
   * Convert MCP tool definitions for Claude
   */
  getMCPTools() {
    return [
      // Market Data Tools
      {
        name: 'get_current_price',
        description: 'Get the current stock price and quote information for a given symbol',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Stock ticker symbol (e.g., AAPL, GOOGL)',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'get_historical_prices',
        description: 'Get historical daily prices for a stock. Returns OHLCV data.',
        input_schema: {
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
      // Analysis Tools
      {
        name: 'calculate_sma',
        description: 'Calculate Simple Moving Average for given prices',
        input_schema: {
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
      {
        name: 'calculate_rsi',
        description: 'Calculate Relative Strength Index (RSI) for given prices',
        input_schema: {
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
      {
        name: 'calculate_macd',
        description: 'Calculate MACD (Moving Average Convergence Divergence)',
        input_schema: {
          type: 'object',
          properties: {
            prices: {
              type: 'array',
              description: 'Array of closing prices',
              items: { type: 'number' },
            },
            fastPeriod: {
              type: 'number',
              description: 'Fast EMA period (default 12)',
            },
            slowPeriod: {
              type: 'number',
              description: 'Slow EMA period (default 26)',
            },
            signalPeriod: {
              type: 'number',
              description: 'Signal line period (default 9)',
            },
          },
          required: ['prices'],
        },
      },
      {
        name: 'detect_trend',
        description: 'Detect price trend (uptrend, downtrend, sideways) using linear regression',
        input_schema: {
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
      {
        name: 'generate_signals',
        description: 'Generate comprehensive buy/sell/hold signals based on multiple technical indicators',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Stock symbol',
            },
            prices: {
              type: 'array',
              description: 'Array of price data objects with date, open, high, low, close, volume',
              items: { type: 'object' },
            },
          },
          required: ['symbol', 'prices'],
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
   * Main trading logic - Claude makes decisions using MCP tools
   */
  async executeTradingCycle(tradeDate) {
    console.log(`\n🤖 LLM Trading Agent analyzing market for ${tradeDate}...`);

    const summary = this.portfolio.getPortfolioSummary();

    // Build context for Claude
    const portfolioContext = {
      cash: summary.cash,
      totalValue: summary.totalValue,
      positions: summary.positions,
      dailyReturn: summary.dailyReturn,
      totalReturn: summary.totalReturn,
    };

    const systemPrompt = `You are an expert stock trading AI agent. Your goal is to maximize portfolio returns while managing risk.

Portfolio Configuration:
- Available cash: $${portfolioContext.cash.toFixed(2)}
- Total portfolio value: $${portfolioContext.totalValue.toFixed(2)}
- Max position size: ${(this.maxPositionSize * 100)}% of portfolio per stock
- Minimum confidence threshold: ${(this.minConfidence * 100)}%

Current Positions:
${portfolioContext.positions.length > 0 ? portfolioContext.positions.map(p =>
  `- ${p.symbol}: ${p.quantity} shares @ $${p.average_cost.toFixed(2)} (Current: $${p.current_price.toFixed(2)}, P/L: ${p.profit_loss_percent.toFixed(2)}%)`
).join('\n') : '- No positions'}

Watchlist: ${this.watchlist.join(', ')}

Trading Rules:
1. For buy decisions: Only consider symbols from the watchlist that we don't currently hold
2. For sell decisions: Evaluate current positions for:
   - Stop loss (-10%)
   - Take profit (+15%)
   - Technical sell signals
3. Position sizing: Calculate quantity based on max position size and current price
4. Risk management: Consider overall portfolio diversification

Use the available MCP tools to:
1. Fetch historical price data
2. Calculate technical indicators (SMA, RSI, MACD, trend)
3. Generate trading signals
4. Analyze market conditions

After your analysis, provide a structured decision in this format:
{
  "action": "BUY" | "SELL" | "HOLD",
  "symbol": "TICKER",
  "quantity": number (for buy/sell),
  "confidence": 0.0-1.0,
  "reasoning": "Detailed explanation of your decision",
  "indicators_used": ["list of indicators analyzed"]
}

If no good opportunities exist, respond with action: "HOLD" and explain why.`;

    const userPrompt = `Analyze the current market conditions for ${tradeDate} and make trading decisions for today. Consider both new buying opportunities from the watchlist and potential sells from existing positions.`;

    try {
      const messages = [
        {
          role: 'user',
          content: userPrompt,
        },
      ];

      let continueLoop = true;
      const decisions = [];

      while (continueLoop) {
        const response = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: systemPrompt,
          tools: this.getMCPTools(),
          messages: messages,
        });

        console.log(`\n💭 Claude is thinking... (stop_reason: ${response.stop_reason})`);

        // Handle tool use
        if (response.stop_reason === 'tool_use') {
          // Add assistant's response to messages
          messages.push({
            role: 'assistant',
            content: response.content,
          });

          // Execute each tool call
          const toolResults = [];
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              console.log(`  🔧 Using tool: ${block.name}`);
              try {
                const result = await this.executeMCPTool(block.name, block.input);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(result),
                });
              } catch (error) {
                console.error(`  ❌ Tool error: ${error.message}`);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify({ error: error.message }),
                  is_error: true,
                });
              }
            }
          }

          // Add tool results to messages
          messages.push({
            role: 'user',
            content: toolResults,
          });
        } else if (response.stop_reason === 'end_turn') {
          // Extract text response
          const textContent = response.content.find(block => block.type === 'text');
          if (textContent) {
            console.log(`\n📊 Claude's Analysis:\n${textContent.text}\n`);

            // Try to parse decision from response
            try {
              // Look for JSON in the response
              const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const decision = JSON.parse(jsonMatch[0]);
                decisions.push(decision);
              }
            } catch (e) {
              console.log('  ℹ️  No structured decision found, Claude is providing analysis only');
            }
          }
          continueLoop = false;
        } else {
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

        // Record signal
        this.db.recordSignal(
          tradeDate,
          decision.symbol,
          decision.action,
          decision.confidence,
          decision.reasoning,
          1
        );
      }

      console.log('✓ LLM Trading cycle completed\n');

    } catch (error) {
      console.error('Error in LLM trading cycle:', error);
      throw error;
    }
  }

  /**
   * Execute a trading decision
   */
  async executeDecision(decision, tradeDate) {
    const summary = this.portfolio.getPortfolioSummary();

    if (decision.action === 'BUY') {
      // Validate we have the price
      if (!decision.price) {
        console.log(`  ⚠️  ${decision.symbol}: No price information, skipping`);
        return;
      }

      // Calculate quantity if not provided
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
        console.log(`  ⚠️  ${decision.symbol}: Insufficient cash ($${totalCost.toFixed(2)} needed, $${summary.cash.toFixed(2)} available)`);
        return;
      }

      this.portfolio.executeBuy(
        decision.symbol,
        quantity,
        decision.price,
        tradeDate,
        decision.reasoning
      );

      console.log(`  ✅ BOUGHT ${quantity} shares of ${decision.symbol} @ $${decision.price.toFixed(2)} (Confidence: ${(decision.confidence * 100).toFixed(1)}%)`);

    } else if (decision.action === 'SELL') {
      // Find position
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

      console.log(`  ✅ SOLD ${quantity} shares of ${decision.symbol} @ $${price.toFixed(2)} (Confidence: ${(decision.confidence * 100).toFixed(1)}%)`);
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

/**
 * MCP Client Wrapper
 * Provides a simple interface to communicate with MCP servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

export class MCPClient {
  constructor(serverPath) {
    this.serverPath = serverPath;
    this.client = null;
    this.transport = null;
    this.process = null;
  }

  /**
   * Connect to the MCP server
   */
  async connect() {
    // Spawn the server process
    this.process = spawn('node', [this.serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Create transport
    this.transport = new StdioClientTransport({
      reader: this.process.stdout,
      writer: this.process.stdin,
    });

    // Create and connect client
    this.client = new Client(
      {
        name: 'trading-agent-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(this.transport);
  }

  /**
   * List available tools from the server
   */
  async listTools() {
    const response = await this.client.listTools();
    return response.tools;
  }

  /**
   * Call a tool on the server
   */
  async callTool(name, args) {
    const response = await this.client.callTool({
      name,
      arguments: args,
    });

    if (response.isError) {
      throw new Error(response.content[0].text);
    }

    // Parse JSON response
    const text = response.content[0].text;
    try {
      return JSON.parse(text);
    } catch (e) {
      return { raw: text };
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
    }
    if (this.process) {
      this.process.kill();
    }
  }
}

/**
 * Market Data Client - convenience wrapper for market data operations
 */
export class MarketDataClient extends MCPClient {
  constructor() {
    super('./src/mcp-servers/market-data-server.js');
  }

  async getCurrentPrice(symbol) {
    return this.callTool('get_current_price', { symbol });
  }

  async getHistoricalPrices(symbol, outputsize = 'compact') {
    return this.callTool('get_historical_prices', { symbol, outputsize });
  }

  async getIntradayPrices(symbol, interval = '60min') {
    return this.callTool('get_intraday_prices', { symbol, interval });
  }

  async searchSymbols(keywords) {
    return this.callTool('search_symbols', { keywords });
  }
}

/**
 * Analysis Client - convenience wrapper for analysis operations
 */
export class AnalysisClient extends MCPClient {
  constructor() {
    super('./src/mcp-servers/analysis-server.js');
  }

  async calculateSMA(prices, period) {
    return this.callTool('calculate_sma', { prices, period });
  }

  async calculateRSI(prices, period = 14) {
    return this.callTool('calculate_rsi', { prices, period });
  }

  async calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    return this.callTool('calculate_macd', { prices, fastPeriod, slowPeriod, signalPeriod });
  }

  async detectTrend(prices, lookback = 20) {
    return this.callTool('detect_trend', { prices, lookback });
  }

  async generateSignals(symbol, prices) {
    return this.callTool('generate_signals', { symbol, prices });
  }
}

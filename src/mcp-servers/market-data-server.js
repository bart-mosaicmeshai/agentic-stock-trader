#!/usr/bin/env node

/**
 * MCP Market Data Server
 * Provides real-time and historical stock market data
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// In-memory cache for API responses
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute cache

class MarketDataServer {
  constructor() {
    this.server = new Server(
      {
        name: 'market-data-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_current_price',
          description: 'Get the current stock price for a given symbol',
          inputSchema: {
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
          description: 'Get historical daily prices for a stock',
          inputSchema: {
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
                default: 'compact',
              },
            },
            required: ['symbol'],
          },
        },
        {
          name: 'get_intraday_prices',
          description: 'Get intraday price data for a stock',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: 'Stock ticker symbol',
              },
              interval: {
                type: 'string',
                description: 'Time interval',
                enum: ['1min', '5min', '15min', '30min', '60min'],
                default: '60min',
              },
            },
            required: ['symbol'],
          },
        },
        {
          name: 'get_quote',
          description: 'Get detailed quote information for a stock',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: 'Stock ticker symbol',
              },
            },
            required: ['symbol'],
          },
        },
        {
          name: 'search_symbols',
          description: 'Search for stock symbols by company name',
          inputSchema: {
            type: 'object',
            properties: {
              keywords: {
                type: 'string',
                description: 'Company name or keywords to search',
              },
            },
            required: ['keywords'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_current_price':
            return await this.getCurrentPrice(args.symbol);
          case 'get_historical_prices':
            return await this.getHistoricalPrices(args.symbol, args.outputsize || 'compact');
          case 'get_intraday_prices':
            return await this.getIntradayPrices(args.symbol, args.interval || '60min');
          case 'get_quote':
            return await this.getQuote(args.symbol);
          case 'search_symbols':
            return await this.searchSymbols(args.keywords);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Get current stock price
   */
  async getCurrentPrice(symbol) {
    const cacheKey = `price_${symbol}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data['Error Message']) {
      throw new Error(`Invalid symbol: ${symbol}`);
    }

    if (data['Note']) {
      throw new Error('API rate limit reached. Please try again later or use a premium API key.');
    }

    const quote = data['Global Quote'];
    if (!quote || Object.keys(quote).length === 0) {
      throw new Error(`No data available for symbol: ${symbol}`);
    }

    const result = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            symbol,
            price: parseFloat(quote['05. price']),
            change: parseFloat(quote['09. change']),
            changePercent: quote['10. change percent'],
            volume: parseInt(quote['06. volume']),
            latestTradingDay: quote['07. latest trading day'],
            previousClose: parseFloat(quote['08. previous close']),
            open: parseFloat(quote['02. open']),
            high: parseFloat(quote['03. high']),
            low: parseFloat(quote['04. low']),
          }, null, 2),
        },
      ],
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Get historical daily prices
   */
  async getHistoricalPrices(symbol, outputsize = 'compact') {
    const cacheKey = `historical_${symbol}_${outputsize}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputsize}&apikey=${this.apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data['Error Message']) {
      throw new Error(`Invalid symbol: ${symbol}`);
    }

    if (data['Note']) {
      throw new Error('API rate limit reached. Please try again later or use a premium API key.');
    }

    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
      throw new Error(`No historical data available for symbol: ${symbol}`);
    }

    // Convert to array format
    const prices = Object.entries(timeSeries).map(([date, values]) => ({
      date,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume']),
    }));

    const result = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            symbol,
            prices: prices.slice(0, 100), // Limit to 100 most recent for response size
            metadata: {
              totalDataPoints: prices.length,
              oldestDate: prices[prices.length - 1]?.date,
              newestDate: prices[0]?.date,
            },
          }, null, 2),
        },
      ],
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Get intraday prices
   */
  async getIntradayPrices(symbol, interval = '60min') {
    const cacheKey = `intraday_${symbol}_${interval}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${this.apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data['Error Message']) {
      throw new Error(`Invalid symbol: ${symbol}`);
    }

    if (data['Note']) {
      throw new Error('API rate limit reached. Please try again later or use a premium API key.');
    }

    const timeSeries = data[`Time Series (${interval})`];
    if (!timeSeries) {
      throw new Error(`No intraday data available for symbol: ${symbol}`);
    }

    const prices = Object.entries(timeSeries).map(([datetime, values]) => ({
      datetime,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume']),
    }));

    const result = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            symbol,
            interval,
            prices: prices.slice(0, 50),
            metadata: {
              totalDataPoints: prices.length,
            },
          }, null, 2),
        },
      ],
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Get detailed quote
   */
  async getQuote(symbol) {
    return this.getCurrentPrice(symbol);
  }

  /**
   * Search for symbols
   */
  async searchSymbols(keywords) {
    const cacheKey = `search_${keywords}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keywords)}&apikey=${this.apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data['Note']) {
      throw new Error('API rate limit reached. Please try again later or use a premium API key.');
    }

    const matches = data['bestMatches'] || [];
    const results = matches.map(match => ({
      symbol: match['1. symbol'],
      name: match['2. name'],
      type: match['3. type'],
      region: match['4. region'],
      currency: match['8. currency'],
    }));

    const result = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            keywords,
            results,
          }, null, 2),
        },
      ],
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Cache helpers
   */
  getFromCache(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Market Data Server running on stdio');
  }
}

// Start the server
const server = new MarketDataServer();
server.run().catch(console.error);

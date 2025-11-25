#!/usr/bin/env node

/**
 * MCP Analysis Server
 * Provides technical analysis and trading signals
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

class AnalysisServer {
  constructor() {
    this.server = new Server(
      {
        name: 'analysis-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'calculate_sma',
          description: 'Calculate Simple Moving Average',
          inputSchema: {
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
          name: 'calculate_ema',
          description: 'Calculate Exponential Moving Average',
          inputSchema: {
            type: 'object',
            properties: {
              prices: {
                type: 'array',
                description: 'Array of price values',
                items: { type: 'number' },
              },
              period: {
                type: 'number',
                description: 'Period for EMA calculation',
              },
            },
            required: ['prices', 'period'],
          },
        },
        {
          name: 'calculate_rsi',
          description: 'Calculate Relative Strength Index',
          inputSchema: {
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
                default: 14,
              },
            },
            required: ['prices'],
          },
        },
        {
          name: 'calculate_macd',
          description: 'Calculate MACD (Moving Average Convergence Divergence)',
          inputSchema: {
            type: 'object',
            properties: {
              prices: {
                type: 'array',
                description: 'Array of closing prices',
                items: { type: 'number' },
              },
              fastPeriod: {
                type: 'number',
                description: 'Fast EMA period',
                default: 12,
              },
              slowPeriod: {
                type: 'number',
                description: 'Slow EMA period',
                default: 26,
              },
              signalPeriod: {
                type: 'number',
                description: 'Signal line period',
                default: 9,
              },
            },
            required: ['prices'],
          },
        },
        {
          name: 'calculate_bollinger_bands',
          description: 'Calculate Bollinger Bands',
          inputSchema: {
            type: 'object',
            properties: {
              prices: {
                type: 'array',
                description: 'Array of closing prices',
                items: { type: 'number' },
              },
              period: {
                type: 'number',
                description: 'Period for calculation',
                default: 20,
              },
              stdDev: {
                type: 'number',
                description: 'Number of standard deviations',
                default: 2,
              },
            },
            required: ['prices'],
          },
        },
        {
          name: 'detect_trend',
          description: 'Detect price trend (uptrend, downtrend, sideways)',
          inputSchema: {
            type: 'object',
            properties: {
              prices: {
                type: 'array',
                description: 'Array of closing prices',
                items: { type: 'number' },
              },
              lookback: {
                type: 'number',
                description: 'Number of periods to analyze',
                default: 20,
              },
            },
            required: ['prices'],
          },
        },
        {
          name: 'generate_signals',
          description: 'Generate buy/sell/hold signals based on technical indicators',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: 'Stock symbol',
              },
              prices: {
                type: 'array',
                description: 'Array of price data objects with date, open, high, low, close',
                items: { type: 'object' },
              },
            },
            required: ['symbol', 'prices'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'calculate_sma':
            return this.calculateSMA(args.prices, args.period);
          case 'calculate_ema':
            return this.calculateEMA(args.prices, args.period);
          case 'calculate_rsi':
            return this.calculateRSI(args.prices, args.period || 14);
          case 'calculate_macd':
            return this.calculateMACD(
              args.prices,
              args.fastPeriod || 12,
              args.slowPeriod || 26,
              args.signalPeriod || 9
            );
          case 'calculate_bollinger_bands':
            return this.calculateBollingerBands(args.prices, args.period || 20, args.stdDev || 2);
          case 'detect_trend':
            return this.detectTrend(args.prices, args.lookback || 20);
          case 'generate_signals':
            return this.generateSignals(args.symbol, args.prices);
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
   * Calculate Simple Moving Average
   */
  calculateSMA(prices, period) {
    if (prices.length < period) {
      throw new Error(`Not enough data points. Need ${period}, have ${prices.length}`);
    }

    const smaValues = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      smaValues.push(sum / period);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            indicator: 'SMA',
            period,
            values: smaValues,
            current: smaValues[smaValues.length - 1],
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Calculate Exponential Moving Average
   */
  calculateEMA(prices, period) {
    if (prices.length < period) {
      throw new Error(`Not enough data points. Need ${period}, have ${prices.length}`);
    }

    const multiplier = 2 / (period + 1);
    const emaValues = [];

    // First EMA is SMA
    const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emaValues.push(firstSMA);

    // Calculate EMA for remaining values
    for (let i = period; i < prices.length; i++) {
      const ema = (prices[i] - emaValues[emaValues.length - 1]) * multiplier + emaValues[emaValues.length - 1];
      emaValues.push(ema);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            indicator: 'EMA',
            period,
            values: emaValues,
            current: emaValues[emaValues.length - 1],
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Calculate Relative Strength Index
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) {
      throw new Error(`Not enough data points. Need ${period + 1}, have ${prices.length}`);
    }

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);

    // Calculate average gain and loss
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    const rsiValues = [];

    // First RSI
    const rs1 = avgGain / avgLoss;
    rsiValues.push(100 - (100 / (1 + rs1)));

    // Subsequent RSI values
    for (let i = period; i < changes.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
      const rs = avgGain / avgLoss;
      rsiValues.push(100 - (100 / (1 + rs)));
    }

    const currentRSI = rsiValues[rsiValues.length - 1];
    let signal = 'NEUTRAL';
    if (currentRSI < 30) signal = 'OVERSOLD_BUY';
    if (currentRSI > 70) signal = 'OVERBOUGHT_SELL';

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            indicator: 'RSI',
            period,
            values: rsiValues,
            current: currentRSI,
            signal,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Calculate MACD
   */
  calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod) {
      throw new Error(`Not enough data points. Need ${slowPeriod}, have ${prices.length}`);
    }

    // Calculate fast and slow EMAs
    const fastEMA = this.calculateEMAValues(prices, fastPeriod);
    const slowEMA = this.calculateEMAValues(prices, slowPeriod);

    // Calculate MACD line
    const macdLine = [];
    for (let i = 0; i < slowEMA.length; i++) {
      macdLine.push(fastEMA[i + (fastEMA.length - slowEMA.length)] - slowEMA[i]);
    }

    // Calculate signal line (EMA of MACD)
    const signalLine = this.calculateEMAValues(macdLine, signalPeriod);

    // Calculate histogram
    const histogram = [];
    for (let i = 0; i < signalLine.length; i++) {
      histogram.push(macdLine[i + (macdLine.length - signalLine.length)] - signalLine[i]);
    }

    const currentMACD = macdLine[macdLine.length - 1];
    const currentSignal = signalLine[signalLine.length - 1];
    const currentHistogram = histogram[histogram.length - 1];

    let signal = 'NEUTRAL';
    if (currentMACD > currentSignal && histogram[histogram.length - 2] <= 0) {
      signal = 'BULLISH_CROSSOVER_BUY';
    } else if (currentMACD < currentSignal && histogram[histogram.length - 2] >= 0) {
      signal = 'BEARISH_CROSSOVER_SELL';
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            indicator: 'MACD',
            macdLine: currentMACD,
            signalLine: currentSignal,
            histogram: currentHistogram,
            signal,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) {
      throw new Error(`Not enough data points. Need ${period}, have ${prices.length}`);
    }

    const sma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
    const squaredDiffs = prices.slice(-period).map(p => Math.pow(p - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const upperBand = sma + (stdDev * standardDeviation);
    const lowerBand = sma - (stdDev * standardDeviation);
    const currentPrice = prices[prices.length - 1];

    let signal = 'NEUTRAL';
    if (currentPrice <= lowerBand) signal = 'OVERSOLD_BUY';
    if (currentPrice >= upperBand) signal = 'OVERBOUGHT_SELL';

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            indicator: 'Bollinger Bands',
            period,
            stdDev,
            upperBand,
            middleBand: sma,
            lowerBand,
            currentPrice,
            signal,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Detect trend
   */
  detectTrend(prices, lookback = 20) {
    if (prices.length < lookback) {
      throw new Error(`Not enough data points. Need ${lookback}, have ${prices.length}`);
    }

    const recentPrices = prices.slice(-lookback);
    const firstPrice = recentPrices[0];
    const lastPrice = recentPrices[recentPrices.length - 1];
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;

    // Calculate simple linear regression slope
    const n = recentPrices.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = recentPrices.reduce((a, b) => a + b, 0);
    const xySum = recentPrices.reduce((sum, price, i) => sum + (i * price), 0);
    const x2Sum = (n * (n - 1) * (2 * n - 1)) / 6;
    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);

    let trend = 'SIDEWAYS';
    let strength = 'WEAK';

    if (slope > 0.5) {
      trend = 'UPTREND';
      strength = slope > 1.5 ? 'STRONG' : 'MODERATE';
    } else if (slope < -0.5) {
      trend = 'DOWNTREND';
      strength = slope < -1.5 ? 'STRONG' : 'MODERATE';
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            indicator: 'Trend Detection',
            trend,
            strength,
            change: change.toFixed(2) + '%',
            slope: slope.toFixed(4),
            lookback,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Generate comprehensive trading signals
   */
  generateSignals(symbol, priceData) {
    if (!priceData || priceData.length < 50) {
      throw new Error('Need at least 50 data points for signal generation');
    }

    const closes = priceData.map(p => p.close);
    const currentPrice = closes[closes.length - 1];

    // Calculate indicators
    const sma20 = this.calculateSMAValue(closes, 20);
    const sma50 = this.calculateSMAValue(closes, 50);
    const ema12 = this.calculateEMAValue(closes, 12);
    const rsi = this.calculateRSIValue(closes, 14);

    // Generate signal
    let signal = 'HOLD';
    let confidence = 0;
    const reasons = [];

    // Trend following
    if (currentPrice > sma20 && sma20 > sma50) {
      confidence += 0.25;
      reasons.push('Price above SMA20 and SMA50 (uptrend)');
    } else if (currentPrice < sma20 && sma20 < sma50) {
      confidence -= 0.25;
      reasons.push('Price below SMA20 and SMA50 (downtrend)');
    }

    // RSI signals - Modified for trend following
    // In strong trends, don't penalize overbought/oversold as much
    if (rsi < 30) {
      confidence += 0.3;
      reasons.push(`RSI oversold (${rsi.toFixed(2)})`);
    } else if (rsi > 70) {
      // Only small penalty for overbought in uptrends
      confidence -= 0.1;  // Changed from -0.3 to -0.1
      reasons.push(`RSI overbought (${rsi.toFixed(2)}) - proceed with caution`);
    } else if (rsi >= 40 && rsi <= 60) {
      // Neutral RSI is actually good for entries
      confidence += 0.1;
      reasons.push(`RSI neutral (${rsi.toFixed(2)}) - healthy`);
    }

    // Price vs EMA
    if (currentPrice > ema12) {
      confidence += 0.15;
      reasons.push('Price above EMA12');
    } else {
      confidence -= 0.15;
      reasons.push('Price below EMA12');
    }

    // Recent momentum
    const recentChange = ((closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5]) * 100;
    if (recentChange > 2) {
      confidence += 0.2;
      reasons.push(`Strong recent momentum (+${recentChange.toFixed(2)}%)`);
    } else if (recentChange < -2) {
      confidence -= 0.2;
      reasons.push(`Weak recent momentum (${recentChange.toFixed(2)}%)`);
    }

    // Determine signal
    if (confidence > 0.3) {
      signal = 'BUY';
    } else if (confidence < -0.3) {
      signal = 'SELL';
    }

    // Normalize confidence to 0-1 range
    const normalizedConfidence = Math.min(Math.max((Math.abs(confidence) / 0.8), 0), 1);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            symbol,
            signal,
            confidence: normalizedConfidence,
            currentPrice,
            indicators: {
              sma20,
              sma50,
              ema12,
              rsi,
              recentChange: recentChange.toFixed(2) + '%',
            },
            reasons,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Helper: Calculate EMA values array
   */
  calculateEMAValues(prices, period) {
    const multiplier = 2 / (period + 1);
    const emaValues = [];
    const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emaValues.push(firstSMA);

    for (let i = period; i < prices.length; i++) {
      const ema = (prices[i] - emaValues[emaValues.length - 1]) * multiplier + emaValues[emaValues.length - 1];
      emaValues.push(ema);
    }

    return emaValues;
  }

  /**
   * Helper: Calculate single SMA value
   */
  calculateSMAValue(prices, period) {
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Helper: Calculate single EMA value
   */
  calculateEMAValue(prices, period) {
    const emaValues = this.calculateEMAValues(prices, period);
    return emaValues[emaValues.length - 1];
  }

  /**
   * Helper: Calculate single RSI value
   */
  calculateRSIValue(prices, period) {
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < changes.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    }

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Analysis Server running on stdio');
  }
}

// Start the server
const server = new AnalysisServer();
server.run().catch(console.error);

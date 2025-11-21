/**
 * Backtesting Engine - Simulates trading strategy on historical data
 */

export class BacktestEngine {
  constructor(db, tradingStrategy) {
    this.db = db;
    this.tradingStrategy = tradingStrategy;
  }

  /**
   * Run a backtest over a date range
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {number} initialCapital - Starting capital
   */
  async runBacktest(startDate, endDate, initialCapital) {
    console.log(`\n📊 Starting backtest from ${startDate} to ${endDate}`);
    console.log(`Initial Capital: $${initialCapital.toFixed(2)}\n`);

    // Create backtest run record
    const backtestId = this.db.createBacktestRun(startDate, endDate, initialCapital);

    // Initialize backtest state
    const state = {
      cash: initialCapital,
      positions: new Map(), // symbol -> {quantity, averageCost}
      totalTrades: 0
    };

    // Get trading dates (weekdays between start and end)
    const tradingDates = this.getTradingDates(startDate, endDate);

    console.log(`Trading on ${tradingDates.length} days...\n`);

    // Simulate trading on each date at 10am ET
    for (const date of tradingDates) {
      await this.simulateTradingDay(backtestId, date, state);
    }

    // Calculate final metrics
    const finalValue = this.calculatePortfolioValue(state);
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;

    // Calculate additional metrics
    const { winRate, sharpeRatio, maxDrawdown } = this.calculateMetrics(backtestId, initialCapital);

    // Update backtest run with final results
    this.db.updateBacktestRun(
      backtestId,
      finalValue,
      totalReturn,
      state.totalTrades,
      winRate,
      sharpeRatio,
      maxDrawdown
    );

    console.log('\n' + '='.repeat(60));
    console.log('BACKTEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Initial Capital: $${initialCapital.toFixed(2)}`);
    console.log(`Final Value: $${finalValue.toFixed(2)}`);
    console.log(`Total Return: ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`);
    console.log(`Total Trades: ${state.totalTrades}`);
    console.log(`Win Rate: ${winRate.toFixed(2)}%`);
    console.log(`Sharpe Ratio: ${sharpeRatio.toFixed(3)}`);
    console.log(`Max Drawdown: ${maxDrawdown.toFixed(2)}%`);
    console.log('='.repeat(60));

    return {
      backtestId,
      initialCapital,
      finalValue,
      totalReturn,
      totalTrades: state.totalTrades,
      winRate,
      sharpeRatio,
      maxDrawdown
    };
  }

  /**
   * Simulate trading for a single day
   */
  async simulateTradingDay(backtestId, date, state) {
    // Get trading signals from strategy
    const signals = await this.tradingStrategy.generateSignals(date, state);

    if (!signals || signals.length === 0) {
      // Uncomment for debugging: console.log(`${date}: No signals`);
      return;
    }

    console.log(`${date}:`);

    // Execute signals
    for (const signal of signals) {
      const { symbol, action, quantity, price, reasoning } = signal;

      if (action === 'BUY') {
        const cost = quantity * price;
        if (cost <= state.cash) {
          state.cash -= cost;

          const existing = state.positions.get(symbol);
          if (existing) {
            const newQuantity = existing.quantity + quantity;
            const newAvgCost = ((existing.quantity * existing.averageCost) + cost) / newQuantity;
            state.positions.set(symbol, { quantity: newQuantity, averageCost: newAvgCost });
          } else {
            state.positions.set(symbol, { quantity, averageCost: price });
          }

          this.db.recordBacktestTrade(backtestId, date, symbol, 'BUY', quantity, price, reasoning);
          state.totalTrades++;

          console.log(`  ✓ BUY ${quantity} ${symbol} @ $${price.toFixed(2)}`);
        } else {
          console.log(`  ✗ Cannot buy ${symbol}: insufficient funds`);
        }
      } else if (action === 'SELL') {
        const existing = state.positions.get(symbol);
        if (existing && existing.quantity >= quantity) {
          const value = quantity * price;
          state.cash += value;

          const remaining = existing.quantity - quantity;
          if (remaining > 0) {
            state.positions.set(symbol, { quantity: remaining, averageCost: existing.averageCost });
          } else {
            state.positions.delete(symbol);
          }

          this.db.recordBacktestTrade(backtestId, date, symbol, 'SELL', quantity, price, reasoning);
          state.totalTrades++;

          const profitLoss = value - (quantity * existing.averageCost);
          console.log(`  ✓ SELL ${quantity} ${symbol} @ $${price.toFixed(2)} (P/L: ${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)})`);
        } else {
          console.log(`  ✗ Cannot sell ${symbol}: insufficient position`);
        }
      }
    }
  }

  /**
   * Calculate current portfolio value
   */
  calculatePortfolioValue(state, priceMap = null) {
    let holdingsValue = 0;

    for (const [symbol, position] of state.positions) {
      const price = priceMap && priceMap[symbol] ? priceMap[symbol] : position.averageCost;
      holdingsValue += position.quantity * price;
    }

    return state.cash + holdingsValue;
  }

  /**
   * Get trading dates (weekdays) between start and end dates
   */
  getTradingDates(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const day = current.getDay();
      // Monday = 1, Friday = 5
      if (day >= 1 && day <= 5) {
        dates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Calculate performance metrics
   */
  calculateMetrics(backtestId, initialCapital) {
    const trades = this.db.getBacktestTrades(backtestId);

    // Calculate win rate
    const sellTrades = trades.filter(t => t.action === 'SELL');
    let winningTrades = 0;

    for (const sell of sellTrades) {
      const buyTrades = trades.filter(t =>
        t.action === 'BUY' &&
        t.symbol === sell.symbol &&
        t.trade_date < sell.trade_date
      );

      if (buyTrades.length > 0) {
        const avgBuyPrice = buyTrades.reduce((sum, b) => sum + b.price, 0) / buyTrades.length;
        if (sell.price > avgBuyPrice) {
          winningTrades++;
        }
      }
    }

    const winRate = sellTrades.length > 0 ? (winningTrades / sellTrades.length) * 100 : 0;

    // Calculate daily returns for Sharpe ratio
    const dailyValues = new Map();
    let cash = initialCapital;
    const positions = new Map();

    // Replay trades to get daily portfolio values
    for (const trade of trades) {
      if (trade.action === 'BUY') {
        cash -= trade.total_value;
        const existing = positions.get(trade.symbol);
        if (existing) {
          const newQty = existing.quantity + trade.quantity;
          const newAvg = ((existing.quantity * existing.averageCost) + trade.total_value) / newQty;
          positions.set(trade.symbol, { quantity: newQty, averageCost: newAvg });
        } else {
          positions.set(trade.symbol, { quantity: trade.quantity, averageCost: trade.price });
        }
      } else if (trade.action === 'SELL') {
        cash += trade.total_value;
        const existing = positions.get(trade.symbol);
        if (existing) {
          const remaining = existing.quantity - trade.quantity;
          if (remaining > 0) {
            positions.set(trade.symbol, { quantity: remaining, averageCost: existing.averageCost });
          } else {
            positions.delete(trade.symbol);
          }
        }
      }

      // Calculate portfolio value (simplified - uses cost basis for holdings)
      let holdingsValue = 0;
      for (const [symbol, pos] of positions) {
        holdingsValue += pos.quantity * pos.averageCost;
      }
      dailyValues.set(trade.trade_date, cash + holdingsValue);
    }

    const values = Array.from(dailyValues.values());
    const dailyReturns = [];
    for (let i = 1; i < values.length; i++) {
      dailyReturns.push((values[i] - values[i - 1]) / values[i - 1]);
    }

    let sharpeRatio = 0;
    if (dailyReturns.length > 1) {
      const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
      const stdDev = Math.sqrt(variance);
      sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    }

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = initialCapital;
    for (const value of values) {
      if (value > peak) peak = value;
      const drawdown = ((peak - value) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return { winRate, sharpeRatio, maxDrawdown };
  }
}

/**
 * Simple trading strategy interface
 * Implement this to create custom strategies
 */
export class TradingStrategy {
  /**
   * Generate trading signals for a given date
   * @param {string} date - Trading date in YYYY-MM-DD format
   * @param {object} state - Current portfolio state
   * @returns {Array} Array of signals: [{symbol, action, quantity, price, reasoning}]
   */
  async generateSignals(date, state) {
    throw new Error('generateSignals must be implemented by subclass');
  }
}

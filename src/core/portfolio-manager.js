/**
 * Portfolio Manager - Handles portfolio state and trade execution
 */

export class PortfolioManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get current portfolio summary
   */
  getPortfolioSummary() {
    const cash = this.db.getCashBalance();
    const positions = this.db.getPortfolio();

    const holdingsValue = positions.reduce((sum, pos) => {
      return sum + (pos.quantity * (pos.current_price || pos.average_cost));
    }, 0);

    return {
      cash,
      positions,
      holdingsValue,
      totalValue: cash + holdingsValue
    };
  }

  /**
   * Execute a buy order
   */
  executeBuy(symbol, quantity, price, tradeDate, reasoning = null) {
    const totalCost = quantity * price;
    const currentCash = this.db.getCashBalance();

    if (totalCost > currentCash) {
      throw new Error(`Insufficient funds. Need $${totalCost.toFixed(2)}, have $${currentCash.toFixed(2)}`);
    }

    // Update cash balance
    this.db.updateCashBalance(currentCash - totalCost);

    // Update or create position
    const existingPosition = this.db.getPosition(symbol);

    if (existingPosition) {
      const newQuantity = existingPosition.quantity + quantity;
      const newAverageCost = (
        (existingPosition.quantity * existingPosition.average_cost) + totalCost
      ) / newQuantity;

      this.db.updatePosition(symbol, newQuantity, newAverageCost, price);
    } else {
      this.db.updatePosition(symbol, quantity, price, price);
    }

    // Record the trade
    const tradeId = this.db.recordTrade(tradeDate, symbol, 'BUY', quantity, price, reasoning);

    console.log(`✓ BUY ${quantity} ${symbol} @ $${price.toFixed(2)} = $${totalCost.toFixed(2)}`);

    return {
      tradeId,
      symbol,
      action: 'BUY',
      quantity,
      price,
      totalCost,
      newCashBalance: currentCash - totalCost
    };
  }

  /**
   * Execute a sell order
   */
  executeSell(symbol, quantity, price, tradeDate, reasoning = null) {
    const existingPosition = this.db.getPosition(symbol);

    if (!existingPosition) {
      throw new Error(`No position in ${symbol} to sell`);
    }

    if (quantity > existingPosition.quantity) {
      throw new Error(`Cannot sell ${quantity} shares of ${symbol}. Only own ${existingPosition.quantity}`);
    }

    const totalValue = quantity * price;
    const currentCash = this.db.getCashBalance();

    // Update cash balance
    this.db.updateCashBalance(currentCash + totalValue);

    // Update or remove position
    const remainingQuantity = existingPosition.quantity - quantity;

    if (remainingQuantity > 0) {
      this.db.updatePosition(symbol, remainingQuantity, existingPosition.average_cost, price);
    } else {
      this.db.removePosition(symbol);
    }

    // Record the trade
    const tradeId = this.db.recordTrade(tradeDate, symbol, 'SELL', quantity, price, reasoning);

    // Calculate profit/loss
    const costBasis = quantity * existingPosition.average_cost;
    const profitLoss = totalValue - costBasis;
    const profitLossPercent = (profitLoss / costBasis) * 100;

    console.log(`✓ SELL ${quantity} ${symbol} @ $${price.toFixed(2)} = $${totalValue.toFixed(2)} (P/L: ${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)} / ${profitLossPercent >= 0 ? '+' : ''}${profitLossPercent.toFixed(2)}%)`);

    return {
      tradeId,
      symbol,
      action: 'SELL',
      quantity,
      price,
      totalValue,
      profitLoss,
      profitLossPercent,
      newCashBalance: currentCash + totalValue
    };
  }

  /**
   * Update current prices for all positions
   */
  updatePrices(priceMap) {
    const positions = this.db.getPortfolio();

    for (const position of positions) {
      if (priceMap[position.symbol]) {
        this.db.updatePosition(
          position.symbol,
          position.quantity,
          position.average_cost,
          priceMap[position.symbol]
        );
      }
    }
  }

  /**
   * Take a daily snapshot of portfolio value
   */
  takeDailySnapshot(snapshotDate) {
    const summary = this.getPortfolioSummary();
    const latestSnapshot = this.db.getLatestSnapshot();
    const previousValue = latestSnapshot ? latestSnapshot.total_value : null;

    this.db.recordDailySnapshot(
      snapshotDate,
      summary.cash,
      summary.holdingsValue,
      previousValue
    );

    console.log(`✓ Snapshot recorded for ${snapshotDate}: $${summary.totalValue.toFixed(2)}`);

    return {
      snapshotDate,
      ...summary,
      dailyReturn: latestSnapshot
        ? ((summary.totalValue - latestSnapshot.total_value) / latestSnapshot.total_value) * 100
        : 0
    };
  }

  /**
   * Get portfolio performance metrics
   */
  getPerformanceMetrics(startDate = null) {
    const snapshots = this.db.getSnapshots(startDate);

    if (snapshots.length === 0) {
      return null;
    }

    const initialValue = snapshots[0].total_value;
    const currentValue = snapshots[snapshots.length - 1].total_value;
    const totalReturn = ((currentValue - initialValue) / initialValue) * 100;

    // Calculate daily returns
    const dailyReturns = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = snapshots[i - 1].total_value;
      const currValue = snapshots[i].total_value;
      const dailyReturn = (currValue - prevValue) / prevValue;
      dailyReturns.push(dailyReturn);
    }

    // Calculate Sharpe Ratio (assuming 252 trading days, 0% risk-free rate)
    let sharpeRatio = null;
    if (dailyReturns.length > 0) {
      const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length;
      const stdDev = Math.sqrt(variance);
      sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    }

    // Calculate maximum drawdown
    let maxDrawdown = 0;
    let peak = snapshots[0].total_value;

    for (const snapshot of snapshots) {
      if (snapshot.total_value > peak) {
        peak = snapshot.total_value;
      }
      const drawdown = ((peak - snapshot.total_value) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      initialValue,
      currentValue,
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      tradingDays: snapshots.length
    };
  }

  /**
   * Get trade statistics
   */
  getTradeStatistics(startDate = null) {
    const trades = this.db.getTrades(startDate);

    const buyTrades = trades.filter(t => t.action === 'BUY');
    const sellTrades = trades.filter(t => t.action === 'SELL');

    let winningTrades = 0;
    let losingTrades = 0;
    let totalProfitLoss = 0;

    // Calculate P/L for each sell trade
    for (const sell of sellTrades) {
      // Find corresponding buy trades (FIFO)
      const buys = buyTrades.filter(b =>
        b.symbol === sell.symbol && b.trade_date <= sell.trade_date
      ).sort((a, b) => a.trade_date.localeCompare(b.trade_date));

      if (buys.length > 0) {
        const avgBuyPrice = buys.reduce((sum, b) => sum + b.price, 0) / buys.length;
        const profitLoss = (sell.price - avgBuyPrice) * sell.quantity;
        totalProfitLoss += profitLoss;

        if (profitLoss > 0) {
          winningTrades++;
        } else if (profitLoss < 0) {
          losingTrades++;
        }
      }
    }

    const winRate = sellTrades.length > 0
      ? (winningTrades / sellTrades.length) * 100
      : 0;

    return {
      totalTrades: trades.length,
      buyTrades: buyTrades.length,
      sellTrades: sellTrades.length,
      winningTrades,
      losingTrades,
      winRate,
      totalProfitLoss
    };
  }
}

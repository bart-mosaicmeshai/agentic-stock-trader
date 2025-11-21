/**
 * Reporting utilities for displaying trading results
 */

export class Reporter {
  constructor(db) {
    this.db = db;
  }

  /**
   * Display portfolio status
   */
  displayPortfolio() {
    console.log('\n' + '='.repeat(80));
    console.log('PORTFOLIO STATUS');
    console.log('='.repeat(80));

    const cash = this.db.getCashBalance();
    const positions = this.db.getPortfolio();

    console.log(`\nCash Balance: $${cash.toFixed(2)}`);

    if (positions.length > 0) {
      console.log('\nPositions:');
      console.log('-'.repeat(80));
      console.log('Symbol'.padEnd(10) + 'Quantity'.padEnd(15) + 'Avg Cost'.padEnd(15) + 'Current'.padEnd(15) + 'Value');
      console.log('-'.repeat(80));

      let totalValue = 0;
      for (const pos of positions) {
        const currentPrice = pos.current_price || pos.average_cost;
        const value = pos.quantity * currentPrice;
        totalValue += value;

        console.log(
          pos.symbol.padEnd(10) +
          pos.quantity.toFixed(2).padEnd(15) +
          `$${pos.average_cost.toFixed(2)}`.padEnd(15) +
          `$${currentPrice.toFixed(2)}`.padEnd(15) +
          `$${value.toFixed(2)}`
        );
      }

      console.log('-'.repeat(80));
      console.log(`Holdings Value: $${totalValue.toFixed(2)}`);
      console.log(`Total Portfolio Value: $${(cash + totalValue).toFixed(2)}`);
    } else {
      console.log('\nNo positions currently held.');
    }

    console.log('='.repeat(80));
  }

  /**
   * Display recent trades
   */
  displayRecentTrades(limit = 10) {
    const trades = this.db.getTrades().slice(0, limit);

    if (trades.length === 0) {
      console.log('\nNo trades recorded yet.');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`RECENT TRADES (Last ${limit})`);
    console.log('='.repeat(80));
    console.log('Date'.padEnd(12) + 'Action'.padEnd(8) + 'Symbol'.padEnd(10) + 'Quantity'.padEnd(12) + 'Price'.padEnd(12) + 'Total');
    console.log('-'.repeat(80));

    for (const trade of trades) {
      console.log(
        trade.trade_date.padEnd(12) +
        trade.action.padEnd(8) +
        trade.symbol.padEnd(10) +
        trade.quantity.toFixed(2).padEnd(12) +
        `$${trade.price.toFixed(2)}`.padEnd(12) +
        `$${trade.total_value.toFixed(2)}`
      );
      if (trade.reasoning) {
        console.log(`  Reason: ${trade.reasoning}`);
      }
    }

    console.log('='.repeat(80));
  }

  /**
   * Display performance summary
   */
  displayPerformance(days = null) {
    const startDate = days ? this.getDateDaysAgo(days) : null;
    const snapshots = this.db.getSnapshots(startDate);

    if (snapshots.length === 0) {
      console.log('\nNo performance data available yet.');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`PERFORMANCE SUMMARY${days ? ` (Last ${days} days)` : ''}`);
    console.log('='.repeat(80));

    const initial = snapshots[0];
    const latest = snapshots[snapshots.length - 1];

    console.log(`\nPeriod: ${initial.snapshot_date} to ${latest.snapshot_date}`);
    console.log(`Trading Days: ${snapshots.length}`);
    console.log(`Starting Value: $${initial.total_value.toFixed(2)}`);
    console.log(`Current Value: $${latest.total_value.toFixed(2)}`);
    console.log(`Total Return: ${latest.cumulative_return >= 0 ? '+' : ''}${latest.cumulative_return?.toFixed(2) || '0.00'}%`);

    if (latest.daily_return !== null) {
      console.log(`Last Daily Return: ${latest.daily_return >= 0 ? '+' : ''}${latest.daily_return.toFixed(2)}%`);
    }

    // Calculate additional metrics
    const trades = this.db.getTrades(startDate);
    const buyTrades = trades.filter(t => t.action === 'BUY').length;
    const sellTrades = trades.filter(t => t.action === 'SELL').length;

    console.log(`\nTotal Trades: ${trades.length} (${buyTrades} buys, ${sellTrades} sells)`);

    console.log('\nDaily Performance:');
    console.log('-'.repeat(80));
    console.log('Date'.padEnd(12) + 'Total Value'.padEnd(18) + 'Daily Return'.padEnd(18) + 'Cumulative');
    console.log('-'.repeat(80));

    for (const snapshot of snapshots.slice(-10)) { // Last 10 days
      const dailyReturn = snapshot.daily_return !== null ? `${snapshot.daily_return >= 0 ? '+' : ''}${snapshot.daily_return.toFixed(2)}%` : 'N/A';
      const cumReturn = snapshot.cumulative_return !== null ? `${snapshot.cumulative_return >= 0 ? '+' : ''}${snapshot.cumulative_return.toFixed(2)}%` : 'N/A';

      console.log(
        snapshot.snapshot_date.padEnd(12) +
        `$${snapshot.total_value.toFixed(2)}`.padEnd(18) +
        dailyReturn.padEnd(18) +
        cumReturn
      );
    }

    console.log('='.repeat(80));
  }

  /**
   * Display backtest results
   */
  displayBacktestResults(backtestId = null) {
    const runs = backtestId
      ? [this.db.prepare('SELECT * FROM backtest_runs WHERE id = ?').get(backtestId)]
      : this.db.getBacktestRuns();

    if (!runs || runs.length === 0) {
      console.log('\nNo backtest results available.');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('BACKTEST RESULTS');
    console.log('='.repeat(80));

    for (const run of runs.slice(0, 5)) { // Show last 5 runs
      console.log(`\nBacktest ID: ${run.id}`);
      console.log(`Period: ${run.start_date} to ${run.end_date}`);
      console.log(`Initial Capital: $${run.initial_capital.toFixed(2)}`);
      console.log(`Final Value: $${run.final_value.toFixed(2)}`);
      console.log(`Total Return: ${run.total_return >= 0 ? '+' : ''}${run.total_return.toFixed(2)}%`);
      console.log(`Total Trades: ${run.total_trades}`);
      console.log(`Win Rate: ${run.win_rate?.toFixed(2) || '0.00'}%`);
      console.log(`Sharpe Ratio: ${run.sharpe_ratio?.toFixed(3) || 'N/A'}`);
      console.log(`Max Drawdown: ${run.max_drawdown?.toFixed(2) || '0.00'}%`);
      console.log(`Run Date: ${run.created_at}`);
      console.log('-'.repeat(80));
    }

    console.log('='.repeat(80));
  }

  /**
   * Export performance to CSV
   */
  exportToCSV(filename = 'performance.csv') {
    const snapshots = this.db.getSnapshots();

    if (snapshots.length === 0) {
      console.log('No data to export.');
      return;
    }

    const fs = require('fs');
    const header = 'Date,Cash,Holdings,Total Value,Daily Return %,Cumulative Return %\n';
    const rows = snapshots.map(s =>
      `${s.snapshot_date},${s.cash_balance},${s.holdings_value},${s.total_value},${s.daily_return || ''},${s.cumulative_return || ''}`
    ).join('\n');

    fs.writeFileSync(filename, header + rows);
    console.log(`✓ Performance data exported to ${filename}`);
  }

  /**
   * Helper: Get date N days ago
   */
  getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
}

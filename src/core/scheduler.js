import cron from 'node-cron';

/**
 * Trading Scheduler - Handles scheduled trading runs
 */

export class TradingScheduler {
  constructor(tradingEngine) {
    this.tradingEngine = tradingEngine;
    this.cronJob = null;
  }

  /**
   * Start the daily trading schedule (10am ET = 10:00 America/New_York)
   */
  start() {
    // Run every day at 10:00 AM Eastern Time
    // Note: This assumes the system timezone is set to ET or uses TZ environment variable
    this.cronJob = cron.schedule('0 10 * * 1-5', async () => {
      console.log('\n🔔 Starting scheduled trading run at 10:00 AM ET');
      await this.tradingEngine.runDailyTrading();
    }, {
      scheduled: true,
      timezone: 'America/New_York'
    });

    console.log('✓ Trading scheduler started (daily at 10:00 AM ET, Monday-Friday)');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('✓ Trading scheduler stopped');
    }
  }

  /**
   * Run trading immediately (for testing)
   */
  async runNow() {
    console.log('\n🔔 Running trading manually');
    await this.tradingEngine.runDailyTrading();
  }
}

/**
 * Get current time in Eastern Time
 */
export function getCurrentETTime() {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Check if markets are open (rough approximation)
 */
export function areMarketsOpen() {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const day = etTime.getDay();
  const hour = etTime.getHours();

  // Monday-Friday, 9:30 AM - 4:00 PM ET
  const isWeekday = day >= 1 && day <= 5;
  const isDuringTradingHours = (hour === 9 && etTime.getMinutes() >= 30) || (hour >= 10 && hour < 16);

  return isWeekday && isDuringTradingHours;
}

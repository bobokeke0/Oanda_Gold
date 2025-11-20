/**
 * Risk Management System
 * Handles position sizing, portfolio heat, and risk limits
 */
import Config from './config.js';

class RiskManager {
  constructor(logger, oandaClient) {
    this.logger = logger;
    this.client = oandaClient;

    // Track daily P&L
    this.dailyPnL = 0;
    this.dailyTrades = 0;
    this.winningTrades = 0;
    this.losingTrades = 0;
    this.lastResetDate = new Date().toDateString();

    // Track all-time stats
    this.totalPnL = 0;
    this.totalTrades = 0;
    this.totalWins = 0;
    this.totalLosses = 0;

    this.initialBalance = Config.INITIAL_BALANCE;
    this.currentBalance = Config.INITIAL_BALANCE;
  }

  /**
   * Reset daily statistics (call at start of new day)
   */
  resetDailyStats() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.logger.info('📅 Resetting daily statistics');
      this.dailyPnL = 0;
      this.dailyTrades = 0;
      this.winningTrades = 0;
      this.losingTrades = 0;
      this.lastResetDate = today;
    }
  }

  /**
   * Sync balance from exchange
   */
  async syncBalance() {
    try {
      const balance = await this.client.getBalance();
      this.currentBalance = balance.nav; // Use NAV (includes unrealized P&L)
      this.logger.info(`Balance synced: $${this.currentBalance.toFixed(2)}`);
      return this.currentBalance;
    } catch (error) {
      this.logger.error(`Failed to sync balance: ${error.message}`);
      return this.currentBalance;
    }
  }

  /**
   * Calculate position size based on risk percentage
   * @param {number} entryPrice - Entry price
   * @param {number} stopLoss - Stop loss price
   * @param {number} riskPercent - Risk as decimal (e.g., 0.015 for 1.5%)
   * @returns {number} Position size in units
   */
  calculatePositionSize(entryPrice, stopLoss, riskPercent = Config.MAX_RISK_PER_TRADE) {
    const riskAmount = this.currentBalance * riskPercent;
    const priceDistance = Math.abs(entryPrice - stopLoss);

    if (priceDistance === 0) {
      this.logger.error('Price distance to stop loss is zero');
      return 0;
    }

    // Position Size = Risk Amount / Distance to Stop Loss
    let positionSize = Math.floor(riskAmount / priceDistance);

    // Apply min/max limits
    positionSize = Math.max(positionSize, Config.MIN_POSITION_SIZE);
    positionSize = Math.min(positionSize, Config.MAX_POSITION_SIZE);

    this.logger.info(`Position sizing: Risk=$${riskAmount.toFixed(2)}, Distance=$${priceDistance.toFixed(2)}, Size=${positionSize} units`);

    return positionSize;
  }

  /**
   * Calculate portfolio heat (total risk exposure)
   */
  async calculatePortfolioHeat() {
    try {
      const openTrades = await this.client.getOpenTrades();

      let totalRisk = 0;
      for (const trade of openTrades) {
        if (trade.stopLoss) {
          const priceDistance = Math.abs(trade.price - trade.stopLoss);
          const riskAmount = priceDistance * Math.abs(trade.units);
          totalRisk += riskAmount;
        }
      }

      const portfolioHeat = totalRisk / this.currentBalance;
      return portfolioHeat;
    } catch (error) {
      this.logger.error(`Failed to calculate portfolio heat: ${error.message}`);
      return 0;
    }
  }

  /**
   * Check if we can open a new trade
   */
  async canOpenTrade(entryPrice, stopLoss, positionSize) {
    // Reset daily stats if new day
    this.resetDailyStats();

    // Check daily loss limit
    if (this.dailyPnL <= -Config.MAX_DAILY_LOSS) {
      this.logger.risk('Daily loss limit reached', { dailyPnL: this.dailyPnL });
      return { allowed: false, reason: 'DAILY_LOSS_LIMIT' };
    }

    // Check if daily target already met (optional: stop for the day)
    // Commenting out to allow continued trading even after target met
    // if (this.dailyPnL >= Config.TARGET_DAILY_PROFIT) {
    //   this.logger.info('Daily profit target reached - taking rest of day off');
    //   return { allowed: false, reason: 'DAILY_TARGET_MET' };
    // }

    // Check portfolio heat
    const currentHeat = await this.calculatePortfolioHeat();
    const newTradeRisk = Math.abs(entryPrice - stopLoss) * positionSize;
    const newHeat = (currentHeat * this.currentBalance + newTradeRisk) / this.currentBalance;

    if (newHeat > Config.MAX_PORTFOLIO_RISK) {
      this.logger.risk('Portfolio heat too high', {
        currentHeat: currentHeat.toFixed(3),
        newHeat: newHeat.toFixed(3),
        maxAllowed: Config.MAX_PORTFOLIO_RISK
      });
      return { allowed: false, reason: 'PORTFOLIO_HEAT_EXCEEDED' };
    }

    return { allowed: true };
  }

  /**
   * Record a trade result
   */
  recordTrade(pnl) {
    this.dailyPnL += pnl;
    this.dailyTrades++;

    this.totalPnL += pnl;
    this.totalTrades++;

    if (pnl > 0) {
      this.winningTrades++;
      this.totalWins++;
    } else if (pnl < 0) {
      this.losingTrades++;
      this.totalLosses++;
    }

    this.logger.trade('Trade recorded', {
      pnl: pnl.toFixed(2),
      dailyPnL: this.dailyPnL.toFixed(2),
      totalPnL: this.totalPnL.toFixed(2)
    });
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary() {
    try {
      await this.syncBalance();
      const openTrades = await this.client.getOpenTrades();
      const portfolioHeat = await this.calculatePortfolioHeat();

      const unrealizedPL = openTrades.reduce((sum, trade) => sum + trade.unrealizedPL, 0);
      const winRate = this.totalTrades > 0 ? (this.totalWins / this.totalTrades) * 100 : 0;

      return {
        balance: this.currentBalance,
        initialBalance: this.initialBalance,
        totalPnL: this.totalPnL,
        totalPnLPct: ((this.currentBalance - this.initialBalance) / this.initialBalance) * 100,
        dailyPnL: this.dailyPnL,
        dailyTrades: this.dailyTrades,
        portfolioHeat: portfolioHeat,
        openPositions: openTrades.length,
        unrealizedPL: unrealizedPL,
        portfolioValue: this.currentBalance + unrealizedPL,
        winningTrades: this.winningTrades,
        losingTrades: this.losingTrades,
        totalTrades: this.totalTrades,
        winRate: winRate
      };
    } catch (error) {
      this.logger.error(`Failed to get portfolio summary: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate take profit levels
   */
  calculateTakeProfits(entryPrice, stopLoss, isLong) {
    const riskDistance = Math.abs(entryPrice - stopLoss);

    const tp1Distance = riskDistance * Config.TAKE_PROFIT_1_RR;
    const tp2Distance = riskDistance * Config.TAKE_PROFIT_2_RR;

    if (isLong) {
      return {
        tp1: entryPrice + tp1Distance,
        tp2: entryPrice + tp2Distance
      };
    } else {
      return {
        tp1: entryPrice - tp1Distance,
        tp2: entryPrice - tp2Distance
      };
    }
  }
}

export default RiskManager;

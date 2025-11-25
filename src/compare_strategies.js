/**
 * Strategy Comparison Reporter
 *
 * Fetches performance data from both Oanda accounts and generates
 * daily/weekly/monthly comparison reports.
 */
import dotenv from 'dotenv';
import OandaClient from './oanda_client.js';
import { createLogger } from './logger.js';

const logger = createLogger('StrategyCompare');

class StrategyComparison {
  constructor() {
    this.accounts = [];
  }

  /**
   * Add an account to track
   */
  addAccount(name, apiKey, accountId, strategyType) {
    const client = new OandaClient(logger);
    client.apiKey = apiKey;
    client.accountId = accountId;

    this.accounts.push({
      name,
      strategyType,
      client,
      stats: null
    });

    logger.info(`📊 Registered account: ${name} (${strategyType})`);
  }

  /**
   * Fetch performance stats for an account
   */
  async fetchAccountStats(account) {
    try {
      // Get account summary
      const summary = await account.client.makeRequest('GET', `/v3/accounts/${account.client.accountId}/summary`);
      const accountData = summary.account;

      // Get recent trades (last 50)
      const tradesResponse = await account.client.makeRequest('GET',
        `/v3/accounts/${account.client.accountId}/trades`,
        { count: 50, state: 'CLOSED' }
      );

      const trades = tradesResponse.trades || [];

      // Calculate statistics
      const balance = parseFloat(accountData.balance);
      const unrealizedPL = parseFloat(accountData.unrealizedPL || 0);
      const marginUsed = parseFloat(accountData.marginUsed || 0);
      const openTradeCount = parseInt(accountData.openTradeCount || 0);

      // Analyze closed trades
      let totalTrades = trades.length;
      let winningTrades = 0;
      let losingTrades = 0;
      let totalPnL = 0;
      let largestWin = 0;
      let largestLoss = 0;

      for (const trade of trades) {
        const pnl = parseFloat(trade.realizedPL || 0);
        totalPnL += pnl;

        if (pnl > 0) {
          winningTrades++;
          if (pnl > largestWin) largestWin = pnl;
        } else if (pnl < 0) {
          losingTrades++;
          if (pnl < largestLoss) largestLoss = pnl;
        }
      }

      const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;
      const avgWin = winningTrades > 0 ? (trades.filter(t => parseFloat(t.realizedPL) > 0).reduce((sum, t) => sum + parseFloat(t.realizedPL), 0) / winningTrades) : 0;
      const avgLoss = losingTrades > 0 ? (trades.filter(t => parseFloat(t.realizedPL) < 0).reduce((sum, t) => sum + parseFloat(t.realizedPL), 0) / losingTrades) : 0;
      const profitFactor = Math.abs(avgLoss) > 0 ? (avgWin * winningTrades) / (Math.abs(avgLoss) * losingTrades) : 0;

      return {
        balance,
        unrealizedPL,
        marginUsed,
        openTradeCount,
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalPnL,
        avgWin,
        avgLoss,
        largestWin,
        largestLoss,
        profitFactor
      };

    } catch (error) {
      logger.error(`Failed to fetch stats for ${account.name}: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate comparison report
   */
  async generateReport(period = 'all') {
    logger.info(`\n${'='.repeat(80)}`);
    logger.info(`📊 STRATEGY COMPARISON REPORT (${period.toUpperCase()})`);
    logger.info(`Generated: ${new Date().toLocaleString()}`);
    logger.info('='.repeat(80));
    logger.info('');

    for (const account of this.accounts) {
      logger.info(`🤖 ${account.name} (${account.strategyType})`);
      logger.info('-'.repeat(80));

      const stats = await this.fetchAccountStats(account);

      if (!stats) {
        logger.warn('❌ Could not fetch statistics for this account\n');
        continue;
      }

      account.stats = stats;

      logger.info(`Balance: $${stats.balance.toFixed(2)} | Unrealized P&L: ${stats.unrealizedPL >= 0 ? '+' : ''}$${stats.unrealizedPL.toFixed(2)}`);
      logger.info(`Open Positions: ${stats.openTradeCount} | Margin Used: $${stats.marginUsed.toFixed(2)}`);
      logger.info('');
      logger.info(`Total Trades: ${stats.totalTrades} (${stats.winningTrades}W / ${stats.losingTrades}L)`);
      logger.info(`Win Rate: ${stats.winRate.toFixed(1)}%`);
      logger.info(`Total P&L: ${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}`);
      logger.info(`Avg Win: +$${stats.avgWin.toFixed(2)} | Avg Loss: $${stats.avgLoss.toFixed(2)}`);
      logger.info(`Largest Win: +$${stats.largestWin.toFixed(2)} | Largest Loss: $${stats.largestLoss.toFixed(2)}`);
      logger.info(`Profit Factor: ${stats.profitFactor.toFixed(2)}`);
      logger.info('');
    }

    // Comparison summary
    if (this.accounts.length === 2 && this.accounts[0].stats && this.accounts[1].stats) {
      logger.info('='.repeat(80));
      logger.info('🏆 HEAD-TO-HEAD COMPARISON');
      logger.info('='.repeat(80));
      logger.info('');

      const [acct1, acct2] = this.accounts;

      // Balance comparison
      const balanceDiff = acct1.stats.balance - acct2.stats.balance;
      const balanceLeader = balanceDiff > 0 ? acct1.name : acct2.name;
      logger.info(`💰 Balance Leader: ${balanceLeader} (Δ $${Math.abs(balanceDiff).toFixed(2)})`);

      // Win rate comparison
      const winRateDiff = acct1.stats.winRate - acct2.stats.winRate;
      const winRateLeader = winRateDiff > 0 ? acct1.name : acct2.name;
      logger.info(`🎯 Win Rate Leader: ${winRateLeader} (${Math.abs(winRateDiff).toFixed(1)}% higher)`);

      // Total P&L comparison
      const pnlDiff = acct1.stats.totalPnL - acct2.stats.totalPnL;
      const pnlLeader = pnlDiff > 0 ? acct1.name : acct2.name;
      logger.info(`📈 Total P&L Leader: ${pnlLeader} (Δ $${Math.abs(pnlDiff).toFixed(2)})`);

      // Profit factor comparison
      const pfDiff = acct1.stats.profitFactor - acct2.stats.profitFactor;
      const pfLeader = pfDiff > 0 ? acct1.name : acct2.name;
      logger.info(`⚡ Profit Factor Leader: ${pfLeader} (${Math.abs(pfDiff).toFixed(2)} higher)`);

      logger.info('');
    }

    logger.info('='.repeat(80));
    logger.info('');
  }
}

// CLI Usage
if (import.meta.url === `file://${process.argv[1]}`) {
  // Load both .env files
  dotenv.config({ path: '.env' });
  const tripleKey = process.env.OANDA_API_KEY;
  const tripleAccount = process.env.OANDA_ACCOUNT_ID;

  dotenv.config({ path: '.env.ma_crossover', override: true });
  const maKey = process.env.OANDA_API_KEY;
  const maAccount = process.env.OANDA_ACCOUNT_ID;

  const comparison = new StrategyComparison();
  comparison.addAccount('Triple Confirmation Bot', tripleKey, tripleAccount, 'triple_confirmation');
  comparison.addAccount('MA Crossover Bot', maKey, maAccount, 'ma_crossover');

  const period = process.argv[2] || 'all';
  comparison.generateReport(period).then(() => {
    process.exit(0);
  }).catch(error => {
    logger.error(`Report generation failed: ${error.message}`);
    process.exit(1);
  });
}

export default StrategyComparison;

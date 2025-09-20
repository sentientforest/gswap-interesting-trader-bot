import { GSwap } from '@gala-chain/gswap-sdk';
import { loadConfig, getTagline, BotConfig } from './config.js';
import { BalanceManager, BalanceSummary } from './balance-manager.js';
import { TradingStrategy, TradeResult } from './trading-strategy.js';
import { Logger } from './logger.js';

export class MostInterestingTraderBot {
  private config: BotConfig;
  private balanceManager: BalanceManager;
  private tradingStrategy: TradingStrategy;
  private logger: Logger;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastBalanceCheck: BalanceSummary | null = null;
  private lastTradeTime: Date | null = null;
  private startTime: Date;

  constructor(config?: BotConfig) {
    this.config = config || loadConfig();
    this.logger = new Logger(this.config.enableLogging);
    this.startTime = new Date();

    // Initialize GSwap instance with configurable timeout and URLs
    const gSwap = new GSwap({
      transactionWaitTimeoutMs: this.config.transactionTimeoutMs,
      gatewayBaseUrl: this.config.gatewayBaseUrl,
      dexContractBasePath: this.config.dexContractBasePath,
      tokenContractBasePath: this.config.tokenContractBasePath,
      bundlerBaseUrl: this.config.bundlerBaseUrl,
      bundlingAPIBasePath: this.config.bundlingAPIBasePath,
      dexBackendBaseUrl: this.config.dexBackendBaseUrl,
    });

    // Initialize managers
    this.balanceManager = new BalanceManager(gSwap, this.config);
    this.tradingStrategy = new TradingStrategy(this.config);

    this.logger.info('=' .repeat(60));
    this.logger.info('The Most Interesting Trader in the World');
    this.logger.info(getTagline(this.config));
    this.logger.info('=' .repeat(60));
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Bot is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting trading bot...');
    this.logger.info(`Trade interval: ${this.config.tradeInterval}ms`);
    this.logger.info(`Trading enabled: ${this.config.enableTrading}`);
    this.logger.info(`Transaction timeout: ${this.config.transactionTimeoutMs}ms (${this.config.transactionTimeoutMs / 60000} minutes)`);
    this.logger.info('GSwap SDK Configuration:');
    this.logger.info(`  Gateway: ${this.config.gatewayBaseUrl}`);
    this.logger.info(`  Bundler: ${this.config.bundlerBaseUrl}`);
    this.logger.info(`  DEX Backend: ${this.config.dexBackendBaseUrl}`);

    // Execute first trade cycle immediately
    await this.executeTradeCycle();

    // Set up periodic trading
    this.intervalId = setInterval(async () => {
      await this.executeTradeCycle();
    }, this.config.tradeInterval);

    this.logger.info('Bot started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Bot is not running');
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.logger.info('Bot stopped');
  }

  private async executeTradeCycle(): Promise<void> {
    this.logger.info('');
    this.logger.info(`Starting trade cycle at ${new Date().toISOString()}`);

    try {
      // Step 1: Check balances
      this.logger.info('Checking balances...');
      const balances = await this.balanceManager.getBalances();
      this.lastBalanceCheck = balances;

      this.logger.info(this.balanceManager.formatBalance(balances));

      // Step 2: Determine trades needed
      const trades = this.balanceManager.getTokensToTrade(balances);

      if (trades.length === 0) {
        this.logger.info('No trades needed at this time');
        this.logger.info('Reasons:');

        if (balances.otherTokens.length === 0) {
          this.logger.info('  - No non-preferred tokens to trade');
        }

        if (balances.galaTokenBalance >= this.config.minimumGalaBalance) {
          this.logger.info(`  - GALA balance (${balances.galaTokenBalance}) is above minimum (${this.config.minimumGalaBalance})`);
        }

        if (!this.balanceManager.canTradeExcessGala(balances)) {
          this.logger.info('  - Not enough excess GALA to trade');
        }

        return;
      }

      // Step 3: Execute trades
      this.logger.info(`Executing ${trades.length} trades...`);

      const results = await this.tradingStrategy.executeTradesForPreferredToken(trades);
      this.lastTradeTime = new Date();

      // Step 4: Log results
      if (results.length > 0) {
        this.logger.info(this.tradingStrategy.formatTradeResults(results));
      }

      // Step 5: Check final balance
      if (this.config.enableTrading && results.some(r => r.success)) {
        this.logger.info('Fetching updated balances...');
        const updatedBalances = await this.balanceManager.getBalances();
        this.lastBalanceCheck = updatedBalances;
        this.logger.info(this.balanceManager.formatBalance(updatedBalances));
      }
    } catch (error) {
      this.logger.error(`Trade cycle failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    this.logger.info(`Trade cycle completed`);
    this.logger.info('-' .repeat(40));
  }

  getStatus(): any {
    const uptime = Date.now() - this.startTime.getTime();
    const tradeHistory = this.tradingStrategy.getTradeHistory(10);
    const volume = this.tradingStrategy.getTotalVolume();

    return {
      isRunning: this.isRunning,
      config: {
        preferredToken: this.config.preferredTokenName,
        tagline: getTagline(this.config),
        walletAddress: this.config.walletAddress,
        tradeInterval: this.config.tradeInterval,
        tradingEnabled: this.config.enableTrading,
      },
      uptime: {
        milliseconds: uptime,
        readable: this.formatUptime(uptime),
      },
      lastBalance: this.lastBalanceCheck,
      lastTradeTime: this.lastTradeTime,
      statistics: {
        totalTrades: tradeHistory.length,
        successRate: this.tradingStrategy.getSuccessRate(),
        totalVolume: volume,
      },
      recentTrades: tradeHistory,
    };
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Export a function to create and start the bot
export async function startBot(config?: BotConfig): Promise<MostInterestingTraderBot> {
  const bot = new MostInterestingTraderBot(config);
  await bot.start();
  return bot;
}
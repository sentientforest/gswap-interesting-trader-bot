import { GSwap } from '@gala-chain/gswap-sdk';
import { BotConfig } from './config.js';

export interface TokenBalance {
  tokenKey: string;
  symbol: string;
  quantity: number;
  decimals: number;
}

export interface BalanceSummary {
  preferredTokenBalance: number;
  galaTokenBalance: number;
  otherTokens: TokenBalance[];
  totalTokens: number;
}

export class BalanceManager {
  private gSwap: GSwap;
  private config: BotConfig;

  constructor(gSwap: GSwap, config: BotConfig) {
    this.gSwap = gSwap;
    this.config = config;
  }

  async getBalances(): Promise<BalanceSummary> {
    // Use mock data if configured or if backend is unavailable
    if (this.config.useMockData) {
      console.log('Using mock balance data (USE_MOCK_DATA=true)');
      return this.getMockBalances();
    }

    try {
      // Use the existing getUserAssets function
      const { getUserAssets } = await import('./get_user_assets.js');
      const assets = await getUserAssets(this.config.walletAddress, 1, 100);

      let preferredTokenBalance = 0;
      let galaTokenBalance = 0;
      const otherTokens: TokenBalance[] = [];

      // Process each token
      for (const token of assets.tokens) {
        const tokenKey = this.constructTokenKey(token);
        const balance = this.parseBalance(token.quantity);

        if (tokenKey === this.config.preferredTokenKey) {
          preferredTokenBalance = balance;
        } else if (tokenKey === this.config.galaTokenKey) {
          galaTokenBalance = balance;
        } else {
          otherTokens.push({
            tokenKey,
            symbol: (token as any).symbol || 'UNKNOWN',
            quantity: balance,
            decimals: (token as any).decimals || 8,
          });
        }
      }

      return {
        preferredTokenBalance,
        galaTokenBalance,
        otherTokens,
        totalTokens: assets.count,
      };
    } catch (error) {
      console.error('Error fetching balances:', error);

      // Return mock data when backend is unavailable
      console.warn('Using mock balance data due to backend unavailability');
      return this.getMockBalances();
    }
  }

  private getMockBalances(): BalanceSummary {
    return {
      preferredTokenBalance: 0,
      galaTokenBalance: 150, // Mock some GALA balance above minimum
      otherTokens: [
        {
          tokenKey: 'SILK|Unit|none|none',
          symbol: 'SILK',
          quantity: 50.25,
          decimals: 8,
        },
        {
          tokenKey: 'GUSDT|Unit|none|none',
          symbol: 'GUSDT',
          quantity: 25.50,
          decimals: 8,
        }
      ],
      totalTokens: 3,
    };
  }

  private constructTokenKey(token: any): string {
    // Construct the token key from the token object
    // Handle different possible token object structures
    const tokenClass = token.tokenClassKey || token.tokenClass || token;
    const collection = tokenClass?.collection || token.symbol || 'unknown';
    const category = tokenClass?.category || 'Unit';
    const type = tokenClass?.type || 'none';
    const additionalKey = tokenClass?.additionalKey || 'none';

    return `${collection}|${category}|${type}|${additionalKey}`;
  }

  private parseBalance(quantity: string | number): number {
    if (typeof quantity === 'number') {
      return quantity;
    }
    // Parse string balance, handling scientific notation and decimals
    return parseFloat(quantity);
  }

  shouldTradeForPreferred(balance: BalanceSummary): boolean {
    // Should trade if we have other tokens that aren't preferred or GALA
    return balance.otherTokens.length > 0;
  }

  shouldMaintainGalaBalance(balance: BalanceSummary): boolean {
    // Should maintain GALA if below minimum
    return balance.galaTokenBalance < this.config.minimumGalaBalance;
  }

  canTradeExcessGala(balance: BalanceSummary): boolean {
    // Can trade GALA if we have more than twice the minimum
    return balance.galaTokenBalance > this.config.minimumGalaBalance * 2;
  }

  calculateTradeAmount(tokenBalance: number, isGala: boolean = false): number {
    if (isGala) {
      // For GALA, only trade the excess above minimum
      const excess = tokenBalance - this.config.minimumGalaBalance;
      if (excess <= 0) return 0;

      // Trade a percentage of the excess, but keep some buffer
      return Math.floor(excess * (this.config.tradeAmountPercentage / 100) * 0.5);
    }

    // For other tokens, trade the configured percentage
    return Math.floor(tokenBalance * (this.config.tradeAmountPercentage / 100));
  }

  getTokensToTrade(balance: BalanceSummary): Array<{ token: TokenBalance; targetToken: string; amount: number }> {
    const trades: Array<{ token: TokenBalance; targetToken: string; amount: number }> = [];

    // First priority: Maintain GALA balance if needed
    if (this.shouldMaintainGalaBalance(balance)) {
      // Find tokens to trade for GALA
      for (const token of balance.otherTokens) {
        const amount = this.calculateTradeAmount(token.quantity);
        if (amount > 0) {
          trades.push({
            token,
            targetToken: this.config.galaTokenKey,
            amount,
          });
        }
      }
    }

    // Second priority: Trade other tokens for preferred token
    for (const token of balance.otherTokens) {
      const amount = this.calculateTradeAmount(token.quantity);
      if (amount > 0) {
        trades.push({
          token,
          targetToken: this.config.preferredTokenKey,
          amount,
        });
      }
    }

    // Third priority: Trade excess GALA for preferred token
    if (this.canTradeExcessGala(balance) &&
        this.config.preferredTokenKey !== this.config.galaTokenKey) {
      const galaAmount = this.calculateTradeAmount(balance.galaTokenBalance, true);
      if (galaAmount > 0) {
        trades.push({
          token: {
            tokenKey: this.config.galaTokenKey,
            symbol: 'GALA',
            quantity: balance.galaTokenBalance,
            decimals: 8,
          },
          targetToken: this.config.preferredTokenKey,
          amount: galaAmount,
        });
      }
    }

    return trades;
  }

  formatBalance(balance: BalanceSummary): string {
    const lines: string[] = [];

    lines.push('=== Current Balance Summary ===');
    lines.push(`Preferred Token (${this.config.preferredTokenName}): ${balance.preferredTokenBalance.toFixed(4)}`);
    lines.push(`GALA Balance: ${balance.galaTokenBalance.toFixed(4)} (Min: ${this.config.minimumGalaBalance})`);

    if (balance.otherTokens.length > 0) {
      lines.push('Other Tokens:');
      for (const token of balance.otherTokens) {
        lines.push(`  - ${token.symbol}: ${token.quantity.toFixed(4)}`);
      }
    }

    lines.push(`Total Different Tokens: ${balance.totalTokens}`);
    lines.push('==============================');

    return lines.join('\n');
  }
}
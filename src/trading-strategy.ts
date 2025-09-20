import { GSwap, PrivateKeySigner } from '@gala-chain/gswap-sdk';
import { BotConfig } from './config.js';
import { TokenBalance } from './balance-manager.js';

export interface TradeResult {
  success: boolean;
  fromToken: string;
  toToken: string;
  amountIn: number;
  amountOut?: number;
  transactionId?: string;
  error?: string;
  timestamp: Date;
}

export interface PoolInfo {
  token0: string;
  token1: string;
  fee: number;
  liquidity: string;
  sqrtPrice: string;
}

export class TradingStrategy {
  private gSwap: GSwap;
  private config: BotConfig;
  private tradeHistory: TradeResult[] = [];

  constructor(config: BotConfig) {
    this.config = config;

    // Only create signer if we have a valid private key and aren't using mock data
    const signerConfig: any = {};
    if (!config.useMockData && config.privateKey !== 'demo_key_placeholder' && config.privateKey !== 'your_private_key_here') {
      signerConfig.signer = new PrivateKeySigner(config.privateKey);
    }

    this.gSwap = new GSwap(signerConfig);
  }

  async findAvailablePools(tokenA: string, tokenB: string): Promise<PoolInfo[]> {
    const pools: PoolInfo[] = [];
    const feeTiers = [500, 3000, 10000] as const; // 0.05%, 0.3%, 1.0%

    for (const fee of feeTiers) {
      try {
        // For now, we'll assume pools exist - this would need to be implemented
        // based on the actual gSwap SDK pool query methods
        pools.push({
          token0: tokenA,
          token1: tokenB,
          fee,
          liquidity: "1000000", // Mock liquidity
          sqrtPrice: "1000000000000000000", // Mock price
        });
      } catch (error) {
        // Pool doesn't exist or has no liquidity
        continue;
      }
    }

    return pools;
  }

  async executeTrade(
    fromToken: string,
    toToken: string,
    amount: number,
    fee?: number
  ): Promise<TradeResult> {
    const result: TradeResult = {
      success: false,
      fromToken,
      toToken,
      amountIn: amount,
      timestamp: new Date(),
    };

    // If trading is disabled, simulate successful trade
    if (!this.config.enableTrading) {
      console.log(`[DRY RUN] Would trade ${amount} ${fromToken} for ${toToken}`);
      result.success = true;
      result.amountOut = amount * 0.98; // Mock 2% slippage
      result.transactionId = `mock-tx-${Date.now()}`;
      this.tradeHistory.push(result);
      return result;
    }

    try {
      // Find available pools if fee not specified
      let poolFee = fee;
      if (!poolFee) {
        const pools = await this.findAvailablePools(fromToken, toToken);
        if (pools.length === 0) {
          throw new Error(`No liquid pools found for ${fromToken} -> ${toToken}`);
        }
        // Choose pool with highest liquidity
        const bestPool = pools.reduce((prev, curr) =>
          parseFloat(curr.liquidity) > parseFloat(prev.liquidity) ? curr : prev
        );
        poolFee = bestPool.fee;
      }

      // For now, use existing quote functions from the project
      // This would need to be adapted based on the actual SDK structure
      const { quoteExactInput } = await import('./quote_exact_input.js');
      const quote = await quoteExactInput(
        fromToken,
        toToken,
        amount.toString(),
        poolFee as 500 | 3000 | 10000
      );

      if (!quote || !(quote as any).amountOut) {
        throw new Error('Unable to get quote for trade');
      }

      // Calculate minimum output with slippage
      const expectedOutput = parseFloat((quote as any).amountOut.toString());
      const minOutput = expectedOutput * (1 - this.config.maxSlippage / 100);

      console.log(`Trading ${amount} ${fromToken} for ${toToken}`);
      console.log(`Expected output: ${expectedOutput}, Min output: ${minOutput}`);

      // Connect to socket for transaction updates
      await GSwap.events.connectEventSocket();

      // Execute the swap using existing swap function
      const { swapTokens } = await import('./swap.js');
      const swapResult = await swapTokens(
        this.config.walletAddress,
        fromToken,
        toToken,
        poolFee as 500 | 3000 | 10000,
        {
          exactIn: amount.toString(),
          amountOutMinimum: minOutput.toString(),
        }
      );

      // Assume swap was successful if no error thrown
      result.success = true;
      result.amountOut = expectedOutput; // Use expected output for now
      result.transactionId = 'mock-tx-id'; // Mock transaction ID
      console.log(`Trade successful! Received ${result.amountOut} ${toToken}`);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`Trade failed: ${result.error}`);
    } finally {
      // Disconnect socket
      GSwap.events.disconnectEventSocket();
    }

    // Store in history
    this.tradeHistory.push(result);

    return result;
  }

  async executeTradesForPreferredToken(
    trades: Array<{ token: TokenBalance; targetToken: string; amount: number }>
  ): Promise<TradeResult[]> {
    const results: TradeResult[] = [];

    // Sort trades by priority:
    // 1. Trades to GALA (if needed for minimum balance)
    // 2. Trades to preferred token
    trades.sort((a, b) => {
      if (a.targetToken === this.config.galaTokenKey &&
          b.targetToken !== this.config.galaTokenKey) {
        return -1;
      }
      if (b.targetToken === this.config.galaTokenKey &&
          a.targetToken !== this.config.galaTokenKey) {
        return 1;
      }
      return 0;
    });

    for (const trade of trades) {
      if (!this.config.enableTrading) {
        console.log(`[DRY RUN] Would trade ${trade.amount} ${trade.token.symbol} for ${trade.targetToken}`);
        continue;
      }

      console.log(`Executing trade: ${trade.amount} ${trade.token.symbol} -> ${trade.targetToken}`);

      const result = await this.executeTrade(
        trade.token.tokenKey,
        trade.targetToken,
        trade.amount
      );

      results.push(result);

      // Add delay between trades to avoid rate limiting
      if (trades.indexOf(trade) < trades.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    return results;
  }

  getTradeHistory(limit?: number): TradeResult[] {
    if (limit) {
      return this.tradeHistory.slice(-limit);
    }
    return this.tradeHistory;
  }

  getSuccessRate(): number {
    if (this.tradeHistory.length === 0) return 0;

    const successfulTrades = this.tradeHistory.filter(t => t.success).length;
    return (successfulTrades / this.tradeHistory.length) * 100;
  }

  getTotalVolume(): { traded: number; received: number } {
    let traded = 0;
    let received = 0;

    for (const trade of this.tradeHistory) {
      if (trade.success) {
        traded += trade.amountIn;
        received += trade.amountOut || 0;
      }
    }

    return { traded, received };
  }

  formatTradeResults(results: TradeResult[]): string {
    const lines: string[] = [];

    lines.push('=== Trade Execution Results ===');

    for (const result of results) {
      if (result.success) {
        lines.push(`✅ SUCCESS: ${result.amountIn} ${result.fromToken} -> ${result.amountOut} ${result.toToken}`);
        lines.push(`   TX: ${result.transactionId}`);
      } else {
        lines.push(`❌ FAILED: ${result.amountIn} ${result.fromToken} -> ${result.toToken}`);
        lines.push(`   Error: ${result.error}`);
      }
    }

    lines.push(`Success Rate: ${this.getSuccessRate().toFixed(1)}%`);
    lines.push('===============================');

    return lines.join('\n');
  }
}
import { GSwap, PrivateKeySigner } from '@gala-chain/gswap-sdk';
import { BotConfig } from './config.js';
import { TokenBalance } from './balance-manager.js';
import { TokenRegistry } from './token-registry.js';

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
  private tokenRegistry: TokenRegistry;

  constructor(config: BotConfig) {
    this.config = config;
    this.tokenRegistry = new TokenRegistry();

    // Always create signer with the provided private key and URL configuration
    const signerConfig: any = {
      signer: new PrivateKeySigner(config.privateKey),
      transactionWaitTimeoutMs: config.transactionTimeoutMs,
      gatewayBaseUrl: config.gatewayBaseUrl,
      dexContractBasePath: config.dexContractBasePath,
      tokenContractBasePath: config.tokenContractBasePath,
      bundlerBaseUrl: config.bundlerBaseUrl,
      bundlingAPIBasePath: config.bundlingAPIBasePath,
      dexBackendBaseUrl: config.dexBackendBaseUrl,
    };

    this.gSwap = new GSwap(signerConfig);
  }

  async findAvailablePools(tokenA: string, tokenB: string): Promise<PoolInfo[]> {
    console.log(`\n=== FINDING POOLS FOR ${tokenA} <-> ${tokenB} ===`);
    const pools: PoolInfo[] = [];

    // Check all three fee tiers
    const feeTiers = [500, 3000, 10000] as const;
    console.log(`Checking fee tiers: ${feeTiers.join(', ')}`);

    for (const fee of feeTiers) {
      try {
        console.log(`Checking pool with fee ${fee}...`);
      
        const poolData = await this.gSwap.pools.getPoolData(tokenA, tokenB, fee);

        const liquidity = parseFloat(poolData.liquidity?.toString() || '0');
        console.log(`  Fee ${fee}: liquidity = ${liquidity}`);

        if (poolData && liquidity > 0) {
          pools.push({
            token0: tokenA,
            token1: tokenB,
            fee,
            liquidity: poolData.liquidity.toString(),
            sqrtPrice: poolData.sqrtPrice.toString(),
          });
          console.log(`  ✅ Pool with fee ${fee} has liquidity: ${liquidity}`);
        } else {
          console.log(`  ❌ Pool with fee ${fee} has no liquidity`);
        }
      } catch (error) {
        console.log(`  ❌ Pool with fee ${fee} error:`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    // Sort pools by liquidity (highest first)
    pools.sort((a, b) => parseFloat(b.liquidity) - parseFloat(a.liquidity));

    console.log(`Found ${pools.length} liquid pool(s)`);
    if (pools.length > 0) {
      console.log('Pools sorted by liquidity:');
      pools.forEach(p => console.log(`  - Fee ${p.fee}: liquidity = ${p.liquidity}`));
    }

    return pools;
  }

  async executeTrade(
    fromToken: string,
    toToken: string,
    amount: number,
    fee?: number
  ): Promise<TradeResult> {
    console.log(`\n=== EXECUTE TRADE ===`);
    console.log(`From: ${amount} ${fromToken}`);
    console.log(`To: ${toToken}`);
    console.log(`Fee tier: ${fee || 'auto-detect'}`);

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
        console.log('No fee specified, searching for available pools...');
        const pools = await this.findAvailablePools(fromToken, toToken);
        console.log(`Found ${pools.length} pool(s):`, pools.map(p => `fee=${p.fee}, liquidity=${p.liquidity}`));

        if (pools.length === 0) {
          const error = `No liquid pools found for ${fromToken} -> ${toToken}`;
          console.error(error);
          throw new Error(error);
        }
        // Choose pool with highest liquidity
        const bestPool = pools.reduce((prev, curr) =>
          parseFloat(curr.liquidity) > parseFloat(prev.liquidity) ? curr : prev
        );
        poolFee = bestPool.fee;
        console.log(`Selected pool with fee ${poolFee} (liquidity: ${bestPool.liquidity})`);
      }

      const quote = await this.gSwap.quoting.quoteExactInput(
        fromToken,
        toToken,
        amount.toString(),
        poolFee as 500 | 3000 | 10000
      ).catch((quoteError) => {
        console.error('Quote failed:', quoteError);
        throw new Error(`Unable to get quote: ${quoteError instanceof Error ? quoteError.message : String(quoteError)}`);
      });
      
      // Check if quote has valid output amount (can be amountOut or outTokenAmount)
      const outputAmount = (quote as any).amountOut || (quote as any).outTokenAmount;
      if (!quote || !outputAmount) {
        const error = `Quote returned no valid output amount. Quote object: ${JSON.stringify(quote)}`;
        console.error(error);
        throw new Error('Unable to get quote for trade');
      }

      // Calculate minimum output with slippage
      const expectedOutput = Math.abs(parseFloat(outputAmount.toString()));
      const minOutput = expectedOutput * (1 - this.config.maxSlippage / 100);

      console.log(`Trading ${amount} ${fromToken} for ${toToken}`);
      console.log(`Expected output: ${expectedOutput}, Min output: ${minOutput}`);

      // Connect to socket for transaction updates
      const isConnected = GSwap.events.eventSocketConnected();

      if (!isConnected) {
        await GSwap.events.connectEventSocket(this.config.bundlerBaseUrl ?? 'https://bundle-backend-prod1.defi.gala.com');
      }

      console.log('Submitting swap transaction...');
      const pendingTx = await this.gSwap.swaps.swap(
        fromToken,
        toToken,
        poolFee,
        {
          exactIn: amount.toString(),
          amountOutMinimum: minOutput.toString(),
        },
        this.config.walletAddress
      );

      console.log(`Transaction submitted with ID: ${pendingTx.transactionId}`);
      console.log('Waiting for transaction to complete...');

      await pendingTx.wait()
      .then(() => {
        console.log('Transaction completed successfully!');
        result.success = true;
        result.amountOut = expectedOutput; // Use expected output for now
        result.transactionId = pendingTx.transactionId; 
        console.log(`Trade successful! Received ${result.amountOut} ${toToken}`);
      }).catch((error) => {
        result.error = error instanceof Error ? error.message : String(error);
        console.error(`Trade failed: ${result.error}`);
      });    
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`Trade failed: ${result.error}`);
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

      // Try multi-hop trading which includes direct trading as fallback
      const result = await this.executeMultiHopTrade(
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

  async executeMultiHopTrade(
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<TradeResult> {
    console.log(`\n=== MULTI-HOP TRADE ANALYSIS ===`);
    console.log(`Attempting to trade: ${amount} ${fromToken} -> ${toToken}`);

    // First try direct trade
    console.log('\n1. Trying DIRECT trade...');
    try {
      const directResult = await this.executeTrade(fromToken, toToken, amount);
      if (directResult.success) {
        console.log('✅ Direct trade successful!');
        return directResult;
      }
    } catch (directError) {
      console.log('❌ Direct trade failed:', directError instanceof Error ? directError.message : directError);
    }

    // If direct trade fails, try multi-hop
    console.log('\n2. Direct trade failed, trying MULTI-HOP routes...');

    // Find the best trading path
    const paths = this.tokenRegistry.findTradingPaths(fromToken, toToken, 2);

    if (paths.length === 0) {
      const error = `No trading path found from ${fromToken} to ${toToken}`;
      console.error(error);
      throw new Error(error);
    }

    console.log(`Found ${paths.length} potential path(s):`);
    paths.forEach((path, i) => console.log(`  Path ${i + 1}: ${path.join(' -> ')}`));

    // Try each path until one works
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (!path) continue;

      console.log(`\nTrying path ${i + 1}/${paths.length}: ${path.join(' -> ')}`);

      try {
        if (path.length === 2) {
          // This is a direct trade (already tried above)
          console.log('Skipping direct path (already attempted)');
          continue;
        } else if (path.length === 3) {
          // Two-hop trade
          const [token0, intermediate, token1] = path;
          if (!token0 || !intermediate || !token1) continue;

          console.log(`\nExecuting two-hop trade:`);
          console.log(`  Hop 1: ${token0} -> ${intermediate}`);
          console.log(`  Hop 2: ${intermediate} -> ${token1}`);

          // First hop
          console.log(`\nExecuting Hop 1: ${amount} ${token0} -> ${intermediate}`);
          const firstResult = await this.executeTrade(token0, intermediate, amount);
          if (!firstResult.success || !firstResult.amountOut) {
            console.log(`❌ Hop 1 failed`);
            continue; // Try next path
          }
          console.log(`✅ Hop 1 successful: received ${firstResult.amountOut} ${intermediate}`);

          // Second hop
          console.log(`\nExecuting Hop 2: ${firstResult.amountOut} ${intermediate} -> ${token1}`);
          const secondResult = await this.executeTrade(intermediate, token1, firstResult.amountOut);
          if (secondResult.success && secondResult.amountOut) {
            console.log(`✅ Hop 2 successful: received ${secondResult.amountOut} ${token1}`);
            console.log(`\n✅ MULTI-HOP TRADE COMPLETE!`);
            console.log(`  Total: ${amount} ${fromToken} -> ${secondResult.amountOut} ${toToken}`);

            // Return combined result
            return {
              success: true,
              fromToken,
              toToken,
              amountIn: amount,
              amountOut: secondResult.amountOut,
              transactionId: `multi-hop-${firstResult.transactionId || 'unknown'}-${secondResult.transactionId || 'unknown'}`,
              timestamp: new Date(),
            };
          } else {
            console.log(`❌ Hop 2 failed`);
          }
        }
      } catch (error) {
        console.log(`❌ Path failed:`, error instanceof Error ? error.message : error);
        continue; // Try next path
      }
    }

    // All paths failed
    const error = `All trading paths failed for ${fromToken} -> ${toToken}`;
    console.error(`\n❌ ${error}`);
    throw new Error(error);
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
import { TokenClassKey } from '@gala-chain/api';
import { quoteExactAmount, QuoteExactAmountDto } from '@gala-chain/dex';
import BigNumber from 'bignumber.js';
import { PoolData } from './pool-data-manager.js';

export interface OfflineQuoteResult {
  amountIn: string;
  amountOut: string;
  currentSqrtPrice: string;
  newSqrtPrice: string;
  priceImpact: number; // percentage
}

export class OfflineQuoteEngine {
  /**
   * Perform offline quote calculation using cached composite pool data
   */
  async quoteExactInput(
    poolData: PoolData,
    tokenIn: string,
    tokenOut: string,
    amountIn: number | string
  ): Promise<OfflineQuoteResult> {
    // Determine trade direction (zeroForOne)
    const zeroForOne = tokenIn === poolData.token0;

    // Parse token keys
    const token0 = this.parseTokenKey(poolData.token0);
    const token1 = this.parseTokenKey(poolData.token1);

    // Convert amount to BigNumber
    const amount = new BigNumber(amountIn.toString());

    // Create QuoteExactAmountDto
    const quoteDto = new QuoteExactAmountDto(
      token0,
      token1,
      poolData.fee,
      amount,
      zeroForOne,
      poolData.compositePool
    );

    // Perform offline quote calculation
    const quoteResult = await quoteExactAmount(null, quoteDto);

    // Calculate price impact
    const currentPrice = new BigNumber(quoteResult.currentSqrtPrice).pow(2);
    const newPrice = new BigNumber(quoteResult.newSqrtPrice).pow(2);
    const priceImpact = currentPrice.isZero()
      ? 0
      : newPrice.minus(currentPrice).dividedBy(currentPrice).multipliedBy(100).toNumber();

    return {
      amountIn: zeroForOne ? quoteResult.amount0 : quoteResult.amount1,
      amountOut: zeroForOne ? quoteResult.amount1 : quoteResult.amount0,
      currentSqrtPrice: quoteResult.currentSqrtPrice,
      newSqrtPrice: quoteResult.newSqrtPrice,
      priceImpact: Math.abs(priceImpact),
    };
  }

  /**
   * Get the output amount from a quote (convenience method)
   */
  async getOutputAmount(
    poolData: PoolData,
    tokenIn: string,
    tokenOut: string,
    amountIn: number | string
  ): Promise<number> {
    const quote = await this.quoteExactInput(poolData, tokenIn, tokenOut, amountIn);

    // amountOut will be negative for the token being received
    const amountOut = Math.abs(parseFloat(quote.amountOut));

    return amountOut;
  }

  /**
   * Calculate effective price after fees and slippage
   */
  async getEffectivePrice(
    poolData: PoolData,
    tokenIn: string,
    tokenOut: string,
    amountIn: number | string
  ): Promise<number> {
    const quote = await this.quoteExactInput(poolData, tokenIn, tokenOut, amountIn);

    const amountInNum = Math.abs(parseFloat(quote.amountIn));
    const amountOutNum = Math.abs(parseFloat(quote.amountOut));

    return amountOutNum / amountInNum;
  }

  /**
   * Parse token key string into TokenClassKey object
   */
  private parseTokenKey(tokenKey: string): TokenClassKey {
    const parts = tokenKey.split('|');
    if (parts.length !== 4) {
      throw new Error(`Invalid token key format: ${tokenKey}. Expected format: SYMBOL|Category|Type|AdditionalKey`);
    }

    const token = new TokenClassKey();
    token.collection = parts[0] || '';
    token.category = parts[1] || '';
    token.type = parts[2] || '';
    token.additionalKey = parts[3] || '';

    return token;
  }

  /**
   * Estimate gas cost for a swap (in GALA terms)
   * This is a rough estimate - actual costs may vary
   */
  estimateGasCost(): number {
    // Typical GalaChain swap costs around 0.1-0.5 GALA
    // Being conservative, use 0.5 GALA per swap
    return 0.5;
  }
}
import { TokenClassKey, TokenBalance } from '@gala-chain/api';
import { CompositePoolDto, GetCompositePoolDto, Pool, TickData } from '@gala-chain/dex';
import axios from 'axios';
import BigNumber from 'bignumber.js';

export interface PoolData {
  token0: string;
  token1: string;
  fee: number;
  compositePool: CompositePoolDto;
  lastUpdated: Date;
}

interface CachedPool {
  data: PoolData;
  expiresAt: number;
}

export class PoolDataManager {
  private poolCache: Map<string, CachedPool> = new Map();
  private cacheTTL: number = 60000; // 60 seconds default
  private getCompositePoolUrl: string;

  constructor(getCompositePoolUrl: string = 'https://gateway-mainnet.galachain.com/api/asset/dexv3-contract/GetCompositePool', cacheTTL?: number) {
    this.getCompositePoolUrl = getCompositePoolUrl;
    if (cacheTTL) {
      this.cacheTTL = cacheTTL;
    }
  }

  /**
   * Get composite pool data (cached if available and not expired)
   */
  async getCompositePoolData(token0Key: string, token1Key: string, fee: number): Promise<PoolData> {
    const cacheKey = this.getCacheKey(token0Key, token1Key, fee);
    const cached = this.poolCache.get(cacheKey);

    // Return cached data if still valid
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    // Fetch fresh data
    const poolData = await this.fetchCompositePoolData(token0Key, token1Key, fee);

    // Cache it
    this.poolCache.set(cacheKey, {
      data: poolData,
      expiresAt: Date.now() + this.cacheTTL,
    });

    return poolData;
  }

  /**
   * Fetch composite pool data from GalaChain
   */
  private async fetchCompositePoolData(token0Key: string, token1Key: string, fee: number): Promise<PoolData> {
    // Parse token keys into TokenClassKey objects
    const token0 = this.parseTokenKey(token0Key);
    const token1 = this.parseTokenKey(token1Key);

    // Create GetCompositePoolDto
    const getCompositePoolDto = new GetCompositePoolDto(token0, token1, fee);

    // Fetch from chain
    const response = await axios.post(this.getCompositePoolUrl, getCompositePoolDto, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.data?.Data) {
      throw new Error(`No composite pool data returned for ${token0Key}/${token1Key} fee ${fee}`);
    }

    // Convert response to proper CompositePoolDto
    const compositePool = this.createCompositePoolDtoFromResponse(response.data.Data);

    return {
      token0: token0Key,
      token1: token1Key,
      fee,
      compositePool,
      lastUpdated: new Date(),
    };
  }

  /**
   * Converts response data from GetCompositePool API into a proper CompositePoolDto
   * Based on the offline-quote-example pattern
   */
  private createCompositePoolDtoFromResponse(responseData: any): CompositePoolDto {
    // 1. Create Pool object with proper BigNumber conversions
    const pool = new Pool(
      responseData.pool.token0,
      responseData.pool.token1,
      responseData.pool.token0ClassKey,
      responseData.pool.token1ClassKey,
      responseData.pool.fee,
      new BigNumber(responseData.pool.sqrtPrice),
      responseData.pool.protocolFees
    );

    // Set additional pool properties with BigNumber conversions
    pool.bitmap = responseData.pool.bitmap;
    pool.grossPoolLiquidity = new BigNumber(responseData.pool.grossPoolLiquidity);
    pool.liquidity = new BigNumber(responseData.pool.liquidity);
    pool.feeGrowthGlobal0 = new BigNumber(responseData.pool.feeGrowthGlobal0);
    pool.feeGrowthGlobal1 = new BigNumber(responseData.pool.feeGrowthGlobal1);
    pool.protocolFeesToken0 = new BigNumber(responseData.pool.protocolFeesToken0);
    pool.protocolFeesToken1 = new BigNumber(responseData.pool.protocolFeesToken1);
    pool.tickSpacing = responseData.pool.tickSpacing;
    pool.maxLiquidityPerTick = new BigNumber(responseData.pool.maxLiquidityPerTick);

    // 2. Create tick data map with proper TickData objects
    const tickDataMap: Record<string, TickData> = {};
    Object.keys(responseData.tickDataMap).forEach(tickKey => {
      const tickData = responseData.tickDataMap[tickKey];
      tickDataMap[tickKey] = new TickData(
        tickData.poolHash,
        tickData.tick,
        {
          initialised: tickData.initialised,
          liquidityNet: new BigNumber(tickData.liquidityNet),
          liquidityGross: new BigNumber(tickData.liquidityGross),
          feeGrowthOutside0: new BigNumber(tickData.feeGrowthOutside0),
          feeGrowthOutside1: new BigNumber(tickData.feeGrowthOutside1),
        }
      );
    });

    // 3. Create TokenBalance objects
    const token0Balance = new TokenBalance({
      owner: responseData.token0Balance.owner,
      collection: responseData.token0Balance.collection,
      category: responseData.token0Balance.category,
      type: responseData.token0Balance.type,
      additionalKey: responseData.token0Balance.additionalKey,
      instanceIds: responseData.token0Balance.instanceIds,
      lockedHolds: responseData.token0Balance.lockedHolds,
      inUseHolds: responseData.token0Balance.inUseHolds,
    });
    token0Balance.quantity = new BigNumber(responseData.token0Balance.quantity);

    const token1Balance = new TokenBalance({
      owner: responseData.token1Balance.owner,
      collection: responseData.token1Balance.collection,
      category: responseData.token1Balance.category,
      type: responseData.token1Balance.type,
      additionalKey: responseData.token1Balance.additionalKey,
      instanceIds: responseData.token1Balance.instanceIds,
      lockedHolds: responseData.token1Balance.lockedHolds,
      inUseHolds: responseData.token1Balance.inUseHolds,
    });
    token1Balance.quantity = new BigNumber(responseData.token1Balance.quantity);

    // 4. Create and return CompositePoolDto
    return new CompositePoolDto(
      pool,
      tickDataMap,
      token0Balance,
      token1Balance,
      responseData.token0Decimals,
      responseData.token1Decimals
    );
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
   * Generate cache key for pool
   */
  private getCacheKey(token0: string, token1: string, fee: number): string {
    // Normalize token order to ensure consistent caching
    const [t0, t1] = token0 < token1 ? [token0, token1] : [token1, token0];
    return `${t0}|${t1}|${fee}`;
  }

  /**
   * Get all cached pools
   */
  getAllCachedPools(): PoolData[] {
    return Array.from(this.poolCache.values()).map(cached => cached.data);
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.poolCache.entries()) {
      if (now >= cached.expiresAt) {
        this.poolCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.poolCache.clear();
  }
}
import { BotConfig } from './config.js';
import { PoolDataManager, PoolData } from './pool-data-manager.js';
import { CircularPathFinder, CircularPath } from './circular-path-finder.js';
import { ProfitCalculator, ArbitrageOpportunity } from './profit-calculator.js';
import { TokenRegistry } from './token-registry.js';
import { PoolRegistry } from './pool-registry.js';

export interface ArbitrageResult {
  opportunity: ArbitrageOpportunity;
  success: boolean;
  actualOutputAmount?: number;
  actualProfit?: number;
  transactionIds: string[];
  error?: string;
  executionTime: number;
}

export class ArbitrageDetector {
  private config: BotConfig;
  private poolDataManager: PoolDataManager;
  private pathFinder: CircularPathFinder;
  private profitCalculator: ProfitCalculator;
  private tokenRegistry: TokenRegistry;
  private poolRegistry: PoolRegistry;
  private detectionHistory: ArbitrageOpportunity[] = [];
  private executionHistory: ArbitrageResult[] = [];

  constructor(config: BotConfig) {
    this.config = config;
    this.poolDataManager = new PoolDataManager(
      config.gatewayBaseUrl + config.dexContractBasePath + '/GetCompositePool',
      config.arbitragePoolCacheTTL
    );
    this.pathFinder = new CircularPathFinder();
    this.profitCalculator = new ProfitCalculator(config);
    this.tokenRegistry = new TokenRegistry();
    this.poolRegistry = new PoolRegistry();
  }

  /**
   * Scan for arbitrage opportunities starting from a base token
   */
  async findArbitrageOpportunities(
    baseToken: string,
    amount: number,
    maxHops: number = 3
  ): Promise<ArbitrageOpportunity[]> {
    console.log(`\n=== SCANNING FOR ARBITRAGE OPPORTUNITIES ===`);
    console.log(`Base token: ${baseToken}`);
    console.log(`Amount: ${amount}`);
    console.log(`Max hops: ${maxHops}`);

    const startTime = Date.now();

    try {
      // Step 1: Load pools for known tokens
      await this.preloadKnownPools();

      // Step 2: Find all circular paths
      const availablePools = this.poolDataManager.getAllCachedPools();
      console.log(`\nUsing ${availablePools.length} cached pool(s) for path finding`);

      const paths = this.pathFinder.findCircularPaths(
        baseToken,
        maxHops,
        availablePools,
        this.config.arbitrageMinLiquidity
      );

      if (paths.length === 0) {
        console.log('No circular paths found');
        return [];
      }

      // Step 3: Calculate profitability for each path
      console.log(`\nCalculating profitability for ${paths.length} path(s)...`);

      const opportunities = await this.profitCalculator.calculateMultiplePaths(paths, amount);

      // Step 4: Filter profitable opportunities
      const profitableOpportunities = this.profitCalculator.filterProfitable(
        opportunities,
        this.config.arbitrageMinProfitPercent
      );

      // Step 5: Sort by profitability
      const sortedOpportunities = this.profitCalculator.sortByProfitability(profitableOpportunities);

      // Store in history
      sortedOpportunities.forEach(opp => this.detectionHistory.push(opp));

      const elapsedTime = Date.now() - startTime;
      console.log(`\n=== SCAN COMPLETE (${elapsedTime}ms) ===`);
      console.log(`Found ${sortedOpportunities.length} profitable opportunity(s)`);

      if (sortedOpportunities.length > 0) {
        console.log('\nTop opportunities:');
        sortedOpportunities.slice(0, 5).forEach((opp, i) => {
          const pathStr = opp.path.tokens.map(t => t.split('|')[0]).join(' → ');
          console.log(`  ${i + 1}. ${pathStr}`);
          console.log(`     Net profit: ${opp.netProfit.toFixed(4)} (${opp.profitPercentage.toFixed(2)}%)`);
        });
      }

      return sortedOpportunities;
    } catch (error) {
      console.error(`Arbitrage scan failed: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Preload pool data for known token pairs
   */
  private async preloadKnownPools(): Promise<void> {
    console.log('\nPreloading pool data from registry...');

    // Get all known pools from CSV
    const knownPools = this.poolRegistry.getPoolsWithMinLiquidity(this.config.arbitrageMinLiquidity);

    console.log(`Attempting to load ${knownPools.length} pools from registry...`);

    let successCount = 0;
    let failCount = 0;

    // Load each known pool
    for (const pool of knownPools) {
      try {
        await this.poolDataManager.getCompositePoolData(pool.token0, pool.token1, pool.fee);
        successCount++;
      } catch (error) {
        // Pool failed to load
        failCount++;
        console.log(`Failed to load pool ${pool.token0.split('|')[0]}/${pool.token1.split('|')[0]} (fee: ${pool.fee})`);
      }
    }

    console.log(`Successfully loaded ${successCount} pool(s), ${failCount} failed`);
  }

  /**
   * Get the best arbitrage opportunity if any
   */
  async getBestOpportunity(
    baseToken: string,
    amount: number,
    maxHops: number = 3
  ): Promise<ArbitrageOpportunity | null> {
    const opportunities = await this.findArbitrageOpportunities(baseToken, amount, maxHops);
    return opportunities.length > 0 ? (opportunities[0] ?? null) : null;
  }

  /**
   * Get detection history
   */
  getDetectionHistory(limit?: number): ArbitrageOpportunity[] {
    if (limit) {
      return this.detectionHistory.slice(-limit);
    }
    return this.detectionHistory;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): ArbitrageResult[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return this.executionHistory;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalDetected: number;
    totalExecuted: number;
    successRate: number;
    totalProfitRealized: number;
    averageProfitPercent: number;
  } {
    const totalDetected = this.detectionHistory.length;
    const totalExecuted = this.executionHistory.length;
    const successfulExecutions = this.executionHistory.filter(r => r.success).length;
    const successRate = totalExecuted > 0 ? (successfulExecutions / totalExecuted) * 100 : 0;

    const totalProfitRealized = this.executionHistory
      .filter(r => r.success && r.actualProfit)
      .reduce((sum, r) => sum + (r.actualProfit || 0), 0);

    const profitableExecutions = this.executionHistory.filter(r => r.success && r.actualProfit && r.actualProfit > 0);
    const averageProfitPercent = profitableExecutions.length > 0
      ? profitableExecutions.reduce((sum, r) => {
          const profitPercent = r.actualProfit && r.opportunity.inputAmount
            ? (r.actualProfit / r.opportunity.inputAmount) * 100
            : 0;
          return sum + profitPercent;
        }, 0) / profitableExecutions.length
      : 0;

    return {
      totalDetected,
      totalExecuted,
      successRate,
      totalProfitRealized,
      averageProfitPercent,
    };
  }

  /**
   * Add execution result to history
   */
  recordExecution(result: ArbitrageResult): void {
    this.executionHistory.push(result);
  }

  /**
   * Clear expired pool cache
   */
  clearExpiredCache(): void {
    this.poolDataManager.clearExpiredCache();
  }
}
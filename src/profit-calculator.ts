import { CircularPath } from './circular-path-finder.js';
import { OfflineQuoteEngine } from './offline-quote.js';
import { BotConfig } from './config.js';

export interface ArbitrageOpportunity {
  path: CircularPath;
  inputAmount: number;
  expectedOutputAmount: number;
  grossProfit: number;
  gasEstimate: number;
  netProfit: number;
  profitPercentage: number;
  priceImpacts: number[]; // Price impact for each hop
  timestamp: Date;
}

export class ProfitCalculator {
  private offlineQuoteEngine: OfflineQuoteEngine;
  private config: BotConfig;

  constructor(config: BotConfig) {
    this.config = config;
    this.offlineQuoteEngine = new OfflineQuoteEngine();
  }

  /**
   * Calculate profitability for a circular arbitrage path
   */
  async calculateProfitability(
    path: CircularPath,
    inputAmount: number
  ): Promise<ArbitrageOpportunity> {
    // Chain quotes through all hops
    let currentAmount = inputAmount;
    const priceImpacts: number[] = [];

    for (let i = 0; i < path.hops; i++) {
      const pool = path.pools[i];
      const tokenIn = path.tokens[i];
      const tokenOut = path.tokens[i + 1];

      if (!pool || !tokenIn || !tokenOut) {
        throw new Error(`Invalid path at hop ${i}: missing pool or token data`);
      }

      try {
        // Get quote for this hop
        const quote = await this.offlineQuoteEngine.quoteExactInput(
          pool,
          tokenIn,
          tokenOut,
          currentAmount
        );

        // Update amount for next hop (take absolute value of amountOut)
        currentAmount = Math.abs(parseFloat(quote.amountOut));
        priceImpacts.push(quote.priceImpact);

        console.log(`  Hop ${i + 1}: ${inputAmount} ${tokenIn.split('|')[0]} → ${currentAmount.toFixed(6)} ${tokenOut.split('|')[0]} (impact: ${quote.priceImpact.toFixed(4)}%)`);
      } catch (error) {
        throw new Error(`Failed to quote hop ${i + 1}: ${error instanceof Error ? error.message : error}`);
      }
    }

    const expectedOutputAmount = currentAmount;

    // Calculate gross profit
    const grossProfit = expectedOutputAmount - inputAmount;

    // Estimate gas costs (GALA)
    const gasEstimate = this.offlineQuoteEngine.estimateGasCost() * path.hops;

    // Calculate net profit
    const netProfit = grossProfit - gasEstimate;

    // Calculate profit percentage
    const profitPercentage = (netProfit / inputAmount) * 100;

    return {
      path,
      inputAmount,
      expectedOutputAmount,
      grossProfit,
      gasEstimate,
      netProfit,
      profitPercentage,
      priceImpacts,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate profitability for multiple paths in parallel
   */
  async calculateMultiplePaths(
    paths: CircularPath[],
    inputAmount: number
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    for (const path of paths) {
      try {
        const opportunity = await this.calculateProfitability(path, inputAmount);
        opportunities.push(opportunity);
      } catch (error) {
        console.log(`Skipping path: ${error instanceof Error ? error.message : error}`);
        continue;
      }
    }

    return opportunities;
  }

  /**
   * Filter profitable opportunities
   */
  filterProfitable(
    opportunities: ArbitrageOpportunity[],
    minProfitPercent: number = 1
  ): ArbitrageOpportunity[] {
    return opportunities.filter(opp =>
      opp.netProfit > 0 &&
      opp.profitPercentage >= minProfitPercent
    );
  }

  /**
   * Sort opportunities by profitability
   */
  sortByProfitability(opportunities: ArbitrageOpportunity[]): ArbitrageOpportunity[] {
    return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
  }

  /**
   * Format opportunity for display
   */
  formatOpportunity(opp: ArbitrageOpportunity): string {
    const pathStr = opp.path.tokens.map(t => t.split('|')[0]).join(' → ');
    const lines: string[] = [];

    lines.push(`Path: ${pathStr}`);
    lines.push(`Input: ${opp.inputAmount.toFixed(4)}`);
    lines.push(`Output: ${opp.expectedOutputAmount.toFixed(4)}`);
    lines.push(`Gross Profit: ${opp.grossProfit.toFixed(4)}`);
    lines.push(`Gas Cost: ${opp.gasEstimate.toFixed(4)}`);
    lines.push(`Net Profit: ${opp.netProfit.toFixed(4)} (${opp.profitPercentage.toFixed(2)}%)`);
    lines.push(`Price Impacts: ${opp.priceImpacts.map(p => p.toFixed(2) + '%').join(', ')}`);

    return lines.join('\n  ');
  }
}
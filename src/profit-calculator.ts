import { CircularPath } from './circular-path-finder.js';
import { OfflineQuoteEngine } from './offline-quote.js';
import { BotConfig } from './config.js';
import BigNumber from 'bignumber.js';

export interface ArbitrageOpportunity {
  path: CircularPath;
  inputAmount: string; // Use string to represent BigNumber amounts
  expectedOutputAmount: string;
  grossProfit: string;
  gasEstimate: string;
  netProfit: string;
  profitPercentage: number;
  priceImpacts: number[]; // Price impact for each hop (percentage, safe as number)
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
    inputAmount: BigNumber
  ): Promise<ArbitrageOpportunity> {
    // Convert input to BigNumber
    let currentAmount = new BigNumber(inputAmount.toString());
    const inputAmountBN = new BigNumber(inputAmount.toString());
    const priceImpacts: number[] = [];

    for (let i = 0; i < path.hops; i++) {
      const pool = path.pools[i];
      const tokenIn = path.tokens[i];
      const tokenOut = path.tokens[i + 1];

      if (!pool || !tokenIn || !tokenOut) {
        throw new Error(`Invalid path at hop ${i}: missing pool or token data`);
      }

      const hopInput = new BigNumber(currentAmount);

      try {
        // Get quote for this hop
        const quote = await this.offlineQuoteEngine.quoteExactInput(
          pool,
          tokenIn,
          tokenOut,
          hopInput
        );

        // Update amount for next hop - convert from string and take absolute value
        currentAmount = new BigNumber(quote.amountOut).abs();
        const hopOutput = new BigNumber(currentAmount);

        priceImpacts.push(quote.priceImpact);

        console.log(`  Hop ${i + 1}: ${hopInput.toString()} ${tokenIn.split('|')[0]} → ${hopOutput.toString()} ${tokenOut.split('|')[0]} (impact: ${quote.priceImpact.toFixed(4)}%)`);
      } catch (error) {
        throw new Error(`Failed to quote hop ${i + 1}: ${error instanceof Error ? error.message : error}`);
      }
    }

    const expectedOutputAmount = currentAmount;

    // Calculate gross profit
    const grossProfit = expectedOutputAmount.minus(inputAmountBN);

    // Estimate gas costs (GALA)
    const gasEstimateBN = new BigNumber(this.offlineQuoteEngine.estimateGasCost()).multipliedBy(path.hops);

    // Calculate net profit
    // const netProfit = grossProfit.minus(gasEstimateBN);
    // todo: without conversion between GALA and preferredToken, subtracting GALA transaction fees from grossProfit is incorrect
    const netProfit = grossProfit.times(0.98);

    // Calculate profit percentage
    const profitPercentage = netProfit.dividedBy(inputAmountBN).multipliedBy(100).toNumber();

    console.log(`Path: ${path.tokens.map((t) => t + ' - ')} input: ${inputAmountBN.toString()}, net profit: ${netProfit.toString()}`);

    return {
      path,
      inputAmount: inputAmountBN.toString(),
      expectedOutputAmount: expectedOutputAmount.toString(),
      grossProfit: grossProfit.toString(),
      gasEstimate: gasEstimateBN.toString(),
      netProfit: netProfit.toString(),
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
    inputAmount: BigNumber
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
    minProfitPercent: BigNumber = new BigNumber(1)
  ): ArbitrageOpportunity[] {
    return opportunities.filter(opp => {
      const netProfitBN = new BigNumber(opp.netProfit);
      return netProfitBN.isGreaterThan(0) && new BigNumber(opp.profitPercentage).isGreaterThanOrEqualTo(minProfitPercent);
    });
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
    lines.push(`Input: ${new BigNumber(opp.inputAmount).toFixed(6)}`);
    lines.push(`Output: ${new BigNumber(opp.expectedOutputAmount).toFixed(6)}`);
    lines.push(`Gross Profit: ${new BigNumber(opp.grossProfit).toFixed(6)}`);
    lines.push(`Gas Cost: ${new BigNumber(opp.gasEstimate).toFixed(6)}`);
    lines.push(`Net Profit: ${new BigNumber(opp.netProfit).toFixed(6)} (${opp.profitPercentage.toFixed(2)}%)`);
    lines.push(`Price Impacts: ${opp.priceImpacts.map(p => p.toFixed(2) + '%').join(', ')}`);

    return lines.join('\n  ');
  }
}
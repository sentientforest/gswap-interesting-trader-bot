import { PoolData } from './pool-data-manager.js';
import BigNumber from 'bignumber.js';

export interface CircularPath {
  tokens: string[]; // e.g., ['GALA|Unit|none|none', 'GWBTC|Unit|none|none', 'GUSDC|Unit|none|none', 'GALA|Unit|none|none']
  pools: PoolData[]; // Pool data for each hop
  fees: number[]; // Fee tier for each hop
  hops: number; // Number of hops (2, 3, or 4)
}

export class CircularPathFinder {
  /**
   * Find all circular trading paths starting and ending with the same token
   */
  findCircularPaths(
    baseToken: string,
    maxHops: number,
    availablePools: PoolData[],
    minLiquidity: BigNumber = new BigNumber(1000)
  ): CircularPath[] {
    const paths: CircularPath[] = [];

    // Filter pools by minimum liquidity
    const liquidPools = availablePools.filter(pool => {
      const liquidity = new BigNumber(pool.compositePool.pool.liquidity.toString());
      return liquidity.isGreaterThan(minLiquidity);
    });

    console.log(`Finding circular paths for ${baseToken} with ${liquidPools.length} liquid pools`);

    // Build adjacency map for faster lookups
    const adjacencyMap = this.buildAdjacencyMap(liquidPools);

    // Find 2-hop cycles (A -> B -> A)
    if (maxHops >= 2) {
      const twoHopPaths = this.findTwoHopCycles(baseToken, adjacencyMap);
      paths.push(...twoHopPaths);
    }

    // Find 3-hop cycles (A -> B -> C -> A)
    if (maxHops >= 3) {
      const threeHopPaths = this.findThreeHopCycles(baseToken, adjacencyMap);
      paths.push(...threeHopPaths);
    }

    // Find 4-hop cycles (A -> B -> C -> D -> A)
    if (maxHops >= 4) {
      const fourHopPaths = this.findFourHopCycles(baseToken, adjacencyMap);
      paths.push(...fourHopPaths);
    }

    console.log(`Found ${paths.length} circular path(s):`);
    paths.forEach((path, i) => {
      console.log(`  ${i + 1}. ${path.hops}-hop: ${this.formatPath(path)}`);
    });

    return paths;
  }

  /**
   * Build adjacency map: token -> [{neighborToken, poolData}]
   */
  private buildAdjacencyMap(pools: PoolData[]): Map<string, Array<{ token: string; pool: PoolData }>> {
    const adjacencyMap = new Map<string, Array<{ token: string; pool: PoolData }>>();

    for (const pool of pools) {
      // Add token0 -> token1 edge
      if (!adjacencyMap.has(pool.token0)) {
        adjacencyMap.set(pool.token0, []);
      }
      adjacencyMap.get(pool.token0)?.push({ token: pool.token1, pool });

      // Add token1 -> token0 edge
      if (!adjacencyMap.has(pool.token1)) {
        adjacencyMap.set(pool.token1, []);
      }
      adjacencyMap.get(pool.token1)?.push({ token: pool.token0, pool });
    }

    return adjacencyMap;
  }

  /**
   * Find 2-hop cycles: A -> B -> A
   */
  private findTwoHopCycles(
    baseToken: string,
    adjacencyMap: Map<string, Array<{ token: string; pool: PoolData }>>
  ): CircularPath[] {
    const paths: CircularPath[] = [];
    const neighbors = adjacencyMap.get(baseToken) || [];

    for (const { token: tokenB, pool: pool1 } of neighbors) {
      // Check if there's a path back from B to A (possibly through a different fee tier)
      const neighborsOfB = adjacencyMap.get(tokenB) || [];

      for (const { token: returnToken, pool: pool2 } of neighborsOfB) {
        if (returnToken === baseToken && pool1 !== pool2) {
          // Found a cycle: A -> B -> A
          paths.push({
            tokens: [baseToken, tokenB, baseToken],
            pools: [pool1, pool2],
            fees: [pool1.fee, pool2.fee],
            hops: 2,
          });
        }
      }
    }

    return paths;
  }

  /**
   * Find 3-hop cycles: A -> B -> C -> A
   */
  private findThreeHopCycles(
    baseToken: string,
    adjacencyMap: Map<string, Array<{ token: string; pool: PoolData }>>
  ): CircularPath[] {
    const paths: CircularPath[] = [];
    const neighbors = adjacencyMap.get(baseToken) || [];

    for (const { token: tokenB, pool: pool1 } of neighbors) {
      if (tokenB === baseToken) continue; // Skip self-loops

      const neighborsOfB = adjacencyMap.get(tokenB) || [];

      for (const { token: tokenC, pool: pool2 } of neighborsOfB) {
        if (tokenC === baseToken || tokenC === tokenB) continue; // Skip if same as A or B

        const neighborsOfC = adjacencyMap.get(tokenC) || [];

        for (const { token: returnToken, pool: pool3 } of neighborsOfC) {
          if (returnToken === baseToken) {
            // Found a cycle: A -> B -> C -> A
            paths.push({
              tokens: [baseToken, tokenB, tokenC, baseToken],
              pools: [pool1, pool2, pool3],
              fees: [pool1.fee, pool2.fee, pool3.fee],
              hops: 3,
            });
          }
        }
      }
    }

    return paths;
  }

  /**
   * Find 4-hop cycles: A -> B -> C -> D -> A
   */
  private findFourHopCycles(
    baseToken: string,
    adjacencyMap: Map<string, Array<{ token: string; pool: PoolData }>>
  ): CircularPath[] {
    const paths: CircularPath[] = [];
    const neighbors = adjacencyMap.get(baseToken) || [];

    for (const { token: tokenB, pool: pool1 } of neighbors) {
      if (tokenB === baseToken) continue;

      const neighborsOfB = adjacencyMap.get(tokenB) || [];

      for (const { token: tokenC, pool: pool2 } of neighborsOfB) {
        if (tokenC === baseToken || tokenC === tokenB) continue;

        const neighborsOfC = adjacencyMap.get(tokenC) || [];

        for (const { token: tokenD, pool: pool3 } of neighborsOfC) {
          if (tokenD === baseToken || tokenD === tokenB || tokenD === tokenC) continue;

          const neighborsOfD = adjacencyMap.get(tokenD) || [];

          for (const { token: returnToken, pool: pool4 } of neighborsOfD) {
            if (returnToken === baseToken) {
              // Found a cycle: A -> B -> C -> D -> A
              paths.push({
                tokens: [baseToken, tokenB, tokenC, tokenD, baseToken],
                pools: [pool1, pool2, pool3, pool4],
                fees: [pool1.fee, pool2.fee, pool3.fee, pool4.fee],
                hops: 4,
              });
            }
          }
        }
      }
    }

    return paths;
  }

  /**
   * Format path for display
   */
  private formatPath(path: CircularPath): string {
    const tokenSymbols = path.tokens.map(t => t.split('|')[0]);
    const feeStr = path.fees.map(f => `${f / 100}bps`).join(', ');
    return `${tokenSymbols.join(' → ')} (fees: ${feeStr})`;
  }
}
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import BigNumber from "bignumber.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PoolInfo {
  token0: string;
  token1: string;
  fee: number;
  liquidity: number;
}

export class PoolRegistry {
  private pools: PoolInfo[] = [];

  constructor() {
    this.loadPoolsFromCSV();
  }

  private loadPoolsFromCSV(): void {
    try {
      const csvPath = path.join(__dirname, '..', 'pools.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.trim().split('\n');

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i]?.split(',');
        if (!parts || parts.length < 4) continue;

        const [token0, token1, fee, liquidity] = parts;
        if (!token0 || !token1 || !fee || !liquidity) continue;

        this.pools.push({
          token0: token0.trim() + '|Unit|none|none',
          token1: token1.trim() + '|Unit|none|none',
          fee: parseInt(fee.trim()),
          liquidity: parseFloat(liquidity.trim()),
        });
      }

      console.log(`Loaded ${this.pools.length} known pools from registry`);
    } catch (error) {
      console.warn('Could not load pools.csv, will try to discover pools dynamically');
    }
  }

  getAllPools(): PoolInfo[] {
    return this.pools;
  }

  getPoolsWithMinLiquidity(minLiquidity: BigNumber): PoolInfo[] {
    return this.pools.filter(p => new BigNumber(p.liquidity).isGreaterThanOrEqualTo(minLiquidity));
  }

  getPoolsForToken(tokenKey: string): PoolInfo[] {
    return this.pools.filter(p => p.token0 === tokenKey || p.token1 === tokenKey);
  }
}
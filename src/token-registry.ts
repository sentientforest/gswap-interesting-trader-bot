import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TokenInfo {
  symbol: string;
  tokenKey: string;
  decimals: number;
  description: string;
}

export interface TradingPair {
  token0: string;
  token1: string;
  fee: number;
  exists?: boolean;
}

export class TokenRegistry {
  private tokens: Map<string, TokenInfo> = new Map();
  private tokensByKey: Map<string, TokenInfo> = new Map();
  private knownPairs: Set<string> = new Set();

  constructor() {
    this.loadTokensFromCSV();
    this.initializeKnownPairs();
  }

  private loadTokensFromCSV(): void {
    try {
      const csvPath = path.join(__dirname, '..', 'tokens.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.trim().split('\n');

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i]?.split(',');
        if (!parts || parts.length < 4) continue;

        const [symbol, tokenKey, decimals, description] = parts;
        if (!symbol || !tokenKey || !decimals || !description) continue;

        const token: TokenInfo = {
          symbol: symbol.trim(),
          tokenKey: tokenKey.trim(),
          decimals: parseInt(decimals.trim()),
          description: description.trim(),
        };

        this.tokens.set(token.symbol, token);
        this.tokensByKey.set(token.tokenKey, token);
      }

      console.log(`Loaded ${this.tokens.size} tokens from registry`);
    } catch (error) {
      console.warn('Could not load tokens.csv, using default tokens');
      this.loadDefaultTokens();
    }
  }

  private loadDefaultTokens(): void {
    const defaultTokens: TokenInfo[] = [
      { symbol: 'GALA', tokenKey: 'GALA|Unit|none|none', decimals: 8, description: 'Gala token' },
      { symbol: 'GWBTC', tokenKey: 'GWBTC|Unit|none|none', decimals: 8, description: 'Wrapped Bitcoin' },
      { symbol: 'GUSDC', tokenKey: 'GUSDC|Unit|none|none', decimals: 6, description: 'USD Coin' },
      { symbol: 'GUSDT', tokenKey: 'GUSDT|Unit|none|none', decimals: 6, description: 'Tether USD' },
      { symbol: 'SILK', tokenKey: 'SILK|Unit|none|none', decimals: 8, description: 'Silk token' },
    ];

    defaultTokens.forEach(token => {
      this.tokens.set(token.symbol, token);
      this.tokensByKey.set(token.tokenKey, token);
    });
  }

  private initializeKnownPairs(): void {
    // Known pairs based on actual liquidity pool data analysis
    const knownLiquidPairs = [
      // GALA pairs with confirmed liquidity from liquidity_pools.json
      'GALA|GWBTC|10000', // Confirmed: liquidity: "35826.857864843960769612"

      // Common stablecoin and major token pairs (need to verify)
      'GALA|GUSDC|3000',
      'GALA|GUSDT|3000',
      'GALA|SILK|10000',

      // Stablecoin pairs
      'GUSDC|GUSDT|500',
    ];

    knownLiquidPairs.forEach(pair => this.knownPairs.add(pair));
  }

  getTokenBySymbol(symbol: string): TokenInfo | undefined {
    return this.tokens.get(symbol);
  }

  getTokenByKey(tokenKey: string): TokenInfo | undefined {
    return this.tokensByKey.get(tokenKey);
  }

  getAllTokens(): TokenInfo[] {
    return Array.from(this.tokens.values());
  }

  // Find potential trading paths from source to target token
  findTradingPaths(fromTokenKey: string, toTokenKey: string, maxHops: number = 2): string[][] {
    const paths: string[][] = [];

    // Direct path
    if (this.hasPotentialPair(fromTokenKey, toTokenKey)) {
      paths.push([fromTokenKey, toTokenKey]);
    }

    // Single hop paths through intermediate tokens
    if (maxHops >= 2) {
      const intermediateTokens = ['GALA|Unit|none|none', 'GUSDC|Unit|none|none', 'GUSDT|Unit|none|none'];

      for (const intermediate of intermediateTokens) {
        if (intermediate !== fromTokenKey && intermediate !== toTokenKey) {
          if (this.hasPotentialPair(fromTokenKey, intermediate) &&
              this.hasPotentialPair(intermediate, toTokenKey)) {
            paths.push([fromTokenKey, intermediate, toTokenKey]);
          }
        }
      }
    }

    return paths;
  }

  private hasPotentialPair(token0: string, token1: string): boolean {
    const fees = [500, 3000, 10000];

    for (const fee of fees) {
      const pair1 = `${token0}|${token1}|${fee}`;
      const pair2 = `${token1}|${token0}|${fee}`;

      if (this.knownPairs.has(pair1) || this.knownPairs.has(pair2)) {
        return true;
      }
    }

    // If not in known pairs, assume GALA can pair with anything
    const galaToken = 'GALA|Unit|none|none';
    if (token0 === galaToken || token1 === galaToken) {
      return true;
    }

    // Assume stablecoins can pair with major tokens
    const stablecoins = ['GUSDC|Unit|none|none', 'GUSDT|Unit|none|none'];
    const majorTokens = ['GWBTC|Unit|none|none', 'GETH|Unit|none|none'];

    if ((stablecoins.includes(token0) && majorTokens.includes(token1)) ||
        (stablecoins.includes(token1) && majorTokens.includes(token0))) {
      return true;
    }

    return false;
  }

  // Get the best intermediate token for routing
  getBestIntermediateToken(fromTokenKey: string, toTokenKey: string): string | null {
    const gala = 'GALA|Unit|none|none';
    const usdc = 'GUSDC|Unit|none|none';
    const usdt = 'GUSDT|Unit|none|none';

    // Prefer GALA as intermediate (gas token, most liquid)
    if (fromTokenKey !== gala && toTokenKey !== gala) {
      if (this.hasPotentialPair(fromTokenKey, gala) && this.hasPotentialPair(gala, toTokenKey)) {
        return gala;
      }
    }

    // Then try USDC
    if (fromTokenKey !== usdc && toTokenKey !== usdc) {
      if (this.hasPotentialPair(fromTokenKey, usdc) && this.hasPotentialPair(usdc, toTokenKey)) {
        return usdc;
      }
    }

    // Finally try USDT
    if (fromTokenKey !== usdt && toTokenKey !== usdt) {
      if (this.hasPotentialPair(fromTokenKey, usdt) && this.hasPotentialPair(usdt, toTokenKey)) {
        return usdt;
      }
    }

    return null;
  }

  // Mark a pair as confirmed to exist
  confirmPairExists(token0: string, token1: string, fee: number): void {
    const pair = `${token0}|${token1}|${fee}`;
    this.knownPairs.add(pair);
  }

  // Get suggested fee tiers in order of preference
  getSuggestedFeeTiers(): number[] {
    return [3000, 500, 10000]; // 0.3%, 0.05%, 1.0%
  }
}
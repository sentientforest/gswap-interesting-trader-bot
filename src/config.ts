import 'dotenv/config';
import BigNumber from "bignumber.js";

/**
 * Available Environment Variables for Bot Configuration:
 *
 * Token Configuration:
 * - PREFERRED_TOKEN_KEY: Token key for preferred token (default: GALA|Unit|none|none)
 * - PREFERRED_TOKEN_NAME: Display name for preferred token (default: $GALA)
 * - GALA_TOKEN_KEY: Token key for GALA (default: GALA|Unit|none|none)
 *
 * Trading Parameters:
 * - MINIMUM_GALA_BALANCE: Minimum GALA balance to maintain (default: 100)
 * - TRADE_INTERVAL_MS: Trading interval in milliseconds (default: 60000)
 * - MAX_SLIPPAGE: Maximum slippage percentage (default: 5)
 * - TRADE_AMOUNT_PERCENTAGE: Percentage of balance to trade (default: 10)
 *
 * Arbitrage Configuration:
 * - ENABLE_ARBITRAGE: Enable arbitrage detection and execution (default: false)
 * - ARBITRAGE_CHECK_INTERVAL_MS: Arbitrage scan interval in milliseconds (default: 120000 = 2 minutes)
 * - ARBITRAGE_MIN_PROFIT_PERCENT: Minimum profit percentage to execute (default: 1.0)
 * - ARBITRAGE_MAX_TRADE_SIZE: Maximum amount to use per arbitrage (default: 100)
 * - ARBITRAGE_MAX_HOPS: Maximum hops for circular paths (default: 3)
 * - ARBITRAGE_MIN_LIQUIDITY: Minimum pool liquidity to consider (default: 1000)
 * - ARBITRAGE_POOL_CACHE_TTL: Pool data cache TTL in ms (default: 60000 = 1 minute)
 *
 * Wallet Configuration:
 * - WALLET_ADDRESS: Your wallet address (required)
 * - GALACHAIN_PRIVATE_KEY: Your private key (required)
 *
 * Server Configuration:
 * - PORT: Server port (default: 3000)
 *
 * Feature Flags:
 * - ENABLE_TRADING: Enable actual trading (default: false)
 * - ENABLE_LOGGING: Enable logging (default: true)
 *
 * Transaction Settings:
 * - TRANSACTION_TIMEOUT_MS: Transaction timeout in ms (default: 600000 = 10 minutes)
 *
 * GSwap SDK URL Configuration:
 * - GSWAP_GATEWAY_BASE_URL: Gateway base URL (default: https://gateway-mainnet.galachain.com)
 * - GSWAP_DEX_CONTRACT_BASE_PATH: DEX contract path (default: /api/asset/dexv3-contract)
 * - GSWAP_TOKEN_CONTRACT_BASE_PATH: Token contract path (default: /api/asset/token-contract)
 * - GSWAP_BUNDLER_BASE_URL: Bundler URL (default: https://bundle-backend-prod1.defi.gala.com)
 * - GSWAP_BUNDLING_API_BASE_PATH: Bundling API path (default: /bundle)
 * - GSWAP_DEX_BACKEND_BASE_URL: DEX backend URL (default: https://dex-backend-prod1.defi.gala.com)
 */

export interface BotConfig {
  // Token preferences
  preferredTokenKey: string;
  preferredTokenName: string;
  galaTokenKey: string;

  // Trading parameters
  minimumGalaBalance: number;
  tradeInterval: number; // milliseconds
  maxSlippage: number; // percentage
  tradeAmountPercentage: number; // percentage of balance to trade

  // Arbitrage parameters
  enableArbitrage: boolean;
  arbitrageCheckInterval: number; // milliseconds
  arbitrageMinProfitPercent: BigNumber; // minimum profit percentage
  arbitrageMaxTradeSize: BigNumber; // maximum GALA to use per arbitrage
  arbitrageMaxHops: number; // maximum hops in circular path
  arbitrageMinLiquidity: BigNumber; // minimum pool liquidity to consider
  arbitragePoolCacheTTL: number; // pool data cache TTL in milliseconds

  // Wallet configuration
  walletAddress: string;
  privateKey: string;

  // Server configuration
  port: number;

  // Feature flags
  enableTrading: boolean;
  enableLogging: boolean;

  // Transaction settings
  transactionTimeoutMs: number;

  // GSwap SDK URL configuration
  gatewayBaseUrl: string;
  dexContractBasePath: string;
  tokenContractBasePath: string;
  bundlerBaseUrl: string;
  bundlingAPIBasePath: string;
  dexBackendBaseUrl: string;
}

function validateTokenKey(key: string): boolean {
  const parts = key.split('|');
  return parts.length === 4;
}

export function loadConfig(): BotConfig {
  const preferredTokenKey = process.env.PREFERRED_TOKEN_KEY || 'GALA|Unit|none|none';
  const galaTokenKey = process.env.GALA_TOKEN_KEY || 'GALA|Unit|none|none';

  if (!validateTokenKey(preferredTokenKey)) {
    throw new Error(`Invalid PREFERRED_TOKEN_KEY format: ${preferredTokenKey}. Expected format: "SYMBOL|Unit|none|none"`);
  }

  if (!validateTokenKey(galaTokenKey)) {
    throw new Error(`Invalid GALA_TOKEN_KEY format: ${galaTokenKey}. Expected format: "SYMBOL|Unit|none|none"`);
  }

  const privateKey = process.env.GALACHAIN_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('GALACHAIN_PRIVATE_KEY environment variable is required');
  }

  // Validate private key format
  if (privateKey === 'demo_key_placeholder' || privateKey === 'your_private_key_here') {
    throw new Error('Please set a real private key in GALACHAIN_PRIVATE_KEY');
  }

  const walletAddress = process.env.WALLET_ADDRESS;
  if (!walletAddress) {
    throw new Error('WALLET_ADDRESS environment variable is required');
  }

  return {
    // Token configuration
    preferredTokenKey,
    preferredTokenName: process.env.PREFERRED_TOKEN_NAME || '$GALA',
    galaTokenKey,

    // Trading parameters with defaults
    minimumGalaBalance: Number(process.env.MINIMUM_GALA_BALANCE) || 100,
    tradeInterval: Number(process.env.TRADE_INTERVAL_MS) || 60000, // 1 minute default
    maxSlippage: Number(process.env.MAX_SLIPPAGE) || 5, // 5% default
    tradeAmountPercentage: Number(process.env.TRADE_AMOUNT_PERCENTAGE) || 10, // 10% of balance default

    // Arbitrage parameters with defaults
    enableArbitrage: process.env.ENABLE_ARBITRAGE === 'true', // Default to false for safety
    arbitrageCheckInterval: Number(process.env.ARBITRAGE_CHECK_INTERVAL_MS) || 120_000, // 2 minutes default
    arbitrageMinProfitPercent: new BigNumber(process.env.ARBITRAGE_MIN_PROFIT_PERCENT ?? 1.0), // 1% minimum profit
    arbitrageMaxTradeSize: new BigNumber(process.env.ARBITRAGE_MAX_TRADE_SIZE ?? 100), // 100 GALA max
    arbitrageMaxHops: Number(process.env.ARBITRAGE_MAX_HOPS) || 3, // 3 hops maximum
    arbitrageMinLiquidity: new BigNumber(process.env.ARBITRAGE_MIN_LIQUIDITY || 1000), // 1000 minimum liquidity
    arbitragePoolCacheTTL: Number(process.env.ARBITRAGE_POOL_CACHE_TTL) || 60_000, // 1 minute cache

    // Wallet configuration
    walletAddress,
    privateKey,

    // Server configuration
    port: Number(process.env.PORT) || 3000,

    // Feature flags
    enableTrading: process.env.ENABLE_TRADING === 'true', // Default to false for safety
    enableLogging: process.env.ENABLE_LOGGING !== 'false', // Default to true

    // Transaction settings
    transactionTimeoutMs: Number(process.env.TRANSACTION_TIMEOUT_MS) || 600_000, // 10 minutes default

    // GSwap SDK URL configuration with defaults from SDK
    gatewayBaseUrl: process.env.GSWAP_GATEWAY_BASE_URL || 'https://gateway-mainnet.galachain.com',
    dexContractBasePath: process.env.GSWAP_DEX_CONTRACT_BASE_PATH || '/api/asset/dexv3-contract',
    tokenContractBasePath: process.env.GSWAP_TOKEN_CONTRACT_BASE_PATH || '/api/asset/token-contract',
    bundlerBaseUrl: process.env.GSWAP_BUNDLER_BASE_URL || 'https://bundle-backend-prod1.defi.gala.com',
    bundlingAPIBasePath: process.env.GSWAP_BUNDLING_API_BASE_PATH || '/bundle',
    dexBackendBaseUrl: process.env.GSWAP_DEX_BACKEND_BASE_URL || 'https://dex-backend-prod1.defi.gala.com',
  };
}

export function getTagline(config: BotConfig): string {
  return `I don't always trade crypto, but when I do, I prefer ${config.preferredTokenName}`;
}
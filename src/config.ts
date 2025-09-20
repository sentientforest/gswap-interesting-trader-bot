import 'dotenv/config';

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

  // Wallet configuration
  walletAddress: string;
  privateKey: string;

  // Server configuration
  port: number;

  // Feature flags
  enableTrading: boolean;
  enableLogging: boolean;
  useMockData: boolean;
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
  const useMockData = process.env.USE_MOCK_DATA === 'true';

  if (!privateKey) {
    throw new Error('GALACHAIN_PRIVATE_KEY environment variable is required');
  }

  // Allow placeholder private key when using mock data
  if (!useMockData && (privateKey === 'demo_key_placeholder' || privateKey === 'your_private_key_here')) {
    throw new Error('Please set a real private key in GALACHAIN_PRIVATE_KEY or enable USE_MOCK_DATA=true for testing');
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

    // Wallet configuration
    walletAddress,
    privateKey,

    // Server configuration
    port: Number(process.env.PORT) || 3000,

    // Feature flags
    enableTrading: process.env.ENABLE_TRADING === 'true', // Default to false for safety
    enableLogging: process.env.ENABLE_LOGGING !== 'false', // Default to true
    useMockData: process.env.USE_MOCK_DATA === 'true', // Default to false
  };
}

export function getTagline(config: BotConfig): string {
  return `I don't always trade crypto, but when I do, I prefer ${config.preferredTokenName}`;
}
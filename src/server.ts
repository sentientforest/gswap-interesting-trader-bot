#!/usr/bin/env node
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { MostInterestingTraderBot } from './bot.js';
import { loadConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = loadConfig();
const app = express();

// Global bot instance
let bot: MostInterestingTraderBot | null = null;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.get('/api/status', (_req, res) => {
  if (!bot) {
    return res.json({
      isRunning: false,
      error: 'Bot not initialized',
    });
  }

  try {
    const status = bot.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/start', async (_req, res) => {
  try {
    if (bot) {
      return res.json({ message: 'Bot is already running' });
    }

    bot = new MostInterestingTraderBot(config);
    await bot.start();

    res.json({ message: 'Bot started successfully' });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/stop', async (_req, res) => {
  try {
    if (!bot) {
      return res.json({ message: 'Bot is not running' });
    }

    await bot.stop();
    bot = null;

    res.json({ message: 'Bot stopped successfully' });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get('/api/config', (_req, res) => {
  res.json({
    preferredToken: config.preferredTokenName,
    walletAddress: config.walletAddress,
    tradeInterval: config.tradeInterval,
    minimumGalaBalance: config.minimumGalaBalance,
    maxSlippage: config.maxSlippage,
    tradingEnabled: config.enableTrading,
    transactionTimeoutMs: config.transactionTimeoutMs,
    gswapUrls: {
      gatewayBaseUrl: config.gatewayBaseUrl,
      dexContractBasePath: config.dexContractBasePath,
      tokenContractBasePath: config.tokenContractBasePath,
      bundlerBaseUrl: config.bundlerBaseUrl,
      bundlingAPIBasePath: config.bundlingAPIBasePath,
      dexBackendBaseUrl: config.dexBackendBaseUrl,
    },
  });
});

// Serve the main UI
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling middleware
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
  });
});

// Start server
const server = app.listen(config.port, async () => {
  console.log('');
  console.log('=' .repeat(60));
  console.log('🍺 The Most Interesting Trader in the World - Web Interface');
  console.log(`🌐 Server running at http://localhost:${config.port}`);
  console.log(`💼 Wallet: ${config.walletAddress}`);
  console.log(`🎯 Preferred Token: ${config.preferredTokenName}`);
  console.log(`⚡ Trading: ${config.enableTrading ? 'ENABLED' : 'DISABLED'}`);
  console.log('=' .repeat(60));
  console.log('');

  // Auto-start the bot
  try {
    bot = new MostInterestingTraderBot(config);
    await bot.start();
    console.log('🚀 Bot started automatically');
  } catch (error) {
    console.error('❌ Failed to auto-start bot:', error instanceof Error ? error.message : String(error));
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');

  if (bot) {
    await bot.stop();
  }

  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');

  if (bot) {
    await bot.stop();
  }

  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});
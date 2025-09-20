# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a gSwap CLI tool for interacting with the gSwap decentralized exchange (DEX) on GalaChain. The project provides a command-line interface for trading operations, liquidity management, and pool queries using the @gala-chain/gswap-sdk.

## Commands

### Development Commands
- `npm run cli -- <command> [args...]` - Run CLI commands
- `npm run sockets` - Start websocket listener for transaction events
- `npm run build` - Build TypeScript to JavaScript (outputs to ./dist)

Note: No test command is currently configured.

## Architecture

### Core Components

1. **CLI Entry Point** (`src/cli.ts`): Main command dispatcher that routes commands to specific functions. Uses process.argv for command parsing and includes comprehensive help text.

2. **Trading Functions**: Each major operation has its own module:
   - `swap.ts` - Token swapping with automatic transaction waiting
   - `quote_exact_input.ts` / `quote_exact_output.ts` - Price quotes
   - `add_liquidity.ts` - Multiple liquidity adding strategies
   - `remove_all_liquidity.ts` - Liquidity removal
   - `collect_fees.ts` - Fee collection from positions

3. **WebSocket Integration** (`socket_example.ts`): Real-time transaction status monitoring via GSwap event socket.

4. **Private Key Management**: All signing operations require `GALACHAIN_PRIVATE_KEY` environment variable set via `.env` file.

### Key Patterns

- All async operations use the GSwap SDK's pending transaction pattern with `.wait()` for completion
- Token identifiers follow the format: `"SYMBOL|Unit|none|none"`
- Wallet addresses use format: `"eth|<address>"` or `"client|<address>"`
- Fee tiers are limited to: 500 (0.05%), 3000 (0.3%), 10000 (1.0%)

## TypeScript Configuration

- ES2022 modules with strict TypeScript settings
- Uses ts-node ESM loader for direct execution
- All strict checks enabled including `noUncheckedIndexedAccess`
- Source maps enabled for debugging

## Important Context

- This is a Work in Progress project with initial spec at `@ctx/20250919_initial_spec.md`
- Uses `@ctx/` directory for documentation and AI agent working memory
- Uses `@ext/` directory for local reference to external resources like gswap-sdk source
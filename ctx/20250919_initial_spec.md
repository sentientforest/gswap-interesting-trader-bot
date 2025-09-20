I want you to make a GalaChain Trading Bot using Gala's gswap-sdk: 
https://github.com/GalaChain/gswap-sdk

This bot should take a configuration parameter named "PREFERRED_TOKEN_KEY" for a TokenClassKey comprised of collection, 
category, type, and additionalKey properties, along with a name "PREFERRED_TOKEN_NAME" property for 
display purposes. gswap-sdk uses a collection|category|type|additionalKey convention 
for these properties, so the PREFERRED_TOKEN_KEY for "Gala" is "GALA|Unit|none|none" 
for example, and the PREFERRED_TOKEN_KEY for "Bitcoin" is 
"GWBTC|Unit|none|none".

The theme of this bot is a parody of the old Dos Equis Beer commercials, in which 
"The Most Interesting Man in the World" ended each commercial with the tagline: 
"I don't always drink beer, but when I do, I prefer Dos Equis."

For our bot, our parody, we will be using a play on those words:

"I don't always trade crypto, but when I do, I prefer {name of preferred token}".

For example, depending on PREFERRED_TOKEN_NAME in .env,

"I don't always trade crypto, but when I do, I prefer $GALA".
"I don't always trade crypto, but when I do, I prefer Bitcoin (₿TC)". 

IMPORTANT: The bot will try to maximize its balance of the preferred token. 
It will do so by employing various strategies. To start, dollar-cost-average any other 
tokens the bot owns into the preferred token at regular intervals. 

One way to get the bots' owned assets:

```typescript
const assets = await assetsService.getUserAssets('eth|123...abc', 1, 20);
console.log(`User has ${assets.count} different tokens`);
assets.tokens.forEach(token => {
  console.log(`${token.symbol}: ${token.quantity}`);
});
```

```bash
npm run cli -- getUserAssets "eth|73291822E3554fFfCAf131E1D6e30c9E098F8055"
```

Example swap call:

// Exact input swap: sell 100 GALA for USDC
const result = await swapsService.swap(
  'GALA|Unit|none|none',
  'GUSDC|Unit|none|none',
  500,
  { exactIn: '100', amountOutMinimum: '45' },
  'eth|123...abc', // your wallet address
);
console.log('Swap successful:', result);

Other environment parameters the bot will need

https://github.com/GalaChain/gswap-sdk/tree/main/examples/cli

The starting point of the project is the cli example copied from the gswap-sdk, 
it's already in the root of the repo. The README.md contains lots of sample commands. 

We want to use the NPM commands for development and testing. We want to build a 
Node.js application that runs the cli tool and periodically executes our trades. 

On a periodical interval, it checks its own balances. If it has non-zero balances of 
tokens that are not its 
configured preferred token, it should: 

1) attempt to find pools that include the token it owns and its preferred token
2) attempt to swap a small amount of the owned token for the preferred token, 
using generous slippage / 
price tolerances to favor the trade executing
3) log results of all actions take

As an additional behavior, the token defined by the env variable "GALA_TOKEN_KEY=GALA|Unit|none|none
" should not be traded to zero balance. The bot should strive to maintain a minimum balance 
of 100 units of this token at all times. In the event that the bot has non-zero balances 
of tokens that are NEITHER its preferred token NOR the GALA token, it may trade these 
non-preferred tokens for GALA using the same dollar cost averaging as the preferred token. 
This is a secondary goal beyond the maximizing of the preferred token balance: maintaining 
a useable store of GALA, which is used for transaction fees on GALA chain. 

Additionally, if the bot has more than twice the minimum GALA_TOKEN_KEY balance, 
it can trade small amounts of that for its preferred token or other tokens 
it finds available in pools. 

Part of the development is the make a basic Express.js server that runs the 
ongoing trading process, that displays a basic UI of the latest status. 
The UI should be basic HTML/CSS and beautifully styled to our theme of 
"the most interesting trader in the world", as described above. 


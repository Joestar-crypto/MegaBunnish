# MegaBunnish

MegaBunnish is a 2D blockchain application navigator that renders a constellation of project nodes from local JSON data. Users can filter by primitive, orbit the canvas with a left-click drag gesture, and inspect detailed resources plus incentive campaigns per project.

## Requirements

- Node.js 18+
- npm, pnpm, or yarn package manager

## Getting Started

```bash
npm install
npm run dev
```

The dev server defaults to http://localhost:5173.

## Available Scripts

- `npm run dev` – start Vite in development mode.
- `npm run build` – type-check and build the production bundle.
- `npm run preview` – preview the production build locally.
- `npm run lint` – run ESLint on the `src` directory.

## Data Model

Projects live in `src/data/projects.json`. Each entry contains:

- `category` – grouping label (e.g., lending, dex, perps)
- `links` – site, docs, social references
- `networks` – supported chains
- `incentives` – optional campaign array with ISO expiry timestamps

Expired incentives are hidden automatically at runtime.

## Interactions

- **Left-click drag** pans the camera.
- **Click nodes** to open the detail drawer.
- **Category chips** recenter the view on that cluster.

Logos are simple SVG placeholders stored in `public/logos`. Replace them with real project artwork as needed.

## Wallet Checker & NFT Beads

The Wallet Checker (top-right pill) lets you enter any MegaETH wallet to:

- Scan recent transactions via the Blockscout/Etherscan-compatible API.
- Detect verified smart-contract interactions mapped to constellation projects.
- Fetch NFT balances for tracked collections such as **BadBunnz** (`0xbdb13add477e76c1df52192d4f5f4dd67f6a40d8`). Owning multiple NFTs produces multiple “white bead” indicators on the corresponding node.

### API Key (optional)

If you have an Etherscan-style API key, expose it as `VITE_ETHERSCAN_API_KEY` in a `.env` file:

```
VITE_ETHERSCAN_API_KEY=your-key-here
```

The app works without a key, but adding one helps avoid shared rate limits when scanning wallets or NFT balances.

## MegaETH Wallet Checker (Node CLI)

This repo includes a standalone **Node.js MegaETH Wallet Checker** that analyzes one wallet using explorer APIs + RPC checks.

### What it does

1. Accepts a single wallet address as input.
2. Fetches transactions from account endpoints:
	 - `txlist`
	 - `txlistinternal`
	 - `tokentx`
	 - `tokennfttx`
3. Uses Etherscan-compatible API first, then auto-falls back to Blockscout-compatible API.
4. For each transaction, it:
	 - Checks whether `to` is a smart contract using `eth_getCode`.
	 - Extracts `methodId` from tx input.
	 - Fetches and decodes logs (when available).
5. Classifies interactions into categories (DEX, Lending, NFT, Token, etc.) using method IDs + decoded logs.

### Install / Run

```bash
npm install
npm run wallet:check -- 0xYourWalletAddress
```

### Environment variables

```bash
MEGAETH_RPC_URL=https://carrot.megaeth.com/rpc
MEGAETH_ETHERSCAN_API_URL=https://megaeth.blockscout.com/api
MEGAETH_BLOCKSCOUT_API_URL=https://megaeth.blockscout.com/api
MEGAETH_EXPLORER_API_KEY=

MEGAETH_PAGE_SIZE=100
MEGAETH_MAX_PAGES=500
MEGAETH_REQUEST_DELAY_MS=200
MEGAETH_MAX_RETRIES=5
```

### Output

The command prints JSON to stdout and writes a file:

`wallet-checker-<wallet>.json`

Sample JSON structure:

```json
{
	"wallet": "0x1234...abcd",
	"explorerSource": "etherscan-compatible",
	"warning": null,
	"totalTransactions": 247,
	"uniqueContractsInteracted": 39,
	"breakdownByType": {
		"DEX": 54,
		"Lending": 18,
		"NFT": 27,
		"Token": 96,
		"Other Contract": 22,
		"Internal": 11,
		"EOA Transfer": 19
	},
	"interactions": [
		{
			"stream": "txlist",
			"hash": "0x...",
			"blockNumber": 123456,
			"timestamp": 1739980000,
			"from": "0x...",
			"to": "0x...",
			"toIsContract": true,
			"methodId": "0x38ed1739",
			"methodName": "swapExactTokensForTokens",
			"interactionType": "DEX",
			"decodedLogs": [
				{
					"eventName": "Swap",
					"signature": "Swap(address,uint256,uint256,uint256,uint256,address)",
					"category": "DEX",
					"args": {}
				}
			]
		}
	]
}
```

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
- `npm run alerts:list` – inspect the backend subscriber list used for event alerts.
- `npm run alerts:send` – send pending event alerts to subscribed contacts.
- `npm run alerts:dry-run` – preview which pending event alerts would be sent.

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

## Event Alerts

The Events panel can subscribe an email address to event notifications. The frontend posts subscriptions to `VITE_EVENT_ALERTS_API_URL` when defined, otherwise it uses `/api/event-alert-subscriptions`.

The included backend stores subscriber emails itself and tracks which recipients already received each event. Automatic sends use Resend.

For local development, subscriber data is written to `.data/event-alerts.json` by default. If no KV or Upstash storage is configured but `RESEND_API_KEY` is available, the app now falls back automatically to a Resend segment and topic for subscriptions plus Resend broadcast history for duplicate prevention. That means Cloudflare Pages and similar serverless deployments can work with just the Resend and base URL secrets after redeploying, but the Resend key must be allowed to manage Contacts, Segments, Topics, and Broadcasts. Send-only Resend keys will fail for subscriptions.

Optional alternate storage backends remain available if you prefer to keep the subscriber list outside Resend.

### Required environment variables

For the subscription API and alert sender:

```bash
RESEND_API_KEY=your-resend-key
RESEND_FROM_ADDRESS="Megabunnish <alerts@your-domain.com>"
EVENT_ALERTS_BASE_URL=https://your-public-app-url
```

If the alert API runs on a different host than the frontend, keep `EVENT_ALERTS_BASE_URL` pointed at the public app so email assets and "Manage alerts" links still land on the site, then add:

```bash
EVENT_ALERTS_API_BASE_URL=https://your-alert-api-host
EVENT_ALERTS_ALLOWED_ORIGIN=https://your-public-app-url
```

For Cloudflare Pages native storage:

```bash
EVENT_ALERTS=<KV namespace binding>
```

Recommended for durable production storage when you want the same store available outside Cloudflare too:

```bash
EVENT_ALERTS_STORAGE_DRIVER=upstash
UPSTASH_REDIS_REST_URL=https://your-upstash-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
EVENT_ALERTS_STORAGE_KEY=megabunnish:event-alerts
```

Optional if you run on a persistent Node server and want file storage elsewhere:

```bash
EVENT_ALERTS_STORAGE_DRIVER=file
EVENT_ALERTS_STORAGE_PATH=/absolute/path/to/event-alerts.json
```

Optional for a custom frontend endpoint, protected admin access, or unsubscribe signing:

```bash
VITE_EVENT_ALERTS_API_URL=https://your-api-host/api/event-alert-subscriptions
EVENT_ALERTS_CRON_SECRET=choose-a-secret
EVENT_ALERTS_ADMIN_SECRET=choose-a-secret
EVENT_ALERTS_UNSUBSCRIBE_SECRET=choose-a-secret
```

### Troubleshooting subscriptions

If the UI shows Event alert storage is not configured on this deployment, the public subscription endpoint is still running an older deployment or is missing `RESEND_API_KEY` entirely.

After this change, the minimal production setup is:

- `RESEND_API_KEY`
- `EVENT_ALERTS_BASE_URL`

If the alert API is deployed separately from the frontend, also add:

- `EVENT_ALERTS_API_BASE_URL`
- `EVENT_ALERTS_ALLOWED_ORIGIN`

Optional alternatives if you do not want Resend to hold the subscriber list:

- A KV binding named EVENT_ALERTS
- Or the Upstash variables UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN

The GitHub send-alerts workflow does not create deployment secrets for the public subscription API. It only sends pending alerts. If the deployed sender fails and the workflow falls back to Node, the Node sender now also works with the same minimal Resend setup.

### Automatic dispatch

The repo includes `.github/workflows/send-event-alerts.yml`, scheduled hourly. It first tries the deployed `/api/send-event-alerts` route so Cloudflare Pages can send alerts from the same storage used by the subscription UI. If that route is unavailable, it falls back to the existing Node sender.

For one-off tests, you can limit the sender to a specific event id by calling `/api/send-event-alerts?eventId=<event-id>` on the deployed API, or by running `npm run alerts:send -- --event-id <event-id>` locally.

Configure the matching GitHub Actions secrets before enabling it:

- `RESEND_API_KEY`
- `RESEND_FROM_ADDRESS`
- `EVENT_ALERTS_BASE_URL`
- `EVENT_ALERTS_API_BASE_URL` (optional, if the sender API is not on the same host as the frontend)
- `EVENT_ALERTS_CRON_SECRET` (recommended)

Only add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `EVENT_ALERTS_STORAGE_KEY` if you explicitly want to use the Upstash storage driver.

If you deploy the frontend on a platform with serverless routes, the included `api/event-alert-subscriptions.ts` and `api/send-event-alerts.ts` files can be used directly. For Cloudflare Pages, the repo now also includes `functions/api/event-alert-subscriptions.ts` and `functions/api/send-event-alerts.ts`.

If your frontend host is static-only or cannot keep the mail secrets, you can run the alert API separately on Railway with the included `server/railway.ts` entrypoint.

### Railway API deployment

Use Railway only if your current frontend host cannot serve the `/api/*` routes reliably. The shortest split deployment is:

1. Deploy the repo to Railway as a backend service.
2. Let Railway use the included `nixpacks.toml`, which installs dependencies and starts `npm run alerts:server`.
3. Set Railway variables:

```bash
RESEND_API_KEY=your-resend-key
RESEND_FROM_ADDRESS="Megabunnish <alerts@your-domain.com>"
EVENT_ALERTS_BASE_URL=https://your-public-frontend-url
EVENT_ALERTS_API_BASE_URL=https://your-railway-service.up.railway.app
EVENT_ALERTS_ALLOWED_ORIGIN=https://your-public-frontend-url
EVENT_ALERTS_CRON_SECRET=choose-a-secret
EVENT_ALERTS_ADMIN_SECRET=choose-a-secret
EVENT_ALERTS_UNSUBSCRIBE_SECRET=choose-a-secret
```

4. On the frontend host, set:

```bash
VITE_EVENT_ALERTS_API_URL=https://your-railway-service.up.railway.app/api/event-alert-subscriptions
```

5. In GitHub Actions, keep `EVENT_ALERTS_BASE_URL` as the public frontend URL, and add `EVENT_ALERTS_API_BASE_URL=https://your-railway-service.up.railway.app` if you want the workflow to hit the Railway sender first.

With that setup:

- the React app subscribes through Railway,
- unsubscribe links in emails go back to Railway,
- email images and "Manage alerts" links still use the public frontend URL.

### Inspecting subscribers

To inspect the current stored list locally:

```bash
npm run alerts:list
```

To inspect it through the deployed API, call `GET /api/event-alert-subscriptions` with `Authorization: Bearer <EVENT_ALERTS_ADMIN_SECRET>` or `?secret=<EVENT_ALERTS_ADMIN_SECRET>`.

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

# MegaETH & MegaBunnish — Documentation

This document is split in two parts:

1. **Part 1 — MegaETH:** what the chain is, why it exists, and how
   MegaBunnish maps and tracks the projects building on it.
2. **Part 2 — Public API:** the read-only HTTP endpoints exposed by
   MegaBunnish so other developers can reuse the same ecosystem data
   (projects, categories, incentives and events) in their own apps,
   bots and dashboards.

---

## Part 1 — MegaETH

### What is MegaETH?

MegaETH is a real-time Ethereum L2 designed for sub-10 ms block times
and very high throughput while staying fully EVM-compatible. The goal
is to make on-chain UX feel as responsive as a centralized backend so
that consumer apps — trading, gaming, social, prediction markets —
can run "natively on-chain" instead of relying on off-chain
sequencers or batched UX shortcuts.

Key properties relevant to apps and integrators:

- **EVM equivalence.** Standard Solidity contracts, JSON-RPC and
  tooling (Foundry, Hardhat, viem, ethers, wagmi) work as-is.
- **Real-time blocks.** Targeted ~10 ms mini-blocks with frequent
  state diffs published to subscribers, allowing UIs to stream state
  updates instead of polling.
- **L2 security.** Settlement and data availability anchored to
  Ethereum L1.
- **Chain ID.** `6342` (testnet phase at the time of writing — verify
  on the official MegaETH docs before sending real value).

Because the chain optimizes for low latency, the ecosystem skews
toward apps where milliseconds matter: perps, on-chain order books,
prediction markets, mobile trading, real-time games, and on-chain
social.

### What is MegaBunnish?

MegaBunnish is a 2D constellation explorer for the MegaETH ecosystem.
It renders every tracked project as a node, grouped by primitive
(DeFi, NFT, Gaming, RWA, Social, Meme, DePIN, AI, Tools…), and lets
users:

- pan around the canvas to discover apps,
- filter by category or by curated tags such as **Megamafia**,
  **Jojo** and **Native**,
- open a detail drawer per project with links and active incentives,
- subscribe an email address to upcoming **event alerts**,
- check a wallet against the constellation via the **Wallet Checker**
  to surface contract interactions and NFT holdings (e.g. BadBunnz
  beads).

### Data model

All ecosystem data lives in two source files:

- [src/data/projects.json](src/data/projects.json) — the catalog of
  projects.
- [src/data/appEvents.ts](src/data/appEvents.ts) — scheduled events
  (mints, presales, tournaments, deploy windows…).

#### Project shape

```json
{
  "id": "cap-money",
  "name": "Cap Money",
  "categories": ["Megamafia", "DeFi", "Native"],
  "networks": ["MegaETH"],
  "links": {
    "site": "https://cap.app/",
    "twitter": "https://x.com/capmoney_"
  },
  "logo": "/logos/CapMoney.webp",
  "isLive": true,
  "incentives": [
    {
      "id": "example-incentive",
      "title": "Cosmetic SBT for early users",
      "reward": "Cosmetic SBT",
      "expiresAt": "2026-02-13T23:59:00-05:00"
    }
  ]
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable kebab-case slug, used as the public API key. |
| `name` | string | Display name. |
| `categories` | string[] | Free-form taxonomy. See list below. |
| `networks` | string[] | Currently always `["MegaETH"]`. |
| `links` | object | Any of `site`, `docs`, `twitter`, `discord`, `telegram`, `github`. |
| `logo` | string | Path served from `public/logos/`. |
| `isLive` | boolean | `true` once the app is reachable on MegaETH. |
| `incentives` | array | Optional. Expired entries are filtered server-side. |

#### Categories in use

`Megamafia`, `Jojo`, `Native`, `DeFi`, `Trading`, `Trading bot`,
`Mobile`, `Prediction Market`, `Gaming`, `NFT`, `RWA`, `Launchpad`,
`Social`, `Gambling`, `Meme`, `Depin`, `AI`, `Tools`, `Bridge`.

Two of these are curated tags rather than primitives:

- **Megamafia** — apps included in the official MegaETH builder
  cohort.
- **Jojo** — a sub-cohort tracked by the community.

#### Event shape

Events drive both the UI panel and the email alerts:

```ts
{
  id: 'offshore-presale',
  title: 'Presale Open',
  projectId: 'offshore',
  start: '2026-02-14T12:00:00-05:00',
  end:   '2026-02-19T16:00:00-05:00',
  tweetUrl: 'https://x.com/OffshoreOnMega',
  detailsUrl: 'https://offshoreprotocol.fun?ref=139',
  phases: [
    { label: 'Presale Open', start: '...', end: '...' }
  ]
}
```

`projectId` always matches an entry in `projects.json`.

### Architecture overview

| Layer | Path | Purpose |
| --- | --- | --- |
| Frontend (Vite + React) | [src/](src/) | Canvas, panels, wallet checker. |
| Static catalog | [src/data/](src/data/) | `projects.json`, `appEvents.ts`. |
| AI advisor | [server/ai-advisor.ts](server/ai-advisor.ts), [api/ai-chat.ts](api/ai-chat.ts) | RAG-style chat grounded on the catalog. |
| Event alerts | [functions/api/event-alert-subscriptions.ts](functions/api/event-alert-subscriptions.ts), [api/send-event-alerts.ts](api/send-event-alerts.ts) | Subscribe + send via Resend. |
| Public API (this doc) | [api/_public.ts](api/_public.ts), [functions/api/public/](functions/api/public/) | Read-only ecosystem endpoints. |
| Node entrypoint | [server/railway.ts](server/railway.ts) | HTTP server used in non-Cloudflare deployments. |
| Cloudflare Pages | [functions/](functions/) | Routes used by the Pages deployment. |

---

## Part 2 — Public API

The public API exposes a stable, read-only JSON view of the
MegaBunnish catalog so external developers can:

- power their own MegaETH dashboards or directories,
- check whether a project they care about is live,
- subscribe to the upcoming-events feed for bots and Discord
  notifiers,
- avoid scraping the website or duplicating the data manually.

### Base URLs

- Production (Cloudflare Pages): `https://megabunnish.com/api/public`
- Local dev (Node server via `npm run alerts:server`):
  `http://localhost:3000/api/public`

### Conventions

- All endpoints are `GET` (and `OPTIONS` for CORS preflight).
- Every response is `application/json; charset=utf-8`.
- Responses are CORS-open (`Access-Control-Allow-Origin: *`) and
  cacheable: `public, max-age=60, s-maxage=300, stale-while-revalidate=600`.
- No authentication. Treat the data as public and best-effort.
- Errors use `{ "error": "<message>" }` with a non-2xx status.

### `GET /api/public`

Returns a small index describing the available endpoints. Useful as a
liveness probe.

```json
{
  "name": "MegaBunnish public API",
  "version": 1,
  "endpoints": {
    "projects": "/api/public/projects",
    "events": "/api/public/events",
    "ecosystem": "/api/public/ecosystem"
  }
}
```

### `GET /api/public/projects`

Returns the full project catalog (currently 116 entries) with
expired incentives already filtered out.

#### Query parameters

| Param | Type | Description |
| --- | --- | --- |
| `id` | string | Return a single project by its slug. |
| `category` | string | Case-insensitive match against a category. |
| `network` | string | Case-insensitive match against a network. Mostly `MegaETH`. |
| `live` | bool (`true`/`false`/`1`/`0`) | Filter by `isLive`. |
| `q` | string | Substring search in `name` and `id`. |

#### Response

```json
{
  "count": 12,
  "total": 116,
  "projects": [
    {
      "id": "cap-money",
      "name": "Cap Money",
      "categories": ["Megamafia", "DeFi", "Native"],
      "networks": ["MegaETH"],
      "links": { "site": "https://cap.app/", "twitter": "https://x.com/capmoney_" },
      "logo": "/logos/CapMoney.webp",
      "isLive": true,
      "incentives": []
    }
  ]
}
```

#### Examples

```bash
# All projects
curl https://megabunnish.com/api/public/projects

# Only live DeFi apps
curl "https://megabunnish.com/api/public/projects?category=DeFi&live=true"

# A single project by slug
curl https://megabunnish.com/api/public/projects?id=cap-money

# Free-text search
curl "https://megabunnish.com/api/public/projects?q=trade"
```

### `GET /api/public/events`

Returns the scheduled events feed, sorted by start time ascending.

#### Query parameters

| Param | Type | Description |
| --- | --- | --- |
| `projectId` | string | Filter to a single project. |
| `upcoming` | bool | Keep only events whose end (or start) is ≥ now. |
| `past` | bool | Keep only events whose end (or start) is < now. |

#### Response

```json
{
  "count": 3,
  "total": 24,
  "events": [
    {
      "id": "offshore-presale",
      "title": "Presale Open",
      "projectId": "offshore",
      "start": "2026-02-14T12:00:00-05:00",
      "end": "2026-02-19T16:00:00-05:00",
      "tweetUrl": "https://x.com/OffshoreOnMega",
      "detailsUrl": "https://offshoreprotocol.fun?ref=139",
      "phases": [
        { "label": "Presale Open", "start": "...", "end": "..." }
      ]
    }
  ]
}
```

#### Examples

```bash
# Everything upcoming
curl "https://megabunnish.com/api/public/events?upcoming=true"

# Events for a specific project
curl "https://megabunnish.com/api/public/events?projectId=offshore"
```

### `GET /api/public/ecosystem`

A lightweight summary of the ecosystem — useful for stat widgets and
quick health checks.

```json
{
  "chain": "MegaETH",
  "chainId": 6342,
  "projects": { "total": 116, "live": 17, "activeIncentives": 4 },
  "events":   { "total": 24,  "upcoming": 6 },
  "categories": { "Native": 88, "Megamafia": 41, "DeFi": 27, "...": "..." },
  "networks":   { "MegaETH": 116 },
  "generatedAt": "2026-04-28T10:15:00.000Z"
}
```

### Client snippets

#### TypeScript / `fetch`

```ts
type PublicProject = {
  id: string;
  name: string;
  categories: string[];
  networks: string[];
  links: Record<string, string>;
  logo?: string;
  isLive: boolean;
  incentives: { id: string; title: string; reward?: string; expiresAt?: string }[];
};

const response = await fetch(
  'https://megabunnish.com/api/public/projects?live=true&category=DeFi'
);
const { projects } = (await response.json()) as { projects: PublicProject[] };
```

#### Python

```python
import requests

data = requests.get(
    'https://megabunnish.com/api/public/events',
    params={'upcoming': 'true'},
    timeout=10,
).json()

for event in data['events']:
    print(event['start'], '-', event['title'])
```

### Rate limits and caching

There is no hard rate limit, but please:

- respect the `Cache-Control` header (5 min shared cache),
- send a meaningful `User-Agent`,
- avoid hammering the endpoints from the browser on every keystroke
  — debounce filter inputs.

If you need higher freshness or a webhook-style stream, open an
issue rather than polling at sub-second intervals.

### Versioning and stability

The shape documented here is **v1** and matches the JSON returned by
the index endpoint (`"version": 1`). Backwards-incompatible changes
will ship under a new path (`/api/public/v2/...`) so existing
integrations keep working.

The data itself (slugs, categories, event IDs) is curated and may
change. Treat `id` as stable; treat `categories` as a best-effort
taxonomy that can evolve.

### Local development

The Cloudflare Pages routes live in
[functions/api/public/](functions/api/public/) and are served by
Wrangler when running `npm run dev` against Pages.

For Node / Railway-style deployments, the same handlers are wired in
[server/railway.ts](server/railway.ts) and become available after:

```bash
npm run alerts:server
# -> http://localhost:3000/api/public/projects
# -> http://localhost:3000/api/public/events
# -> http://localhost:3000/api/public/ecosystem
```

The shared logic lives in [api/_public.ts](api/_public.ts) and reads
directly from `src/data/projects.json` and `src/data/appEvents.ts`,
so updating the catalog is enough — no extra deploy step is needed
for the API.

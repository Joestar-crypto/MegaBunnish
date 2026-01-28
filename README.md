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

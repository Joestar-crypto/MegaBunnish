/**
 * Shared logic for the public read-only MegaBunnish API.
 *
 * Exposes a curated, JSON-only view of the MegaETH ecosystem data that
 * powers https://megabunnish.com so that third parties can build
 * dashboards, bots and integrations without scraping the site.
 *
 * All endpoints are read-only, unauthenticated and rate-friendly:
 * responses are cacheable for a few minutes via standard HTTP headers.
 */

import projectsData from '../src/data/projects.json';
import { APP_EVENTS, type AppEvent } from '../src/data/appEvents';

export type PublicIncentive = {
  id: string;
  title: string;
  reward?: string;
  expiresAt?: string;
};

export type PublicProject = {
  id: string;
  name: string;
  categories: string[];
  networks: string[];
  links: Record<string, string>;
  logo?: string;
  isLive: boolean;
  incentives: PublicIncentive[];
};

type RawProject = {
  id: string;
  name: string;
  categories?: string[];
  networks?: string[];
  links?: Record<string, string>;
  logo?: string;
  isLive?: boolean;
  incentives?: PublicIncentive[];
};

const RAW_PROJECTS = projectsData as RawProject[];

const DEFAULT_CACHE_HEADERS: Record<string, string> = {
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function normalizeProject(raw: RawProject): PublicProject {
  return {
    id: raw.id,
    name: raw.name,
    categories: raw.categories ?? [],
    networks: raw.networks ?? [],
    links: raw.links ?? {},
    logo: raw.logo,
    isLive: Boolean(raw.isLive),
    incentives: (raw.incentives ?? []).filter((incentive) => {
      if (!incentive.expiresAt) return true;
      const expiresAt = Date.parse(incentive.expiresAt);
      return Number.isNaN(expiresAt) ? true : expiresAt >= Date.now();
    })
  };
}

const ALL_PROJECTS: PublicProject[] = RAW_PROJECTS.map(normalizeProject);

function readQuery(query: unknown, key: string): string | undefined {
  if (!query || typeof query !== 'object') return undefined;
  const value = (query as Record<string, unknown>)[key];
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim() || undefined;
  return undefined;
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (/^(1|true|yes)$/i.test(value)) return true;
  if (/^(0|false|no)$/i.test(value)) return false;
  return undefined;
}

export type PublicQuery = Record<string, string | string[] | undefined>;

export function listProjects(query: PublicQuery = {}) {
  const id = readQuery(query, 'id');
  const category = readQuery(query, 'category');
  const network = readQuery(query, 'network');
  const live = parseBool(readQuery(query, 'live'));
  const search = readQuery(query, 'q')?.toLowerCase();

  let result = ALL_PROJECTS;

  if (id) {
    result = result.filter((project) => project.id === id);
  }
  if (category) {
    const needle = category.toLowerCase();
    result = result.filter((project) =>
      project.categories.some((entry) => entry.toLowerCase() === needle)
    );
  }
  if (network) {
    const needle = network.toLowerCase();
    result = result.filter((project) =>
      project.networks.some((entry) => entry.toLowerCase() === needle)
    );
  }
  if (live !== undefined) {
    result = result.filter((project) => project.isLive === live);
  }
  if (search) {
    result = result.filter((project) =>
      project.name.toLowerCase().includes(search) || project.id.toLowerCase().includes(search)
    );
  }

  return {
    count: result.length,
    total: ALL_PROJECTS.length,
    projects: result
  };
}

export function listEvents(query: PublicQuery = {}) {
  const projectId = readQuery(query, 'projectId');
  const upcoming = parseBool(readQuery(query, 'upcoming'));
  const past = parseBool(readQuery(query, 'past'));
  const now = Date.now();

  let result: AppEvent[] = [...APP_EVENTS];

  if (projectId) {
    result = result.filter((event) => event.projectId === projectId);
  }
  if (upcoming === true) {
    result = result.filter((event) => {
      const reference = Date.parse(event.end ?? event.start);
      return Number.isNaN(reference) ? true : reference >= now;
    });
  }
  if (past === true) {
    result = result.filter((event) => {
      const reference = Date.parse(event.end ?? event.start);
      return !Number.isNaN(reference) && reference < now;
    });
  }

  result.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  return {
    count: result.length,
    total: APP_EVENTS.length,
    events: result
  };
}

export function getEcosystemSummary() {
  const categories = new Map<string, number>();
  const networks = new Map<string, number>();
  let liveCount = 0;
  let activeIncentives = 0;

  for (const project of ALL_PROJECTS) {
    if (project.isLive) liveCount += 1;
    activeIncentives += project.incentives.length;
    for (const category of project.categories) {
      categories.set(category, (categories.get(category) ?? 0) + 1);
    }
    for (const network of project.networks) {
      networks.set(network, (networks.get(network) ?? 0) + 1);
    }
  }

  const upcomingEvents = APP_EVENTS.filter((event) => {
    const reference = Date.parse(event.end ?? event.start);
    return Number.isNaN(reference) ? true : reference >= Date.now();
  }).length;

  return {
    chain: 'MegaETH',
    chainId: 6342,
    projects: {
      total: ALL_PROJECTS.length,
      live: liveCount,
      activeIncentives
    },
    events: {
      total: APP_EVENTS.length,
      upcoming: upcomingEvents
    },
    categories: Object.fromEntries(
      Array.from(categories.entries()).sort((a, b) => b[1] - a[1])
    ),
    networks: Object.fromEntries(
      Array.from(networks.entries()).sort((a, b) => b[1] - a[1])
    ),
    generatedAt: new Date().toISOString()
  };
}

export function publicJsonHeaders(extra: Record<string, string> = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    ...DEFAULT_CACHE_HEADERS,
    ...extra
  };
}

export function publicJsonResponse(payload: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: publicJsonHeaders(extra)
  });
}

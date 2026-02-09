import fs from 'node:fs';
import path from 'node:path';

const ETHOS_ENDPOINT = 'https://api.ethos.network/api/v2/apps';
const ETHOS_CLIENT = 'Megabunnish';
const PAGE_SIZE = 50;

const projectsPath = path.join(process.cwd(), 'src', 'data', 'projects.json');
const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));

const normalizeTwitterHandle = (value) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().replace(/^@+/, '');
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return normalized || null;
};

const isTwitterHost = (host) => host === 'twitter.com' || host === 'x.com';

const extractTwitterHandleFromUrl = (link) => {
  if (!link) {
    return null;
  }
  try {
    const url = new URL(link);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (!isTwitterHost(host)) {
      return null;
    }
    const segments = url.pathname.split('/').filter(Boolean);
    if (!segments.length) {
      return null;
    }
    return normalizeTwitterHandle(segments[0]);
  } catch {
    return null;
  }
};

const slugify = (value) => {
  if (!value) {
    return '';
  }
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, '');
};

const normalizeHost = (link) => {
  if (!link) {
    return null;
  }
  try {
    const url = new URL(link);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
};

const buildIndex = () => {
  const twitterMap = new Map();
  const hostMap = new Map();
  const slugMap = new Map();

  projects.forEach((project) => {
    const ref = {
      id: project.id,
      name: project.name,
      logo: project.logo,
      slug: slugify(project.name),
      host: normalizeHost(project.links?.site ?? null),
      twitterHandle: extractTwitterHandleFromUrl(project.links?.twitter ?? null)
    };

    if (ref.twitterHandle) {
      const entries = twitterMap.get(ref.twitterHandle) ?? [];
      entries.push(ref);
      twitterMap.set(ref.twitterHandle, entries);
    }

    if (ref.host) {
      const entries = hostMap.get(ref.host) ?? [];
      entries.push(ref);
      hostMap.set(ref.host, entries);
    }

    if (ref.slug) {
      const entries = slugMap.get(ref.slug) ?? [];
      entries.push(ref);
      slugMap.set(ref.slug, entries);
    }
  });

  return { twitterMap, hostMap, slugMap };
};

const matchProject = (app, index) => {
  const twitterHandle =
    normalizeTwitterHandle(app.author?.username ?? null) ?? extractTwitterHandleFromUrl(app.link ?? null);
  if (twitterHandle) {
    const matches = index.twitterMap.get(twitterHandle);
    if (matches?.length) {
      if (matches.length === 1) {
        return matches[0];
      }
      const slug = slugify(app.name);
      return matches.find((candidate) => candidate.slug === slug) ?? matches[0];
    }
  }

  const host = normalizeHost(app.link ?? null);
  if (host) {
    const matches = index.hostMap.get(host);
    if (matches?.length) {
      if (matches.length === 1) {
        return matches[0];
      }
      const slug = slugify(app.name);
      return matches.find((candidate) => candidate.slug === slug) ?? matches[0];
    }
  }

  const slug = slugify(app.name);
  const matches = index.slugMap.get(slug);
  if (matches?.length) {
    return matches[0];
  }
  return null;
};

const fetchAllEthosApps = async () => {
  const collected = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (collected.length < total) {
    const response = await fetch(`${ETHOS_ENDPOINT}?limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: {
        'X-Ethos-Client': ETHOS_CLIENT
      }
    });

    if (!response.ok) {
      throw new Error(`Ethos API error ${response.status}`);
    }

    const payload = await response.json();
    collected.push(...payload.values);
    total = payload.total;
    offset += PAGE_SIZE;

    if (!payload.values.length) {
      break;
    }
  }

  return collected;
};

const main = async () => {
  const index = buildIndex();
  const apps = await fetchAllEthosApps();
  const seen = new Set();
  const matched = [];

  apps.forEach((app) => {
    const match = matchProject(app, index);
    if (!match || seen.has(match.id)) {
      return;
    }
    seen.add(match.id);
    matched.push({
      projectId: match.id,
      projectName: match.name,
      twitterHandle: match.twitterHandle,
      ethosName: app.name,
      trustScore: Math.round(app.author?.score ?? 0),
      authorDisplayName: app.author?.displayName ?? 'Auteur inconnu',
      authorUsername: app.author?.username ?? null
    });
  });

  matched.sort((a, b) => b.trustScore - a.trustScore);
  console.log(JSON.stringify(matched, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

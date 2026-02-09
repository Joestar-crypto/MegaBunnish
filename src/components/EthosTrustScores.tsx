import { useEffect, useMemo, useRef, useState } from 'react';
import { ETHOS_PROFILE_OVERRIDES } from '../data/ethosManualProfiles';
import rawProjects from '../data/projects.json';
import { useConstellation } from '../state/constellation';
import type { RawProject } from '../types';

type EthosAppPayload = {
  id: number;
  name: string;
  appType: string;
  link?: string | null;
  author?: {
    displayName?: string | null;
    username?: string | null;
    score?: number | null;
  } | null;
};

type EthosResponse = {
  values: EthosAppPayload[];
  total: number;
  limit: number;
  offset: number;
};

type EthosApp = {
  id: number;
  name: string;
  appType: string;
  link: string | null;
  trustScore: number;
  authorName: string;
  authorUsername: string | null;
};

type EcosystemEthosApp = EthosApp & {
  projectId: string;
  projectName: string;
  projectLogo: string;
};

const ETHOS_ENDPOINT = 'https://api.ethos.network/api/v2/apps';
const ETHOS_CLIENT_HEADER = 'Megabunnish';
const PAGE_SIZE = 50;
const ETHOS_FILTERS = [
  { label: '> 1600', value: 1600 },
  { label: '> 1400', value: 1400 },
  { label: '> 1200', value: 1200 }
];

const getFilterToneClass = (value: number) => {
  if (value >= 1600) {
    return 'ethos-filter-pill--tone-1600';
  }
  if (value >= 1400) {
    return 'ethos-filter-pill--tone-1400';
  }
  return 'ethos-filter-pill--tone-1200';
};

type EcosystemProjectRef = {
  id: string;
  name: string;
  slug: string;
  logo: string;
  host: string | null;
  twitterHandle: string | null;
};

const ECOSYSTEM_PROJECTS = rawProjects as RawProject[];

const slugifyName = (value?: string | null) => {
  if (!value) {
    return '';
  }
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, '');
};

const normalizeHost = (link?: string | null) => {
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

const isTwitterHost = (host: string) => host === 'twitter.com' || host === 'x.com';

const normalizeTwitterHandle = (value?: string | null) => {
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

const extractTwitterHandleFromUrl = (link?: string | null) => {
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

const mapProjectToRef = (project: RawProject): EcosystemProjectRef => ({
  id: project.id,
  name: project.name,
  slug: slugifyName(project.name),
  logo: project.logo,
  host: normalizeHost(project.links?.site ?? null),
  twitterHandle: extractTwitterHandleFromUrl(project.links?.twitter ?? null)
});

const ECOSYSTEM_PROJECT_REFS = ECOSYSTEM_PROJECTS.map(mapProjectToRef);
const PROJECT_REF_BY_ID = new Map(ECOSYSTEM_PROJECT_REFS.map((ref) => [ref.id, ref]));

const buildEcosystemIndex = () => {
  const slugMap = new Map<string, EcosystemProjectRef[]>();
  const hostMap = new Map<string, EcosystemProjectRef[]>();
  const twitterMap = new Map<string, EcosystemProjectRef[]>();

  ECOSYSTEM_PROJECT_REFS.forEach((ref) => {
    const { slug, host, twitterHandle } = ref;

    if (slug) {
      const candidates = slugMap.get(slug) ?? [];
      candidates.push(ref);
      slugMap.set(slug, candidates);
    }

    if (host) {
      const candidates = hostMap.get(host) ?? [];
      candidates.push(ref);
      hostMap.set(host, candidates);
    }

    if (twitterHandle) {
      const candidates = twitterMap.get(twitterHandle) ?? [];
      candidates.push(ref);
      twitterMap.set(twitterHandle, candidates);
    }
  });

  return { slugMap, hostMap, twitterMap };
};

type EcosystemIndex = ReturnType<typeof buildEcosystemIndex>;

const matchEthosAppToProject = (app: EthosApp, index: EcosystemIndex): EcosystemProjectRef | null => {
  const matchByTwitterHandle = (handle: string | null) => {
    const normalized = normalizeTwitterHandle(handle);
    if (!normalized) {
      return null;
    }
    const matches = index.twitterMap.get(normalized);
    if (!matches?.length) {
      return null;
    }
    if (matches.length === 1) {
      return matches[0];
    }
    const slug = slugifyName(app.name);
    if (slug) {
      const slugCandidate = matches.find((candidate) => candidate.slug === slug);
      if (slugCandidate) {
        return slugCandidate;
      }
    }
    return matches[0];
  };

  const handleFromAuthor = matchByTwitterHandle(app.authorUsername);
  if (handleFromAuthor) {
    return handleFromAuthor;
  }

  const handleFromLink = matchByTwitterHandle(extractTwitterHandleFromUrl(app.link));
  if (handleFromLink) {
    return handleFromLink;
  }

  const host = normalizeHost(app.link);
  if (host) {
    const hostMatches = index.hostMap.get(host);
    if (hostMatches?.length) {
      if (hostMatches.length === 1) {
        return hostMatches[0];
      }
      const slug = slugifyName(app.name);
      return hostMatches.find((candidate) => candidate.slug === slug) ?? hostMatches[0];
    }
  }

  const slug = slugifyName(app.name);
  if (!slug) {
    return null;
  }
  const slugMatches = index.slugMap.get(slug);
  if (!slugMatches?.length) {
    return null;
  }
  if (slugMatches.length === 1) {
    return slugMatches[0];
  }
  return slugMatches[0];
};

const buildManualEthosApps = (index: EcosystemIndex): EcosystemEthosApp[] => {
  return ETHOS_PROFILE_OVERRIDES.reduce<EcosystemEthosApp[]>((acc, profile, entryIndex) => {
    const manualApp: EthosApp = {
      id: -(entryIndex + 1),
      name: profile.displayName ?? profile.handle,
      appType: profile.tier ? `Profil ${profile.tier}` : 'Profil Ethos',
      link: profile.url ?? null,
      trustScore: profile.score,
      authorName: profile.tier ?? 'Profil Ethos',
      authorUsername: profile.handle
    };

    let projectRef: EcosystemProjectRef | null = null;
    if (profile.projectId) {
      projectRef = PROJECT_REF_BY_ID.get(profile.projectId) ?? null;
    }
    if (!projectRef) {
      projectRef = matchEthosAppToProject(manualApp, index);
    }
    if (!projectRef) {
      console.warn('Impossible de faire correspondre le profil Ethos manuel', profile.handle);
      return acc;
    }

    acc.push({
      ...manualApp,
      projectId: projectRef.id,
      projectName: projectRef.name,
      projectLogo: projectRef.logo
    });
    return acc;
  }, []);
};

const extractEthosErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    if (payload && typeof payload.message === 'string' && payload.message.trim().length > 0) {
      return payload.message;
    }
  } catch (parseError) {
    console.warn('Unable to parse Ethos error payload', parseError);
  }
  return response.statusText || 'Ethos API error.';
};

const fetchAllEthosApps = async (): Promise<EthosApp[]> => {
  const collected: EthosAppPayload[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (collected.length < total) {
    const response = await fetch(`${ETHOS_ENDPOINT}?limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: { 'X-Ethos-Client': ETHOS_CLIENT_HEADER }
    });

    if (!response.ok) {
      const details = await extractEthosErrorMessage(response);
      throw new Error(details);
    }

    const payload: EthosResponse = await response.json();
    collected.push(...payload.values);
    total = payload.total;
    offset += PAGE_SIZE;

    if (!payload.values.length) {
      break;
    }
  }

  return collected
    .map((app) => ({
      id: app.id,
      name: app.name,
      appType: app.appType,
      link: app.link ?? null,
      trustScore: Math.round(app.author?.score ?? 0),
      authorName: app.author?.displayName ?? 'Auteur inconnu',
      authorUsername: app.author?.username ?? null
    }))
    .sort((a, b) => b.trustScore - a.trustScore);
};

export const EthosTrustScores = () => {
  const [areScoresVisible, setScoresVisible] = useState(false);
  const [apps, setApps] = useState<EthosApp[]>([]);
  const hasFetchedRef = useRef(false);
  const {
    setEthosScores,
    setEthosOverlayActive,
    setEthosProfileLinks,
    ethosScoreThreshold,
    setEthosScoreThreshold
  } = useConstellation();

  const ecosystemIndex = useMemo(() => buildEcosystemIndex(), []);
  const matchedApps = useMemo<EcosystemEthosApp[]>(() => {
    if (!apps.length) {
      return [];
    }
    const seen = new Set<string>();
    return apps.reduce<EcosystemEthosApp[]>((acc, app) => {
      const match = matchEthosAppToProject(app, ecosystemIndex);
      if (!match || seen.has(match.id)) {
        return acc;
      }
      seen.add(match.id);
      acc.push({
        ...app,
        projectId: match.id,
        projectName: match.name,
        projectLogo: match.logo
      });
      return acc;
    }, []);
  }, [apps, ecosystemIndex]);

  const manualApps = useMemo(() => buildManualEthosApps(ecosystemIndex), [ecosystemIndex]);
  const combinedApps = useMemo<EcosystemEthosApp[]>(() => {
    if (!manualApps.length && !matchedApps.length) {
      return [];
    }
    const appByProjectId = new Map<string, EcosystemEthosApp>();
    manualApps.forEach((entry) => appByProjectId.set(entry.projectId, entry));
    matchedApps.forEach((entry) => appByProjectId.set(entry.projectId, entry));
    return Array.from(appByProjectId.values()).sort((a, b) => b.trustScore - a.trustScore);
  }, [manualApps, matchedApps]);

  useEffect(() => {
    if (!areScoresVisible || hasFetchedRef.current) {
      return;
    }

    let isActive = true;

    fetchAllEthosApps()
      .then((data) => {
        if (!isActive) {
          return;
        }
        setApps(data);
        hasFetchedRef.current = true;
      })
      .catch((fetchError) => {
        if (!isActive) {
          return;
        }
        console.error('Impossible de recuperer les trust scores Ethos', fetchError);
      });

    return () => {
      isActive = false;
    };
  }, [areScoresVisible]);

  useEffect(() => {
    if (!combinedApps.length) {
      setEthosScores({});
      setEthosProfileLinks({});
      return;
    }
    const { scores, links } = combinedApps.reduce(
      (acc, app) => {
        acc.scores[app.projectId] = app.trustScore;
        acc.links[app.projectId] = app.link ?? null;
        return acc;
      },
      { scores: {} as Record<string, number>, links: {} as Record<string, string | null> }
    );
    setEthosScores(scores);
    setEthosProfileLinks(links);
  }, [combinedApps, setEthosProfileLinks, setEthosScores]);

  useEffect(() => {
    setEthosOverlayActive(areScoresVisible);
    return () => {
      setEthosOverlayActive(false);
    };
  }, [areScoresVisible, setEthosOverlayActive]);

  useEffect(() => {
    if (!areScoresVisible && ethosScoreThreshold !== null) {
      setEthosScoreThreshold(null);
    }
  }, [areScoresVisible, ethosScoreThreshold, setEthosScoreThreshold]);

  const handleToggle = () => {
    setScoresVisible((prev) => !prev);
  };

  const handleFilterSelect = (threshold: number) => {
    const nextValue = ethosScoreThreshold === threshold ? null : threshold;
    setEthosScoreThreshold(nextValue);
  };

  return (
    <div className="ethos-trust-widget">
      <button
        type="button"
        className="ethos-trust-button"
        onClick={handleToggle}
        aria-pressed={areScoresVisible}
        aria-label="Basculer les trust scores Ethos"
        title={areScoresVisible ? 'Masquer les trust scores sur les orbes' : 'Afficher les trust scores sur les orbes'}
      >
        <img src="/logos/Ethos.webp" alt="" />
      </button>
      {areScoresVisible ? (
        <div className="ethos-filter-bar" role="group" aria-label="Filtrer les trust scores Ethos">
          {ETHOS_FILTERS.map((filter) => {
            const isActive = ethosScoreThreshold === filter.value;
            const toneClass = getFilterToneClass(filter.value);
            return (
              <button
                key={filter.value}
                type="button"
                className={`ethos-filter-pill ${toneClass}${isActive ? ' ethos-filter-pill--active' : ''}`}
                onClick={() => handleFilterSelect(filter.value)}
                aria-pressed={isActive}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

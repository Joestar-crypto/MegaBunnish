import { useEffect, useMemo, useRef, useState } from 'react';
import { APP_EVENTS, type AppEvent } from '../data/appEvents';
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

const EVENT_TIMEZONE = 'America/New_York';

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
const PROJECT_BY_ID = new Map(ECOSYSTEM_PROJECTS.map((project) => [project.id, project]));

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
      appType: profile.tier ? `Profile ${profile.tier}` : 'Ethos profile',
      link: profile.url ?? null,
      trustScore: profile.score,
      authorName: profile.tier ?? 'Ethos profile',
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
      console.warn('Unable to match manual Ethos profile', profile.handle);
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

const toCalendarDateString = (value: string) => {
  const date = new Date(value);
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

const buildGoogleCalendarUrl = (event: AppEvent, projectName: string) => {
  const end = event.end ?? event.start;
  const phaseLines = event.phases
    .map((phase) => `${phase.label}: ${formatEventDateRange(phase.start, phase.end)}`)
    .join('\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${projectName} - ${event.title}`,
    dates: `${toCalendarDateString(event.start)}/${toCalendarDateString(end)}`,
    details: `${event.title}\n${phaseLines ? `\n${phaseLines}\n` : ''}\nTweet: ${event.tweetUrl}`,
    ctz: EVENT_TIMEZONE
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const EVENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: EVENT_TIMEZONE
});

const EVENT_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: EVENT_TIMEZONE
});

const formatEventDateRange = (start: string, end?: string) => {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const startLabel = EVENT_DATE_FORMATTER.format(startDate);
  if (!endDate || Number.isNaN(endDate.getTime())) {
    return startLabel;
  }
  const endLabel = EVENT_DATE_FORMATTER.format(endDate);
  const startTime = EVENT_TIME_FORMATTER.format(startDate);
  const endTime = EVENT_TIME_FORMATTER.format(endDate);
  const isSameDay = startLabel === endLabel;
  const isAllDay = isSameDay && startTime === '12:00 AM' && endTime === '11:59 PM';

  if (isAllDay) {
    return `${startLabel} · All day`;
  }
  if (isSameDay) {
    return `${startLabel} · ${startTime}-${endTime}`;
  }
  return `${startLabel} - ${endLabel}`;
};

const formatEventTimeRange = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startTime = EVENT_TIME_FORMATTER.format(startDate);
  const endTime = EVENT_TIME_FORMATTER.format(endDate);
  const isAllDay = startTime === '12:00 AM' && endTime === '11:59 PM';
  return isAllDay ? 'All day' : `${startTime}-${endTime}`;
};

const formatCountdown = (start: string, end?: string, nowMs?: number) => {
  if (!end) {
    return null;
  }
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return null;
  }
  const now = nowMs ?? Date.now();
  const isUpcoming = startTime > now;
  const targetTime = isUpcoming ? startTime : endTime;
  const diffMs = targetTime - now;
  if (diffMs <= 0 && !isUpcoming) {
    return 'Ended';
  }
  if (diffMs > 28 * 24 * 60 * 60 * 1000) {
    return '?';
  }
  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  if (days === 0 && hours === 0) {
    parts.push(`${minutes}m`);
  }
  return isUpcoming ? `Starts in ${parts.join(' ')}` : `Ends in ${parts.join(' ')}`;
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
      authorName: app.author?.displayName ?? 'Unknown author',
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
        console.error('Unable to fetch Ethos trust scores', fetchError);
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
        aria-label="Toggle Ethos trust scores"
        title={areScoresVisible ? 'Hide trust scores on orbs' : 'Show trust scores on orbs'}
      >
        <img src="/logos/Ethos.webp" alt="" />
      </button>
      {areScoresVisible ? (
        <div className="ethos-filter-bar" role="group" aria-label="Filter Ethos trust scores">
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

export const EventsBell = () => {
  const [areEventsVisible, setEventsVisible] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const { selectProject } = useConstellation();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const upcomingEvents = useMemo(() => {
    return APP_EVENTS
      .filter((event) => {
        const endValue = event.end ?? event.start;
        return new Date(endValue).getTime() > nowTick;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [nowTick]);

  const hasUpcomingEvents = upcomingEvents.length > 0;

  const handleEventsToggle = () => {
    setEventsVisible((prev) => !prev);
  };

  const handleEventProjectClick = (projectId: string) => {
    selectProject(projectId);
    setEventsVisible(false);
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!areEventsVisible) {
      return;
    }

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      if (!container.contains(event.target as Node)) {
        setEventsVisible(false);
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
    };
  }, [areEventsVisible]);

  return (
    <div className="events-bell" ref={containerRef}>
      <button
        type="button"
        className={`ethos-events-button${hasUpcomingEvents ? ' ethos-events-button--active' : ''}${areEventsVisible ? ' ethos-events-button--open' : ''}`}
        onClick={handleEventsToggle}
        aria-pressed={areEventsVisible}
        aria-label="Open events"
        title={areEventsVisible ? 'Hide events' : 'Show events'}
      >
        <img src="/icons/bell.svg" alt="" />
        {hasUpcomingEvents ? (
          <span className="ethos-events-button__badge" aria-label={`${upcomingEvents.length} upcoming events`}>
            {upcomingEvents.length}
          </span>
        ) : null}
      </button>
      {areEventsVisible ? (
        <div className="ethos-events-panel" role="dialog" aria-label="Upcoming events">
          <div className="ethos-events-panel__header">
            <div>
              <h3>Events</h3>
            </div>
            <button
              type="button"
              className="ethos-events-panel__close"
              onClick={handleEventsToggle}
              aria-label="Close events"
            >
              Close
            </button>
          </div>
          {upcomingEvents.length ? (
            <ul className="ethos-events-panel__list">
              {upcomingEvents.map((event) => {
                const project = PROJECT_BY_ID.get(event.projectId);
                const projectName = project?.name ?? event.projectId;
                const calendarUrl = buildGoogleCalendarUrl(event, projectName);
                const countdownLabel = formatCountdown(event.start, event.end, nowTick);
                return (
                  <li key={event.id} className="ethos-events-panel__item">
                    <div className="ethos-events-panel__meta">
                      <button
                        type="button"
                        className="ethos-events-panel__logo"
                        onClick={() => handleEventProjectClick(event.projectId)}
                        aria-label={`Open ${projectName}`}
                      >
                        <img src={project?.logo ?? '/logos/MegaETH.webp'} alt={projectName} />
                      </button>
                      <div>
                        <div className="ethos-events-panel__title">{event.title}</div>
                        <div className="ethos-events-panel__details">
                          <span>{formatEventDateRange(event.start, event.end)}</span>
                          <span className="ethos-events-panel__divider" aria-hidden="true">
                            •
                          </span>
                          <span>{projectName}</span>
                        </div>
                        <div className="ethos-events-panel__phases">
                          {event.phases.map((phase) => (
                            <div key={phase.label} className="ethos-events-panel__phase">
                              <span className="ethos-events-panel__phase-label">{phase.label}</span>
                              <span className="ethos-events-panel__phase-time">
                                {formatEventTimeRange(phase.start, phase.end)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {countdownLabel ? (
                        <div className="ethos-events-panel__countdown" aria-label={countdownLabel}>
                          {countdownLabel}
                        </div>
                      ) : null}
                    </div>
                    <div className="ethos-events-panel__actions">
                      <a
                        className="ethos-events-panel__action"
                        href={calendarUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Google Calendar
                      </a>
                      <a
                        className="ethos-events-panel__action"
                        href={event.detailsUrl ?? event.tweetUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Details
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="ethos-events-panel__empty">No upcoming events.</div>
          )}
        </div>
      ) : null}
    </div>
  );
};

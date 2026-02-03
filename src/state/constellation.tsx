import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import rawProjects from '../data/projects.json';
import { DEFAULT_JOJO_PROFILE_ID, JOJO_PROFILES } from '../data/jojoProfiles';
import {
  CameraState,
  ConstellationProject,
  ConstellationState,
  HighlightVariant,
  Incentive,
  JojoProfile,
  RawProject,
  SpecialFilters
} from '../types';
import { useWalletInsights, WalletInsights } from './useWalletInsights';

export const CORE_CATEGORIES = [
  'Gambling',
  'Depin',
  'DeFi',
  'Trading',
  'Meme',
  'NFT',
  'Gaming',
  'Social',
  'Launchpad',
  'Tools',
  'Prediction M.',
  'AI',
  'Mobile'
] as const;

const SPECIAL_CATEGORIES = ['Megamafia', 'Native', 'Jojo'] as const;

type CoreCategory = (typeof CORE_CATEGORIES)[number];
type SpecialCategory = (typeof SPECIAL_CATEGORIES)[number];
type CanonicalCategory = CoreCategory | SpecialCategory;

const DEFAULT_CORE_CATEGORY: CoreCategory = 'DeFi';

const CORE_LOOKUP = CORE_CATEGORIES.reduce<Record<string, CoreCategory>>((acc, category) => {
  acc[category.toLowerCase()] = category;
  return acc;
}, {});

const CATEGORY_ALIASES: Record<string, CanonicalCategory> = {
  gaming: 'Gaming',
  defi: 'DeFi',
  lending: 'DeFi',
  stablecoins: 'DeFi',
  dex: 'Trading',
  perps: 'Trading',
  'perps/trading': 'Trading',
  trading: 'Trading',
  meme: 'Meme',
  memes: 'Meme',
  nft: 'NFT',
  nfts: 'NFT',
  collectible: 'NFT',
  collectibles: 'NFT',
  depin: 'Depin',
  gambling: 'Gambling',
  gatcha: 'Gambling',
  casino: 'Gambling',
  ai: 'AI',
  tools: 'Tools',
  tool: 'Tools',
  launchpad: 'Launchpad',
  launchpads: 'Launchpad',
  social: 'Social',
  socials: 'Social',
  community: 'Social',
  prediction: 'Prediction M.',
  'prediction market': 'Prediction M.',
  'prediction-market': 'Prediction M.',
  'prediction m.': 'Prediction M.',
  megmafia: 'Megamafia',
  megamafia: 'Megamafia',
  'badbunnz': 'Megamafia',
  payment: 'Megamafia',
  jojo: 'Jojo',
  mobile: 'Mobile',
  native: 'Native'
};

const canonicalizeCategory = (label: string): CanonicalCategory | null => {
  const normalized = label.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (CATEGORY_ALIASES[normalized]) {
    return CATEGORY_ALIASES[normalized];
  }
  if (CORE_LOOKUP[normalized]) {
    return CORE_LOOKUP[normalized];
  }
  return null;
};

const SPECIAL_DEFAULTS: SpecialFilters = { megamafia: false, jojo: false, mobile: false, native: false };

const JOJO_PROFILE_LOOKUP = JOJO_PROFILES.reduce<Record<string, JojoProfile>>((acc, profile) => {
  acc[profile.id] = profile;
  return acc;
}, {});

const resolveJojoProfile = (profileId?: string): JojoProfile => {
  if (profileId && JOJO_PROFILE_LOOKUP[profileId]) {
    return JOJO_PROFILE_LOOKUP[profileId];
  }
  return JOJO_PROFILE_LOOKUP[DEFAULT_JOJO_PROFILE_ID];
};

type ProjectCategoryMeta = {
  primary: CoreCategory;
  categories: CoreCategory[];
  traits: SpecialFilters;
};

const toCategoryMeta = (labels: string[]): ProjectCategoryMeta => {
  const categories: CoreCategory[] = [];
  const traits: SpecialFilters = { ...SPECIAL_DEFAULTS };

  labels.forEach((label) => {
    const canonical = canonicalizeCategory(label);
    if (!canonical) {
      return;
    }
    if (canonical === 'Megamafia') {
      traits.megamafia = true;
      return;
    }
    if (canonical === 'Jojo') {
      traits.jojo = true;
      return;
    }
    if (canonical === 'Native') {
      traits.native = true;
      return;
    }
    if (canonical === 'Mobile') {
      traits.mobile = true;
    }
    if (!categories.includes(canonical)) {
      categories.push(canonical);
    }
  });

  if (categories.length === 0) {
    categories.push(DEFAULT_CORE_CATEGORY);
  }

  return { primary: categories[0], categories, traits };
};

const applySpecialFilters = (
  projects: ConstellationProject[],
  filters: SpecialFilters,
  jojoProfileId: string
) => {
  if (!filters.megamafia && !filters.jojo && !filters.mobile && !filters.native) {
    return projects;
  }
  return projects.filter((project) => {
    if (filters.megamafia && !project.traits.megamafia) {
      return false;
    }
    if (filters.jojo) {
      if (!project.traits.jojo) {
        return false;
      }
      const profile = resolveJojoProfile(jojoProfileId);
      if (profile.projectIds?.length && !profile.projectIds.includes(project.id)) {
        return false;
      }
    }
    if (filters.mobile && !project.traits.mobile) {
      return false;
    }
    if (filters.native && !project.traits.native) {
      return false;
    }
    return true;
  });
};

const shouldAggregateFilters = (filters: SpecialFilters) =>
  filters.megamafia || filters.jojo || filters.mobile || filters.native;

const cloneProject = (project: ConstellationProject): ConstellationProject => ({
  ...project,
  position: { ...project.position },
  clusterOrigin: { ...project.clusterOrigin },
  linkedIds: [...project.linkedIds]
});

const cloneProjects = (projects: ConstellationProject[]) => projects.map(cloneProject);

const toRawProjectSnapshot = (project: ConstellationProject): RawProject => ({
  id: project.id,
  name: project.name,
  categories: [...project.categories],
  networks: [...project.networks],
  links: { ...project.links },
  logo: project.logo,
  incentives: project.incentives.length ? [...project.incentives] : undefined,
  linkedIds: project.linkedIds.length ? [...project.linkedIds] : undefined
});

const toRawProjectSet = (projects: ConstellationProject[]) => projects.map(toRawProjectSnapshot);

const computeProjectsCentroid = (projects: ConstellationProject[]) => {
  if (projects.length === 0) {
    return { x: 0, y: 0 };
  }
  const totals = projects.reduce(
    (acc, project) => {
      acc.x += project.position.x;
      acc.y += project.position.y;
      return acc;
    },
    { x: 0, y: 0 }
  );
  return { x: totals.x / projects.length, y: totals.y / projects.length };
};

const compressProjects = (projects: ConstellationProject[], scale: number) => {
  if (projects.length === 0 || scale === 1) {
    return projects;
  }
  const centroid = computeProjectsCentroid(projects);
  return projects.map((project) => ({
    ...project,
    position: {
      x: (project.position.x - centroid.x) * scale,
      y: (project.position.y - centroid.y) * scale
    },
    clusterOrigin: {
      x: (project.clusterOrigin.x - centroid.x) * scale,
      y: (project.clusterOrigin.y - centroid.y) * scale
    }
  }));
};

const deriveCategoryCounts = (projects: ConstellationProject[]): Record<string, number> => {
  const counts = CORE_CATEGORIES.reduce<Record<string, number>>((acc, category) => {
    acc[category] = 0;
    return acc;
  }, {});
  projects.forEach((project) => {
    project.categories.forEach((category) => {
      if (counts[category] !== undefined) {
        counts[category] += 1;
      }
    });
  });
  return counts;
};

const filterProjectsByCategory = (
  projects: ConstellationProject[],
  category: string | null
) => {
  if (!category) {
    return projects;
  }
  return projects.filter((project) => project.categories.includes(category as CoreCategory));
};
const CATEGORY_ANCHOR_RADIUS = 260;
const CLUSTER_RADIUS_PADDING = 60;
const CLUSTER_COLLISION_ITERATIONS = 12;
const CLUSTER_PULL_STRENGTH = 0.18;
const ORBIT_BASE_RADIUS = 95;
const ORBIT_RING_GAP = 70;
const BASE_RING_SLOTS = 8;
const RING_SLOT_GROWTH = 3;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.4;
const NODE_RELAX_ITERATIONS = 6;
const MIN_NODE_SPACING = 90;
const CAMERA_BASE_ZOOM = 640;
const CAMERA_SPREAD_PADDING = 260;
const SELECT_FOCUS_ZOOM = 1.55;
const FAVORITES_CLUSTER_SCALE = 0.55;

const SPECIAL_LINKS: Record<string, string[]> = {
  'bad-bunnz': ['prismfi', 'bunnzpaw', 'faster'],
  megalio: ['priority']
};

const EXCLUSIVE_LINKS: Record<string, string[]> = {
  priority: ['megalio']
};

const ECOSYSTEM_HIGHLIGHTS: Record<string, HighlightVariant> = {
  'bad-bunnz': 'badbunnz',
  prismfi: 'badbunnz',
  faster: 'badbunnz',
  bunnzpaw: 'badbunnz',
  megalio: 'megalio',
  priority: 'megalio'
};

const FAVORITES_STORAGE_KEY = 'constellation:favorites';
const baseProjects = rawProjects as RawProject[];

const readStoredFavorites = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
};

type ClusterLayoutMeta = {
  anchor: { x: number; y: number };
  radius: number;
};

const resolveClusterAnchors = (clusters: Record<string, ClusterLayoutMeta>) => {
  const entries = Object.entries(clusters).map(([category, meta]) => ({
    category,
    position: { ...meta.anchor },
    radius: meta.radius
  }));

  if (entries.length < 2) {
    return entries.reduce((acc, entry) => {
      acc[entry.category] = entry.position;
      return acc;
    }, {} as Record<string, { x: number; y: number }>);
  }

  for (let iteration = 0; iteration < CLUSTER_COLLISION_ITERATIONS; iteration += 1) {
    let moved = false;

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const current = entries[i];
        const other = entries[j];
        const dx = other.position.x - current.position.x;
        const dy = other.position.y - current.position.y;
        let distance = Math.hypot(dx, dy);
        if (distance === 0) {
          distance = 0.001;
        }
        const minDistance = current.radius + other.radius;
        if (distance < minDistance) {
          const overlap = (minDistance - distance) / 2;
          const offsetX = (dx / distance) * overlap;
          const offsetY = (dy / distance) * overlap;
          current.position.x -= offsetX;
          current.position.y -= offsetY;
          other.position.x += offsetX;
          other.position.y += offsetY;
          moved = true;
        }
      }
    }

    entries.forEach((entry) => {
      const currentRadius = Math.hypot(entry.position.x, entry.position.y);
      if (currentRadius < 1) {
        entry.position.x = CATEGORY_ANCHOR_RADIUS;
        entry.position.y = 0;
        moved = true;
        return;
      }
      const delta = CATEGORY_ANCHOR_RADIUS - currentRadius;
      if (Math.abs(delta) < 0.5) {
        return;
      }
      const pull = delta * CLUSTER_PULL_STRENGTH;
      entry.position.x += (entry.position.x / currentRadius) * pull;
      entry.position.y += (entry.position.y / currentRadius) * pull;
      moved = true;
    });

    if (!moved) {
      break;
    }
  }

  return entries.reduce((acc, entry) => {
    acc[entry.category] = entry.position;
    return acc;
  }, {} as Record<string, { x: number; y: number }>);
};

const relaxClusterDensity = (
  assignments: Record<string, ConstellationProject[]>,
  anchors: Record<string, { x: number; y: number }>
) => {
  Object.entries(assignments).forEach(([category, projects]) => {
    if (projects.length < 2) {
      return;
    }

    for (let iteration = 0; iteration < NODE_RELAX_ITERATIONS; iteration += 1) {
      for (let i = 0; i < projects.length; i += 1) {
        for (let j = i + 1; j < projects.length; j += 1) {
          const current = projects[i];
          const other = projects[j];
          const dx = other.position.x - current.position.x;
          const dy = other.position.y - current.position.y;
          let distance = Math.hypot(dx, dy);
          if (distance === 0) {
            distance = 0.001;
          }
          if (distance >= MIN_NODE_SPACING) {
            continue;
          }
          const overlap = (MIN_NODE_SPACING - distance) / 2;
          const offsetX = (dx / distance) * overlap;
          const offsetY = (dy / distance) * overlap;
          current.position.x -= offsetX;
          current.position.y -= offsetY;
          other.position.x += offsetX;
          other.position.y += offsetY;
        }
      }
    }

    const anchor = anchors[category];
    if (!anchor) {
      return;
    }
    const centroid = projects.reduce(
      (acc, project) => {
        acc.x += project.position.x;
        acc.y += project.position.y;
        return acc;
      },
      { x: 0, y: 0 }
    );
    centroid.x /= projects.length;
    centroid.y /= projects.length;
    const offsetX = anchor.x - centroid.x;
    const offsetY = anchor.y - centroid.y;
    projects.forEach((project) => {
      project.position.x += offsetX;
      project.position.y += offsetY;
    });
  });
};

const sortCategories = (labels: Set<CoreCategory>) =>
  CORE_CATEGORIES.filter((category) => labels.has(category));

const now = () => new Date();

const pruneIncentives = (entries: Incentive[] | undefined): Incentive[] => {
  if (!entries) {
    return [];
  }
  const current = now().getTime();
  return entries.filter((entry) => new Date(entry.expiresAt).getTime() > current);
};

const clamp = (value: number, min: number, max: number) => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const computeLayout = (
  projects: RawProject[]
): { projects: ConstellationProject[]; categories: string[]; categoryCounts: Record<string, number> } => {
  const categoryBucket = new Set<CoreCategory>();
  const categoryCounts: Record<string, number> = {};
  const groupedByPrimary = new Map<CoreCategory, RawProject[]>();
  const projectCategoryMeta = new Map<string, ProjectCategoryMeta>();

  projects.forEach((project) => {
    const meta = toCategoryMeta(project.categories);
    categoryBucket.add(meta.primary);
    categoryCounts[meta.primary] = (categoryCounts[meta.primary] ?? 0) + 1;
    projectCategoryMeta.set(project.id, meta);
    if (!groupedByPrimary.has(meta.primary)) {
      groupedByPrimary.set(meta.primary, []);
    }
    groupedByPrimary.get(meta.primary)!.push(project);
  });

  const categories = sortCategories(categoryBucket);
  const categoryAnchors: Record<string, { x: number; y: number }> = {};
  const clusterStats: Record<string, ClusterLayoutMeta> = {};
  categories.forEach((category, index) => {
    const angle = (index / Math.max(categories.length, 1)) * Math.PI * 2;
    categoryAnchors[category] = {
      x: Math.cos(angle) * CATEGORY_ANCHOR_RADIUS,
      y: Math.sin(angle) * CATEGORY_ANCHOR_RADIUS
    };
  });

  const positionedProjects: ConstellationProject[] = [];
  const clusterAssignments: Record<string, ConstellationProject[]> = {};
  categories.forEach((category) => {
    const group = groupedByPrimary.get(category as CoreCategory);
    if (!group || group.length === 0) {
      return;
    }

    const anchor = categoryAnchors[category] ?? { x: 0, y: 0 };
    let processed = 0;
    let ringIndex = 0;
    let maxOrbitRadius = 0;
    clusterAssignments[category] = clusterAssignments[category] ?? [];

    while (processed < group.length) {
      const slotsInRing = Math.min(
        BASE_RING_SLOTS + ringIndex * RING_SLOT_GROWTH,
        group.length - processed
      );
      const rotationOffset =
        (((category.charCodeAt(0) + ringIndex * 17) % 360) * Math.PI) / 180;
      const angleStep = (Math.PI * 2) / Math.max(slotsInRing, 1);

      for (let slot = 0; slot < slotsInRing; slot += 1) {
        const project = group[processed + slot];
        const meta = projectCategoryMeta.get(project.id);
        if (!meta) {
          continue;
        }
        const categoriesForProject = meta.categories;
        const primaryCategory = meta.primary;
        const baseAngle = rotationOffset + slot * angleStep;
        const normalizedSlot = slotsInRing > 1 ? slot / (slotsInRing - 1) : 0.5;
        const petalLift = Math.sin(normalizedSlot * Math.PI) ** 2 * 28;
        const wave = Math.sin(baseAngle * 3) * 10;
        const orbitRadius = ORBIT_BASE_RADIUS + ringIndex * ORBIT_RING_GAP + petalLift + wave;
        const x = anchor.x + Math.cos(baseAngle) * orbitRadius;
        const y = anchor.y + Math.sin(baseAngle) * orbitRadius;

        maxOrbitRadius = Math.max(maxOrbitRadius, orbitRadius);

        const positionedProject: ConstellationProject = {
          ...project,
          categories: categoriesForProject,
          primaryCategory,
          incentives: pruneIncentives(project.incentives),
          linkedIds: [...(project.linkedIds ?? [])],
          clusterOrigin: anchor,
          position: { x, y },
          highlight: ECOSYSTEM_HIGHLIGHTS[project.id],
          traits: meta.traits
        };
        positionedProjects.push(positionedProject);
        clusterAssignments[category]!.push(positionedProject);
      }

      processed += slotsInRing;
      ringIndex += 1;
    }

    clusterStats[category] = {
      anchor,
      radius: maxOrbitRadius + CLUSTER_RADIUS_PADDING
    };
  });

  const adjustedAnchors = resolveClusterAnchors(clusterStats);

  positionedProjects.forEach((project) => {
    const nextAnchor = adjustedAnchors[project.primaryCategory];
    if (!nextAnchor) {
      return;
    }
    const deltaX = nextAnchor.x - project.clusterOrigin.x;
    const deltaY = nextAnchor.y - project.clusterOrigin.y;
    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
      project.clusterOrigin = nextAnchor;
      return;
    }
    project.clusterOrigin = nextAnchor;
    project.position = {
      x: project.position.x + deltaX,
      y: project.position.y + deltaY
    };
  });

  relaxClusterDensity(clusterAssignments, adjustedAnchors);

  const byId = new Map(positionedProjects.map((project) => [project.id, project]));

  Object.entries(SPECIAL_LINKS).forEach(([sourceId, targets]) => {
    const source = byId.get(sourceId);
    if (!source) {
      return;
    }

    targets.forEach((targetId) => {
      const target = byId.get(targetId);
      if (!target) {
        return;
      }
      source.linkedIds = Array.from(new Set([...source.linkedIds, targetId]));
      target.linkedIds = Array.from(new Set([...target.linkedIds, sourceId]));
    });
  });

  Object.entries(EXCLUSIVE_LINKS).forEach(([sourceId, allowedTargets]) => {
    const allowedSet = new Set(allowedTargets);
    const source = byId.get(sourceId);
    if (source) {
      source.linkedIds = source.linkedIds.filter((targetId) => allowedSet.has(targetId));
      allowedTargets.forEach((targetId) => {
        if (!source.linkedIds.includes(targetId)) {
          source.linkedIds.push(targetId);
        }
      });
    }

    allowedTargets.forEach((targetId) => {
      const target = byId.get(targetId);
      if (!target) {
        return;
      }
      if (!target.linkedIds.includes(sourceId)) {
        target.linkedIds.push(sourceId);
      }
    });

    byId.forEach((project) => {
      if (project.id === sourceId || allowedSet.has(project.id)) {
        return;
      }
      project.linkedIds = project.linkedIds.filter((targetId) => targetId !== sourceId);
    });
  });

  return { projects: positionedProjects, categories, categoryCounts };
};

const deriveProjectView = (
  baseProjects: ConstellationProject[],
  filters: SpecialFilters,
  category: string | null,
  jojoProfileId: string,
  options?: { favoritesOnly?: boolean; favoriteIds?: Set<string> }
) => {
  let workingPool = baseProjects;

  if (options?.favoritesOnly) {
    const favoriteSet = options.favoriteIds ?? new Set<string>();
    const favoritesSubset = workingPool.filter((project) => favoriteSet.has(project.id));
    if (favoritesSubset.length === 0) {
      const emptyCounts = deriveCategoryCounts([]);
      return { pool: [], visible: [], counts: emptyCounts };
    }
    workingPool = compressProjects(
      computeLayout(toRawProjectSet(favoritesSubset)).projects,
      FAVORITES_CLUSTER_SCALE
    );
  }

  const filteredPool = applySpecialFilters(workingPool, filters, jojoProfileId);
  const pool = shouldAggregateFilters(filters)
    ? computeLayout(toRawProjectSet(filteredPool)).projects
    : cloneProjects(filteredPool);
  const visible = filterProjectsByCategory(pool, category);
  return { pool, visible, counts: deriveCategoryCounts(pool) };
};

const computeCameraFocus = (
  category: string | null,
  focusProjects: ConstellationProject[],
  forceFocus = false
) => {
  if ((!category && !forceFocus) || focusProjects.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }
  const centroid = computeProjectsCentroid(focusProjects);
  const spread = focusProjects.reduce((max, project) => {
    const dx = project.position.x - centroid.x;
    const dy = project.position.y - centroid.y;
    return Math.max(max, Math.hypot(dx, dy));
  }, 0);

  const zoom = clamp(
    CAMERA_BASE_ZOOM / (spread + CAMERA_SPREAD_PADDING),
    forceFocus ? 0.8 : 0.7,
    1.9
  );
  return { x: centroid.x, y: centroid.y, zoom };
};

const defaultCamera = (): CameraState => ({
  x: 0,
  y: 0,
  zoom: 1,
  targetX: 0,
  targetY: 0,
  targetZoom: 1
});

const createReturnPoint = (camera: CameraState) => ({
  x: camera.targetX,
  y: camera.targetY,
  zoom: camera.targetZoom
});

type ConstellationContextShape = ConstellationState &
  WalletInsights & {
  setActiveCategory: (category: string | null) => void;
  setHoveredProject: (projectId: string | null) => void;
  selectProject: (projectId: string | null) => void;
  panCamera: (deltaX: number, deltaY: number) => void;
  zoomCamera: (deltaZoom: number, focus?: { x: number; y: number }) => void;
  resetCamera: () => void;
  setJojoProfile: (profileId: string) => void;
  toggleFilter: (filterKey: keyof SpecialFilters) => void;
  toggleFavoritesOnly: () => void;
  toggleFavorite: (projectId: string) => void;
  resolveProjectById: (projectId: string | null) => ConstellationProject | null;
  };

const ConstellationContext = createContext<ConstellationContextShape | undefined>(undefined);

export const ConstellationProvider = ({ children }: { children: ReactNode }) => {
  const layout = useMemo(() => computeLayout(baseProjects), []);
  const [state, setState] = useState<ConstellationState>(() => {
    const filters = { ...SPECIAL_DEFAULTS };
    const favoriteIds = readStoredFavorites();
    const favoritesOnly = false;
    const jojoProfileId = DEFAULT_JOJO_PROFILE_ID;
    const { pool, visible, counts } = deriveProjectView(layout.projects, filters, null, jojoProfileId, {
      favoritesOnly,
      favoriteIds: new Set(favoriteIds)
    });
    return {
      projects: visible,
      projectPoolSize: pool.length,
      categories: [...CORE_CATEGORIES],
      categoryCounts: counts,
      activeCategory: null,
      hoveredProjectId: null,
      selectedProjectId: null,
      camera: defaultCamera(),
      cameraReturnPoint: null,
      filters,
      favoriteIds,
      favoritesOnly,
      jojoProfileId
    };
  });
  const {
    walletAddress,
    walletInput,
    walletStatus,
    walletError,
    walletInteractionCounts,
    walletNftHoldings,
    walletUpdatedAt,
    contractDirectoryStatus,
    setWalletInput: setWalletInputValue,
    submitWallet,
    clearWallet,
    refreshWalletInsights
  } = useWalletInsights();

  useEffect(() => {
    setState((prev) => {
      const { pool, visible, counts } = deriveProjectView(
        layout.projects,
        prev.filters,
        prev.activeCategory,
        prev.jojoProfileId,
        {
          favoritesOnly: prev.favoritesOnly,
          favoriteIds: new Set(prev.favoriteIds)
        }
      );
      const visibleIds = new Set(visible.map((project) => project.id));
      return {
        ...prev,
        projects: visible,
        projectPoolSize: pool.length,
        categoryCounts: counts,
        hoveredProjectId:
          prev.hoveredProjectId && visibleIds.has(prev.hoveredProjectId) ? prev.hoveredProjectId : null,
        selectedProjectId:
          prev.selectedProjectId && visibleIds.has(prev.selectedProjectId)
            ? prev.selectedProjectId
            : null
      };
    });
  }, [layout.projects]);

  const setActiveCategory = useCallback(
    (category: string | null) => {
      setState((prev) => {
        if (prev.activeCategory === category) {
          return prev;
        }

        const { pool, visible, counts } = deriveProjectView(layout.projects, prev.filters, category, prev.jojoProfileId, {
          favoritesOnly: prev.favoritesOnly,
          favoriteIds: new Set(prev.favoriteIds)
        });
        const visibleIds = new Set(visible.map((project) => project.id));
        const focus = computeCameraFocus(category, visible);

        return {
          ...prev,
          projects: visible,
          projectPoolSize: pool.length,
          categoryCounts: counts,
          activeCategory: category,
          hoveredProjectId:
            prev.hoveredProjectId && visibleIds.has(prev.hoveredProjectId) ? prev.hoveredProjectId : null,
          selectedProjectId:
            prev.selectedProjectId && visibleIds.has(prev.selectedProjectId) ? prev.selectedProjectId : null,
          cameraReturnPoint: null,
          camera: {
            ...prev.camera,
            targetX: focus.x,
            targetY: focus.y,
            targetZoom: focus.zoom
          }
        };
      });
    },
    [layout.projects]
  );

  const toggleFilter = useCallback(
    (filterKey: keyof SpecialFilters) => {
      setState((prev) => {
        const nextFilters = { ...prev.filters, [filterKey]: !prev.filters[filterKey] };
        const { pool, visible, counts } = deriveProjectView(
          layout.projects,
          nextFilters,
          prev.activeCategory,
          prev.jojoProfileId,
          {
            favoritesOnly: prev.favoritesOnly,
            favoriteIds: new Set(prev.favoriteIds)
          }
        );

        let nextActiveCategory = prev.activeCategory;
        let nextVisible = visible;

        if (nextActiveCategory && visible.length === 0) {
          nextActiveCategory = null;
          nextVisible = pool;
        }

        const visibleIds = new Set(nextVisible.map((project) => project.id));
        const forceFocus =
          (shouldAggregateFilters(nextFilters) && !nextActiveCategory) ||
          (prev.favoritesOnly && !nextActiveCategory);
        const focus = computeCameraFocus(nextActiveCategory, nextVisible, forceFocus);
        const shouldUpdateCamera =
          Boolean(nextActiveCategory) ||
          prev.activeCategory !== nextActiveCategory ||
          forceFocus;

        return {
          ...prev,
          filters: nextFilters,
          projects: nextVisible,
          projectPoolSize: pool.length,
          categoryCounts: counts,
          activeCategory: nextActiveCategory,
          hoveredProjectId:
            prev.hoveredProjectId && visibleIds.has(prev.hoveredProjectId)
              ? prev.hoveredProjectId
              : null,
          selectedProjectId:
            prev.selectedProjectId && visibleIds.has(prev.selectedProjectId)
              ? prev.selectedProjectId
              : null,
          cameraReturnPoint: null,
          camera: shouldUpdateCamera
            ? {
                ...prev.camera,
                targetX: focus.x,
                targetY: focus.y,
                targetZoom: focus.zoom
              }
            : prev.camera
        };
      });
    },
    [layout.projects]
  );

  const setJojoProfile = useCallback((profileId: string) => {
    setState((prev) => {
      const resolvedProfileId = resolveJojoProfile(profileId).id;
      if (prev.jojoProfileId === resolvedProfileId) {
        return prev;
      }

      const { pool, visible, counts } = deriveProjectView(
        layout.projects,
        prev.filters,
        prev.activeCategory,
        resolvedProfileId,
        {
          favoritesOnly: prev.favoritesOnly,
          favoriteIds: new Set(prev.favoriteIds)
        }
      );

      let nextActiveCategory = prev.activeCategory;
      let nextVisible = visible;

      if (nextActiveCategory && visible.length === 0) {
        nextActiveCategory = null;
        nextVisible = pool;
      }

      const visibleIds = new Set(nextVisible.map((project) => project.id));
      const forceFocus =
        (shouldAggregateFilters(prev.filters) && !nextActiveCategory) ||
        (prev.favoritesOnly && !nextActiveCategory);
      const focus = computeCameraFocus(nextActiveCategory, nextVisible, forceFocus);
      const shouldUpdateCamera =
        Boolean(nextActiveCategory) ||
        prev.activeCategory !== nextActiveCategory ||
        forceFocus;

      return {
        ...prev,
        jojoProfileId: resolvedProfileId,
        projects: nextVisible,
        projectPoolSize: pool.length,
        categoryCounts: counts,
        activeCategory: nextActiveCategory,
        hoveredProjectId:
          prev.hoveredProjectId && visibleIds.has(prev.hoveredProjectId)
            ? prev.hoveredProjectId
            : null,
        selectedProjectId:
          prev.selectedProjectId && visibleIds.has(prev.selectedProjectId)
            ? prev.selectedProjectId
            : null,
        cameraReturnPoint: shouldUpdateCamera ? null : prev.cameraReturnPoint,
        camera: shouldUpdateCamera
          ? {
              ...prev.camera,
              targetX: focus.x,
              targetY: focus.y,
              targetZoom: focus.zoom
            }
          : prev.camera
      };
    });
  }, [layout.projects]);

  const toggleFavoritesOnly = useCallback(() => {
    setState((prev) => {
      if (!prev.favoritesOnly && prev.favoriteIds.length === 0) {
        return prev;
      }
      const nextFavoritesOnly = !prev.favoritesOnly;
      const { pool, visible, counts } = deriveProjectView(
        layout.projects,
        prev.filters,
        prev.activeCategory,
        prev.jojoProfileId,
        {
          favoritesOnly: nextFavoritesOnly,
          favoriteIds: new Set(prev.favoriteIds)
        }
      );

      let nextActiveCategory = prev.activeCategory;
      let nextVisible = visible;

      if (nextActiveCategory && visible.length === 0) {
        nextActiveCategory = null;
        nextVisible = pool;
      }

      const visibleIds = new Set(nextVisible.map((project) => project.id));
      const forceFocus =
        (shouldAggregateFilters(prev.filters) && !nextActiveCategory) ||
        (nextFavoritesOnly && !nextActiveCategory);
      const focus = computeCameraFocus(nextActiveCategory, nextVisible, forceFocus);
      const shouldUpdateCamera =
        Boolean(nextActiveCategory) ||
        prev.activeCategory !== nextActiveCategory ||
        forceFocus ||
        prev.favoritesOnly !== nextFavoritesOnly;

      return {
        ...prev,
        favoritesOnly: nextFavoritesOnly,
        projects: nextVisible,
        projectPoolSize: pool.length,
        categoryCounts: counts,
        activeCategory: nextActiveCategory,
        hoveredProjectId:
          prev.hoveredProjectId && visibleIds.has(prev.hoveredProjectId)
            ? prev.hoveredProjectId
            : null,
        selectedProjectId:
          prev.selectedProjectId && visibleIds.has(prev.selectedProjectId)
            ? prev.selectedProjectId
            : null,
        cameraReturnPoint: null,
        camera: shouldUpdateCamera
          ? {
              ...prev.camera,
              targetX: focus.x,
              targetY: focus.y,
              targetZoom: focus.zoom
            }
          : prev.camera
      };
    });
  }, [layout.projects]);

  const toggleFavorite = useCallback(
    (projectId: string) => {
      setState((prev) => {
        const isFavorite = prev.favoriteIds.includes(projectId);
        const nextFavoriteIds = isFavorite
          ? prev.favoriteIds.filter((id) => id !== projectId)
          : [...prev.favoriteIds, projectId];
        const nextFavoritesOnly = prev.favoritesOnly && nextFavoriteIds.length > 0 ? prev.favoritesOnly : false;

        const { pool, visible, counts } = deriveProjectView(
          layout.projects,
          prev.filters,
          prev.activeCategory,
          prev.jojoProfileId,
          {
            favoritesOnly: nextFavoritesOnly,
            favoriteIds: new Set(nextFavoriteIds)
          }
        );

        let nextActiveCategory = prev.activeCategory;
        let nextVisible = visible;

        if (nextActiveCategory && visible.length === 0) {
          nextActiveCategory = null;
          nextVisible = pool;
        }

        const visibleIds = new Set(nextVisible.map((project) => project.id));
        const forceFocus =
          (shouldAggregateFilters(prev.filters) && !nextActiveCategory) ||
          (nextFavoritesOnly && !nextActiveCategory);
        const shouldUpdateCamera =
          Boolean(nextActiveCategory) ||
          prev.activeCategory !== nextActiveCategory ||
          forceFocus ||
          prev.favoritesOnly !== nextFavoritesOnly;
        const focus = computeCameraFocus(nextActiveCategory, nextVisible, forceFocus);

        return {
          ...prev,
          favoriteIds: nextFavoriteIds,
          favoritesOnly: nextFavoritesOnly,
          projects: nextVisible,
          projectPoolSize: pool.length,
          categoryCounts: counts,
          activeCategory: nextActiveCategory,
          hoveredProjectId:
            prev.hoveredProjectId && visibleIds.has(prev.hoveredProjectId)
              ? prev.hoveredProjectId
              : null,
          selectedProjectId:
            prev.selectedProjectId && visibleIds.has(prev.selectedProjectId)
              ? prev.selectedProjectId
              : null,
          cameraReturnPoint: null,
          camera: shouldUpdateCamera
            ? {
                ...prev.camera,
                targetX: focus.x,
                targetY: focus.y,
                targetZoom: focus.zoom
              }
            : prev.camera
        };
      });
    },
    [layout.projects]
  );

  const setHoveredProject = useCallback((projectId: string | null) => {
    setState((prev) => {
      if (prev.hoveredProjectId === projectId) {
        return prev;
      }
      return { ...prev, hoveredProjectId: projectId };
    });
  }, []);

  const selectProject = useCallback(
    (projectId: string | null) => {
      setState((prev) => {
        if (prev.selectedProjectId === projectId) {
          return prev;
        }

        let nextCamera = prev.camera;
        let nextReturnPoint = prev.cameraReturnPoint;

        if (projectId) {
          const targetProject =
            prev.projects.find((project) => project.id === projectId) ??
            layout.projects.find((project) => project.id === projectId);
          if (!targetProject) {
            return prev;
          }

          if (!nextReturnPoint) {
            nextReturnPoint = createReturnPoint(prev.camera);
          }

          const focusZoom = Math.max(prev.camera.targetZoom, SELECT_FOCUS_ZOOM);
          nextCamera = {
            ...prev.camera,
            targetX: targetProject.position.x,
            targetY: targetProject.position.y,
            targetZoom: focusZoom
          };
        } else if (prev.cameraReturnPoint) {
          nextCamera = {
            ...prev.camera,
            targetX: prev.cameraReturnPoint.x,
            targetY: prev.cameraReturnPoint.y,
            targetZoom: prev.cameraReturnPoint.zoom
          };
          nextReturnPoint = null;
        } else if (prev.selectedProjectId) {
          const forceFocus = shouldAggregateFilters(prev.filters) && !prev.activeCategory;
          const focus = computeCameraFocus(prev.activeCategory, prev.projects, forceFocus);
          nextCamera = {
            ...prev.camera,
            targetX: focus.x,
            targetY: focus.y,
            targetZoom: focus.zoom
          };
          nextReturnPoint = null;
        }

        return {
          ...prev,
          selectedProjectId: projectId,
          camera: nextCamera,
          cameraReturnPoint: nextReturnPoint
        };
      });
    },
    [layout.projects]
  );

  const panCamera = useCallback((deltaX: number, deltaY: number) => {
    setState((prev) => {
      const speedFactor = 1 / prev.camera.zoom;
      return {
        ...prev,
        camera: {
          ...prev.camera,
          targetX: prev.camera.targetX - deltaX * speedFactor,
          targetY: prev.camera.targetY - deltaY * speedFactor
        }
      };
    });
  }, []);

  const zoomCamera = useCallback((deltaZoom: number, focus?: { x: number; y: number }) => {
    setState((prev) => {
      const currentZoom = prev.camera.targetZoom;
      const nextZoom = clamp(currentZoom + deltaZoom, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === currentZoom) {
        return prev;
      }

      let targetX = prev.camera.targetX;
      let targetY = prev.camera.targetY;
      if (focus) {
        const zoomRatio = currentZoom !== 0 ? nextZoom / currentZoom : 1;
        if (zoomRatio > 0 && isFinite(zoomRatio)) {
          targetX = focus.x - (focus.x - targetX) / zoomRatio;
          targetY = focus.y - (focus.y - targetY) / zoomRatio;
        }
      } else if (prev.projects.length > 0) {
        const centroid = computeProjectsCentroid(prev.projects);
        const blend = 0.4;
        targetX = centroid.x * blend + targetX * (1 - blend);
        targetY = centroid.y * blend + targetY * (1 - blend);
      }

      return {
        ...prev,
        camera: {
          ...prev.camera,
          targetX,
          targetY,
          targetZoom: nextZoom
        }
      };
    });
  }, []);

  const resetCamera = useCallback(() => {
    setState((prev) => {
      const { pool, visible, counts } = deriveProjectView(
        layout.projects,
        prev.filters,
        null,
        prev.jojoProfileId,
        {
          favoritesOnly: prev.favoritesOnly,
          favoriteIds: new Set(prev.favoriteIds)
        }
      );
      const visibleIds = new Set(visible.map((project) => project.id));
      return {
        ...prev,
        projects: visible,
        projectPoolSize: pool.length,
        categoryCounts: counts,
        activeCategory: null,
        hoveredProjectId:
          prev.hoveredProjectId && visibleIds.has(prev.hoveredProjectId) ? prev.hoveredProjectId : null,
        selectedProjectId:
          prev.selectedProjectId && visibleIds.has(prev.selectedProjectId)
            ? prev.selectedProjectId
            : null,
        cameraReturnPoint: null,
        camera: { ...prev.camera, targetX: 0, targetY: 0, targetZoom: 1 }
      };
    });
  }, [layout.projects]);

  const resolveProjectById = useCallback(
    (projectId: string | null) => {
      if (!projectId) {
        return null;
      }
      return (
        state.projects.find((project) => project.id === projectId) ??
        layout.projects.find((project) => project.id === projectId) ??
        null
      );
    },
    [state.projects, layout.projects]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(state.favoriteIds));
    } catch {
      // Ignore storage errors
    }
  }, [state.favoriteIds]);

  useEffect(() => {
    let animationFrame: number;

    const tick = () => {
      setState((prev) => {
        const { camera } = prev;
        const lerp = (value: number, target: number) => value + (target - value) * 0.08;
        const nextX = lerp(camera.x, camera.targetX);
        const nextY = lerp(camera.y, camera.targetY);
        const nextZoom = lerp(camera.zoom, camera.targetZoom);

        const closeEnough =
          Math.abs(nextX - camera.x) < 0.01 &&
          Math.abs(nextY - camera.y) < 0.01 &&
          Math.abs(nextZoom - camera.zoom) < 0.01;

        if (closeEnough) {
          if (
            camera.x === camera.targetX &&
            camera.y === camera.targetY &&
            camera.zoom === camera.targetZoom
          ) {
            return prev;
          }
          return {
            ...prev,
            camera: { ...camera, x: camera.targetX, y: camera.targetY, zoom: camera.targetZoom }
          };
        }

        return {
          ...prev,
          camera: { ...camera, x: nextX, y: nextY, zoom: nextZoom }
        };
      });

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      walletAddress,
      walletInput,
      walletStatus,
      walletError,
      walletInteractionCounts,
      walletNftHoldings,
      walletUpdatedAt,
      contractDirectoryStatus,
      setWalletInput: setWalletInputValue,
      submitWallet,
      clearWallet,
      refreshWalletInsights,
      setActiveCategory,
      setHoveredProject,
      selectProject,
      panCamera,
      zoomCamera,
      resetCamera,
      setJojoProfile,
      toggleFilter,
      toggleFavoritesOnly,
      toggleFavorite,
      resolveProjectById
    }),
    [
      state,
      walletAddress,
      walletInput,
      walletStatus,
      walletError,
      walletInteractionCounts,
      walletNftHoldings,
      walletUpdatedAt,
      contractDirectoryStatus,
      setWalletInputValue,
      submitWallet,
      clearWallet,
      refreshWalletInsights,
      setActiveCategory,
      setHoveredProject,
      selectProject,
      panCamera,
      zoomCamera,
      resetCamera,
      setJojoProfile,
      toggleFilter,
      toggleFavoritesOnly,
      toggleFavorite,
      resolveProjectById
    ]
  );

  return <ConstellationContext.Provider value={value}>{children}</ConstellationContext.Provider>;
};

export const useConstellation = () => {
  const context = useContext(ConstellationContext);
  if (!context) {
    throw new Error('useConstellation must be used inside ConstellationProvider');
  }
  return context;
};

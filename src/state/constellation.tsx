import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import rawProjects from '../data/projects.json';
import {
  CameraState,
  ConstellationProject,
  ConstellationState,
  HighlightVariant,
  Incentive,
  RawProject,
  SpecialFilters
} from '../types';

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
  'AI'
] as const;

const SPECIAL_CATEGORIES = ['Megamafia', 'Mobile'] as const;

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
  mobile: 'Mobile'
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

const SPECIAL_DEFAULTS: SpecialFilters = { megamafia: false, mobile: false };

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
    if (canonical === 'Mobile') {
      traits.mobile = true;
      return;
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

const applySpecialFilters = (projects: ConstellationProject[], filters: SpecialFilters) => {
  if (!filters.megamafia && !filters.mobile) {
    return projects;
  }
  return projects.filter((project) => {
    if (filters.megamafia && !project.traits.megamafia) {
      return false;
    }
    if (filters.mobile && !project.traits.mobile) {
      return false;
    }
    return true;
  });
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

const registerAdjacency = (
  adjacency: Record<string, Set<string>>,
  source: string,
  target: string
) => {
  if (source === target) {
    return;
  }
  if (!adjacency[source]) {
    adjacency[source] = new Set<string>();
  }
  adjacency[source]!.add(target);
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

  const categoryAdjacency: Record<string, Set<string>> = {};
  const positionedProjects: ConstellationProject[] = [];
  const clusterAssignments: Record<string, ConstellationProject[]> = {};
  categories.forEach((category) => {
    const group = groupedByPrimary.get(category as CoreCategory);
    if (!group || group.length === 0) {
      return;
    }

    const anchor = categoryAnchors[category] ?? { x: 0, y: 0 };
    const arrangedIds: string[] = [];
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

      for (let slot = 0; slot < slotsInRing; slot += 1) {
        const project = group[processed + slot];
        const meta = projectCategoryMeta.get(project.id);
        if (!meta) {
          continue;
        }
        const categoriesForProject = meta.categories;
        const primaryCategory = meta.primary;
        const baseAngle = (slot / slotsInRing) * Math.PI * 2 + rotationOffset;
        const jitter = (((project.id.charCodeAt(0) + slot * 31) % 100) / 100 - 0.5) * 0.25;
        const radiusJitter = ((project.id.length * 13) % 9) - 4;
        const orbitRadius = ORBIT_BASE_RADIUS + ringIndex * ORBIT_RING_GAP + radiusJitter;
        const angle = baseAngle + jitter;
        const x = anchor.x + Math.cos(angle) * orbitRadius;
        const y = anchor.y + Math.sin(angle) * orbitRadius;

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
        arrangedIds.push(project.id);
      }

      processed += slotsInRing;
      ringIndex += 1;
    }

    clusterStats[category] = {
      anchor,
      radius: maxOrbitRadius + CLUSTER_RADIUS_PADDING
    };

    if (arrangedIds.length > 1) {
      arrangedIds.forEach((projectId, index) => {
        const prev = arrangedIds[(index - 1 + arrangedIds.length) % arrangedIds.length];
        const next = arrangedIds[(index + 1) % arrangedIds.length];
        registerAdjacency(categoryAdjacency, projectId, prev);
        registerAdjacency(categoryAdjacency, projectId, next);
      });
    }
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

  Object.entries(categoryAdjacency).forEach(([projectId, neighbors]) => {
    const project = byId.get(projectId);
    if (!project) {
      return;
    }
    project.linkedIds = Array.from(new Set([...project.linkedIds, ...neighbors]));
  });

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
  category: string | null
) => {
  const pool = applySpecialFilters(baseProjects, filters);
  const visible = filterProjectsByCategory(pool, category);
  return { pool, visible, counts: deriveCategoryCounts(pool) };
};

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

const computeCameraFocus = (
  category: string | null,
  focusProjects: ConstellationProject[]
) => {
  if (!category || focusProjects.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }
  const centroid = focusProjects.reduce(
    (acc, project) => {
      acc.x += project.position.x;
      acc.y += project.position.y;
      return acc;
    },
    { x: 0, y: 0 }
  );
  centroid.x /= focusProjects.length;
  centroid.y /= focusProjects.length;

  const spread = focusProjects.reduce((max, project) => {
    const dx = project.position.x - centroid.x;
    const dy = project.position.y - centroid.y;
    return Math.max(max, Math.hypot(dx, dy));
  }, 0);

  const zoom = clamp(CAMERA_BASE_ZOOM / (spread + CAMERA_SPREAD_PADDING), 0.7, 1.9);
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

type ConstellationContextShape = ConstellationState & {
  setActiveCategory: (category: string | null) => void;
  setHoveredProject: (projectId: string | null) => void;
  selectProject: (projectId: string | null) => void;
  panCamera: (deltaX: number, deltaY: number) => void;
  zoomCamera: (deltaZoom: number, focus?: { x: number; y: number }) => void;
  resetCamera: () => void;
  toggleFilter: (filterKey: keyof SpecialFilters) => void;
};

const ConstellationContext = createContext<ConstellationContextShape | undefined>(undefined);

export const ConstellationProvider = ({ children }: { children: ReactNode }) => {
  const layout = useMemo(() => computeLayout(rawProjects as RawProject[]), []);
  const [state, setState] = useState<ConstellationState>(() => {
    const filters = { ...SPECIAL_DEFAULTS };
    const { pool, visible, counts } = deriveProjectView(layout.projects, filters, null);
    return {
      projects: visible,
      projectPoolSize: pool.length,
      categories: [...CORE_CATEGORIES],
      categoryCounts: counts,
      activeCategory: null,
      hoveredProjectId: null,
      selectedProjectId: null,
      camera: defaultCamera(),
      filters
    };
  });

  const setActiveCategory = useCallback(
    (category: string | null) => {
      setState((prev) => {
        if (prev.activeCategory === category) {
          return prev;
        }

        const { pool, visible, counts } = deriveProjectView(layout.projects, prev.filters, category);
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
          prev.activeCategory
        );

        let nextActiveCategory = prev.activeCategory;
        let nextVisible = visible;

        if (nextActiveCategory && visible.length === 0) {
          nextActiveCategory = null;
          nextVisible = pool;
        }

        const visibleIds = new Set(nextVisible.map((project) => project.id));
        const focus = computeCameraFocus(nextActiveCategory, nextVisible);
        const shouldUpdateCamera = Boolean(nextActiveCategory) || prev.activeCategory !== nextActiveCategory;

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

  const selectProject = useCallback((projectId: string | null) => {
    setState((prev) => {
      if (prev.selectedProjectId === projectId) {
        return prev;
      }
      return { ...prev, selectedProjectId: projectId };
    });
  }, []);

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
      const nextZoom = clamp(prev.camera.targetZoom + deltaZoom, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === prev.camera.targetZoom) {
        return prev;
      }

      let targetX = prev.camera.targetX;
      let targetY = prev.camera.targetY;
      const blend = 0.25;

      if (focus) {
        targetX = focus.x * blend + targetX * (1 - blend);
        targetY = focus.y * blend + targetY * (1 - blend);
      } else if (prev.projects.length > 0) {
        const centroid = computeProjectsCentroid(prev.projects);
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
      const { pool, counts } = deriveProjectView(layout.projects, prev.filters, null);
      const visibleIds = new Set(pool.map((project) => project.id));
      return {
        ...prev,
        projects: pool,
        projectPoolSize: pool.length,
        categoryCounts: counts,
        activeCategory: null,
        hoveredProjectId:
          prev.hoveredProjectId && visibleIds.has(prev.hoveredProjectId) ? prev.hoveredProjectId : null,
        selectedProjectId:
          prev.selectedProjectId && visibleIds.has(prev.selectedProjectId)
            ? prev.selectedProjectId
            : null,
        camera: { ...prev.camera, targetX: 0, targetY: 0, targetZoom: 1 }
      };
    });
  }, [layout.projects]);

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
      setActiveCategory,
      setHoveredProject,
      selectProject,
      panCamera,
      zoomCamera,
      resetCamera,
      toggleFilter
    }),
    [
      state,
      setActiveCategory,
      setHoveredProject,
      selectProject,
      panCamera,
      zoomCamera,
      resetCamera,
      toggleFilter
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

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import rawProjects from '../data/projects.json';
import {
  CameraState,
  ConstellationProject,
  ConstellationState,
  HighlightVariant,
  Incentive,
  RawProject
} from '../types';
const CORE_CATEGORIES = [
  'DeFi',
  'Trading',
  'Tools',
  'Gaming',
  'Mobile',
  'NFT',
  'Meme',
  'Megamafia',
  'Depin',
  'Prediction Market',
  'Gambling'
] as const;

type CoreCategory = (typeof CORE_CATEGORIES)[number];

const DEFAULT_CORE_CATEGORY: CoreCategory = 'Megamafia';

const CORE_LOOKUP = CORE_CATEGORIES.reduce<Record<string, CoreCategory>>((acc, category) => {
  acc[category.toLowerCase()] = category;
  return acc;
}, {});

const CATEGORY_ALIASES: Record<string, CoreCategory> = {
  megmafia: 'Megamafia',
  megamafia: 'Megamafia',
  social: 'Megamafia',
  'badbunnz': 'Megamafia',
  launchpad: 'Tools',
  launchpads: 'Tools',
  dex: 'Trading',
  perps: 'Trading',
  'perps/trading': 'Trading',
  lending: 'DeFi',
  stablecoins: 'DeFi',
  bridge: 'Tools',
  payment: 'Megamafia',
  rwa: 'DeFi',
  lst: 'DeFi',
  gatcha: 'Gambling',
  casino: 'Gambling',
  prediction: 'Prediction Market',
  'prediction market': 'Prediction Market',
  'prediction-market': 'Prediction Market',
  meme: 'Meme',
  ai: 'Tools',
  depin: 'Depin',
  mobile: 'Mobile',
  nft: 'NFT',
  nfts: 'NFT',
  collectible: 'NFT',
  collectibles: 'NFT'
};

const canonicalizeCategory = (label: string): CoreCategory | null => {
  const normalized = label.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return CATEGORY_ALIASES[normalized] ?? CORE_LOOKUP[normalized] ?? null;
};

const sanitizeCategories = (labels: string[]): CoreCategory[] => {
  const sanitized: CoreCategory[] = [];
  labels.forEach((label) => {
    const canonical = canonicalizeCategory(label);
    if (!canonical || sanitized.includes(canonical)) {
      return;
    }
    sanitized.push(canonical);
  });
  if (sanitized.length === 0) {
    sanitized.push(DEFAULT_CORE_CATEGORY);
  }
  return sanitized;
};
const CATEGORY_ANCHOR_RADIUS = 320;
const CLUSTER_RADIUS_PADDING = 70;
const CLUSTER_COLLISION_ITERATIONS = 8;
const CLUSTER_PULL_STRENGTH = 0.12;
const ORBIT_BASE_RADIUS = 90;
const ORBIT_RING_GAP = 65;
const BASE_RING_SLOTS = 6;
const RING_SLOT_GROWTH = 5;

const PARENT_RELATIONS: Record<string, string[]> = {
  'bad-bunnz': ['prismfi', 'bunnzpaw', 'faster'],
  megalio: ['priority']
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

const computeLayout = (
  projects: RawProject[]
): { projects: ConstellationProject[]; categories: string[]; categoryCounts: Record<string, number> } => {
  const categoryBucket = new Set<CoreCategory>();
  const categoryCounts: Record<string, number> = {};
  const groupedByPrimary = new Map<CoreCategory, RawProject[]>();
  const projectCategoryMeta = new Map<string, { primary: CoreCategory; categories: CoreCategory[] }>();

  projects.forEach((project) => {
    const sanitizedCategories = sanitizeCategories(project.categories);
    const primaryCategory = sanitizedCategories[0];
    categoryBucket.add(primaryCategory);
    categoryCounts[primaryCategory] = (categoryCounts[primaryCategory] ?? 0) + 1;
    projectCategoryMeta.set(project.id, { primary: primaryCategory, categories: sanitizedCategories });
    if (!groupedByPrimary.has(primaryCategory)) {
      groupedByPrimary.set(primaryCategory, []);
    }
    groupedByPrimary.get(primaryCategory)!.push(project);
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

        positionedProjects.push({
          ...project,
          categories: categoriesForProject,
          primaryCategory,
          incentives: pruneIncentives(project.incentives),
          linkedIds: [...(project.linkedIds ?? [])],
          clusterOrigin: anchor,
          position: { x, y },
          highlight: ECOSYSTEM_HIGHLIGHTS[project.id]
        });
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

  const byId = new Map(positionedProjects.map((project) => [project.id, project]));

  Object.entries(categoryAdjacency).forEach(([projectId, neighbors]) => {
    const project = byId.get(projectId);
    if (!project) {
      return;
    }
    project.linkedIds = Array.from(new Set([...project.linkedIds, ...neighbors]));
  });

  Object.entries(PARENT_RELATIONS).forEach(([parentId, children]) => {
    const parent = byId.get(parentId);
    if (!parent) {
      return;
    }

    children.forEach((childId, index) => {
      const child = byId.get(childId);
      if (!child) {
        return;
      }

      const orbitRadius = 55 + index * 10;
      const angle = (index / Math.max(children.length, 1)) * Math.PI * 2;
      child.position = {
        x: parent.position.x + Math.cos(angle) * orbitRadius,
        y: parent.position.y + Math.sin(angle) * orbitRadius
      };
      child.clusterOrigin = parent.clusterOrigin;
      child.linkedIds = Array.from(new Set([...child.linkedIds, parentId]));
      parent.linkedIds = Array.from(new Set([...parent.linkedIds, childId]));
    });
  });

  return { projects: positionedProjects, categories, categoryCounts };
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
  resetCamera: () => void;
};

const ConstellationContext = createContext<ConstellationContextShape | undefined>(undefined);

export const ConstellationProvider = ({ children }: { children: ReactNode }) => {
  const layout = useMemo(() => computeLayout(rawProjects as RawProject[]), []);
  const [state, setState] = useState<ConstellationState>({
    projects: layout.projects,
    categories: layout.categories,
    categoryCounts: layout.categoryCounts,
    activeCategory: null,
    hoveredProjectId: null,
    selectedProjectId: null,
    camera: defaultCamera()
  });

  const setActiveCategory = useCallback((category: string | null) => {
    setState((prev) => {
      if (prev.activeCategory === category) {
        return prev;
      }

      let targetX = 0;
      let targetY = 0;
      let targetZoom = 1;

      if (category) {
        const projectsInCategory = prev.projects.filter(
          (project) => project.primaryCategory === category
        );
        if (projectsInCategory.length > 0) {
          targetX =
            projectsInCategory.reduce((sum, project) => sum + project.position.x, 0) /
            projectsInCategory.length;
          targetY =
            projectsInCategory.reduce((sum, project) => sum + project.position.y, 0) /
            projectsInCategory.length;
          targetZoom = 1.25;
        }
      }

      return {
        ...prev,
        activeCategory: category,
        camera: {
          ...prev.camera,
          targetX,
          targetY,
          targetZoom
        }
      };
    });
  }, []);

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

  const resetCamera = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activeCategory: null,
      camera: { ...prev.camera, targetX: 0, targetY: 0, targetZoom: 1 }
    }));
  }, []);

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
      resetCamera
    }),
    [state, setActiveCategory, setHoveredProject, selectProject, panCamera, resetCamera]
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

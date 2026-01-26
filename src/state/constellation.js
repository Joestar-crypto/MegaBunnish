import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import rawProjects from '../data/projects.json';
const CORE_CATEGORIES = [
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
    'Prediction Market',
    'AI'
];
const SPECIAL_CATEGORIES = ['Megamafia', 'Mobile'];
const DEFAULT_CORE_CATEGORY = 'DeFi';
const CORE_LOOKUP = CORE_CATEGORIES.reduce((acc, category) => {
    acc[category.toLowerCase()] = category;
    return acc;
}, {});
const CATEGORY_ALIASES = {
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
    prediction: 'Prediction Market',
    'prediction market': 'Prediction Market',
    'prediction-market': 'Prediction Market',
    megmafia: 'Megamafia',
    megamafia: 'Megamafia',
    'badbunnz': 'Megamafia',
    payment: 'Megamafia',
    mobile: 'Mobile'
};
const canonicalizeCategory = (label) => {
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
const SPECIAL_DEFAULTS = { megamafia: false, mobile: false };
const toCategoryMeta = (labels) => {
    const categories = [];
    const traits = { ...SPECIAL_DEFAULTS };
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
const applySpecialFilters = (projects, filters) => {
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
const deriveCategoryCounts = (projects) => {
    return projects.reduce((acc, project) => {
        acc[project.primaryCategory] = (acc[project.primaryCategory] ?? 0) + 1;
        return acc;
    }, {});
};
const CATEGORY_ANCHOR_RADIUS = 220;
const CLUSTER_RADIUS_PADDING = 45;
const CLUSTER_COLLISION_ITERATIONS = 10;
const CLUSTER_PULL_STRENGTH = 0.18;
const ORBIT_BASE_RADIUS = 70;
const ORBIT_RING_GAP = 50;
const BASE_RING_SLOTS = 8;
const RING_SLOT_GROWTH = 4;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.4;
const SPECIAL_LINKS = {
    'bad-bunnz': ['prismfi', 'bunnzpaw', 'faster'],
    megalio: ['priority']
};
const ECOSYSTEM_HIGHLIGHTS = {
    'bad-bunnz': 'badbunnz',
    prismfi: 'badbunnz',
    faster: 'badbunnz',
    bunnzpaw: 'badbunnz',
    megalio: 'megalio',
    priority: 'megalio'
};
const resolveClusterAnchors = (clusters) => {
    const entries = Object.entries(clusters).map(([category, meta]) => ({
        category,
        position: { ...meta.anchor },
        radius: meta.radius
    }));
    if (entries.length < 2) {
        return entries.reduce((acc, entry) => {
            acc[entry.category] = entry.position;
            return acc;
        }, {});
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
    }, {});
};
const sortCategories = (labels) => CORE_CATEGORIES.filter((category) => labels.has(category));
const now = () => new Date();
const pruneIncentives = (entries) => {
    if (!entries) {
        return [];
    }
    const current = now().getTime();
    return entries.filter((entry) => new Date(entry.expiresAt).getTime() > current);
};
const registerAdjacency = (adjacency, source, target) => {
    if (source === target) {
        return;
    }
    if (!adjacency[source]) {
        adjacency[source] = new Set();
    }
    adjacency[source].add(target);
};
const clamp = (value, min, max) => {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
};
const computeLayout = (projects) => {
    const categoryBucket = new Set();
    const categoryCounts = {};
    const groupedByPrimary = new Map();
    const projectCategoryMeta = new Map();
    projects.forEach((project) => {
        const meta = toCategoryMeta(project.categories);
        categoryBucket.add(meta.primary);
        categoryCounts[meta.primary] = (categoryCounts[meta.primary] ?? 0) + 1;
        projectCategoryMeta.set(project.id, meta);
        if (!groupedByPrimary.has(meta.primary)) {
            groupedByPrimary.set(meta.primary, []);
        }
        groupedByPrimary.get(meta.primary).push(project);
    });
    const categories = sortCategories(categoryBucket);
    const categoryAnchors = {};
    const clusterStats = {};
    categories.forEach((category, index) => {
        const angle = (index / Math.max(categories.length, 1)) * Math.PI * 2;
        categoryAnchors[category] = {
            x: Math.cos(angle) * CATEGORY_ANCHOR_RADIUS,
            y: Math.sin(angle) * CATEGORY_ANCHOR_RADIUS
        };
    });
    const categoryAdjacency = {};
    const positionedProjects = [];
    categories.forEach((category) => {
        const group = groupedByPrimary.get(category);
        if (!group || group.length === 0) {
            return;
        }
        const anchor = categoryAnchors[category] ?? { x: 0, y: 0 };
        const arrangedIds = [];
        let processed = 0;
        let ringIndex = 0;
        let maxOrbitRadius = 0;
        while (processed < group.length) {
            const slotsInRing = Math.min(BASE_RING_SLOTS + ringIndex * RING_SLOT_GROWTH, group.length - processed);
            const rotationOffset = (((category.charCodeAt(0) + ringIndex * 17) % 360) * Math.PI) / 180;
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
                    highlight: ECOSYSTEM_HIGHLIGHTS[project.id],
                    traits: meta.traits
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
    return { projects: positionedProjects, categories, categoryCounts };
};
const defaultCamera = () => ({
    x: 0,
    y: 0,
    zoom: 1,
    targetX: 0,
    targetY: 0,
    targetZoom: 1
});
const ConstellationContext = createContext(undefined);
export const ConstellationProvider = ({ children }) => {
    const layout = useMemo(() => computeLayout(rawProjects), []);
    const [state, setState] = useState(() => {
        const filters = { ...SPECIAL_DEFAULTS };
        const filteredProjects = applySpecialFilters(layout.projects, filters);
        return {
            projects: filteredProjects,
            categories: layout.categories,
            categoryCounts: deriveCategoryCounts(filteredProjects),
            activeCategory: null,
            hoveredProjectId: null,
            selectedProjectId: null,
            camera: defaultCamera(),
            filters
        };
    });
    const setActiveCategory = useCallback((category) => {
        setState((prev) => {
            if (prev.activeCategory === category) {
                return prev;
            }
            let targetX = 0;
            let targetY = 0;
            let targetZoom = 1;
            if (category) {
                const projectsInCategory = prev.projects.filter((project) => project.primaryCategory === category);
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
    const toggleFilter = useCallback((filterKey) => {
        setState((prev) => {
            const nextFilters = { ...prev.filters, [filterKey]: !prev.filters[filterKey] };
            const filteredProjects = applySpecialFilters(layout.projects, nextFilters);
            const visibleIds = new Set(filteredProjects.map((project) => project.id));
            const nextCategoryCounts = deriveCategoryCounts(filteredProjects);
            const nextActiveCategory = prev.activeCategory &&
                filteredProjects.some((project) => project.primaryCategory === prev.activeCategory)
                ? prev.activeCategory
                : null;
            return {
                ...prev,
                filters: nextFilters,
                projects: filteredProjects,
                categoryCounts: nextCategoryCounts,
                hoveredProjectId: prev.hoveredProjectId && visibleIds.has(prev.hoveredProjectId)
                    ? prev.hoveredProjectId
                    : null,
                selectedProjectId: prev.selectedProjectId && visibleIds.has(prev.selectedProjectId)
                    ? prev.selectedProjectId
                    : null,
                activeCategory: nextActiveCategory
            };
        });
    }, [layout.projects]);
    const setHoveredProject = useCallback((projectId) => {
        setState((prev) => {
            if (prev.hoveredProjectId === projectId) {
                return prev;
            }
            return { ...prev, hoveredProjectId: projectId };
        });
    }, []);
    const selectProject = useCallback((projectId) => {
        setState((prev) => {
            if (prev.selectedProjectId === projectId) {
                return prev;
            }
            return { ...prev, selectedProjectId: projectId };
        });
    }, []);
    const panCamera = useCallback((deltaX, deltaY) => {
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
    const zoomCamera = useCallback((deltaZoom, focus) => {
        setState((prev) => {
            const nextZoom = clamp(prev.camera.targetZoom + deltaZoom, MIN_ZOOM, MAX_ZOOM);
            if (nextZoom === prev.camera.targetZoom) {
                return prev;
            }
            let targetX = prev.camera.targetX;
            let targetY = prev.camera.targetY;
            if (focus) {
                const blend = 0.25;
                targetX = focus.x * blend + targetX * (1 - blend);
                targetY = focus.y * blend + targetY * (1 - blend);
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
        setState((prev) => ({
            ...prev,
            activeCategory: null,
            camera: { ...prev.camera, targetX: 0, targetY: 0, targetZoom: 1 }
        }));
    }, []);
    useEffect(() => {
        let animationFrame;
        const tick = () => {
            setState((prev) => {
                const { camera } = prev;
                const lerp = (value, target) => value + (target - value) * 0.08;
                const nextX = lerp(camera.x, camera.targetX);
                const nextY = lerp(camera.y, camera.targetY);
                const nextZoom = lerp(camera.zoom, camera.targetZoom);
                const closeEnough = Math.abs(nextX - camera.x) < 0.01 &&
                    Math.abs(nextY - camera.y) < 0.01 &&
                    Math.abs(nextZoom - camera.zoom) < 0.01;
                if (closeEnough) {
                    if (camera.x === camera.targetX &&
                        camera.y === camera.targetY &&
                        camera.zoom === camera.targetZoom) {
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
    const value = useMemo(() => ({
        ...state,
        setActiveCategory,
        setHoveredProject,
        selectProject,
        panCamera,
        zoomCamera,
        resetCamera,
        toggleFilter
    }), [
        state,
        setActiveCategory,
        setHoveredProject,
        selectProject,
        panCamera,
        zoomCamera,
        resetCamera,
        toggleFilter
    ]);
    return _jsx(ConstellationContext.Provider, { value: value, children: children });
};
export const useConstellation = () => {
    const context = useContext(ConstellationContext);
    if (!context) {
        throw new Error('useConstellation must be used inside ConstellationProvider');
    }
    return context;
};

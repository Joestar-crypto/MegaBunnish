import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import rawProjects from '../data/projects.json';
const CATEGORY_ORDER = [
    'Megamafia',
    'Defi',
    'Dex',
    'Lending',
    'Perps',
    'BadBunnz',
    'Social',
    'Trading',
    'Meme',
    'Launchpads',
    'Depin',
    'Prediction Market',
    'AI',
    'Others',
    'NFT',
    'Mobile',
    'Gaming',
    'RWA',
    'Gatcha',
    'Gambling',
    'Payment',
    'WTF?',
    'LST',
    'Tools',
    'Bridge',
    'Stablecoins'
];
const CATEGORY_ANCHOR_RADIUS = 430;
const ORBIT_BASE_RADIUS = 90;
const ORBIT_RING_GAP = 65;
const BASE_RING_SLOTS = 6;
const RING_SLOT_GROWTH = 5;
const PARENT_RELATIONS = {
    'bad-bunnz': ['prismfi', 'bunnzpaw', 'faster'],
    megalio: ['priority']
};
const sortCategories = (labels) => {
    const extras = Array.from(labels).filter((label) => !CATEGORY_ORDER.includes(label)).sort();
    return [...CATEGORY_ORDER, ...extras];
};
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
const computeLayout = (projects) => {
    const categoryBucket = new Set();
    const categoryCounts = {};
    const groupedByPrimary = new Map();
    projects.forEach((project) => {
        const categories = project.categories.length > 0 ? project.categories : ['Others'];
        categories.forEach((label) => {
            categoryBucket.add(label);
            categoryCounts[label] = (categoryCounts[label] ?? 0) + 1;
        });
        const primaryCategory = categories[0];
        if (!groupedByPrimary.has(primaryCategory)) {
            groupedByPrimary.set(primaryCategory, []);
        }
        groupedByPrimary.get(primaryCategory).push(project);
    });
    const categories = sortCategories(categoryBucket);
    const categoryAnchors = {};
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
        while (processed < group.length) {
            const slotsInRing = Math.min(BASE_RING_SLOTS + ringIndex * RING_SLOT_GROWTH, group.length - processed);
            const rotationOffset = (((category.charCodeAt(0) + ringIndex * 17) % 360) * Math.PI) / 180;
            for (let slot = 0; slot < slotsInRing; slot += 1) {
                const project = group[processed + slot];
                const categoriesForProject = project.categories.length > 0 ? project.categories : ['Others'];
                const primaryCategory = categoriesForProject[0];
                const baseAngle = (slot / slotsInRing) * Math.PI * 2 + rotationOffset;
                const jitter = (((project.id.charCodeAt(0) + slot * 31) % 100) / 100 - 0.5) * 0.25;
                const radiusJitter = ((project.id.length * 13) % 9) - 4;
                const orbitRadius = ORBIT_BASE_RADIUS + ringIndex * ORBIT_RING_GAP + radiusJitter;
                const angle = baseAngle + jitter;
                const x = anchor.x + Math.cos(angle) * orbitRadius;
                const y = anchor.y + Math.sin(angle) * orbitRadius;
                positionedProjects.push({
                    ...project,
                    categories: categoriesForProject,
                    primaryCategory,
                    incentives: pruneIncentives(project.incentives),
                    linkedIds: [...(project.linkedIds ?? [])],
                    clusterOrigin: anchor,
                    position: { x, y }
                });
                arrangedIds.push(project.id);
            }
            processed += slotsInRing;
            ringIndex += 1;
        }
        if (arrangedIds.length > 1) {
            arrangedIds.forEach((projectId, index) => {
                const prev = arrangedIds[(index - 1 + arrangedIds.length) % arrangedIds.length];
                const next = arrangedIds[(index + 1) % arrangedIds.length];
                registerAdjacency(categoryAdjacency, projectId, prev);
                registerAdjacency(categoryAdjacency, projectId, next);
            });
        }
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
    const [state, setState] = useState({
        projects: layout.projects,
        categories: layout.categories,
        categoryCounts: layout.categoryCounts,
        activeCategory: null,
        hoveredProjectId: null,
        selectedProjectId: null,
        camera: defaultCamera()
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
                const projectsInCategory = prev.projects.filter((project) => project.categories.includes(category));
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
        resetCamera
    }), [state, setActiveCategory, setHoveredProject, selectProject, panCamera, resetCamera]);
    return _jsx(ConstellationContext.Provider, { value: value, children: children });
};
export const useConstellation = () => {
    const context = useContext(ConstellationContext);
    if (!context) {
        throw new Error('useConstellation must be used inside ConstellationProvider');
    }
    return context;
};

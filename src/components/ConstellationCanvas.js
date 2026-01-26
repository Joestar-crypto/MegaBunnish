import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConstellation } from '../state/constellation';
const palette = [
    '#4ef1ff',
    '#ff9a62',
    '#9b6bff',
    '#6fffc8',
    '#ff6f91',
    '#f8d477',
    '#66f2a2',
    '#b992ff',
    '#ff7ad9',
    '#ffd966',
    '#7ad6ff',
    '#9ff7c1',
    '#ffb6c1',
    '#c4a2ff'
];
const categoryColor = (category) => {
    const hash = category
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palette[hash % palette.length];
};
const defaultPointerState = {
    isDragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    hasMoved: false
};
const useImageCache = (projects) => {
    const cache = useMemo(() => new Map(), []);
    useEffect(() => {
        projects.forEach((project) => {
            if (!cache.has(project.logo)) {
                const image = new Image();
                image.src = project.logo;
                cache.set(project.logo, image);
            }
        });
    }, [cache, projects]);
    return cache;
};
const generateStars = () => Array.from({ length: 120 }, () => ({
    x: Math.random(),
    y: Math.random(),
    radius: Math.random() * 1.5 + 0.2,
    speed: Math.random() * 0.6 + 0.2
}));
const worldFromClient = (event, rect, cameraX, cameraY, zoom) => {
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    const worldX = (relativeX - rect.width / 2) / zoom + cameraX;
    const worldY = (relativeY - rect.height / 2) / zoom + cameraY;
    return { worldX, worldY };
};
const findHitProject = (clientEvent, rect, projects, cameraX, cameraY, zoom) => {
    const { worldX, worldY } = worldFromClient(clientEvent, rect, cameraX, cameraY, zoom);
    const hitRadius = 42;
    for (const project of projects) {
        const dx = worldX - project.position.x;
        const dy = worldY - project.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= hitRadius) {
            return project;
        }
    }
    return null;
};
export const ConstellationCanvas = () => {
    const canvasRef = useRef(null);
    const [pointerState, setPointerState] = useState(defaultPointerState);
    const stars = useMemo(generateStars, []);
    const { projects, camera, hoveredProjectId, selectedProjectId, setHoveredProject, selectProject, panCamera } = useConstellation();
    const images = useImageCache(projects);
    const cameraRef = useRef(camera);
    const hoveredRef = useRef(hoveredProjectId);
    const selectedRef = useRef(selectedProjectId);
    useEffect(() => {
        cameraRef.current = camera;
    }, [camera]);
    useEffect(() => {
        hoveredRef.current = hoveredProjectId;
    }, [hoveredProjectId]);
    useEffect(() => {
        selectedRef.current = selectedProjectId;
    }, [selectedProjectId]);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const context = canvas.getContext('2d');
        if (!context) {
            return;
        }
        let animationFrame;
        let dpr = window.devicePixelRatio || 1;
        const resize = () => {
            const { width, height } = canvas.getBoundingClientRect();
            dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
        };
        resize();
        const handleResize = () => resize();
        window.addEventListener('resize', handleResize);
        const render = (time) => {
            const width = canvas.width / dpr;
            const height = canvas.height / dpr;
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.scale(dpr, dpr);
            context.fillStyle = 'rgba(5, 8, 20, 0.9)';
            context.fillRect(0, 0, width, height);
            stars.forEach((star) => {
                const drift = Math.sin(time * 0.0002 * star.speed) * 5;
                context.beginPath();
                context.fillStyle = 'rgba(255, 255, 255, 0.6)';
                context.arc(star.x * width + drift, star.y * height + drift, star.radius, 0, Math.PI * 2);
                context.fill();
            });
            const cameraState = cameraRef.current;
            const hoveredId = hoveredRef.current;
            const selectedId = selectedRef.current;
            const toScreen = (point) => ({
                x: (point.x - cameraState.x) * cameraState.zoom + width / 2,
                y: (point.y - cameraState.y) * cameraState.zoom + height / 2
            });
            const orbitMeta = new Map();
            projects.forEach((project) => {
                const key = project.primaryCategory;
                const origin = project.clusterOrigin;
                const distance = Math.hypot(project.position.x - origin.x, project.position.y - origin.y);
                const existing = orbitMeta.get(key);
                const nextRadius = Math.max(distance + 50, existing?.radius ?? 0);
                if (!existing) {
                    orbitMeta.set(key, { origin, radius: nextRadius });
                }
                else if (nextRadius > existing.radius) {
                    orbitMeta.set(key, { origin, radius: nextRadius });
                }
            });
            orbitMeta.forEach(({ origin, radius }) => {
                const center = toScreen(origin);
                const screenRadius = Math.max((radius + 20) * cameraState.zoom, 30);
                context.beginPath();
                context.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                context.lineWidth = 1;
                context.arc(center.x, center.y, screenRadius, 0, Math.PI * 2);
                context.stroke();
                const gradient = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, screenRadius);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.015)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                context.beginPath();
                context.fillStyle = gradient;
                context.arc(center.x, center.y, screenRadius, 0, Math.PI * 2);
                context.fill();
            });
            projects.forEach((project, index) => {
                const { x, y } = toScreen(project.position);
                const pulse = Math.sin(time * 0.002 + index) * 4;
                const baseRadius = 36;
                const radius = baseRadius + pulse + (project.id === hoveredId ? 6 : 0);
                context.beginPath();
                context.fillStyle = 'rgba(255, 255, 255, 0.08)';
                context.arc(x, y, radius + 10, 0, Math.PI * 2);
                context.fill();
                context.beginPath();
                context.strokeStyle = categoryColor(project.primaryCategory);
                context.lineWidth = project.id === selectedId ? 4 : 2;
                context.arc(x, y, radius, 0, Math.PI * 2);
                context.stroke();
                const image = images.get(project.logo);
                if (image && image.complete) {
                    context.save();
                    context.beginPath();
                    context.arc(x, y, radius - 6, 0, Math.PI * 2);
                    context.closePath();
                    context.clip();
                    context.drawImage(image, x - (radius - 6), y - (radius - 6), (radius - 6) * 2, (radius - 6) * 2);
                    context.restore();
                }
                else {
                    context.fillStyle = categoryColor(project.primaryCategory);
                    context.beginPath();
                    context.arc(x, y, radius - 6, 0, Math.PI * 2);
                    context.fill();
                    context.fillStyle = '#05060f';
                    context.font = '600 14px Space Grotesk, sans-serif';
                    context.textAlign = 'center';
                    context.textBaseline = 'middle';
                    context.fillText(project.name[0]?.toUpperCase() ?? '?', x, y);
                }
                context.fillStyle = 'rgba(255, 255, 255, 0.7)';
                context.font = '12px Space Grotesk, sans-serif';
                context.textAlign = 'center';
                context.fillText(project.name, x, y + radius + 14);
            });
            animationFrame = requestAnimationFrame(render);
        };
        animationFrame = requestAnimationFrame(render);
        return () => {
            cancelAnimationFrame(animationFrame);
            window.removeEventListener('resize', handleResize);
        };
    }, [projects, images, stars]);
    const handlePointerDown = (event) => {
        if (!canvasRef.current || event.button !== 0) {
            return;
        }
        canvasRef.current.setPointerCapture(event.pointerId);
        setPointerState({
            isDragging: true,
            pointerId: event.pointerId,
            lastX: event.clientX,
            lastY: event.clientY,
            hasMoved: false
        });
    };
    const handlePointerMove = (event) => {
        if (!canvasRef.current) {
            return;
        }
        if (pointerState.isDragging && pointerState.pointerId === event.pointerId) {
            const deltaX = event.clientX - pointerState.lastX;
            const deltaY = event.clientY - pointerState.lastY;
            const nextHasMoved = pointerState.hasMoved || Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2;
            if (nextHasMoved) {
                panCamera(deltaX, deltaY);
            }
            setPointerState((prev) => ({
                ...prev,
                lastX: event.clientX,
                lastY: event.clientY,
                hasMoved: nextHasMoved
            }));
            return;
        }
        const rect = canvasRef.current.getBoundingClientRect();
        const hit = findHitProject(event.nativeEvent, rect, projects, camera.x, camera.y, camera.zoom);
        setHoveredProject(hit?.id ?? null);
    };
    const handlePointerUp = (event) => {
        if (!canvasRef.current) {
            return;
        }
        if (pointerState.isDragging && pointerState.pointerId === event.pointerId) {
            if (!pointerState.hasMoved) {
                const rect = canvasRef.current.getBoundingClientRect();
                const hit = findHitProject(event.nativeEvent, rect, projects, camera.x, camera.y, camera.zoom);
                if (hit) {
                    selectProject(hit.id);
                }
                else {
                    selectProject(null);
                }
            }
            canvasRef.current.releasePointerCapture(event.pointerId);
            setPointerState(defaultPointerState);
        }
    };
    const handlePointerLeave = () => {
        setHoveredProject(null);
        if (canvasRef.current && pointerState.pointerId !== null) {
            canvasRef.current.releasePointerCapture(pointerState.pointerId);
        }
        setPointerState(defaultPointerState);
    };
    return (_jsx("canvas", { ref: canvasRef, className: "constellation-canvas", onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp, onPointerLeave: handlePointerLeave, onContextMenu: (event) => event.preventDefault() }));
};

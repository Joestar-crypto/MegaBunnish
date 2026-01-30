import { useEffect, useMemo, useRef, useState } from 'react';
import { useConstellation } from '../state/constellation';
import { ConstellationProject, HighlightVariant } from '../types';
import { getCategoryColor } from '../utils/colors';

const highlightStyles: Record<HighlightVariant, { stroke: string; glow: string; halo: string }> = {
  badbunnz: {
    stroke: '#ff6f91',
    glow: 'rgba(255, 111, 145, 0.45)',
    halo: 'rgba(255, 111, 145, 0.22)'
  },
  megalio: {
    stroke: '#b58bff',
    glow: 'rgba(181, 139, 255, 0.45)',
    halo: 'rgba(181, 139, 255, 0.22)'
  }
};

const STAR_RADIUS = 9;
const CATEGORY_RING_PADDING = 70;
const CATEGORY_RING_MIN_RADIUS = 60;
const CATEGORY_LABEL_INSET = 18;

const drawFavoriteStar = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  isFavorite: boolean
) => {
  const spikes = 5;
  const outerRadius = STAR_RADIUS;
  const innerRadius = STAR_RADIUS * 0.5;
  const step = Math.PI / spikes;

  context.save();
  context.translate(x, y);
  context.beginPath();
  context.moveTo(0, -outerRadius);
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * step - Math.PI / 2;
    context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  context.closePath();
  context.fillStyle = isFavorite ? '#ffd84d' : 'rgba(255, 255, 255, 0.08)';
  context.strokeStyle = isFavorite ? '#ffeaa0' : 'rgba(255, 255, 255, 0.35)';
  context.lineWidth = isFavorite ? 1.6 : 1.2;
  context.shadowColor = isFavorite ? 'rgba(255, 216, 77, 0.65)' : 'transparent';
  context.shadowBlur = isFavorite ? 18 : 0;
  context.fill();
  context.stroke();
  context.restore();
};

const drawIncentiveBell = (context: CanvasRenderingContext2D, x: number, y: number) => {
  context.save();
  context.translate(x, y);
  context.beginPath();
  context.fillStyle = '#ff5d77';
  context.strokeStyle = '#ff9fb1';
  context.lineWidth = 1.5;
  context.moveTo(0, -8);
  context.quadraticCurveTo(8, -8, 8, 0);
  context.lineTo(10, 6);
  context.quadraticCurveTo(10.5, 8, 8.5, 8);
  context.lineTo(-8.5, 8);
  context.quadraticCurveTo(-10.5, 8, -10, 6);
  context.lineTo(-8, 0);
  context.quadraticCurveTo(-8, -8, 0, -8);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(-4, 12);
  context.quadraticCurveTo(0, 14, 4, 12);
  context.stroke();
  context.restore();
};

type PointerState = {
  isDragging: boolean;
  pointerId: number | null;
  lastX: number;
  lastY: number;
  hasMoved: boolean;
};

const defaultPointerState: PointerState = {
  isDragging: false,
  pointerId: null,
  lastX: 0,
  lastY: 0,
  hasMoved: false
};

type ClientLikeEvent = { clientX: number; clientY: number };

type PinchState = {
  activePointers: Map<number, { x: number; y: number }>;
  originDistance: number;
  initialZoom: number;
  focus: { x: number; y: number } | null;
  isPinching: boolean;
};

const useImageCache = (projects: ConstellationProject[]) => {
  const cache = useMemo(() => new Map<string, HTMLImageElement>(), []);

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

const generateStars = () =>
  Array.from({ length: 260 }, () => ({
    x: Math.random(),
    y: Math.random(),
    radius: Math.random() * 1.4 + 0.2,
    speed: Math.random() * 0.4 + 0.2,
    twinkle: Math.random() * Math.PI * 2
  }));

const worldFromClient = (
  event: ClientLikeEvent,
  rect: DOMRect,
  cameraX: number,
  cameraY: number,
  zoom: number
) => {
  const relativeX = event.clientX - rect.left;
  const relativeY = event.clientY - rect.top;
  const worldX = (relativeX - rect.width / 2) / zoom + cameraX;
  const worldY = (relativeY - rect.height / 2) / zoom + cameraY;
  return { worldX, worldY };
};

const findHitProject = (
  clientEvent: ClientLikeEvent,
  rect: DOMRect,
  projects: ConstellationProject[],
  cameraX: number,
  cameraY: number,
  zoom: number
) => {
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

type ConstellationCanvasProps = {
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

export const ConstellationCanvas = ({
  onInteractionStart,
  onInteractionEnd
}: ConstellationCanvasProps = {}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pointerState, setPointerState] = useState<PointerState>(defaultPointerState);
  const pinchStateRef = useRef<PinchState>({
    activePointers: new Map(),
    originDistance: 0,
    initialZoom: 1,
    focus: null,
    isPinching: false
  });
  const stars = useMemo(generateStars, []);
  const {
    projects,
    camera,
    hoveredProjectId,
    selectedProjectId,
    setHoveredProject,
    selectProject,
    panCamera,
    zoomCamera,
    favoriteIds
  } = useConstellation();
  const images = useImageCache(projects);
  const cameraRef = useRef(camera);
  const hoveredRef = useRef(hoveredProjectId);
  const selectedRef = useRef(selectedProjectId);
  const hoveredCategoryRef = useRef<string | null>(null);
  const categoryRingsRef = useRef<
    { category: string; origin: { x: number; y: number }; radius: number }
  >([]);
  const interactionActiveRef = useRef(false);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const updateCategoryHoverState = (clientX: number, clientY: number, rect?: DOMRect) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const bounds = rect ?? canvas.getBoundingClientRect();
    const { worldX, worldY } = worldFromClient(
      { clientX, clientY },
      bounds,
      cameraRef.current.x,
      cameraRef.current.y,
      cameraRef.current.zoom
    );
    const rings = categoryRingsRef.current;
    let nextCategory: string | null = null;
    for (const ring of rings) {
      const dx = worldX - ring.origin.x;
      const dy = worldY - ring.origin.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= ring.radius) {
        nextCategory = ring.category;
        break;
      }
    }
    if (hoveredCategoryRef.current !== nextCategory) {
      hoveredCategoryRef.current = nextCategory;
    }
  };

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

    let animationFrame: number;
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

    const projectById = new Map(projects.map((project) => [project.id, project]));

    const render = (time: number) => {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(dpr, dpr);

      context.fillStyle = '#000000';
      context.fillRect(0, 0, width, height);

      stars.forEach((star, idx) => {
        const drift = Math.sin(time * 0.0002 * star.speed + idx) * 4;
        const brightness = 0.35 + ((Math.sin(time * 0.001 * star.speed + star.twinkle) + 1) / 2) * 0.45;
        context.beginPath();
        context.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        context.arc(star.x * width + drift, star.y * height + drift, star.radius, 0, Math.PI * 2);
        context.fill();
      });

      const cameraState = cameraRef.current;
      const hoveredId = hoveredRef.current;
      const selectedId = selectedRef.current;
      const toScreen = (point: { x: number; y: number }) => ({
        x: (point.x - cameraState.x) * cameraState.zoom + width / 2,
        y: (point.y - cameraState.y) * cameraState.zoom + height / 2
      });
      const hoveredCategory = hoveredCategoryRef.current;

      const orbitMeta = new Map<
        string,
        { origin: { x: number; y: number }; radius: number; color: string }
      >();
      projects.forEach((project) => {
        const key = project.primaryCategory;
        const origin = project.clusterOrigin;
        const distance = Math.hypot(project.position.x - origin.x, project.position.y - origin.y);
        const existing = orbitMeta.get(key);
        if (!existing) {
          orbitMeta.set(key, {
            origin,
            radius: distance,
            color: getCategoryColor(key)
          });
          return;
        }
        if (distance > existing.radius) {
          existing.radius = distance;
        }
      });

      const categoryLabels: { x: number; y: number; text: string; color: string; fontSize: number }[] = [];
      const nextCategoryRings: {
        category: string;
        origin: { x: number; y: number };
        radius: number;
      }[] = [];

      orbitMeta.forEach(({ origin, radius, color }, category) => {
        const center = toScreen(origin);
        const paddedRadius = radius + CATEGORY_RING_PADDING;
        const screenRadius = Math.max(paddedRadius * cameraState.zoom, CATEGORY_RING_MIN_RADIUS);

        nextCategoryRings.push({ category, origin, radius: paddedRadius });

        context.save();
        context.beginPath();
        context.strokeStyle = color;
        context.globalAlpha = 0.22;
        context.lineWidth = 1.25;
        context.shadowColor = color;
        context.shadowBlur = 14;
        context.arc(center.x, center.y, screenRadius, 0, Math.PI * 2);
        context.stroke();
        context.restore();

        if (hoveredCategory === category) {
          const fontSize = Math.max(11, 11.5 * Math.min(1.25, cameraState.zoom + 0.2));
          const labelY = center.y - screenRadius + CATEGORY_LABEL_INSET;
          categoryLabels.push({ x: center.x, y: labelY, text: category, color, fontSize });
        }
      });

      categoryRingsRef.current = nextCategoryRings;

      const drawnLinks = new Set<string>();
      projects.forEach((project, index) => {
        const sourceScreen = toScreen(project.position);
        project.linkedIds.forEach((linkedId) => {
          const target = projectById.get(linkedId);
          if (!target) {
            return;
          }
          const key = project.id < linkedId ? `${project.id}|${linkedId}` : `${linkedId}|${project.id}`;
          if (drawnLinks.has(key)) {
            return;
          }
          drawnLinks.add(key);

          const targetScreen = toScreen(target.position);
          const curvature = Math.sin((project.position.x + target.position.y + index) * 0.001) * 35;
          const controlX = (sourceScreen.x + targetScreen.x) / 2 + curvature;
          const controlY = (sourceScreen.y + targetScreen.y) / 2 - curvature;
          const sourceHighlight = project.highlight ? highlightStyles[project.highlight] : null;
          const targetHighlight = target.highlight ? highlightStyles[target.highlight] : null;
          const sharedHighlight =
            project.highlight && project.highlight === target.highlight
              ? highlightStyles[project.highlight]
              : null;
          const stroke =
            sharedHighlight?.stroke ?? sourceHighlight?.stroke ?? targetHighlight?.stroke ?? 'rgba(78, 241, 255, 0.2)';
          const glow =
            sharedHighlight?.glow ?? sourceHighlight?.glow ?? targetHighlight?.glow ?? 'rgba(78, 241, 255, 0.28)';
          const pulse = (Math.sin(time * 0.0015 + index) + 2) / 3;
          const baseWidth = sharedHighlight ? 1.6 : 0.8;
          const pulseWidth = sharedHighlight ? 0.9 : 0.6;
          const baseAlpha = sharedHighlight ? 0.28 : 0.18;
          const alphaPulse = sharedHighlight ? 0.32 : 0.25;
          const shadowBlur = sharedHighlight ? 24 : 16;

          context.save();
          context.globalAlpha = baseAlpha + pulse * alphaPulse;
          context.strokeStyle = stroke;
          context.lineWidth = baseWidth + pulse * pulseWidth;
          context.shadowBlur = shadowBlur;
          context.shadowColor = glow;
          context.beginPath();
          context.moveTo(sourceScreen.x, sourceScreen.y);
          context.quadraticCurveTo(controlX, controlY, targetScreen.x, targetScreen.y);
          context.stroke();
          context.restore();
        });
      });

      projects.forEach((project, index) => {
        const { x, y } = toScreen(project.position);
        const pulse = Math.sin(time * 0.002 + index) * 4;
        const baseRadius = 36;
        const radius = baseRadius + pulse + (project.id === hoveredId ? 6 : 0);
        const highlightStyle = project.highlight ? highlightStyles[project.highlight] : null;
        const baseLineWidth = project.id === selectedId ? 4 : 2;
        const isFavorite = favoriteSet.has(project.id);

        context.beginPath();
        context.fillStyle = 'rgba(255, 255, 255, 0.08)';
        context.arc(x, y, radius + 10, 0, Math.PI * 2);
        context.fill();

        if (highlightStyle) {
          context.save();
          const haloRadius = radius + 24;
          const haloGradient = context.createRadialGradient(x, y, radius, x, y, haloRadius);
          haloGradient.addColorStop(0, highlightStyle.halo);
          haloGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          context.fillStyle = haloGradient;
          context.beginPath();
          context.arc(x, y, haloRadius, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }

        const nodeColor = getCategoryColor(project.primaryCategory);
        context.beginPath();
        context.strokeStyle = nodeColor;
        context.lineWidth = baseLineWidth;
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.stroke();

        if (highlightStyle) {
          context.save();
          context.strokeStyle = highlightStyle.stroke;
          context.lineWidth = baseLineWidth + 2;
          context.shadowColor = highlightStyle.glow;
          context.shadowBlur = 25;
          context.beginPath();
          context.arc(x, y, radius + 4, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }

        const image = images.get(project.logo);
        const canRenderImage =
          image &&
          image.complete &&
          image.naturalWidth > 0 &&
          image.naturalHeight > 0;
        if (canRenderImage) {
          context.save();
          context.beginPath();
          context.arc(x, y, radius - 6, 0, Math.PI * 2);
          context.closePath();
          context.clip();
          try {
            context.drawImage(
              image,
              x - (radius - 6),
              y - (radius - 6),
              (radius - 6) * 2,
              (radius - 6) * 2
            );
          } catch (err) {
            console.warn('Failed to draw project logo', project.id, err);
          }
          context.restore();
        } else {
          context.fillStyle = nodeColor;
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

        if (isFavorite) {
          const starOffset = Math.max(radius * 0.65, radius - 12);
          const starX = x + starOffset;
          const starY = y - starOffset;
          drawFavoriteStar(context, starX, starY, true);
        }

        if (project.incentives.length > 0) {
          const bellOffset = Math.max(radius * 0.7, radius - 8);
          drawIncentiveBell(context, x - bellOffset, y - bellOffset);
        }
      });

      categoryLabels.forEach(({ x, y, text, color, fontSize }) => {
        context.save();
        context.font = `600 ${fontSize}px Space Grotesk, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.lineWidth = 4;
        context.strokeStyle = 'rgba(5, 6, 18, 0.85)';
        context.globalAlpha = 0.9;
        context.strokeText(text, x, y);
        context.fillStyle = color;
        context.globalAlpha = 0.95;
        context.fillText(text, x, y);
        context.restore();
      });

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, [projects, images, stars, favoriteSet]);

  const endInteraction = () => {
    if (interactionActiveRef.current) {
      interactionActiveRef.current = false;
      onInteractionEnd?.();
    }
  };

  const beginPinchGesture = () => {
    const pinchState = pinchStateRef.current;
    if (!canvasRef.current || pinchState.activePointers.size < 2) {
      return;
    }
    const [first, second] = Array.from(pinchState.activePointers.values());
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    if (!distance || !isFinite(distance)) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const midpointX = (first.x + second.x) / 2;
    const midpointY = (first.y + second.y) / 2;
    const { worldX, worldY } = worldFromClient(
      { clientX: midpointX, clientY: midpointY },
      rect,
      cameraRef.current.x,
      cameraRef.current.y,
      cameraRef.current.zoom
    );

    pinchState.originDistance = distance;
    pinchState.initialZoom = cameraRef.current.targetZoom;
    pinchState.focus = { x: worldX, y: worldY };
    pinchState.isPinching = true;
    setPointerState(defaultPointerState);

    if (!interactionActiveRef.current) {
      interactionActiveRef.current = true;
      onInteractionStart?.();
    }
  };

  const updatePinchZoom = () => {
    const pinchState = pinchStateRef.current;
    if (!pinchState.isPinching || pinchState.originDistance <= 0 || !pinchState.focus) {
      return;
    }
    const [first, second] = Array.from(pinchState.activePointers.values());
    if (!first || !second) {
      return;
    }
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    if (!distance || !isFinite(distance)) {
      return;
    }
    const ratio = distance / pinchState.originDistance;
    if (!isFinite(ratio) || ratio <= 0) {
      return;
    }
    const targetZoom = pinchState.initialZoom * ratio;
    const deltaZoom = targetZoom - cameraRef.current.targetZoom;
    if (Math.abs(deltaZoom) < 0.001) {
      return;
    }
    zoomCamera(deltaZoom, pinchState.focus);
  };

  const registerTouchPoint = (pointerId: number, position: { x: number; y: number }) => {
    const pinchState = pinchStateRef.current;
    pinchState.activePointers.set(pointerId, position);
    if (pinchState.activePointers.size >= 2 && !pinchState.isPinching) {
      beginPinchGesture();
    }
  };

  const removeTouchPoint = (pointerId: number) => {
    const pinchState = pinchStateRef.current;
    pinchState.activePointers.delete(pointerId);
    if (pinchState.activePointers.size < 2 && pinchState.isPinching) {
      pinchState.isPinching = false;
      pinchState.originDistance = 0;
      pinchState.focus = null;
      endInteraction();
    }
  };

  const resetPinchState = () => {
    const pinchState = pinchStateRef.current;
    pinchState.activePointers.clear();
    pinchState.originDistance = 0;
    pinchState.focus = null;
    pinchState.isPinching = false;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    if (event.pointerType === 'touch') {
      registerTouchPoint(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    canvasRef.current.setPointerCapture(event.pointerId);

    if (pinchStateRef.current.isPinching) {
      return;
    }

    setPointerState({
      isDragging: true,
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      hasMoved: false
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) {
      return;
    }

    if (event.pointerType === 'touch' && pinchStateRef.current.activePointers.has(event.pointerId)) {
      pinchStateRef.current.activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
      });
      if (pinchStateRef.current.isPinching) {
        updatePinchZoom();
        return;
      }
    }

    if (pointerState.isDragging && pointerState.pointerId === event.pointerId) {
      const deltaX = event.clientX - pointerState.lastX;
      const deltaY = event.clientY - pointerState.lastY;
      const nextHasMoved =
        pointerState.hasMoved || Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2;
      if (nextHasMoved && !interactionActiveRef.current) {
        interactionActiveRef.current = true;
        onInteractionStart?.();
      }
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
    updateCategoryHoverState(event.clientX, event.clientY, rect);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) {
      return;
    }

    if (event.pointerType === 'touch') {
      removeTouchPoint(event.pointerId);
    }

    if (pointerState.isDragging && pointerState.pointerId === event.pointerId) {
      if (!pointerState.hasMoved) {
        const rect = canvasRef.current.getBoundingClientRect();
        const hit = findHitProject(event.nativeEvent, rect, projects, camera.x, camera.y, camera.zoom);
        if (hit) {
          selectProject(hit.id);
        } else {
          selectProject(null);
        }
      }

      setPointerState(defaultPointerState);
      endInteraction();
    }

    if (canvasRef.current.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerLeave = () => {
    setHoveredProject(null);
    hoveredCategoryRef.current = null;
    if (canvasRef.current && pointerState.pointerId !== null) {
      canvasRef.current.releasePointerCapture(pointerState.pointerId);
    }
    resetPinchState();
    setPointerState(defaultPointerState);
    endInteraction();
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) {
      return;
    }
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const { worldX, worldY } = worldFromClient(event.nativeEvent, rect, camera.x, camera.y, camera.zoom);
    const baseDelta = event.deltaY / (event.ctrlKey ? 350 : 650);
    const normalizedDelta = Math.max(Math.min(baseDelta, 0.35), -0.35);
    zoomCamera(-normalizedDelta, { x: worldX, y: worldY });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const handleCtrlWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };
    canvas.addEventListener('wheel', handleCtrlWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleCtrlWheel);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="constellation-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
      onContextMenu={(event) => event.preventDefault()}
    />
  );

};



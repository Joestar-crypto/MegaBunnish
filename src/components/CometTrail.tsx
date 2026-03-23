import { useEffect, useRef } from 'react';
import { useConstellation } from '../state/constellation';

// Points stored in world-space so the trail follows the map
type WorldPoint = { wx: number; wy: number; t: number };

const TRAIL_DURATION = 8000;
const MAX_POINTS = 400;

export const CometTrail = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const points = useRef<WorldPoint[]>([]);
  const rafId = useRef<number>(0);
  const { camera } = useConstellation();
  const cameraRef = useRef(camera);

  // Keep camera ref always fresh without re-running the effect
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? document.body);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cam = cameraRef.current;
      const w = rect.width;
      const h = rect.height;
      // Screen → world
      const wx = (e.clientX - rect.left - w / 2) / cam.zoom + cam.x;
      const wy = (e.clientY - rect.top - h / 2) / cam.zoom + cam.y;
      points.current.push({ wx, wy, t: performance.now() });
      if (points.current.length > MAX_POINTS) points.current.shift();
    };
    window.addEventListener('mousemove', onMove);

    const draw = () => {
      rafId.current = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const now = performance.now();
      points.current = points.current.filter(p => now - p.t < TRAIL_DURATION);

      const pts = points.current;
      if (pts.length < 2) return;

      const cam = cameraRef.current;

      // World → screen projection using current camera
      const toScreen = (p: WorldPoint) => ({
        sx: (p.wx - cam.x) * cam.zoom + w / 2,
        sy: (p.wy - cam.y) * cam.zoom + h / 2,
      });

      for (let i = 1; i < pts.length; i++) {
        const age = now - pts[i].t;
        const lifeRatio = 1 - age / TRAIL_DURATION;
        const posRatio = i / pts.length;

        const alpha = Math.pow(lifeRatio, 0.5) * posRatio;
        const lineWidth = posRatio * 8 * Math.pow(lifeRatio, 0.4);
        if (alpha <= 0 || lineWidth <= 0) continue;

        const from = toScreen(pts[i - 1]);
        const to = toScreen(pts[i]);

        const hue = 200 + posRatio * 40;
        const lightness = 70 + posRatio * 30;

        ctx.beginPath();
        ctx.moveTo(from.sx, from.sy);
        ctx.lineTo(to.sx, to.sy);
        ctx.strokeStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Glow at head
      const head = pts[pts.length - 1];
      if (head) {
        const headAge = now - head.t;
        if (headAge < 120) {
          const s = toScreen(head);
          const gAlpha = 1 - headAge / 120;
          const grad = ctx.createRadialGradient(s.sx, s.sy, 0, s.sx, s.sy, 10);
          grad.addColorStop(0, `rgba(200, 230, 255, ${gAlpha * 0.9})`);
          grad.addColorStop(1, 'rgba(200, 230, 255, 0)');
          ctx.beginPath();
          ctx.arc(s.sx, s.sy, 10, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener('mousemove', onMove);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
};

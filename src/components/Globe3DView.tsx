/**
 * Globe3DView — EXPERIMENTAL 3D mode for the constellation canvas.
 *
 * - Apps tile the sphere via a single fibonacci distribution (globally
 *   equidistant). When showing the global view, points are then *assigned*
 *   to category centers so each cluster is contiguous, and a faint colored
 *   ring is drawn around each cluster on the sphere surface.
 * - Tiles are spherical patches (true curvature) instead of flat circles.
 * - Multi-category mode places each globe at a random non-overlapping
 *   position in 3D space and dezooms accordingly.
 * - Drag rotates / wheel zooms / click on a *front-facing* tile opens the
 *   drawer and pauses rotation. Closing it resumes.
 * - Ethos overlay: small colored badge sprite tangent to the sphere under
 *   each scored tile, only visible while the tile is on the front hemisphere.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useConstellation } from '../state/constellation';
import type { ConstellationProject } from '../types';
import { ensureImage } from '../utils/imageCache';

const matchesCategory = (project: ConstellationProject, target: string) => {
  const t = target.toLowerCase();
  return project.categories.some((c) => c.toLowerCase() === t);
};

const fibonacciSphere = (n: number): THREE.Vector3[] => {
  const pts: THREE.Vector3[] = [];
  if (n <= 0) return pts;
  if (n === 1) return [new THREE.Vector3(0, 0, 1)];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }
  return pts;
};

// Stable color per category name.
const CATEGORY_PALETTE = [
  0xffd84d, 0x6cf2c7, 0xff7ab8, 0x7aa6ff, 0xffa86b, 0xb38cff, 0x6ee7ff, 0xffe27a,
  0xff5e7a, 0x9bff7a, 0xc9b6ff, 0x6affc1, 0xff9d3d, 0x4ed3ff, 0xff7bd6, 0xc7ff5a
];
const categoryColor = (name: string): number => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length];
};

// --- Texture helpers ---------------------------------------------------------

const ROUND_TEX_CACHE = new Map<string, THREE.Texture>();
const PENDING_LOADS = new Map<string, Set<(t: THREE.Texture) => void>>();
let NEUTRAL_PLACEHOLDER: THREE.Texture | null = null;

const buildNeutralPlaceholder = (): THREE.Texture => {
  if (NEUTRAL_PLACEHOLDER) return NEUTRAL_PLACEHOLDER;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(231, 233, 255, 0.32)');
  grad.addColorStop(1, 'rgba(231, 233, 255, 0.06)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  NEUTRAL_PLACEHOLDER = tex;
  return tex;
};

const buildRoundTextureFromImage = (image: HTMLImageElement, key: string): THREE.Texture => {
  const cached = ROUND_TEX_CACHE.get(key);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const ar = image.width / image.height;
  let dw = size;
  let dh = size;
  let dx = 0;
  let dy = 0;
  if (ar > 1) {
    dw = size * ar;
    dx = -(dw - size) / 2;
  } else if (ar < 1) {
    dh = size / ar;
    dy = -(dh - size) / 2;
  }
  ctx.drawImage(image, dx, dy, dw, dh);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  ROUND_TEX_CACHE.set(key, tex);
  return tex;
};

const requestLogoTexture = (
  logoPath: string | undefined,
  onReady: (tex: THREE.Texture) => void
) => {
  if (!logoPath) {
    onReady(buildNeutralPlaceholder());
    return;
  }
  const cached = ROUND_TEX_CACHE.get(logoPath);
  if (cached) {
    onReady(cached);
    return;
  }
  const pending = PENDING_LOADS.get(logoPath);
  if (pending) {
    pending.add(onReady);
    return;
  }
  const subscribers = new Set<(t: THREE.Texture) => void>([onReady]);
  PENDING_LOADS.set(logoPath, subscribers);
  // Reuse the shared <img> from the 2D cache when possible — if it has already
  // been decoded we can build the round texture synchronously and skip the
  // letter-placeholder flash that happens on a 2D ↔ 3D toggle.
  const img = ensureImage(logoPath);
  const finish = () => {
    const round = buildRoundTextureFromImage(img, logoPath);
    PENDING_LOADS.delete(logoPath);
    subscribers.forEach((s) => s(round));
  };
  if (img.complete && img.naturalWidth > 0) {
    finish();
    return;
  }
  img.addEventListener('load', finish, { once: true });
  img.addEventListener(
    'error',
    () => {
      const fb = buildNeutralPlaceholder();
      PENDING_LOADS.delete(logoPath);
      subscribers.forEach((s) => s(fb));
    },
    { once: true }
  );
};

// --- Spherical patch geometry (true curvature) ------------------------------

/**
 * Build a circular cap on the unit sphere centered on +Z, of half-angle alpha.
 * UVs map the cap to a disk of [0..1] so the round texture lines up.
 */
const buildSphericalPatchGeometry = (alpha: number, segments = 18): THREE.BufferGeometry => {
  const rings = Math.max(4, Math.round(segments * 0.6));
  const verts: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Center vertex
  verts.push(0, 0, 1);
  uvs.push(0.5, 0.5);

  for (let r = 1; r <= rings; r++) {
    const t = r / rings; // 0..1
    const theta = t * alpha;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let s = 0; s < segments; s++) {
      const phi = (s / segments) * Math.PI * 2;
      const x = sinT * Math.cos(phi);
      const y = sinT * Math.sin(phi);
      const z = cosT;
      verts.push(x, y, z);
      uvs.push(0.5 + 0.5 * t * Math.cos(phi), 0.5 + 0.5 * t * Math.sin(phi));
    }
  }

  // Inner ring connects to center
  for (let s = 0; s < segments; s++) {
    const a = 1 + s;
    const b = 1 + ((s + 1) % segments);
    indices.push(0, a, b);
  }
  // Subsequent rings
  for (let r = 1; r < rings; r++) {
    const offsetA = 1 + (r - 1) * segments;
    const offsetB = 1 + r * segments;
    for (let s = 0; s < segments; s++) {
      const a = offsetA + s;
      const b = offsetA + ((s + 1) % segments);
      const c = offsetB + s;
      const d = offsetB + ((s + 1) % segments);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
};

// --- Ethos badge texture ----------------------------------------------------

type EthosPalette = { start: string; end: string; text: string; stroke: string };
const ETHOS_TONES: { max: number; palette: EthosPalette }[] = [
  { max: 800, palette: { start: '#7a0215', end: '#ff2e49', text: '#fff5f7', stroke: '#ff6a80' } },
  { max: 1200, palette: { start: '#b67200', end: '#ffb11f', text: '#2b1600', stroke: '#ffc857' } },
  { max: 1400, palette: { start: '#f8f7f0', end: '#ffffff', text: '#0e142b', stroke: '#ffffff' } },
  { max: 1600, palette: { start: '#8ab0ff', end: '#bdd4ff', text: '#03102d', stroke: '#dfe9ff' } },
  { max: 1800, palette: { start: '#1c86ff', end: '#46b2ff', text: '#f1f8ff', stroke: '#72c8ff' } },
  { max: Number.POSITIVE_INFINITY, palette: { start: '#172d66', end: '#3049ad', text: '#e6edff', stroke: '#4f6fe1' } }
];
const ethosPaletteFor = (score: number): EthosPalette =>
  ETHOS_TONES.find((e) => score < e.max)?.palette ?? ETHOS_TONES[0].palette;

const ETHOS_BADGE_CACHE = new Map<number, { tex: THREE.CanvasTexture; w: number; h: number }>();
const buildEthosBadgeTexture = (score: number) => {
  const rounded = Math.round(score);
  const cached = ETHOS_BADGE_CACHE.get(rounded);
  if (cached) return cached;
  const dpr = 2;
  const padX = 13 * dpr;
  const fontSize = 22 * dpr;
  const height = 34 * dpr;
  const radius = 17 * dpr;
  const labelText = String(rounded);
  const tmp = document.createElement('canvas').getContext('2d')!;
  tmp.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
  const textW = tmp.measureText(labelText).width;
  const width = Math.ceil(padX * 2 + textW);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const palette = ethosPaletteFor(score);
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, palette.start);
  grad.addColorStop(1, palette.end);
  ctx.beginPath();
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(r, 0);
  ctx.lineTo(width - r, 0);
  ctx.quadraticCurveTo(width, 0, width, r);
  ctx.lineTo(width, height - r);
  ctx.quadraticCurveTo(width, height, width - r, height);
  ctx.lineTo(r, height);
  ctx.quadraticCurveTo(0, height, 0, height - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5 * dpr;
  ctx.strokeStyle = palette.stroke;
  ctx.stroke();
  ctx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
  ctx.fillStyle = palette.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, width / 2, height / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const entry = { tex, w: width, h: height };
  ETHOS_BADGE_CACHE.set(rounded, entry);
  return entry;
};

// --- Component ---------------------------------------------------------------

interface CategoryBucket {
  name: string;
  projects: ConstellationProject[];
}
interface Planet {
  title: string;
  projects: ConstellationProject[];
  buckets: CategoryBucket[];
  showClusters: boolean;
}

interface Globe3DViewProps {
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

/**
 * Assign the n fibonacci points to category buckets so that points
 * belonging to the same bucket end up close together on the sphere.
 * Returns: positions indexed by project index in `planet.projects`,
 * plus per-bucket centroid + max angular radius.
 */
const assignPointsToBuckets = (
  buckets: CategoryBucket[],
  fibPoints: THREE.Vector3[],
  totalProjects: ConstellationProject[]
): { positions: THREE.Vector3[]; centroids: THREE.Vector3[]; alphas: number[] } => {
  const positions: THREE.Vector3[] = new Array(totalProjects.length);
  const centroids: THREE.Vector3[] = [];
  const alphas: number[] = [];
  if (buckets.length === 0) {
    return { positions, centroids, alphas };
  }
  // Initial centers from a fibonacci layout over the buckets themselves.
  const initialCenters = fibonacciSphere(buckets.length);
  const sortedIdx = buckets.map((_, i) => i).sort((a, b) => buckets[b].projects.length - buckets[a].projects.length);
  const remaining = new Set<number>(fibPoints.map((_, i) => i));

  // Greedy: for each bucket (largest first) take the m closest unassigned points.
  const bucketPointIndices: number[][] = buckets.map(() => []);
  for (const bi of sortedIdx) {
    const m = buckets[bi].projects.length;
    const center = initialCenters[bi];
    const candidates = Array.from(remaining).sort((a, b) => {
      const da = 1 - fibPoints[a].dot(center);
      const db = 1 - fibPoints[b].dot(center);
      return da - db;
    });
    const taken = candidates.slice(0, m);
    bucketPointIndices[bi] = taken;
    taken.forEach((pi) => remaining.delete(pi));
  }

  buckets.forEach((bucket, bi) => {
    const taken = bucketPointIndices[bi];
    // Recompute centroid from assigned points.
    const centroid = new THREE.Vector3();
    taken.forEach((pi) => centroid.add(fibPoints[pi]));
    if (centroid.lengthSq() < 1e-6) centroid.copy(initialCenters[bi]);
    centroid.normalize();
    centroids.push(centroid);
    let maxAng = 0;
    taken.forEach((pi) => {
      const ang = Math.acos(THREE.MathUtils.clamp(fibPoints[pi].dot(centroid), -1, 1));
      if (ang > maxAng) maxAng = ang;
    });
    alphas.push(maxAng);
    bucket.projects.forEach((proj, k) => {
      const pIdx = totalProjects.indexOf(proj);
      positions[pIdx] = fibPoints[taken[k]].clone();
    });
  });

  return { positions, centroids, alphas };
};

export const Globe3DView = ({ onInteractionStart, onInteractionEnd }: Globe3DViewProps) => {
  const {
    projects,
    allProjects,
    activeCategories,
    selectProject,
    selectedProjectId,
    isEthosOverlayActive,
    ethosScores
  } = useConstellation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = !!selectedProjectId;
  }, [selectedProjectId]);

  const ethosOverlayRef = useRef(isEthosOverlayActive);
  const ethosScoresRef = useRef(ethosScores);
  useEffect(() => {
    ethosOverlayRef.current = isEthosOverlayActive;
  }, [isEthosOverlayActive]);
  useEffect(() => {
    ethosScoresRef.current = ethosScores;
  }, [ethosScores]);

  const planets = useMemo<Planet[]>(() => {
    if (activeCategories.length === 0) {
      const byCat = new Map<string, ConstellationProject[]>();
      projects.forEach((p) => {
        const key = p.primaryCategory || p.categories[0] || 'Other';
        if (!byCat.has(key)) byCat.set(key, []);
        byCat.get(key)!.push(p);
      });
      const buckets: CategoryBucket[] = Array.from(byCat.entries())
        .map(([name, ps]) => ({ name, projects: ps }))
        .sort((a, b) => b.projects.length - a.projects.length);
      return [{ title: 'MegaETH', projects, buckets, showClusters: true }];
    }
    return activeCategories
      .map<Planet>((cat) => ({
        title: cat,
        projects: allProjects.filter((p) => matchesCategory(p, cat)),
        buckets: [],
        showClusters: false
      }))
      .filter((p) => p.projects.length > 0);
  }, [projects, allProjects, activeCategories]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || planets.length === 0) return;

    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    // ---- Starfield ------------------------------------------------------
    const starCount = 1400;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 200 + Math.random() * 300;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
      const tint = 0.55 + Math.random() * 0.45;
      const roll = Math.random();
      if (roll < 0.7) {
        starCol[i * 3] = tint;
        starCol[i * 3 + 1] = tint;
        starCol[i * 3 + 2] = tint;
      } else if (roll < 0.88) {
        starCol[i * 3] = tint * 0.7;
        starCol[i * 3 + 1] = tint * 0.85;
        starCol[i * 3 + 2] = tint;
      } else {
        starCol[i * 3] = tint;
        starCol[i * 3 + 1] = tint * 0.85;
        starCol[i * 3 + 2] = tint * 0.55;
      }
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.6,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ---- Build globes ---------------------------------------------------

    type TileRecord = {
      mesh: THREE.Mesh;
      project: ConstellationProject;
      dirLocal: THREE.Vector3;
      ethosBadge: THREE.Sprite | null;
    };
    type GlobeRecord = {
      group: THREE.Group;
      tiles: TileRecord[];
      tileAngular: number;
      radius: number;
      clusterRings: THREE.LineLoop[];
      // Quaternion-based rotation so we never hit gimbal lock at the poles.
      rot: THREE.Quaternion;
      // Smooth angular momentum applied each frame after release.
      momentum: THREE.Quaternion;
      autoSpin: boolean;
    };

    const radiusForCount = (n: number) => {
      const r = 1.9 * Math.sqrt(Math.max(1, n) / 60);
      return THREE.MathUtils.clamp(r, 1.0, 3.4);
    };

    const tileMeshes: THREE.Mesh[] = [];
    const meshToTile = new Map<THREE.Mesh, TileRecord>();
    const meshToGlobe = new Map<THREE.Mesh, GlobeRecord>();
    const allBadges: THREE.Sprite[] = [];
    const ringGeoCache: THREE.BufferGeometry[] = [];

    const makeClusterRing = (
      center: THREE.Vector3,
      alpha: number,
      radius: number,
      colorHex: number
    ) => {
      const segments = 96;
      const positions = new Float32Array(segments * 3);
      const ringRadius = radius * 1.012;
      const sinA = Math.sin(alpha);
      const cosA = Math.cos(alpha);
      const z = new THREE.Vector3(0, 0, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(z, center.clone().normalize());
      const tmp = new THREE.Vector3();
      for (let i = 0; i < segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        tmp.set(sinA * Math.cos(t), sinA * Math.sin(t), cosA).applyQuaternion(q).multiplyScalar(ringRadius);
        positions[i * 3] = tmp.x;
        positions[i * 3 + 1] = tmp.y;
        positions[i * 3 + 2] = tmp.z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      ringGeoCache.push(geo);
      const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      });
      return new THREE.LineLoop(geo, mat);
    };

    // The angular radius alpha that gives n equidistant fibonacci points
    // their full breathing room: each "cell" covers ~(4π/n) sr, so its
    // characteristic radius is sqrt(area/π) = 2/sqrt(n). Tile patch should
    // be a bit smaller so they don't visually touch.
    const tileAngularFor = (n: number) => {
      const cell = 2 / Math.sqrt(Math.max(1, n));
      return THREE.MathUtils.clamp(cell * 0.55, 0.06, 0.6);
    };

    const globes: GlobeRecord[] = planets.map((planet, planetIdx) => {
      const radius = radiusForCount(planet.projects.length);
      const group = new THREE.Group();

      // Per-globe wireframe color: category color when in multi-category mode,
      // soft yellow for the global view.
      const wireColor = planet.showClusters
        ? 0xffd84d
        : categoryColor(planet.title);
      const fillColor = planet.showClusters
        ? 0x0a0d1f
        : new THREE.Color(wireColor).multiplyScalar(0.06).getHex();

      const coreGeo = new THREE.SphereGeometry(radius, 32, 24);
      const coreMat = new THREE.MeshBasicMaterial({
        color: wireColor,
        wireframe: true,
        transparent: true,
        opacity: planet.showClusters ? 0.07 : 0.18
      });
      group.add(new THREE.Mesh(coreGeo, coreMat));

      const fillGeo = new THREE.SphereGeometry(radius * 0.985, 32, 24);
      const fillMat = new THREE.MeshBasicMaterial({
        color: fillColor,
        transparent: true,
        opacity: planet.showClusters ? 0.6 : 0.72
      });
      group.add(new THREE.Mesh(fillGeo, fillMat));
      void planetIdx;

      const n = planet.projects.length;
      const tileAngular = tileAngularFor(n);

      // Single fibonacci distribution → globally equidistant points.
      const fib = fibonacciSphere(n);

      let positions: THREE.Vector3[] = fib.map((p) => p.clone());
      const clusterRings: THREE.LineLoop[] = [];

      if (planet.showClusters) {
        const { positions: pos, centroids, alphas } = assignPointsToBuckets(
          planet.buckets,
          fib,
          planet.projects
        );
        positions = pos;
        planet.buckets.forEach((bucket, bi) => {
          const colorHex = categoryColor(bucket.name);
          const ringAlpha = Math.min(alphas[bi] + tileAngular * 0.9, Math.PI * 0.49);
          const ring = makeClusterRing(centroids[bi], ringAlpha, radius, colorHex);
          group.add(ring);
          clusterRings.push(ring);
        });
      }

      // Shared spherical patch geometry for every tile of THIS globe.
      const patchGeo = buildSphericalPatchGeometry(tileAngular, 20);

      const tiles: TileRecord[] = [];
      planet.projects.forEach((project, i) => {
        const dir = positions[i] || new THREE.Vector3(0, 1, 0);
        const mat = new THREE.MeshBasicMaterial({
          map: buildNeutralPlaceholder(),
          transparent: true,
          alphaTest: 0.04,
          side: THREE.FrontSide,
          depthWrite: true,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });
        requestLogoTexture(project.logo, (tex) => {
          mat.map = tex;
          mat.needsUpdate = true;
        });
        // Mesh sits at globe origin; it's the patch oriented to dir,
        // scaled by the globe radius so it sits ON the sphere surface.
        const mesh = new THREE.Mesh(patchGeo, mat);
        const z = new THREE.Vector3(0, 0, 1);
        mesh.quaternion.setFromUnitVectors(z, dir.clone().normalize());
        mesh.scale.setScalar(radius * 1.012);
        mesh.renderOrder = 1;
        group.add(mesh);

        const rec: TileRecord = { mesh, project, dirLocal: dir.clone(), ethosBadge: null };
        tiles.push(rec);
        tileMeshes.push(mesh);
        meshToTile.set(mesh, rec);
      });

      const record: GlobeRecord = {
        group,
        tiles,
        tileAngular,
        radius,
        clusterRings,
        rot: new THREE.Quaternion(),
        momentum: new THREE.Quaternion(),
        autoSpin: true
      };
      tiles.forEach((t) => meshToGlobe.set(t.mesh, record));
      return record;
    });

    // ---- Random non-overlapping placement for multiple globes ----------

    const rng = (() => {
      // Stable per-mount randomness so layout doesn't reshuffle every frame.
      let seed = Date.now() & 0xffffffff;
      return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0xffffffff;
      };
    })();

    let layoutBoundingRadius = 0;
    if (globes.length === 1) {
      globes.forEach((g) => scene.add(g.group));
      layoutBoundingRadius = globes[0].radius;
    } else {
      // 2D scatter on XY plane with slight Z jitter; keep min spacing so they
      // don't intersect. Spread radius scales with number + sizes.
      const spread =
        Math.max(2.5, globes.reduce((s, g) => s + g.radius, 0) * 0.9) *
        Math.max(1, Math.sqrt(globes.length / 3));
      const placed: { x: number; y: number; z: number; r: number }[] = [];
      globes.forEach((g) => {
        let attempt = 0;
        let pos = { x: 0, y: 0, z: 0 };
        // First globe centered.
        if (placed.length === 0) {
          pos = { x: 0, y: 0, z: 0 };
        } else {
          for (; attempt < 200; attempt++) {
            const x = (rng() * 2 - 1) * spread;
            const y = (rng() * 2 - 1) * spread * 0.55;
            const z = (rng() * 2 - 1) * spread * 0.35;
            const ok = placed.every(
              (p) => Math.hypot(p.x - x, p.y - y, p.z - z) > p.r + g.radius + 0.5
            );
            if (ok) {
              pos = { x, y, z };
              break;
            }
          }
          if (attempt === 200) {
            // Fallback: ring layout.
            const k = placed.length;
            const ang = (k / globes.length) * Math.PI * 2;
            pos = { x: Math.cos(ang) * spread, y: Math.sin(ang) * spread * 0.55, z: 0 };
          }
        }
        g.group.position.set(pos.x, pos.y, pos.z);
        scene.add(g.group);
        placed.push({ ...pos, r: g.radius });
      });
      // Bounding radius for camera framing.
      layoutBoundingRadius = Math.max(
        ...placed.map((p, i) => Math.hypot(p.x, p.y, p.z) + globes[i].radius)
      );
    }

    const fov = (camera.fov * Math.PI) / 180;
    const aspect = Math.max(0.6, width / height);
    const distNeeded = layoutBoundingRadius / Math.tan(fov / 2) / Math.min(1, aspect);
    const desiredZ = Math.max(distNeeded * 1.35, 4);
    camera.position.set(0, 0, desiredZ);
    camera.lookAt(0, 0, 0);

    // ---- Ethos badge management ----------------------------------------

    const ensureBadge = (rec: TileRecord, score: number, globe: GlobeRecord) => {
      if (rec.ethosBadge) return rec.ethosBadge;
      const { tex, w, h } = buildEthosBadgeTexture(score);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: false
      });
      const sprite = new THREE.Sprite(mat);
      // Smaller badge — match the 2D scale closely.
      const tileSpan = Math.sin(globe.tileAngular) * globe.radius * 2;
      const baseHeight = THREE.MathUtils.clamp(tileSpan * 0.22, 0.06, 0.18);
      const aspectR = w / h;
      sprite.scale.set(baseHeight * aspectR, baseHeight, 1);
      const dir = rec.dirLocal.clone().normalize();
      const worldUp = new THREE.Vector3(0, 1, 0);
      const tangent = worldUp.clone().sub(dir.clone().multiplyScalar(worldUp.dot(dir)));
      if (tangent.lengthSq() < 1e-4) tangent.set(1, 0, 0);
      tangent.normalize();
      const tangentDrop = Math.max(Math.sin(globe.tileAngular) * globe.radius * 0.85, baseHeight * 0.85);
      const offset = dir
        .clone()
        .multiplyScalar(globe.radius * 1.02)
        .add(tangent.multiplyScalar(-tangentDrop));
      sprite.position.copy(offset);
      sprite.renderOrder = 10;
      globe.group.add(sprite);
      rec.ethosBadge = sprite;
      allBadges.push(sprite);
      return sprite;
    };

    const removeBadge = (rec: TileRecord, globe: GlobeRecord) => {
      if (!rec.ethosBadge) return;
      globe.group.remove(rec.ethosBadge);
      const idx = allBadges.indexOf(rec.ethosBadge);
      if (idx >= 0) allBadges.splice(idx, 1);
      const mat = rec.ethosBadge.material as THREE.SpriteMaterial;
      mat.dispose();
      rec.ethosBadge = null;
    };

    // ---- Interaction ---------------------------------------------------

    let isDragging = false;
    let didDrag = false;
    let downX = 0;
    let downY = 0;
    let lastX = 0;
    let lastY = 0;
    let activeGlobe: GlobeRecord | null = null;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerInside = false;

    // World-space tile center derived from dirLocal + group quaternion.
    const tileWorldPos = (rec: TileRecord, globe: GlobeRecord, out: THREE.Vector3) => {
      out.copy(rec.dirLocal).applyQuaternion(globe.group.quaternion).multiplyScalar(globe.radius);
      out.add(globe.group.position);
      return out;
    };

    const tmpTileWorld = new THREE.Vector3();

    const isFrontFacing = (mesh: THREE.Mesh): boolean => {
      const rec = meshToTile.get(mesh);
      if (!rec) return false;
      const globe = meshToGlobe.get(mesh);
      if (!globe) return false;
      tileWorldPos(rec, globe, tmpTileWorld);
      const normal = tmpTileWorld.clone().sub(globe.group.position).normalize();
      const toCam = camera.position.clone().sub(tmpTileWorld).normalize();
      return normal.dot(toCam) > 0.05;
    };

    // Build invisible sphere colliders so we can detect which globe is grabbed
    // even when the user clicks on empty space between tiles.
    const sphereColliderGeo = new THREE.SphereGeometry(1, 16, 12);
    const globeColliders: { mesh: THREE.Mesh; record: GlobeRecord }[] = globes.map((g) => {
      const m = new THREE.Mesh(
        sphereColliderGeo,
        new THREE.MeshBasicMaterial({ visible: false })
      );
      m.scale.setScalar(g.radius * 1.04);
      m.position.copy(g.group.position);
      scene.add(m);
      return { mesh: m, record: g };
    });

    const pickGlobeAtPointer = (): GlobeRecord | null => {
      raycaster.setFromCamera(pointer, camera);
      // Prefer tile hits (front-facing) so click-vs-drag still resolves.
      const tileHits = raycaster.intersectObjects(tileMeshes, false);
      for (const h of tileHits) {
        const m = h.object as THREE.Mesh;
        if (isFrontFacing(m)) return meshToGlobe.get(m) ?? null;
      }
      const sphHits = raycaster.intersectObjects(
        globeColliders.map((c) => c.mesh),
        false
      );
      if (sphHits[0]) {
        const found = globeColliders.find((c) => c.mesh === sphHits[0].object);
        return found?.record ?? null;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      activeGlobe = pickGlobeAtPointer();
      isDragging = true;
      didDrag = false;
      downX = e.clientX;
      downY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      onInteractionStart?.();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging && activeGlobe) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 4) didDrag = true;
        // Rotate around camera-relative axes (avoids gimbal lock entirely).
        const sensitivity = 0.005;
        const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        const qX = new THREE.Quaternion().setFromAxisAngle(camRight, dy * sensitivity);
        const qY = new THREE.Quaternion().setFromAxisAngle(camUp, dx * sensitivity);
        const delta = new THREE.Quaternion().multiplyQuaternions(qY, qX);
        activeGlobe.rot.premultiply(delta);
        // Track momentum from last move for inertial spin.
        activeGlobe.momentum.copy(delta);
        activeGlobe.autoSpin = false;
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (isDragging) onInteractionEnd?.();
      const wasDrag = didDrag;
      isDragging = false;
      activeGlobe = null;
      if (!wasDrag) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(tileMeshes, false);
        const tile = hits.find((h) => isFrontFacing(h.object as THREE.Mesh))?.object as
          | THREE.Mesh
          | undefined;
        if (tile) {
          const rec = meshToTile.get(tile);
          if (rec) selectProject(rec.project.id);
        } else {
          // Click in empty area: close any open drawer and resume spin on
          // every globe (whichever one the user previously stopped).
          if (isPausedRef.current) selectProject(null);
          globes.forEach((g) => {
            g.autoSpin = true;
          });
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = renderer.domElement.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Cast a ray through the cursor and find where it hits the focal plane
      // (z=0, where the globes live) BEFORE zoom.
      const rayBefore = new THREE.Raycaster();
      rayBefore.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const focalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const beforeHit = new THREE.Vector3();
      rayBefore.ray.intersectPlane(focalPlane, beforeHit);

      const minZ = Math.max(2, layoutBoundingRadius * 0.6);
      const maxZ = desiredZ * 8;
      const factor = 1 + e.deltaY * 0.0015;
      const newZ = THREE.MathUtils.clamp(camera.position.z * factor, minZ, maxZ);
      camera.position.z = newZ;

      // After zoom, find where the same cursor ray now hits z=0 and shift
      // the camera laterally so the world point under the cursor stays put.
      if (beforeHit) {
        camera.updateMatrixWorld();
        const rayAfter = new THREE.Raycaster();
        rayAfter.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
        const afterHit = new THREE.Vector3();
        if (rayAfter.ray.intersectPlane(focalPlane, afterHit)) {
          camera.position.x += beforeHit.x - afterHit.x;
          camera.position.y += beforeHit.y - afterHit.y;
        }
      }
    };

    const dom = renderer.domElement;
    dom.style.touchAction = 'none';
    dom.style.cursor = 'grab';
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Single shared sprite floating above the hovered tile. We swap its
    // texture/scale/position based on which tile is currently hovered. Using
    // a billboard avoids wrap-around / silhouette glitches on the curved patch.
    const hoverOverlayMat = new THREE.SpriteMaterial({
      map: buildNeutralPlaceholder(),
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const hoverOverlay = new THREE.Sprite(hoverOverlayMat);
    hoverOverlay.renderOrder = 50;
    hoverOverlay.visible = false;
    scene.add(hoverOverlay);

    let lastHovered: THREE.Mesh | null = null;
    let frameId = 0;

    const tick = () => {
      frameId = requestAnimationFrame(tick);

      const paused = isPausedRef.current;

      // Identity quaternion for slerping momentum back to rest.
      const identity = new THREE.Quaternion();
      const yAxis = new THREE.Vector3(0, 1, 0);
      const slowSpin = new THREE.Quaternion().setFromAxisAngle(yAxis, 0.0025);

      globes.forEach((g) => {
        const isActive = g === activeGlobe && isDragging;
        if (!isActive) {
          // Apply momentum (drag inertia) and decay it.
          if (g.momentum.angleTo(identity) > 0.0001) {
            g.rot.premultiply(g.momentum);
            g.momentum.slerp(identity, 0.07);
          }
          // Auto-spin when allowed (no drawer open, and globe wasn't paused by interaction).
          if (!paused && g.autoSpin) {
            g.rot.premultiply(slowSpin);
          }
        }
        g.group.quaternion.copy(g.rot);
      });

      // Sync ethos badges with overlay state.
      const overlay = ethosOverlayRef.current;
      const scores = ethosScoresRef.current;
      globes.forEach((g) => {
        g.tiles.forEach((rec) => {
          const score = scores[rec.project.id];
          const wantBadge = overlay && Number.isFinite(score);
          if (wantBadge && !rec.ethosBadge) {
            ensureBadge(rec, score, g);
          } else if (!wantBadge && rec.ethosBadge) {
            removeBadge(rec, g);
          }
        });
      });

      // Tiles stay fully opaque (back-faces are culled by FrontSide).
      // Badge sprites fade based on facing of their tile.
      const tmpWorld = new THREE.Vector3();
      const tmpToCam = new THREE.Vector3();
      globes.forEach((g) => {
        g.tiles.forEach((rec) => {
          if (!rec.ethosBadge) return;
          tileWorldPos(rec, g, tmpWorld);
          tmpToCam.copy(camera.position).sub(tmpWorld).normalize();
          const normal = tmpWorld.clone().sub(g.group.position).normalize();
          const facing = THREE.MathUtils.clamp(normal.dot(tmpToCam), 0, 1);
          const a = THREE.MathUtils.smoothstep(facing, 0.05, 0.35);
          const m = rec.ethosBadge.material as THREE.SpriteMaterial;
          m.opacity = a;
        });
      });

      // Hover handling — only consider front-facing tiles.
      let hovered: THREE.Mesh | null = null;
      if (pointerInside) {
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(tileMeshes, false);
        for (const h of hits) {
          const m = h.object as THREE.Mesh;
          if (isFrontFacing(m)) {
            hovered = m;
            break;
          }
        }
      }
      if (hovered !== lastHovered) {
        if (lastHovered) {
          const prevG = meshToGlobe.get(lastHovered)!;
          lastHovered.scale.setScalar(prevG.radius * 1.012);
          lastHovered.renderOrder = 1;
          const prevMat = lastHovered.material as THREE.MeshBasicMaterial;
          prevMat.depthTest = true;
        }
        lastHovered = hovered;
        if (hovered) {
          const g = meshToGlobe.get(hovered)!;
          const t = meshToTile.get(hovered)!;
          // Use a flat billboard overlay so silhouette tiles don't wrap.
          const tileMat = hovered.material as THREE.MeshBasicMaterial;
          hoverOverlayMat.map = tileMat.map ?? buildNeutralPlaceholder();
          hoverOverlayMat.needsUpdate = true;
          const tileSpan = Math.sin(g.tileAngular) * g.radius * 2;
          const overlaySize = Math.max(tileSpan * 1.55, g.radius * 0.18);
          hoverOverlay.scale.set(overlaySize, overlaySize, 1);
          hoverOverlay.visible = true;
          dom.style.cursor = 'pointer';
          setHoverLabel(t.project.name ?? null);
        } else {
          hoverOverlay.visible = false;
          dom.style.cursor = 'grab';
          setHoverLabel(null);
        }
      }

      // Keep overlay parked at hovered tile's *current* world position.
      if (lastHovered) {
        const g = meshToGlobe.get(lastHovered)!;
        const t = meshToTile.get(lastHovered)!;
        tileWorldPos(t, g, tmpWorld);
        // Push slightly toward camera so it sits clearly in front.
        const toward = camera.position.clone().sub(tmpWorld).normalize();
        hoverOverlay.position.copy(tmpWorld).add(toward.multiplyScalar(g.radius * 0.04));
      }

      starField.rotation.y += 0.00015;

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      tileMeshes.forEach((m) => {
        (m.material as THREE.Material).dispose();
      });
      globes.forEach((g) => {
        g.group.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (m.geometry) m.geometry.dispose?.();
        });
        g.clusterRings.forEach((ring) => {
          (ring.material as THREE.Material).dispose();
        });
        g.tiles.forEach((rec) => {
          if (rec.ethosBadge) {
            (rec.ethosBadge.material as THREE.SpriteMaterial).dispose();
          }
        });
      });
      ringGeoCache.forEach((g) => g.dispose());
      sphereColliderGeo.dispose();
      globeColliders.forEach((c) => (c.mesh.material as THREE.Material).dispose());
      hoverOverlayMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [planets, onInteractionStart, onInteractionEnd, selectProject]);

  return (
    <div className="globe3d-view" ref={containerRef}>
      {hoverLabel ? <div className="globe3d-view__label">{hoverLabel}</div> : null}
    </div>
  );
};

export default Globe3DView;

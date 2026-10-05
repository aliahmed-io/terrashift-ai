export const SCENE_W = 480;
export const SCENE_H = 300;
export const PIXEL_AREA_M2 = 100;

export type RegionKind = "clearing" | "built";

export interface Region {
  id: number;
  kind: RegionKind;
  label: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  areaM2: number;
  confidence: number;
}

export interface Scene {
  seed: number;
  width: number;
  height: number;
  rgb1: Uint8ClampedArray;
  rgb2: Uint8ClampedArray;
  ndvi1: Float32Array;
  ndvi2: Float32Array;
  ndbi2: Float32Array;
  mask: Uint8Array;
  naive: Uint8Array;
  regions: Region[];
  changedM2: number;
  changedPct: number;
  naivePct: number;
}

type Cover = "water" | "forest" | "crop" | "built" | "bare";

const NAIVE_THRESHOLD = 14;

function hash(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2147483629)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(x: number, y: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < 4; o += 1) {
    sum += amp * vnoise(x * freq, y * freq, seed + o * 17);
    amp *= 0.5;
    freq *= 2;
  }
  return sum / 0.9375;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const SLOTS: ReadonlyArray<{ fx: number; fy: number; kind: RegionKind }> = [
  { fx: 0.2, fy: 0.22, kind: "clearing" },
  { fx: 0.56, fy: 0.2, kind: "built" },
  { fx: 0.84, fy: 0.3, kind: "clearing" },
  { fx: 0.3, fy: 0.86, kind: "built" },
  { fx: 0.7, fy: 0.85, kind: "clearing" },
];

function buildRegions(seed: number): Region[] {
  return SLOTS.map((slot, i) => {
    const jx = (hash(i, 1, seed) - 0.5) * 0.06;
    const jy = (hash(i, 2, seed) - 0.5) * 0.06;
    return {
      id: i + 1,
      kind: slot.kind,
      label: slot.kind === "clearing" ? "Forest → bare soil" : "Open land → built structure",
      cx: (slot.fx + jx) * SCENE_W,
      cy: (slot.fy + jy) * SCENE_H,
      rx: 30 + hash(i, 3, seed) * 16,
      ry: 18 + hash(i, 4, seed) * 10,
      areaM2: 0,
      confidence: 0.82 + hash(i, 5, seed) * 0.15,
    };
  });
}

interface Look {
  r: number;
  g: number;
  b: number;
  ndvi: number;
  ndbi: number;
}

function look(cover: Cover, season: 0 | 1, v: number, stripe: number, jitter: number, x: number, y: number): Look {
  const s = season;
  switch (cover) {
    case "water":
      return { r: 12, g: 44 + jitter * 10, b: 74 + jitter * 12, ndvi: -0.3, ndbi: -0.4 };
    case "forest":
      return {
        r: 28 + 46 * s * 0.8 + v * 6,
        g: 86 - 4 * s + v * 14,
        b: 46 - 2 * s,
        ndvi: 0.45 + 0.35 * v - 0.12 * s,
        ndbi: -0.25,
      };
    case "crop": {
      const tone = stripe * 12;
      return s === 0
        ? { r: 96 + tone, g: 142 + tone, b: 60, ndvi: 0.72 - stripe * 0.08, ndbi: -0.2 }
        : { r: 176 + tone, g: 150 + tone, b: 106, ndvi: 0.2 + stripe * 0.06, ndbi: 0.02 };
    }
    case "built": {
      const grid = (Math.floor(x / 6) + Math.floor(y / 6)) % 2 === 0 ? 8 : -8;
      return { r: 156 + grid, g: 156 + grid, b: 164 + grid, ndvi: 0.05, ndbi: 0.28 };
    }
    case "bare":
      return { r: 158, g: 124, b: 92, ndvi: 0.08, ndbi: 0.08 };
  }
}

function baseCover(x: number, y: number, seed: number): { cover: Cover; v: number; stripe: number } {
  const e = fbm(x / 55, y / 55, seed);
  const m = fbm(x / 32 + 40, y / 32 + 40, seed + 101);
  const riverY = SCENE_H * 0.62 + 26 * Math.sin(x / 56) + 14 * Math.sin(x / 25);
  const v = clamp((m - 0.25) * 1.8, 0.1, 1);
  const stripe = Math.floor((x + y * 0.3) / 9) % 2;
  if (Math.abs(y - riverY) < 6 || e < 0.27) return { cover: "water", v, stripe };
  if (m < 0.4 && e > 0.45) return { cover: "crop", v, stripe };
  return { cover: "forest", v, stripe };
}

export function generateScene(seed: number): Scene {
  const w = SCENE_W;
  const h = SCENE_H;
  const n = w * h;
  const rgb1 = new Uint8ClampedArray(n * 4);
  const rgb2 = new Uint8ClampedArray(n * 4);
  const ndvi1 = new Float32Array(n);
  const ndvi2 = new Float32Array(n);
  const ndbi2 = new Float32Array(n);
  const mask = new Uint8Array(n);
  const naive = new Uint8Array(n);
  const regions = buildRegions(seed);
  const counts = new Array<number>(regions.length).fill(0);
  let naiveCount = 0;
  let changed = 0;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const base = baseCover(x, y, seed);
      const jitter = vnoise(x / 3, y / 3, seed + 7);
      const bright = 0.9 + 0.2 * jitter;
      let cover2: Cover = base.cover;
      let owner = -1;

      for (let r = 0; r < regions.length; r += 1) {
        const reg = regions[r];
        if (!reg || base.cover === "water") continue;
        const dx = (x - reg.cx) / reg.rx;
        const dy = (y - reg.cy) / reg.ry;
        const d = dx * dx + dy * dy + (vnoise(x / 9, y / 9, seed + r * 31) - 0.5) * 0.6;
        if (d < 1) {
          cover2 = reg.kind === "clearing" ? "bare" : "built";
          owner = r;
          break;
        }
      }

      const a = look(base.cover, 0, base.v, base.stripe, jitter, x, y);
      const b = look(cover2, 1, base.v, base.stripe, jitter, x, y);
      const k1 = bright;
      const k2 = bright * 0.9;
      const o = i * 4;
      rgb1[o] = a.r * k1;
      rgb1[o + 1] = a.g * k1;
      rgb1[o + 2] = a.b * k1;
      rgb1[o + 3] = 255;
      rgb2[o] = b.r * k2 + 6;
      rgb2[o + 1] = b.g * k2 + 8;
      rgb2[o + 2] = b.b * k2 + 14;
      rgb2[o + 3] = 255;
      ndvi1[i] = a.ndvi;
      ndvi2[i] = b.ndvi;
      ndbi2[i] = b.ndbi;

      const diff =
        (Math.abs((rgb1[o] ?? 0) - (rgb2[o] ?? 0)) +
          Math.abs((rgb1[o + 1] ?? 0) - (rgb2[o + 1] ?? 0)) +
          Math.abs((rgb1[o + 2] ?? 0) - (rgb2[o + 2] ?? 0))) /
        3;
      if (diff > NAIVE_THRESHOLD) {
        naive[i] = 1;
        naiveCount += 1;
      }
      if (owner >= 0 && cover2 !== base.cover) {
        mask[i] = 1;
        changed += 1;
        counts[owner] = (counts[owner] ?? 0) + 1;
      }
    }
  }

  regions.forEach((reg, idx) => {
    reg.areaM2 = (counts[idx] ?? 0) * PIXEL_AREA_M2;
  });

  return {
    seed,
    width: w,
    height: h,
    rgb1,
    rgb2,
    ndvi1,
    ndvi2,
    ndbi2,
    mask,
    naive,
    regions,
    changedM2: changed * PIXEL_AREA_M2,
    changedPct: (changed / n) * 100,
    naivePct: (naiveCount / n) * 100,
  };
}

const cache = new Map<number, Scene>();

export function getScene(seed: number): Scene {
  const hit = cache.get(seed);
  if (hit) return hit;
  const scene = generateScene(seed);
  cache.set(seed, scene);
  return scene;
}

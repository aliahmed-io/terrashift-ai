import type { Scene } from "@/lib/scene";

export type PaintMode = "before" | "after" | "naive" | "ndvi" | "mask" | "polygons" | "ndbi";

const INK: readonly [number, number, number] = [10, 15, 22];
const SIGNAL: readonly [number, number, number] = [255, 176, 32];
const ALERT: readonly [number, number, number] = [255, 82, 64];

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function paintScene(canvas: HTMLCanvasElement, scene: Scene, mode: PaintMode): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = scene.width;
  canvas.height = scene.height;
  const out = ctx.createImageData(scene.width, scene.height);
  const d = out.data;
  const n = scene.width * scene.height;

  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    const r1 = scene.rgb1[o] ?? 0;
    const g1 = scene.rgb1[o + 1] ?? 0;
    const b1 = scene.rgb1[o + 2] ?? 0;
    const r2 = scene.rgb2[o] ?? 0;
    const g2 = scene.rgb2[o + 1] ?? 0;
    const b2 = scene.rgb2[o + 2] ?? 0;
    let r = r2;
    let g = g2;
    let b = b2;

    if (mode === "before") {
      r = r1;
      g = g1;
      b = b1;
    } else if (mode === "naive") {
      const flag = scene.naive[i] === 1;
      r = flag ? mix(r2 * 0.5, ALERT[0], 0.7) : r2 * 0.45;
      g = flag ? mix(g2 * 0.5, ALERT[1], 0.7) : g2 * 0.45;
      b = flag ? mix(b2 * 0.5, ALERT[2], 0.7) : b2 * 0.45;
    } else if (mode === "ndvi") {
      const delta = (scene.ndvi2[i] ?? 0) - (scene.ndvi1[i] ?? 0);
      const t = clamp01((-delta - 0.1) / 0.6);
      r = mix(INK[0], SIGNAL[0], t);
      g = mix(INK[1], SIGNAL[1], t);
      b = mix(INK[2], SIGNAL[2], t);
    } else if (mode === "ndbi") {
      const t = clamp01(((scene.ndbi2[i] ?? 0) + 0.4) / 0.7);
      r = mix(INK[0], 61, t);
      g = mix(INK[1], 214, t);
      b = mix(INK[2], 195, t);
    } else if (mode === "mask" || mode === "polygons") {
      const flag = scene.mask[i] === 1;
      const dim = mode === "polygons" ? 0.5 : 0.35;
      r = flag ? mix(r2, SIGNAL[0], 0.78) : r2 * dim;
      g = flag ? mix(g2, SIGNAL[1], 0.78) : g2 * dim;
      b = flag ? mix(b2, SIGNAL[2], 0.78) : b2 * dim;
    }

    d[o] = r;
    d[o + 1] = g;
    d[o + 2] = b;
    d[o + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

export function paintChannel(
  canvas: HTMLCanvasElement,
  scene: Scene,
  channel: "r" | "g" | "b" | "ndvi" | "ndbi",
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = scene.width;
  canvas.height = scene.height;
  const out = ctx.createImageData(scene.width, scene.height);
  const d = out.data;
  const n = scene.width * scene.height;
  const tint: Record<typeof channel, readonly [number, number, number]> = {
    r: [255, 110, 100],
    g: [110, 230, 140],
    b: [110, 160, 255],
    ndvi: [140, 255, 120],
    ndbi: [61, 214, 195],
  };
  const c = tint[channel];
  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    let v = 0;
    if (channel === "r") v = (scene.rgb2[o] ?? 0) / 255;
    else if (channel === "g") v = (scene.rgb2[o + 1] ?? 0) / 255;
    else if (channel === "b") v = (scene.rgb2[o + 2] ?? 0) / 255;
    else if (channel === "ndvi") v = ((scene.ndvi2[i] ?? 0) + 0.4) / 1.3;
    else v = ((scene.ndbi2[i] ?? 0) + 0.4) / 0.7;
    v = clamp01(v);
    d[o] = mix(INK[0], c[0], v);
    d[o + 1] = mix(INK[1], c[1], v);
    d[o + 2] = mix(INK[2], c[2], v);
    d[o + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

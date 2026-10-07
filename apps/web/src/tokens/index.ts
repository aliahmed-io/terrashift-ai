export const colors = {
  ink950: "#0B0F17",
  ink900: "#111824",
  ink800: "#172030",
  ink700: "#1E293B",
  ink400: "#94A3B8",
  bone100: "#F8FAFC",
  bone300: "#94A3B8",
  signal400: "#38BDF8",
  signal600: "#0284C7",
  lagoon400: "#38BDF8",
} as const;

export const spacing = {
  1: 8,
  2: 16,
  3: 24,
  4: 32,
  6: 48,
  8: 64,
  12: 96,
  16: 128,
} as const;

export const radii = { sm: 4, md: 8, lg: 16, pill: 999 } as const;

export const motion = {
  fast: 0.16,
  base: 0.32,
  slow: 0.64,
  easeOutExpo: [0.16, 1, 0.3, 1] as const,
} as const;

export const typography = {
  display: "var(--font-space)",
  sans: "var(--font-space)",
  mono: "var(--font-jetbrains)",
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;

export function hexToRgb(hex: string): readonly [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

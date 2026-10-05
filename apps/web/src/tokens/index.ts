export const colors = {
  ink950: "#05080C",
  ink900: "#0A0F16",
  ink800: "#111823",
  ink700: "#1B2533",
  ink400: "#8A99AD",
  bone100: "#F2EEE6",
  bone300: "#BDB8AD",
  signal400: "#FFB020",
  signal600: "#E08A00",
  lagoon400: "#3DD6C3",
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
  fast: 0.2,
  base: 0.5,
  slow: 0.9,
  easeOutExpo: [0.16, 1, 0.3, 1] as const,
} as const;

export const typography = {
  display: "var(--font-instrument)",
  sans: "var(--font-inter)",
  mono: "var(--font-jetbrains)",
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;

export function hexToRgb(hex: string): readonly [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

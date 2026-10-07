/**
 * TerraShift design tokens — "Petrol & Porcelain" geospatial system.
 * Mirrors the `@theme` block in `app/globals.css`; keep both in sync.
 */
export const colors = {
  // Petrol command chrome (Ref 1 header & probability callouts)
  petrol900: "#082F44",
  petrol800: "#0B3B54",
  petrol700: "#0F4C6C",
  petrol500: "#2A7AA0",
  // Spatial accents drawn on top of imagery (Ref 1 & Ref 3)
  cyanRing: "#36C5D8",
  sandPin: "#F4C396",
  sandPinInk: "#5A3A1A",
  coralBeam: "#C8553D",
  // Porcelain surfaces for tasking & catalog sheets (Ref 2)
  porcelain50: "#FFFFFF",
  porcelain100: "#F3F5F7",
  porcelain200: "#E6EAEE",
  slate500: "#64707D",
  slate700: "#3A4450",
  slate900: "#111827",
  // Actions & status (Ref 2)
  emerald600: "#00875A",
  emerald700: "#006E49",
  amber500: "#D97A06",
  alert600: "#C2312B",
  // Imagery void & legacy compatibility tokens
  void: "#0C1014",
  ink950: "#05080C",
  ink900: "#0A0F16",
  ink800: "#111823",
  ink700: "#1B2533",
  ink400: "#8A99AD",
  bone100: "#F2EEE6",
  bone300: "#BDB8AD",
  signal400: "#FFB020",
  signal600: "#E08A00",
  lagoon400: "#36C5D8",
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
  display: "var(--font-instrument)",
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

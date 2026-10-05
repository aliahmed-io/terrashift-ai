/**
 * Sentinel-2 Cloudless tile utilities and spherical geometry calculations.
 * Powered by EOX Sentinel-2 Cloudless (free, CORS-enabled, no API key required).
 */

export const MIN_YEAR = 2017;
export const MAX_YEAR = 2025;
export const DEFAULT_YEAR_T1 = 2018;
export const DEFAULT_YEAR_T2 = 2024;
export const MAX_AOI_KM2 = 100.0;

export interface HotspotPreset {
  id: string;
  name: string;
  location: string;
  description: string;
  yearT1: number;
  yearT2: number;
  center: [number, number]; // [lon, lat]
  zoom: number;
  polygon: [number, number][]; // closed ring [[lon, lat], ...]
}

export const HOTSPOT_PRESETS: readonly HotspotPreset[] = [
  {
    id: "rondonia",
    name: "Rondônia Amazon Frontier",
    location: "Brazil",
    description: "Rapid tropical forest clearing for cattle pasture and agricultural road networks.",
    yearT1: 2018,
    yearT2: 2024,
    center: [-62.905, -9.702],
    zoom: 12.5,
    polygon: [
      [-62.93, -9.72],
      [-62.88, -9.72],
      [-62.88, -9.68],
      [-62.93, -9.68],
      [-62.93, -9.72],
    ],
  },
  {
    id: "dubai",
    name: "Dubai Coastal & Desert Sprawl",
    location: "UAE",
    description: "Rapid urbanization, infrastructure expansion, and island construction.",
    yearT1: 2017,
    yearT2: 2024,
    center: [55.28, 25.21],
    zoom: 12,
    polygon: [
      [55.25, 25.18],
      [55.33, 25.18],
      [55.33, 25.24],
      [55.25, 25.24],
      [55.25, 25.18],
    ],
  },
  {
    id: "santacruz",
    name: "Santa Cruz Agricultural Expansion",
    location: "Bolivia",
    description: "Tierras Bajas radial deforestation and extensive commercial soybean cultivation.",
    yearT1: 2018,
    yearT2: 2024,
    center: [-63.12, -17.78],
    zoom: 12,
    polygon: [
      [-63.16, -17.81],
      [-63.08, -17.81],
      [-63.08, -17.75],
      [-63.16, -17.75],
      [-63.16, -17.81],
    ],
  },
  {
    id: "aral",
    name: "South Aral Sea Shoreline Shift",
    location: "Uzbekistan / Kazakhstan",
    description: "Dramatic desiccation and receding waterlines over the Aralkum desert basin.",
    yearT1: 2017,
    yearT2: 2023,
    center: [60.05, 45.12],
    zoom: 11.5,
    polygon: [
      [60.00, 45.08],
      [60.10, 45.08],
      [60.10, 45.15],
      [60.00, 45.15],
      [60.00, 45.08],
    ],
  },
];

export function getEoxTileUrl(year: number): string {
  const y = Math.max(MIN_YEAR, Math.min(MAX_YEAR, year));
  return `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${y}_3857/default/g/{z}/{y}/{x}.jpg`;
}

/**
 * Calculates geodesic area of a polygon on Earth (WGS84 spherical approximation) in square meters.
 * Ring should be [[lon, lat], ...] coordinates.
 */
export function calculatePolygonAreaM2(ring: readonly (readonly [number, number])[]): number {
  if (ring.length < 3) return 0;
  const radius = 6378137.0; // Earth mean radius in meters
  let total = 0;

  for (let i = 0; i < ring.length; i += 1) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % ring.length];
    if (!p1 || !p2) continue;
    const [lon1, lat1] = p1;
    const [lon2, lat2] = p2;

    const radLon1 = (lon1 * Math.PI) / 180;
    const radLat1 = (lat1 * Math.PI) / 180;
    const radLon2 = (lon2 * Math.PI) / 180;
    const radLat2 = (lat2 * Math.PI) / 180;

    total += (radLon2 - radLon1) * (2 + Math.sin(radLat1) + Math.sin(radLat2));
  }

  const area = Math.abs((total * radius * radius) / 2.0);
  return area;
}

export function calculatePolygonAreaKm2(ring: readonly (readonly [number, number])[]): number {
  return calculatePolygonAreaM2(ring) / 1_000_000.0;
}

export function formatArea(areaM2: number): string {
  if (areaM2 <= 0) return "0 m²";
  if (areaM2 >= 1_000_000) {
    const km2 = areaM2 / 1_000_000;
    return `${km2.toFixed(km2 >= 10 ? 1 : 2)} km²`;
  }
  if (areaM2 >= 10_000) {
    const ha = areaM2 / 10_000;
    return `${ha.toFixed(1)} ha`;
  }
  return `${Math.round(areaM2).toLocaleString("en-US")} m²`;
}

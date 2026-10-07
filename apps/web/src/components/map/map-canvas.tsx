"use client";

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  getEoxTileUrls,
  getHighResTileUrls,
  calculatePolygonAreaKm2,
  formatArea,
  MAX_AOI_KM2,
} from "@/lib/tiles";
import { OrbitalSwathHud } from "@/components/map/orbital-swath-hud";

export interface MapFeatureProperties {
  id: number;
  area_m2: number;
  confidence: number;
  class: string;
  label: string;
  mean_ndvi_delta?: number;
  mean_ndbi_delta?: number;
  centroid?: [number, number];
}

export interface MapFeature {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: MapFeatureProperties;
}

export interface LayerVisibilityState {
  titles: boolean;
  indicators: boolean;
  aoi: boolean;
  protectedAreas: boolean;
  restrictedAreas: boolean;
}

export interface MapCanvasProps {
  yearT1: number;
  yearT2: number;
  polygon: [number, number][] | null;
  features?: MapFeature[];
  isDrawing: boolean;
  onDrawingChange: (drawing: boolean) => void;
  onPolygonChange: (poly: [number, number][] | null) => void;
  selectedFeatureId?: number | null | undefined;
  onSelectFeature?: ((id: number | null) => void) | undefined;
  compareMode?: boolean | undefined;
  onToggleCompareMode?: (() => void) | undefined;
  basemapSource?: "s2" | "mapbox" | undefined;
  onToggleBasemapSource?: (() => void) | undefined;
  center?: [number, number] | undefined;
  zoom?: number | undefined;
  onCameraMove?: ((center: [number, number], zoom: number) => void) | undefined;
  locationLabel?: string | undefined;
  onCyclePreset?: (() => void) | undefined;
  onCycleYear?: (() => void) | undefined;
  visibleLayers?: LayerVisibilityState | undefined;
}

interface ScreenBoxProjection {
  corners: { x: number; y: number; lon: number; lat: number }[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  midX: number;
  midY: number;
}

interface IndicatorPin {
  id: number;
  code: string;
  lon: number;
  lat: number;
  probability: number;
  subtitle: string;
  areaLabel?: string | undefined;
}

interface ProjectedPin extends IndicatorPin {
  x: number;
  y: number;
}

function buildMapStyle(year: number): maplibregl.StyleSpecification {
  const sources: maplibregl.StyleSpecification["sources"] = {
    "s2-cloudless": {
      type: "raster",
      tiles: getEoxTileUrls(year),
      tileSize: 256,
      maxzoom: 13,
      attribution: "Sentinel-2 cloudless by EOX IT Services GmbH",
    },
    "mapbox-satellite": {
      type: "raster",
      tiles: getHighResTileUrls(),
      tileSize: 256,
      maxzoom: 19,
      attribution: "Maxar, Airbus, CNES / Copernicus",
    },
  };

  const layers: maplibregl.StyleSpecification["layers"] = [
    {
      id: "orbital-bg",
      type: "background",
      paint: {
        "background-color": "#0C1014",
      },
    },
    {
      id: "s2-layer",
      type: "raster",
      source: "s2-cloudless",
      minzoom: 0,
      maxzoom: 14,
      paint: {
        "raster-opacity": 1,
        "raster-fade-duration": 0,
        "raster-resampling": "linear",
      },
    },
    {
      id: "mapbox-layer",
      type: "raster",
      source: "mapbox-satellite",
      minzoom: 13,
      maxzoom: 22,
      paint: {
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.5, 1],
        "raster-fade-duration": 0,
        "raster-resampling": "linear",
      },
    },
  ];

  return {
    version: 8,
    sources,
    layers,
  };
}

function buildPolygonGeoJson(polygon: [number, number][] | null): GeoJSON.FeatureCollection {
  if (!polygon || polygon.length < 3) {
    return { type: "FeatureCollection", features: [] };
  }
  const ring =
    polygon[0]?.[0] === polygon[polygon.length - 1]?.[0] &&
    polygon[0]?.[1] === polygon[polygon.length - 1]?.[1]
      ? polygon
      : [...polygon, polygon[0] ?? [0, 0]];

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [ring],
        },
        properties: {},
      },
      ...ring.slice(0, 4).map((pt, idx) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: pt,
        },
        properties: { vertexIndex: idx },
      })),
    ],
  };
}

function buildZoneOverlays(polygon: [number, number][] | null): {
  protectedGeoJson: GeoJSON.FeatureCollection;
  restrictedGeoJson: GeoJSON.FeatureCollection;
} {
  if (!polygon || polygon.length < 3) {
    return {
      protectedGeoJson: { type: "FeatureCollection", features: [] },
      restrictedGeoJson: { type: "FeatureCollection", features: [] },
    };
  }
  const lons = polygon.map((p) => p[0]);
  const lats = polygon.map((p) => p[1]);
  const cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;

  return {
    protectedGeoJson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [cLon - 0.032, cLat + 0.012],
                [cLon - 0.012, cLat + 0.012],
                [cLon - 0.012, cLat + 0.028],
                [cLon - 0.032, cLat + 0.028],
                [cLon - 0.032, cLat + 0.012],
              ],
            ],
          },
          properties: { name: "Protected Ecological Buffer" },
        },
      ],
    },
    restrictedGeoJson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [cLon + 0.014, cLat - 0.026],
                [cLon + 0.034, cLat - 0.026],
                [cLon + 0.034, cLat - 0.01],
                [cLon + 0.014, cLat - 0.01],
                [cLon + 0.014, cLat - 0.026],
              ],
            ],
          },
          properties: { name: "Restricted Infrastructure Corridor" },
        },
      ],
    },
  };
}

function deriveDefaultPins(polygon: [number, number][] | null): IndicatorPin[] {
  if (!polygon || polygon.length < 3) return [];
  const lons = polygon.map((p) => p[0]);
  const lats = polygon.map((p) => p[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const cLon = (minLon + maxLon) / 2;
  const cLat = (minLat + maxLat) / 2;
  const spanLon = Math.max(0.02, maxLon - minLon);
  const spanLat = Math.max(0.02, maxLat - minLat);

  return [
    {
      id: 101,
      code: "JJV-16541",
      lon: cLon + spanLon * 0.12,
      lat: cLat - spanLat * 0.08,
      probability: 75,
      subtitle: "Probability of mining / grading happening",
      areaLabel: "18.4 ha",
    },
    {
      id: 102,
      code: "KSA-24819",
      lon: cLon - spanLon * 0.55,
      lat: cLat + spanLat * 0.32,
      probability: 89,
      subtitle: "Probability of structural change happening",
      areaLabel: "31.2 ha",
    },
    {
      id: 103,
      code: "SRD-19042",
      lon: cLon - spanLon * 0.42,
      lat: cLat - spanLat * 0.35,
      probability: 82,
      subtitle: "Probability of corridor excavation",
      areaLabel: "12.7 ha",
    },
    {
      id: 104,
      code: "orb-30911",
      lon: cLon + spanLon * 0.62,
      lat: cLat + spanLat * 0.44,
      probability: 68,
      subtitle: "Probability of canopy / surface shift",
      areaLabel: "9.5 ha",
    },
  ];
}

function updateRasterYear(map: maplibregl.Map | null, year: number) {
  if (!map || !map.isStyleLoaded()) return;
  const src = map.getSource("s2-cloudless") as maplibregl.RasterTileSource | undefined;
  if (src && typeof src.setTiles === "function") {
    src.setTiles(getEoxTileUrls(year));
  }
}

function applyBasemapMode(map: maplibregl.Map | null, mode: "s2" | "mapbox") {
  if (!map || !map.isStyleLoaded()) return;
  if (map.getLayer("s2-layer")) {
    map.setLayoutProperty("s2-layer", "visibility", mode === "s2" ? "visible" : "none");
  }
  if (map.getLayer("mapbox-layer")) {
    map.setLayerZoomRange("mapbox-layer", mode === "mapbox" ? 0 : 13, 22);
    map.setPaintProperty(
      "mapbox-layer",
      "raster-opacity",
      mode === "mapbox" ? 1 : ["interpolate", ["linear"], ["zoom"], 13, 0, 13.5, 1],
    );
  }
}

export function MapCanvas({
  yearT1,
  yearT2,
  polygon,
  features = [],
  isDrawing,
  onDrawingChange,
  onPolygonChange,
  selectedFeatureId,
  onSelectFeature,
  compareMode = false,
  onToggleCompareMode,
  basemapSource = "s2",
  onToggleBasemapSource,
  center = [46.745, 24.835],
  zoom = 12.5,
  onCameraMove,
  locationLabel = "RIYADH SEDRA, KSA",
  onCyclePreset,
  onCycleYear,
  visibleLayers = {
    titles: true,
    indicators: true,
    aoi: true,
    protectedAreas: false,
    restrictedAreas: false,
  },
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const compareContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const compareMapRef = useRef<maplibregl.Map | null>(null);

  const yearT1Ref = useRef(yearT1);
  yearT1Ref.current = yearT1;
  const appliedYearT1Ref = useRef(yearT1);
  const appliedYearT2Ref = useRef(yearT2);
  const polygonRef = useRef(polygon);
  polygonRef.current = polygon;
  const basemapSourceRef = useRef(basemapSource);
  basemapSourceRef.current = basemapSource;
  const onCameraMoveRef = useRef(onCameraMove);
  onCameraMoveRef.current = onCameraMove;

  // Drawing state
  const [activeVertices, setActiveVertices] = useState<[number, number][]>([]);
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);
  const activeVerticesRef = useRef<[number, number][]>([]);
  activeVerticesRef.current = activeVertices;

  // Inline Bounding-Box Parameter Pills State (Ref 2)
  const [swathOpacity, setSwathOpacity] = useState<number>(1.0);
  const [showMgrs, setShowMgrs] = useState<boolean>(false);

  // Projected screen coordinates for 4-corner swath & indicator pins (Ref 1, 2, 3)
  const [screenBox, setScreenBox] = useState<ScreenBoxProjection | null>(null);
  const [projectedPins, setProjectedPins] = useState<ProjectedPin[]>([]);
  const [activePinId, setActivePinId] = useState<number | null>(101);

  // Compute active pins from ML features or pre-seeded indicator pins
  const rawPins: IndicatorPin[] =
    features.length > 0
      ? features.slice(0, 8).map((f) => {
          const ring = f.geometry.coordinates[0] ?? [];
          const lons = ring.map((p) => p[0] ?? 0);
          const lats = ring.map((p) => p[1] ?? 0);
          const cLon =
            f.properties.centroid?.[0] ??
            (lons.length > 0 ? (Math.min(...lons) + Math.max(...lons)) / 2 : center[0]);
          const cLat =
            f.properties.centroid?.[1] ??
            (lats.length > 0 ? (Math.min(...lats) + Math.max(...lats)) / 2 : center[1]);
          return {
            id: f.properties.id,
            code: `JJV-${16500 + f.properties.id}`,
            lon: cLon,
            lat: cLat,
            probability: Math.round(f.properties.confidence * 100),
            subtitle: `Probability of ${f.properties.label.toLowerCase()}`,
            areaLabel: formatArea(f.properties.area_m2),
          };
        })
      : deriveDefaultPins(polygon);

  const rawPinsRef = useRef<IndicatorPin[]>(rawPins);
  rawPinsRef.current = rawPins;

  const recomputeScreenProjections = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const poly = polygonRef.current;
    if (poly && poly.length >= 4) {
      const uniqueCorners = poly.slice(0, 4);
      const projected = uniqueCorners.map(([lon, lat]) => {
        const pt = map.project([lon, lat]);
        return { x: pt.x, y: pt.y, lon, lat };
      });
      const xs = projected.map((p) => p.x);
      const ys = projected.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      setScreenBox({
        corners: projected,
        minX,
        maxX,
        minY,
        maxY,
        midX: (minX + maxX) / 2,
        midY: (minY + maxY) / 2,
      });
    } else {
      setScreenBox(null);
    }

    const nextPins = rawPinsRef.current.map((pin) => {
      const pt = map.project([pin.lon, pin.lat]);
      return { ...pin, x: pt.x, y: pt.y };
    });
    setProjectedPins(nextPins);
  }, []);

  // Sync dual maps during compare mode
  const syncMaps = useCallback((source: maplibregl.Map, target: maplibregl.Map) => {
    let active = false;
    const onMove = () => {
      if (active) return;
      active = true;
      target.jumpTo({
        center: source.getCenter(),
        zoom: source.getZoom(),
        bearing: 0,
        pitch: 0,
      });
      active = false;
    };
    source.on("move", onMove);
    return () => {
      source.off("move", onMove);
    };
  }, []);

  // Update Basemap layer visibility
  useEffect(() => {
    applyBasemapMode(mapRef.current, basemapSource);
    applyBasemapMode(compareMapRef.current, basemapSource);
  }, [basemapSource]);

  // Update Swath & Feature Opacity from inline [Opacity: 1.0] pill
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer("aoi-fill")) {
      map.setPaintProperty("aoi-fill", "fill-opacity", 0.2 * swathOpacity);
    }
    if (map.getLayer("change-features-fill")) {
      map.setPaintProperty("change-features-fill", "fill-opacity", 0.62 * swathOpacity);
    }
  }, [swathOpacity]);

  // Apply Layer Visibility from Bottom Checklist Bar (Ref 1)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const aoiVis = visibleLayers.aoi ? "visible" : "none";
    for (const id of ["aoi-fill", "aoi-stroke", "aoi-vertices"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", aoiVis);
    }

    const indVis = visibleLayers.indicators ? "visible" : "none";
    for (const id of ["change-features-fill", "change-features-line"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", indVis);
    }

    const protVis = visibleLayers.protectedAreas ? "visible" : "none";
    for (const id of ["protected-fill", "protected-line"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", protVis);
    }

    const restVis = visibleLayers.restrictedAreas ? "visible" : "none";
    for (const id of ["restricted-fill", "restricted-line"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", restVis);
    }
  }, [visibleLayers]);

  // Initialize Primary Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(yearT2),
      center,
      zoom,
      minZoom: 1,
      maxZoom: 19,
      fadeDuration: 0,
      maxTileCacheSize: 1200,
      maxTileCacheZoomLevels: 8,
      refreshExpiredTiles: false,
      cancelPendingTileRequestsWhileZooming: true,
      scrollZoom: true,
      dragPan: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      minPitch: 0,
      bearing: 0,
      doubleClickZoom: false,
      attributionControl: false,
    });

    map.scrollZoom.setWheelZoomRate(1 / 200);
    map.scrollZoom.setZoomRate(1 / 85);
    map.touchZoomRotate.disableRotation();
    map.on("error", () => {
      // Suppress transient tile network errors
    });

    map.on("move", () => {
      recomputeScreenProjections();
    });

    map.on("moveend", () => {
      const c = map.getCenter();
      onCameraMoveRef.current?.([c.lng, c.lat], map.getZoom());
      recomputeScreenProjections();
    });

    map.on("load", () => {
      // 1. AOI Swath Footprint Source & Layers (Ref 2 & Ref 3 Cyan Swath + White Dashed Frame + 4 Corner Nodes)
      map.addSource("aoi-polygon-source", {
        type: "geojson",
        data: buildPolygonGeoJson(polygonRef.current),
      });

      map.addLayer({
        id: "aoi-fill",
        type: "fill",
        source: "aoi-polygon-source",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": "#36C5D8",
          "fill-opacity": 0.2,
        },
      });

      map.addLayer({
        id: "aoi-stroke",
        type: "line",
        source: "aoi-polygon-source",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "line-color": "#FFFFFF",
          "line-width": 1.6,
          "line-dasharray": [4, 3],
        },
      });

      map.addLayer({
        id: "aoi-vertices",
        type: "circle",
        source: "aoi-polygon-source",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 4.5,
          "circle-color": "#FFFFFF",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0F4C6C",
        },
      });

      // 2. Protected & Restricted Zone Layers (Toggled by Ref 1 Bottom Layer Bar)
      const zones = buildZoneOverlays(polygonRef.current);
      map.addSource("protected-zones-source", {
        type: "geojson",
        data: zones.protectedGeoJson,
      });
      map.addLayer({
        id: "protected-fill",
        type: "fill",
        source: "protected-zones-source",
        layout: { visibility: "none" },
        paint: { "fill-color": "#00875A", "fill-opacity": 0.22 },
      });
      map.addLayer({
        id: "protected-line",
        type: "line",
        source: "protected-zones-source",
        layout: { visibility: "none" },
        paint: { "line-color": "#10B981", "line-width": 1.8, "line-dasharray": [3, 2] },
      });

      map.addSource("restricted-zones-source", {
        type: "geojson",
        data: zones.restrictedGeoJson,
      });
      map.addLayer({
        id: "restricted-fill",
        type: "fill",
        source: "restricted-zones-source",
        layout: { visibility: "none" },
        paint: { "fill-color": "#C8553D", "fill-opacity": 0.22 },
      });
      map.addLayer({
        id: "restricted-line",
        type: "line",
        source: "restricted-zones-source",
        layout: { visibility: "none" },
        paint: { "line-color": "#F4C396", "line-width": 1.8, "line-dasharray": [2, 2] },
      });

      // 3. Active Drawing rubber-band source & layers
      map.addSource("drawing-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "drawing-fill",
        type: "fill",
        source: "drawing-source",
        paint: { "fill-color": "#36C5D8", "fill-opacity": 0.18 },
      });

      map.addLayer({
        id: "drawing-line",
        type: "line",
        source: "drawing-source",
        paint: { "line-color": "#FFFFFF", "line-width": 2, "line-dasharray": [3, 2] },
      });

      map.addLayer({
        id: "drawing-points",
        type: "circle",
        source: "drawing-source",
        paint: {
          "circle-radius": 5,
          "circle-color": "#FFFFFF",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0F4C6C",
        },
      });

      // 4. Change Polygons from ML vectorization
      map.addSource("change-features-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });

      map.addLayer({
        id: "change-features-fill",
        type: "fill",
        source: "change-features-source",
        paint: {
          "fill-color": [
            "match",
            ["get", "class"],
            "vegetation_loss",
            "#C8553D",
            "vegetation_loss_to_bare",
            "#C8553D",
            "new_built_or_bare",
            "#F4C396",
            "bare_to_built",
            "#F4C396",
            "vegetation_gain",
            "#00875A",
            "surface_change",
            "#36C5D8",
            "#36C5D8",
          ],
          "fill-opacity": 0.58,
        },
      });

      map.addLayer({
        id: "change-features-line",
        type: "line",
        source: "change-features-source",
        paint: {
          "line-color": "#FFFFFF",
          "line-width": 1.5,
          "line-opacity": 0.9,
        },
      });

      map.on("click", "change-features-fill", (e: maplibregl.MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const clicked = e.features[0];
        const id = clicked?.properties ? Number(clicked.properties["id"]) : null;
        if (id) {
          setActivePinId(id);
          onSelectFeature?.(id);
        }
      });

      map.on("mouseenter", "change-features-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "change-features-fill", () => {
        if (!isDrawing) map.getCanvas().style.cursor = "";
      });

      recomputeScreenProjections();
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      map.resize();
      recomputeScreenProjections();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [recomputeScreenProjections]);

  const centerLon = center[0];
  const centerLat = center[1];

  // Fly camera when preset or geocoding search updates `center` and `zoom`
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [centerLon, centerLat],
      zoom,
      bearing: 0,
      pitch: 0,
      duration: 1100,
      essential: true,
    });
    compareMapRef.current?.flyTo({
      center: [centerLon, centerLat],
      zoom,
      bearing: 0,
      pitch: 0,
      duration: 1100,
      essential: true,
    });
  }, [centerLon, centerLat, zoom]);

  // Initialize Secondary Map for Compare Mode (Year T1)
  useEffect(() => {
    if (!compareMode) {
      if (compareMapRef.current) {
        compareMapRef.current.remove();
        compareMapRef.current = null;
      }
      setTimeout(() => {
        mapRef.current?.resize();
        recomputeScreenProjections();
      }, 60);
      return;
    }

    if (!compareContainerRef.current || compareMapRef.current || !mapRef.current) return;

    const mainCenter = mapRef.current.getCenter();
    const mainZoom = mapRef.current.getZoom();

    const compareMap = new maplibregl.Map({
      container: compareContainerRef.current,
      style: buildMapStyle(yearT1Ref.current),
      center: [mainCenter.lng, mainCenter.lat],
      zoom: mainZoom,
      minZoom: 1,
      maxZoom: 19,
      fadeDuration: 0,
      maxTileCacheSize: 1200,
      maxTileCacheZoomLevels: 8,
      refreshExpiredTiles: false,
      cancelPendingTileRequestsWhileZooming: true,
      scrollZoom: true,
      dragPan: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      minPitch: 0,
      bearing: 0,
      doubleClickZoom: false,
      attributionControl: false,
    });
    appliedYearT1Ref.current = yearT1Ref.current;

    compareMap.scrollZoom.setWheelZoomRate(1 / 200);
    compareMap.scrollZoom.setZoomRate(1 / 85);
    compareMap.touchZoomRotate.disableRotation();
    compareMap.on("error", () => {});

    compareMap.on("load", () => {
      compareMap.addSource("compare-aoi-source", {
        type: "geojson",
        data: buildPolygonGeoJson(polygonRef.current),
      });
      compareMap.addLayer({
        id: "compare-aoi-fill",
        type: "fill",
        source: "compare-aoi-source",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#36C5D8", "fill-opacity": 0.16 },
      });
      compareMap.addLayer({
        id: "compare-aoi-stroke",
        type: "line",
        source: "compare-aoi-source",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "line-color": "#FFFFFF", "line-width": 1.6, "line-dasharray": [4, 3] },
      });

      applyBasemapMode(compareMap, basemapSourceRef.current);
    });

    compareMapRef.current = compareMap;

    const cleanSync1 = syncMaps(mapRef.current, compareMap);
    const cleanSync2 = syncMaps(compareMap, mapRef.current);

    const ro = new ResizeObserver(() => {
      compareMap.resize();
    });
    ro.observe(compareContainerRef.current);

    setTimeout(() => {
      mapRef.current?.resize();
      compareMap.resize();
      recomputeScreenProjections();
    }, 60);

    return () => {
      ro.disconnect();
      cleanSync1();
      cleanSync2();
      compareMap.remove();
      compareMapRef.current = null;
    };
  }, [compareMode, syncMaps, recomputeScreenProjections]);

  // Update Raster Tile Year in-place
  useEffect(() => {
    if (appliedYearT2Ref.current === yearT2) return;
    appliedYearT2Ref.current = yearT2;
    updateRasterYear(mapRef.current, yearT2);
  }, [yearT2]);

  useEffect(() => {
    if (appliedYearT1Ref.current === yearT1) return;
    appliedYearT1Ref.current = yearT1;
    updateRasterYear(compareMapRef.current, yearT1);
  }, [yearT1]);

  // Update AOI Polygon & Zone layers on both maps
  useEffect(() => {
    const geojson = buildPolygonGeoJson(polygon);
    const zones = buildZoneOverlays(polygon);
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      const src = map.getSource("aoi-polygon-source") as maplibregl.GeoJSONSource | undefined;
      src?.setData(geojson);
      const protSrc = map.getSource("protected-zones-source") as
        | maplibregl.GeoJSONSource
        | undefined;
      protSrc?.setData(zones.protectedGeoJson);
      const restSrc = map.getSource("restricted-zones-source") as
        | maplibregl.GeoJSONSource
        | undefined;
      restSrc?.setData(zones.restrictedGeoJson);
    }
    const compareMap = compareMapRef.current;
    if (compareMap && compareMap.isStyleLoaded()) {
      const compareSrc = compareMap.getSource("compare-aoi-source") as
        | maplibregl.GeoJSONSource
        | undefined;
      compareSrc?.setData(geojson);
    }
    recomputeScreenProjections();
  }, [polygon, recomputeScreenProjections]);

  // Update Change Polygons layer & active pin
  useEffect(() => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      const src = map.getSource("change-features-source") as maplibregl.GeoJSONSource | undefined;
      src?.setData({
        type: "FeatureCollection",
        features,
      });
    }
    if (features.length > 0 && features[0]) {
      setActivePinId(features[0].properties.id);
    } else {
      setActivePinId(101);
    }
    recomputeScreenProjections();
  }, [features, recomputeScreenProjections]);

  // Fly to selected feature
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || selectedFeatureId == null) return;
    setActivePinId(selectedFeatureId);
    const feat = features.find((f) => f.properties.id === selectedFeatureId);
    if (feat && feat.geometry.coordinates[0]?.[0]) {
      const ring = feat.geometry.coordinates[0];
      const lons = ring.map((p) => p[0] ?? 0);
      const lats = ring.map((p) => p[1] ?? 0);
      const cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
      const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      map.flyTo({ center: [cLon, cLat], zoom: 14, duration: 900 });
    }
  }, [selectedFeatureId, features]);

  // Multi-vertex drawing events
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!isDrawing) {
      map.getCanvas().style.cursor = "";
      setActiveVertices((prev) => (prev.length > 0 ? [] : prev));
      setCursorPos((prev) => (prev !== null ? null : prev));
      const src = map.getSource("drawing-source") as maplibregl.GeoJSONSource | undefined;
      if (src && map.isStyleLoaded()) {
        src.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }

    map.getCanvas().style.cursor = "crosshair";

    const finishDrawing = () => {
      const vertices = activeVerticesRef.current;
      if (vertices.length >= 3) {
        const closed = [...vertices, vertices[0]!];
        onPolygonChange(closed);
      }
      setActiveVertices([]);
      setCursorPos(null);
      onDrawingChange(false);
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const currentPoint: [number, number] = [
        Number(e.lngLat.lng.toFixed(6)),
        Number(e.lngLat.lat.toFixed(6)),
      ];
      setCursorPos(currentPoint);

      const src = map.getSource("drawing-source") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;

      const currentVertices = activeVerticesRef.current;
      if (currentVertices.length === 0) {
        src.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: currentPoint },
              properties: {},
            },
          ],
        });
      } else {
        const ringWithCursor = [...currentVertices, currentPoint, currentVertices[0]!];
        src.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [ringWithCursor] },
              properties: {},
            },
            ...currentVertices.map((v) => ({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: v },
              properties: {},
            })),
          ],
        });
      }
    };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const clickPoint: [number, number] = [
        Number(e.lngLat.lng.toFixed(6)),
        Number(e.lngLat.lat.toFixed(6)),
      ];

      const currentVertices = activeVerticesRef.current;
      if (currentVertices.length >= 3 && currentVertices[0]) {
        const [v0Lon, v0Lat] = currentVertices[0];
        const dist = Math.hypot(clickPoint[0] - v0Lon, clickPoint[1] - v0Lat);
        if (dist < 0.002) {
          finishDrawing();
          return;
        }
      }

      setActiveVertices((prev) => [...prev, clickPoint]);
    };

    const onDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      if (activeVerticesRef.current.length >= 3) {
        finishDrawing();
      }
    };

    map.on("mousemove", onMouseMove);
    map.on("click", onClick);
    map.on("dblclick", onDblClick);

    return () => {
      map.off("mousemove", onMouseMove);
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
    };
  }, [isDrawing, onDrawingChange, onPolygonChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!isDrawing) return;
      if (e.key === "Enter" && activeVertices.length >= 3) {
        const closed = [...activeVertices, activeVertices[0]!];
        onPolygonChange(closed);
        setActiveVertices([]);
        setCursorPos(null);
        onDrawingChange(false);
      } else if (e.key === "Escape") {
        setActiveVertices([]);
        setCursorPos(null);
        onDrawingChange(false);
      } else if (e.key === "Backspace" && activeVertices.length > 0) {
        setActiveVertices((prev) => prev.slice(0, -1));
      }
    },
    [isDrawing, activeVertices, onDrawingChange, onPolygonChange],
  );

  const currentDrawPoints =
    cursorPos && activeVertices.length >= 2 ? [...activeVertices, cursorPos] : activeVertices;
  const liveAreaKm2 =
    currentDrawPoints.length >= 3 ? calculatePolygonAreaKm2(currentDrawPoints) : 0;
  const isAreaOversized = liveAreaKm2 > MAX_AOI_KM2;

  const aoiAreaKm2 = polygon && polygon.length >= 3 ? calculatePolygonAreaKm2(polygon) : 0;
  const activeProjectedPin = projectedPins.find((p) => p.id === activePinId) ?? null;

  // Radial gauge SVG arc math for the Petrol-Blue popover (Ref 1)
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  const probOffset = activeProjectedPin
    ? circumference - (activeProjectedPin.probability / 100) * circumference
    : 0;

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative flex size-full overflow-hidden bg-[#0C1014] select-none outline-none"
    >
      {/* Left Compare Container (Year T1) */}
      <div
        className={`relative h-full overflow-hidden transition-[width] duration-300 ease-out ${
          compareMode ? "w-1/2 border-r border-white/25" : "w-0 hidden pointer-events-none"
        }`}
      >
        <div ref={compareContainerRef} className="size-full" />
        {compareMode && (
          <div className="pointer-events-none absolute top-4 start-4 z-10 flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] shadow-md">
            <span className="size-2 rounded-full bg-[#0F4C6C]" aria-hidden="true" />
            <span>Baseline Pass ({yearT1})</span>
          </div>
        )}
      </div>

      {/* Main Map Container (Year T2 + Spatial Overlays) */}
      <div
        className={`relative h-full overflow-hidden transition-[width] duration-300 ease-out ${
          compareMode ? "w-1/2" : "w-full"
        }`}
      >
        <div ref={containerRef} className="size-full" />

        {compareMode && (
          <div className="pointer-events-none absolute top-4 start-4 z-10 flex items-center gap-2 rounded-lg bg-[#0F4C6C] px-3 py-1.5 text-xs font-semibold text-white shadow-md">
            <span className="size-2 rounded-full bg-[#36C5D8] animate-pulse" aria-hidden="true" />
            <span>Target Pass ({yearT2})</span>
          </div>
        )}

        {/* =====================================================================
            SPATIAL OVERLAY 1: 4-CORNER LAT/LON VERTEX LABELS & INLINE PILLS (Ref 2 & Ref 3)
           ===================================================================== */}
        {visibleLayers.aoi &&
        screenBox &&
        screenBox.maxX - screenBox.minX > 90 &&
        screenBox.maxY - screenBox.minY > 70 ? (
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {/* 4-Corner Coordinate Readouts (Ref 3) */}
            {visibleLayers.titles &&
              screenBox.corners.map((c, idx) => {
                const isTop = c.y <= screenBox.midY;
                const isLeft = c.x <= screenBox.midX;
                return (
                  <div
                    key={idx}
                    style={{
                      left: `${c.x}px`,
                      top: `${c.y}px`,
                      transform: `translate(${isLeft ? "-85%" : "12%"}, ${isTop ? "-145%" : "45%"})`,
                    }}
                    className="absolute whitespace-nowrap font-mono text-[10px] tracking-wider text-white/75 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] tabular-nums"
                  >
                    LAT {c.lat.toFixed(4)} LON {c.lon.toFixed(4)}
                  </div>
                );
              })}

            {/* Top Floating Area Pill + Home Button (Exact Ref 2 Pattern) */}
            <div
              style={{
                left: `${screenBox.midX}px`,
                top: `${Math.max(16, screenBox.minY - 38)}px`,
                transform: "translateX(-50%)",
              }}
              className="pointer-events-auto absolute flex items-center gap-1.5"
            >
              <button
                type="button"
                onClick={() => {
                  mapRef.current?.flyTo({ center, zoom: 12.8, duration: 750 });
                }}
                title="Re-center on AOI bounding box"
                className="flex size-7 items-center justify-center rounded-md bg-white text-[#111827] shadow-md hover:bg-[#F3F5F7] transition-colors"
                aria-label="Re-center on bounding box"
              >
                <svg
                  className="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </button>
              <div className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] shadow-md tabular-nums">
                {aoiAreaKm2.toFixed(2)} km²
              </div>
              {showMgrs ? (
                <div className="rounded-md bg-[#0F4C6C] px-2 py-1 font-mono text-[11px] font-semibold text-white shadow-md">
                  MGRS: 38R MN 742 489
                </div>
              ) : null}
            </div>

            {/* Top-Right Inside Box Close/Redraw [x] Button (Exact Ref 2 Pattern) */}
            <button
              type="button"
              onClick={() => onDrawingChange(true)}
              title="Redraw bounding box"
              style={{
                left: `${screenBox.maxX - 28}px`,
                top: `${screenBox.minY + 8}px`,
              }}
              className="pointer-events-auto absolute flex size-5 items-center justify-center rounded-xs bg-white/90 text-[11px] font-bold text-[#111827] shadow-xs hover:bg-white transition-colors"
              aria-label="Redraw bounding box"
            >
              ×
            </button>

            {/* Bottom Floating Parameter Pills: Opacity, Zoom, Show MGRS (Exact Ref 2 Pattern) */}
            <div
              style={{
                left: `${screenBox.midX}px`,
                top: `${screenBox.maxY + 12}px`,
                transform: "translateX(-50%)",
              }}
              className="pointer-events-auto absolute flex items-center gap-1.5 whitespace-nowrap"
            >
              <button
                type="button"
                onClick={() =>
                  setSwathOpacity((prev) => (prev === 1.0 ? 0.6 : prev === 0.6 ? 0.25 : 1.0))
                }
                className="flex items-center gap-1 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[#111827] shadow-md hover:bg-white transition-colors tabular-nums"
              >
                <span>Opacity: {swathOpacity.toFixed(1)}</span>
                <span className="text-[9px] text-[#64707D]">↕</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onToggleCompareMode) {
                    onToggleCompareMode();
                  } else {
                    const z = mapRef.current?.getZoom() ?? 12.5;
                    mapRef.current?.zoomTo(z >= 14 ? 12.5 : 14.5, { duration: 500 });
                  }
                }}
                className="flex items-center gap-1 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[#111827] shadow-md hover:bg-white transition-colors"
              >
                <span>Zoom: {compareMode ? "1:1" : "2:1"}</span>
                <span className="text-[9px] text-[#64707D]">↕</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMgrs((v) => !v)}
                className="flex items-center gap-1 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[#111827] shadow-md hover:bg-white transition-colors"
              >
                <span>Show MGRS: {showMgrs ? "On" : "Off"}</span>
                <span className="text-[9px] text-[#64707D]">↕</span>
              </button>
            </div>

            {/* Right-Side Leader-Line Connected Orbital Swath HUD (Exact Ref 3 Pattern) */}
            {!compareMode ? (
              <div
                style={{
                  left: `${Math.min(
                    (containerRef.current?.clientWidth ?? 1200) - 340,
                    Math.max(screenBox.maxX, 420),
                  )}px`,
                  top: `${Math.max(24, Math.min((containerRef.current?.clientHeight ?? 800) - 340, screenBox.midY - 140))}px`,
                }}
                className="hidden xl:block absolute z-20"
              >
                <OrbitalSwathHud
                  locationLabel={locationLabel}
                  year={yearT2}
                  basemapSource={basemapSource}
                  onToggleBasemap={onToggleBasemapSource}
                  onCyclePreset={onCyclePreset}
                  onCycleYear={onCycleYear}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* =====================================================================
            SPATIAL OVERLAY 2: WARM-SAND INDICATOR PINS & PETROL-BLUE RADIAL POPOVER (Ref 1)
           ===================================================================== */}
        {visibleLayers.indicators ? (
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {projectedPins.map((pin) => {
              const isSelected = activePinId === pin.id;
              return (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() => {
                    setActivePinId(isSelected ? null : pin.id);
                    onSelectFeature?.(pin.id);
                  }}
                  style={{
                    left: `${pin.x}px`,
                    top: `${pin.y}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                  title={`${pin.code} (${pin.probability}% probability)`}
                  className={`pointer-events-auto absolute flex size-7 items-center justify-center rounded-full bg-[#F4C396] text-[#432810] shadow-[0_4px_14px_rgba(0,0,0,0.65)] transition-transform hover:scale-115 focus-visible:outline-none ${
                    isSelected ? "ring-2 ring-white scale-110" : ""
                  }`}
                  aria-label={`Inspect indicator ${pin.code}`}
                >
                  {/* Crossed Pickaxe / Site Indicator Icon (Exact Ref 1 Pin Icon) */}
                  <svg
                    className="size-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14.5 3.5c2.5 1 4.5 3 5.5 5.5" />
                    <path d="M9.5 3.5c-2.5 1-4.5 3-5.5 5.5" />
                    <path d="m14 10-9.5 9.5" />
                    <path d="m10 10 9.5 9.5" />
                  </svg>
                </button>
              );
            })}

            {/* Floating Petrol-Blue Radial Probability Callout Card (Exact Ref 1 Match) */}
            {activeProjectedPin ? (
              <div
                style={{
                  left: `${Math.min(
                    (containerRef.current?.clientWidth ?? 1000) - 230,
                    Math.max(16, activeProjectedPin.x + 14),
                  )}px`,
                  top: `${Math.min(
                    (containerRef.current?.clientHeight ?? 700) - 170,
                    Math.max(16, activeProjectedPin.y + 8),
                  )}px`,
                }}
                className="pointer-events-auto absolute z-20 w-54 bg-[#0F4C6C] px-4 py-3.5 text-center text-white shadow-[0_20px_44px_rgba(0,0,0,0.75)] border border-white/15"
              >
                <button
                  type="button"
                  onClick={() => setActivePinId(null)}
                  className="absolute top-1.5 right-2 text-xs text-white/60 hover:text-white"
                  aria-label="Close probability callout"
                >
                  ×
                </button>
                <p className="font-sans text-sm font-bold tracking-wide text-white">
                  {activeProjectedPin.code}
                </p>

                {/* Circular SVG Radial Progress Ring */}
                <div className="my-2 flex items-center justify-center">
                  <div className="relative flex size-15 items-center justify-center">
                    <svg className="size-15 -rotate-90" viewBox="0 0 64 64">
                      <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="4.5"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        fill="none"
                        stroke="#36C5D8"
                        strokeWidth="4.5"
                        strokeDasharray={circumference}
                        strokeDashoffset={probOffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute font-sans text-xs font-bold text-white tabular-nums">
                      {activeProjectedPin.probability}%
                    </span>
                  </div>
                </div>

                <p className="text-[11px] font-medium text-white/90 leading-snug">
                  {activeProjectedPin.subtitle}
                </p>
                {activeProjectedPin.areaLabel ? (
                  <p className="mt-1 font-mono text-[10px] text-[#36C5D8]">
                    Disturbed footprint: {activeProjectedPin.areaLabel}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* =====================================================================
            SPATIAL OVERLAY 3: WIREFRAME [ + | - ] RIGHT-EDGE ZOOM CONTROL (Ref 1)
           ===================================================================== */}
        <div className="pointer-events-auto absolute right-5 top-1/2 -translate-y-1/2 z-20 flex flex-col border border-white/85 bg-[#0C1014]/35 backdrop-blur-xs shadow-lg">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
            className="flex size-8 items-center justify-center border-b border-white/75 text-lg font-light text-white hover:bg-white/20 transition-colors focus-visible:outline-none"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
            className="flex size-8 items-center justify-center text-lg font-light text-white hover:bg-white/20 transition-colors focus-visible:outline-none"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      </div>

      {/* Live Polygon Drawing Status Bar */}
      {isDrawing ? (
        <div className="pointer-events-none absolute top-4 inset-x-0 z-30 flex justify-center px-4">
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs shadow-xl backdrop-blur-md transition-colors ${
              isAreaOversized
                ? "bg-[#C2312B] text-white"
                : "bg-white text-[#111827] border border-[#E6EAEE]"
            }`}
          >
            <span
              className={`size-2 rounded-full animate-ping ${
                isAreaOversized ? "bg-white" : "bg-[#00875A]"
              }`}
              aria-hidden="true"
            />
            <div className="flex items-center gap-2">
              <span className="font-semibold">Vertex {activeVertices.length + 1}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                Area: <strong>{formatArea(liveAreaKm2 * 1_000_000)}</strong>
                {isAreaOversized ? " (Exceeds 100\u00A0km² limit)" : " / 100\u00A0km² max"}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#64707D]">
                {activeVertices.length >= 3
                  ? "Click first point or press Enter to finish · Esc to cancel"
                  : "Click map to place vertices · Esc to cancel"}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

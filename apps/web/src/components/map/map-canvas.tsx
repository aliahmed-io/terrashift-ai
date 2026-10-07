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

if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

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
  basemapSource?: "s2" | "mapbox" | undefined;
  center?: [number, number] | undefined;
  zoom?: number | undefined;
  onCameraMove?: ((center: [number, number], zoom: number) => void) | undefined;
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
        "background-color": "#0B0F17",
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
    ],
  };
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
  basemapSource = "s2",
  center = [46.745, 24.835],
  zoom = 12.5,
  onCameraMove,
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

  const [activeVertices, setActiveVertices] = useState<[number, number][]>([]);
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);
  const activeVerticesRef = useRef<[number, number][]>([]);
  activeVerticesRef.current = activeVertices;

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

  useEffect(() => {
    applyBasemapMode(mapRef.current, basemapSource);
    applyBasemapMode(compareMapRef.current, basemapSource);
  }, [basemapSource]);

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
    map.on("error", () => {});

    map.on("moveend", () => {
      const c = map.getCenter();
      onCameraMoveRef.current?.([c.lng, c.lat], map.getZoom());
    });

    map.on("load", () => {
      map.addSource("aoi-polygon-source", {
        type: "geojson",
        data: buildPolygonGeoJson(polygonRef.current),
      });

      map.addLayer({
        id: "aoi-fill",
        type: "fill",
        source: "aoi-polygon-source",
        paint: {
          "fill-color": "#38BDF8",
          "fill-opacity": 0.14,
        },
      });

      map.addLayer({
        id: "aoi-stroke",
        type: "line",
        source: "aoi-polygon-source",
        paint: {
          "line-color": "#38BDF8",
          "line-width": 2,
          "line-dasharray": [4, 2],
        },
      });

      map.addSource("drawing-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "drawing-fill",
        type: "fill",
        source: "drawing-source",
        paint: { "fill-color": "#38BDF8", "fill-opacity": 0.18 },
      });

      map.addLayer({
        id: "drawing-line",
        type: "line",
        source: "drawing-source",
        paint: { "line-color": "#38BDF8", "line-width": 2 },
      });

      map.addLayer({
        id: "drawing-points",
        type: "circle",
        source: "drawing-source",
        paint: {
          "circle-radius": 5,
          "circle-color": "#38BDF8",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0B0F17",
        },
      });

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
            "#F43F5E",
            "vegetation_loss_to_bare",
            "#F43F5E",
            "new_built_or_bare",
            "#38BDF8",
            "bare_to_built",
            "#38BDF8",
            "vegetation_gain",
            "#10B981",
            "surface_change",
            "#38BDF8",
            "#38BDF8",
          ],
          "fill-opacity": 0.55,
        },
      });

      map.addLayer({
        id: "change-features-line",
        type: "line",
        source: "change-features-source",
        paint: {
          "line-color": "#F8FAFC",
          "line-width": 1.5,
          "line-opacity": 0.85,
        },
      });

      map.on("click", "change-features-fill", (e: maplibregl.MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const clicked = e.features[0];
        const id = clicked?.properties ? Number(clicked.properties["id"]) : null;
        if (id && onSelectFeature) {
          onSelectFeature(id);
        }
      });

      map.on("mouseenter", "change-features-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "change-features-fill", () => {
        if (!isDrawing) map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const centerLon = center[0];
  const centerLat = center[1];

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [centerLon, centerLat],
      zoom,
      bearing: 0,
      pitch: 0,
      duration: 1000,
      essential: true,
    });
    compareMapRef.current?.flyTo({
      center: [centerLon, centerLat],
      zoom,
      bearing: 0,
      pitch: 0,
      duration: 1000,
      essential: true,
    });
  }, [centerLon, centerLat, zoom]);

  useEffect(() => {
    if (!compareMode) {
      if (compareMapRef.current) {
        compareMapRef.current.remove();
        compareMapRef.current = null;
      }
      setTimeout(() => mapRef.current?.resize(), 60);
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
        paint: { "fill-color": "#38BDF8", "fill-opacity": 0.14 },
      });
      compareMap.addLayer({
        id: "compare-aoi-stroke",
        type: "line",
        source: "compare-aoi-source",
        paint: { "line-color": "#38BDF8", "line-width": 2, "line-dasharray": [4, 2] },
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
    }, 60);

    return () => {
      ro.disconnect();
      cleanSync1();
      cleanSync2();
      compareMap.remove();
      compareMapRef.current = null;
    };
  }, [compareMode, syncMaps]);

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

  useEffect(() => {
    const geojson = buildPolygonGeoJson(polygon);
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      const src = map.getSource("aoi-polygon-source") as maplibregl.GeoJSONSource | undefined;
      src?.setData(geojson);
    }
    const compareMap = compareMapRef.current;
    if (compareMap && compareMap.isStyleLoaded()) {
      const compareSrc = compareMap.getSource("compare-aoi-source") as
        | maplibregl.GeoJSONSource
        | undefined;
      compareSrc?.setData(geojson);
    }
  }, [polygon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("change-features-source") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features,
      });
    }
  }, [features]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || selectedFeatureId == null) return;
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

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative flex size-full overflow-hidden bg-ink-950 select-none outline-none"
    >
      {/* Left Compare Container (Year T1) */}
      <div
        className={`relative h-full overflow-hidden transition-[width] duration-300 ease-out ${
          compareMode ? "w-1/2 border-r border-bone-100/15" : "w-0 hidden pointer-events-none"
        }`}
      >
        <div ref={compareContainerRef} className="size-full" />
        {compareMode && (
          <div className="pointer-events-none absolute top-4 end-4 z-10 flex items-center gap-2 rounded-lg border border-bone-100/15 bg-ink-900/90 px-3 py-1.5 text-xs font-medium text-bone-100 backdrop-blur-md">
            <span className="size-2 rounded-full bg-bone-300" aria-hidden="true" />
            <span>Baseline ({yearT1})</span>
          </div>
        )}
      </div>

      {/* Main Map Container (Year T2) */}
      <div
        className={`relative h-full overflow-hidden transition-[width] duration-300 ease-out ${
          compareMode ? "w-1/2" : "w-full"
        }`}
      >
        <div ref={containerRef} className="size-full" />
        {compareMode && (
          <div className="pointer-events-none absolute top-4 start-4 z-10 flex items-center gap-2 rounded-lg border border-signal-400/30 bg-ink-900/90 px-3 py-1.5 text-xs font-medium text-signal-400 backdrop-blur-md">
            <span className="size-2 rounded-full bg-signal-400 animate-pulse" aria-hidden="true" />
            <span>Target ({yearT2})</span>
          </div>
        )}

        {/* Minimal Zoom Controls */}
        <div className="pointer-events-auto absolute bottom-6 end-6 z-20 flex flex-col overflow-hidden rounded-xl border border-bone-100/15 bg-ink-900/90 backdrop-blur-md shadow-xl">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
            className="flex size-9 items-center justify-center border-b border-bone-100/10 text-base text-bone-100 hover:bg-bone-100/10 transition-colors focus-visible:outline-none"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
            className="flex size-9 items-center justify-center text-base text-bone-100 hover:bg-bone-100/10 transition-colors focus-visible:outline-none"
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
            className={`flex items-center gap-3 rounded-xl border px-4 py-2 text-xs shadow-xl backdrop-blur-md ${
              isAreaOversized
                ? "border-crimson-400/60 bg-crimson-400/20 text-crimson-400"
                : "border-signal-400/40 bg-ink-900/95 text-bone-100"
            }`}
          >
            <span
              className={`size-2 rounded-full animate-ping ${
                isAreaOversized ? "bg-crimson-400" : "bg-signal-400"
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
              <span className="text-bone-300">
                {activeVertices.length >= 3
                  ? "Click first point or press Enter to finish · Esc to cancel"
                  : "Click map to place boundary points · Esc to cancel"}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

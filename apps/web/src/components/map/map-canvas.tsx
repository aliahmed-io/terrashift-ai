"use client";

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getEoxTileUrls, getHighResTileUrls, calculatePolygonAreaKm2, formatArea, MAX_AOI_KM2 } from "@/lib/tiles";

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

export type RasterLoadStatus = "idle" | "loading" | "slow" | "ready" | "fallback" | "error";

export interface RasterStatusInfo {
  status: RasterLoadStatus;
  latencyMs: number | null;
  origin: "ml-engine" | "sample-fallback" | null;
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
  layerOpacity?: number | undefined;
  classFilter?: string | undefined;
  effectRasterUrl?: string | undefined;
  effectBbox?: [number, number, number, number] | undefined;
  showEffectOverlay?: boolean | undefined;
  effectOpacity?: number | undefined;
  zoomActionsRef?: React.MutableRefObject<{ zoomIn: () => void; zoomOut: () => void } | null> | undefined;
  showDefaultZoomControls?: boolean | undefined;
  onRasterStatusChange?: ((info: RasterStatusInfo) => void) | undefined;
}

// Client-side memory cache so switching back to an already-rendered AI layer is instantaneous (0ms)
const CLIENT_RASTER_CACHE = new Map<string, { blobUrl: string; origin: "ml-engine" | "sample-fallback" }>();

function getOpenVertices(polygon: [number, number][] | null): [number, number][] {
  if (!polygon || polygon.length < 3) return [];
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1] && polygon.length > 3) {
    return polygon.slice(0, -1);
  }
  return [...polygon];
}

function closeRing(vertices: [number, number][]): [number, number][] {
  if (vertices.length < 3) return vertices;
  const first = vertices[0]!;
  return [...vertices, [first[0], first[1]]];
}

function computeBboxFromPolygon(
  polygon: [number, number][] | null,
  fallback?: [number, number, number, number],
): [number, number, number, number] | undefined {
  if (!polygon || polygon.length < 3) return fallback;
  const lons = polygon.map((p) => p[0]);
  const lats = polygon.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
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
  const ring = closeRing(getOpenVertices(polygon));

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

function buildVertexHandlesGeoJson(polygon: [number, number][] | null): GeoJSON.FeatureCollection {
  const open = getOpenVertices(polygon);
  if (open.length < 3) {
    return { type: "FeatureCollection", features: [] };
  }

  const features: GeoJSON.Feature[] = [];

  // Corner handles
  open.forEach((coord, idx) => {
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: coord,
      },
      properties: {
        vertexIndex: idx,
        handleType: "corner",
      },
    });
  });

  // Edge midpoint handles (allow dragging an edge or inserting a vertex)
  open.forEach((coord, idx) => {
    const nextCoord = open[(idx + 1) % open.length]!;
    const mid: [number, number] = [
      Number(((coord[0] + nextCoord[0]) / 2).toFixed(6)),
      Number(((coord[1] + nextCoord[1]) / 2).toFixed(6)),
    ];
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: mid,
      },
      properties: {
        edgeIndex: idx,
        handleType: "midpoint",
      },
    });
  });

  return {
    type: "FeatureCollection",
    features,
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

function mountOrUpdateDiagnosticOverlay(
  map: maplibregl.Map | null,
  resolvedImageUrl?: string,
  effectBbox?: [number, number, number, number],
  showEffectOverlay: boolean = true,
  effectOpacity: number = 0.85,
) {
  if (!map || !map.isStyleLoaded()) return;

  const sourceId = "diagnostic-overlay-source";
  const layerId = "diagnostic-overlay-layer";

  if (!resolvedImageUrl || !effectBbox || showEffectOverlay === false) {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
    return;
  }

  const [minLon, minLat, maxLon, maxLat] = effectBbox;
  const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
    [minLon, maxLat],
    [maxLon, maxLat],
    [maxLon, minLat],
    [minLon, minLat],
  ];

  const existingSource = map.getSource(sourceId) as maplibregl.ImageSource | undefined;
  if (existingSource && typeof existingSource.updateImage === "function") {
    try {
      existingSource.updateImage({ url: resolvedImageUrl, coordinates });
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, "raster-opacity", effectOpacity);
      }
      return;
    } catch {
      // Fallback to recreate if updateImage fails
    }
  }

  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }

  try {
    map.addSource(sourceId, {
      type: "image",
      url: resolvedImageUrl,
      coordinates,
    });

    const beforeId = map.getLayer("aoi-fill") ? "aoi-fill" : undefined;
    map.addLayer(
      {
        id: layerId,
        type: "raster",
        source: sourceId,
        paint: {
          "raster-opacity": effectOpacity,
          "raster-fade-duration": 0,
          "raster-resampling": "linear",
        },
      },
      beforeId,
    );
  } catch {
    // Graceful fallback during tile/context refresh
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
  layerOpacity = 0.55,
  classFilter = "all",
  effectRasterUrl,
  effectBbox,
  showEffectOverlay = true,
  effectOpacity = 0.85,
  zoomActionsRef,
  showDefaultZoomControls = true,
  onRasterStatusChange,
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
  const onPolygonChangeRef = useRef(onPolygonChange);
  onPolygonChangeRef.current = onPolygonChange;
  const isDrawingRef = useRef(isDrawing);
  isDrawingRef.current = isDrawing;
  const basemapSourceRef = useRef(basemapSource);
  basemapSourceRef.current = basemapSource;
  const onCameraMoveRef = useRef(onCameraMove);
  onCameraMoveRef.current = onCameraMove;
  const onRasterStatusChangeRef = useRef(onRasterStatusChange);
  onRasterStatusChangeRef.current = onRasterStatusChange;

  // Dynamic bbox tracks the edited blue polygon so AI overlay aligns with user's edited shape
  const dynamicBbox = computeBboxFromPolygon(polygon, effectBbox);
  const resolvedBlobUrlRef = useRef<string | undefined>(undefined);
  const effectBboxRef = useRef(dynamicBbox);
  effectBboxRef.current = dynamicBbox;
  const showEffectOverlayRef = useRef(showEffectOverlay);
  showEffectOverlayRef.current = showEffectOverlay;
  const effectOpacityRef = useRef(effectOpacity);
  effectOpacityRef.current = effectOpacity;

  const [activeVertices, setActiveVertices] = useState<[number, number][]>([]);
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);
  const activeVerticesRef = useRef<[number, number][]>([]);
  activeVerticesRef.current = activeVertices;

  // State for dragging existing blue polygon corners/edges
  const [isDraggingVertex, setIsDraggingVertex] = useState(false);
  const [liveDragAreaKm2, setLiveDragAreaKm2] = useState<number | null>(null);
  const dragStateRef = useRef<{
    mode: "corner" | "edge" | "translate";
    index: number;
    startLngLat: [number, number];
    initialVertices: [number, number][];
    currentVertices: [number, number][];
  } | null>(null);

  // State for AI Raster loading / lag / not-responding feedback
  const [rasterStatus, setRasterStatus] = useState<RasterLoadStatus>("idle");
  const [rasterLatencyMs, setRasterLatencyMs] = useState<number | null>(null);
  const [elapsedLoadMs, setElapsedLoadMs] = useState<number>(0);
  const [retryCounter, setRetryCounter] = useState<number>(0);

  const updateStatus = useCallback(
    (status: RasterLoadStatus, latencyMs: number | null, origin: "ml-engine" | "sample-fallback" | null) => {
      setRasterStatus(status);
      setRasterLatencyMs(latencyMs);
      onRasterStatusChangeRef.current?.({ status, latencyMs, origin });
    },
    [],
  );

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
          "line-width": 2.2,
          "line-dasharray": [4, 2],
        },
      });

      // Interactive draggable vertex & edge handles for editing the blue AOI shape
      map.addSource("aoi-vertices-source", {
        type: "geojson",
        data: buildVertexHandlesGeoJson(polygonRef.current),
      });

      map.addLayer({
        id: "aoi-midpoint-handles",
        type: "circle",
        source: "aoi-vertices-source",
        filter: ["==", ["get", "handleType"], "midpoint"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#38BDF8",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
          "circle-opacity": 0.85,
        },
      });

      map.addLayer({
        id: "aoi-corner-handles",
        type: "circle",
        source: "aoi-vertices-source",
        filter: ["==", ["get", "handleType"], "corner"],
        paint: {
          "circle-radius": 7,
          "circle-color": "#FFFFFF",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#0284C7",
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

      // Cursor feedback on corner and midpoint handles
      map.on("mouseenter", "aoi-corner-handles", () => {
        if (!isDrawingRef.current && !dragStateRef.current) {
          map.getCanvas().style.cursor = "grab";
        }
      });
      map.on("mouseleave", "aoi-corner-handles", () => {
        if (!isDrawingRef.current && !dragStateRef.current) {
          map.getCanvas().style.cursor = "";
        }
      });
      map.on("mouseenter", "aoi-midpoint-handles", () => {
        if (!isDrawingRef.current && !dragStateRef.current) {
          map.getCanvas().style.cursor = "grab";
        }
      });
      map.on("mouseleave", "aoi-midpoint-handles", () => {
        if (!isDrawingRef.current && !dragStateRef.current) {
          map.getCanvas().style.cursor = "";
        }
      });

      // Start dragging a corner handle
      map.on("mousedown", "aoi-corner-handles", (e: maplibregl.MapLayerMouseEvent) => {
        if (isDrawingRef.current) return;
        const feat = e.features?.[0];
        const vIdx = feat?.properties?.["vertexIndex"];
        if (typeof vIdx !== "number") return;
        e.preventDefault();
        const open = getOpenVertices(polygonRef.current);
        if (open.length < 3) return;
        map.dragPan.disable();
        map.getCanvas().style.cursor = "grabbing";
        dragStateRef.current = {
          mode: "corner",
          index: vIdx,
          startLngLat: [e.lngLat.lng, e.lngLat.lat],
          initialVertices: open.map((p) => [p[0], p[1]]),
          currentVertices: open.map((p) => [p[0], p[1]]),
        };
        setIsDraggingVertex(true);
        setLiveDragAreaKm2(calculatePolygonAreaKm2(closeRing(open)));
      });

      // Start dragging an edge midpoint handle (moves that edge segment)
      map.on("mousedown", "aoi-midpoint-handles", (e: maplibregl.MapLayerMouseEvent) => {
        if (isDrawingRef.current) return;
        const feat = e.features?.[0];
        const eIdx = feat?.properties?.["edgeIndex"];
        if (typeof eIdx !== "number") return;
        e.preventDefault();
        const open = getOpenVertices(polygonRef.current);
        if (open.length < 3) return;
        map.dragPan.disable();
        map.getCanvas().style.cursor = "grabbing";
        dragStateRef.current = {
          mode: "edge",
          index: eIdx,
          startLngLat: [e.lngLat.lng, e.lngLat.lat],
          initialVertices: open.map((p) => [p[0], p[1]]),
          currentVertices: open.map((p) => [p[0], p[1]]),
        };
        setIsDraggingVertex(true);
        setLiveDragAreaKm2(calculatePolygonAreaKm2(closeRing(open)));
      });

      // Update blue polygon live during mousemove
      map.on("mousemove", (e: maplibregl.MapMouseEvent) => {
        const drag = dragStateRef.current;
        if (!drag) return;

        const nextVertices: [number, number][] = drag.initialVertices.map((p) => [p[0], p[1]]);
        const dLng = e.lngLat.lng - drag.startLngLat[0];
        const dLat = e.lngLat.lat - drag.startLngLat[1];

        if (drag.mode === "corner") {
          const initV = drag.initialVertices;
          // If it's a 4-corner axis-aligned rectangle, resize the rectangle smoothly
          const isRect =
            initV.length === 4 &&
            (Math.abs(initV[0]![0] - initV[3]![0]) < 1e-4 || Math.abs(initV[0]![0] - initV[1]![0]) < 1e-4);

          if (isRect) {
            const idx = drag.index;
            const oppIdx = (idx + 2) % 4;
            const opp = initV[oppIdx]!;
            const newLon = Number(e.lngLat.lng.toFixed(6));
            const newLat = Number(e.lngLat.lat.toFixed(6));
            const minLon = Math.min(opp[0], newLon);
            const maxLon = Math.max(opp[0], newLon);
            const minLat = Math.min(opp[1], newLat);
            const maxLat = Math.max(opp[1], newLat);
            nextVertices[0] = [minLon, minLat];
            nextVertices[1] = [maxLon, minLat];
            nextVertices[2] = [maxLon, maxLat];
            nextVertices[3] = [minLon, maxLat];
          } else {
            nextVertices[drag.index] = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];
          }
        } else if (drag.mode === "edge") {
          const idx1 = drag.index;
          const idx2 = (drag.index + 1) % nextVertices.length;
          nextVertices[idx1] = [
            Number((drag.initialVertices[idx1]![0] + dLng).toFixed(6)),
            Number((drag.initialVertices[idx1]![1] + dLat).toFixed(6)),
          ];
          nextVertices[idx2] = [
            Number((drag.initialVertices[idx2]![0] + dLng).toFixed(6)),
            Number((drag.initialVertices[idx2]![1] + dLat).toFixed(6)),
          ];
        }

        drag.currentVertices = nextVertices;
        const closed = closeRing(nextVertices);
        setLiveDragAreaKm2(calculatePolygonAreaKm2(closed));

        const polySrc = map.getSource("aoi-polygon-source") as maplibregl.GeoJSONSource | undefined;
        polySrc?.setData(buildPolygonGeoJson(closed));

        const handleSrc = map.getSource("aoi-vertices-source") as maplibregl.GeoJSONSource | undefined;
        handleSrc?.setData(buildVertexHandlesGeoJson(closed));

        const newBbox = computeBboxFromPolygon(closed, effectBboxRef.current);
        if (newBbox && resolvedBlobUrlRef.current && showEffectOverlayRef.current) {
          mountOrUpdateDiagnosticOverlay(
            map,
            resolvedBlobUrlRef.current,
            newBbox,
            showEffectOverlayRef.current,
            effectOpacityRef.current,
          );
        }
      });

      const finishVertexDrag = () => {
        const drag = dragStateRef.current;
        if (!drag) return;
        dragStateRef.current = null;
        setIsDraggingVertex(false);
        setLiveDragAreaKm2(null);
        map.dragPan.enable();
        map.getCanvas().style.cursor = "";
        const closed = closeRing(drag.currentVertices);
        onPolygonChangeRef.current(closed);
      };

      map.on("mouseup", finishVertexDrag);

      if (resolvedBlobUrlRef.current) {
        mountOrUpdateDiagnosticOverlay(
          map,
          resolvedBlobUrlRef.current,
          effectBboxRef.current,
          showEffectOverlayRef.current,
          effectOpacityRef.current,
        );
      }
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

  // Preload AI Raster URL and track loading / slow / fallback / error status so the map never lags silently
  useEffect(() => {
    const map = mapRef.current;

    if (!effectRasterUrl || !showEffectOverlay) {
      updateStatus("idle", null, null);
      if (map && map.isStyleLoaded()) {
        mountOrUpdateDiagnosticOverlay(map, undefined, dynamicBbox, false, effectOpacity);
      }
      return;
    }

    // Check client-side cache first for 0ms instant switching
    const cached = CLIENT_RASTER_CACHE.get(effectRasterUrl);
    if (cached && retryCounter === 0) {
      resolvedBlobUrlRef.current = cached.blobUrl;
      updateStatus(cached.origin === "ml-engine" ? "ready" : "fallback", 1, cached.origin);
      if (map) {
        if (map.isStyleLoaded()) {
          mountOrUpdateDiagnosticOverlay(map, cached.blobUrl, dynamicBbox, showEffectOverlay, effectOpacity);
        } else {
          map.once("load", () => {
            mountOrUpdateDiagnosticOverlay(map, cached.blobUrl, dynamicBbox, showEffectOverlay, effectOpacity);
          });
        }
      }
      return;
    }

    let cancelled = false;
    const abortCtrl = new AbortController();
    const startMs = performance.now();
    setElapsedLoadMs(0);
    updateStatus("loading", null, null);

    const intervalId = window.setInterval(() => {
      const elapsed = Math.round(performance.now() - startMs);
      setElapsedLoadMs(elapsed);
      if (elapsed >= 1200) {
        setRasterStatus((prev) => (prev === "loading" ? "slow" : prev));
      }
    }, 120);

    fetch(effectRasterUrl, { signal: abortCtrl.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const originHeader = res.headers.get("X-Raster-Origin");
        const origin: "ml-engine" | "sample-fallback" =
          originHeader === "ml-engine" ? "ml-engine" : "sample-fallback";
        const blob = await res.blob();
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);
        CLIENT_RASTER_CACHE.set(effectRasterUrl, { blobUrl, origin });
        resolvedBlobUrlRef.current = blobUrl;

        const latency = Math.max(1, Math.round(performance.now() - startMs));
        updateStatus(origin === "ml-engine" ? "ready" : "fallback", latency, origin);

        const currentMap = mapRef.current;
        if (currentMap) {
          if (currentMap.isStyleLoaded()) {
            mountOrUpdateDiagnosticOverlay(
              currentMap,
              blobUrl,
              effectBboxRef.current,
              showEffectOverlayRef.current,
              effectOpacityRef.current,
            );
          } else {
            currentMap.once("load", () => {
              mountOrUpdateDiagnosticOverlay(
                currentMap,
                blobUrl,
                effectBboxRef.current,
                showEffectOverlayRef.current,
                effectOpacityRef.current,
              );
            });
          }
        }
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        const latency = Math.round(performance.now() - startMs);
        updateStatus("error", latency, null);
      })
      .finally(() => {
        window.clearInterval(intervalId);
      });

    return () => {
      cancelled = true;
      abortCtrl.abort();
      window.clearInterval(intervalId);
    };
  }, [effectRasterUrl, showEffectOverlay, retryCounter, updateStatus]);

  // Update overlay coordinates or opacity immediately when polygon bbox or opacity changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (resolvedBlobUrlRef.current && showEffectOverlay) {
      mountOrUpdateDiagnosticOverlay(map, resolvedBlobUrlRef.current, dynamicBbox, showEffectOverlay, effectOpacity);
    }
  }, [dynamicBbox, showEffectOverlay, effectOpacity]);

  useEffect(() => {
    if (!zoomActionsRef) return;
    zoomActionsRef.current = {
      zoomIn: () => {
        mapRef.current?.zoomIn({ duration: 250 });
      },
      zoomOut: () => {
        mapRef.current?.zoomOut({ duration: 250 });
      },
    };
    return () => {
      zoomActionsRef.current = null;
    };
  }, [zoomActionsRef]);

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
    const handlesGeojson = buildVertexHandlesGeoJson(polygon);
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      const src = map.getSource("aoi-polygon-source") as maplibregl.GeoJSONSource | undefined;
      src?.setData(geojson);
      const handlesSrc = map.getSource("aoi-vertices-source") as maplibregl.GeoJSONSource | undefined;
      handlesSrc?.setData(handlesGeojson);
    }
    const compareMap = compareMapRef.current;
    if (compareMap && compareMap.isStyleLoaded()) {
      const compareSrc = compareMap.getSource("compare-aoi-source") as maplibregl.GeoJSONSource | undefined;
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
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer("change-features-fill")) {
      map.setPaintProperty("change-features-fill", "fill-opacity", layerOpacity);
    }

    let filterExpr: unknown = null;
    if (classFilter === "built") {
      filterExpr = [
        "any",
        ["==", ["get", "class"], "new_built_or_bare"],
        ["==", ["get", "class"], "bare_to_built"],
        ["==", ["get", "class"], "surface_change"],
      ];
    } else if (classFilter === "vegetation_loss") {
      filterExpr = [
        "any",
        ["==", ["get", "class"], "vegetation_loss"],
        ["==", ["get", "class"], "vegetation_loss_to_bare"],
      ];
    } else if (classFilter === "vegetation_gain") {
      filterExpr = ["==", ["get", "class"], "vegetation_gain"];
    }

    if (map.getLayer("change-features-fill")) {
      map.setFilter("change-features-fill", filterExpr as maplibregl.FilterSpecification);
    }
    if (map.getLayer("change-features-line")) {
      map.setFilter("change-features-line", filterExpr as maplibregl.FilterSpecification);
    }
  }, [layerOpacity, classFilter]);

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
      const currentPoint: [number, number] = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];
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
      const clickPoint: [number, number] = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];

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

  const currentDrawPoints = cursorPos && activeVertices.length >= 2 ? [...activeVertices, cursorPos] : activeVertices;
  const liveAreaKm2 = currentDrawPoints.length >= 3 ? calculatePolygonAreaKm2(currentDrawPoints) : 0;
  const isAreaOversized = liveAreaKm2 > MAX_AOI_KM2;

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="bg-ink-950 relative flex size-full overflow-hidden outline-none select-none"
    >
      {/* Left Compare Container (Year T1) */}
      <div
        className={`relative h-full overflow-hidden transition-[width] duration-300 ease-out ${
          compareMode ? "border-bone-100/15 w-1/2 border-r" : "pointer-events-none hidden w-0"
        }`}
      >
        <div ref={compareContainerRef} className="size-full" />
        {compareMode && (
          <div className="border-bone-100/15 bg-ink-900/90 text-bone-100 pointer-events-none absolute end-4 top-4 z-10 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium backdrop-blur-md">
            <span className="bg-bone-300 size-2 rounded-full" aria-hidden="true" />
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
          <div className="border-signal-400/30 bg-ink-900/90 text-signal-400 pointer-events-none absolute start-4 top-4 z-10 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium backdrop-blur-md">
            <span className="bg-signal-400 size-2 animate-pulse rounded-full" aria-hidden="true" />
            <span>Target ({yearT2})</span>
          </div>
        )}

        {/* Minimal Zoom Controls */}
        {showDefaultZoomControls && (
          <div className="border-bone-100/15 bg-ink-900/90 pointer-events-auto absolute end-6 bottom-6 z-20 flex flex-col overflow-hidden rounded-xl border shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
              className="border-bone-100/10 text-bone-100 hover:bg-bone-100/10 flex size-9 items-center justify-center border-b text-base transition-colors focus-visible:outline-none"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
              className="text-bone-100 hover:bg-bone-100/10 flex size-9 items-center justify-center text-base transition-colors focus-visible:outline-none"
              aria-label="Zoom out"
            >
              −
            </button>
          </div>
        )}
      </div>

      {/* Live AI Spectral Overlay Loading / Lag / Error Status Banner */}
      {showEffectOverlay && (rasterStatus === "loading" || rasterStatus === "slow" || rasterStatus === "error") && (
        <div className="pointer-events-auto absolute inset-x-0 top-5 z-30 flex justify-center px-4">
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-[12px] font-medium shadow-lg backdrop-blur-md ${
              rasterStatus === "error"
                ? "border-[#e94235]/50 bg-[#1b1e23]/95 text-[#ff8b82]"
                : rasterStatus === "slow"
                  ? "border-[#f39223]/50 bg-[#1b1e23]/95 text-[#fbbf24]"
                  : "border-white/15 bg-[#1b1e23]/90 text-white"
            }`}
          >
            {rasterStatus === "error" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-[#e94235]" />
                <span>AI Raster Service Not Responding ({rasterLatencyMs ?? 0} ms)</span>
                <button
                  type="button"
                  onClick={() => {
                    if (effectRasterUrl) CLIENT_RASTER_CACHE.delete(effectRasterUrl);
                    setRetryCounter((c) => c + 1);
                  }}
                  className="ml-1 cursor-pointer rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-white/25"
                >
                  Retry
                </button>
              </>
            ) : (
              <>
                <svg
                  className="h-3.5 w-3.5 animate-spin text-[#38BDF8]"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path
                    className="opacity-90"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span>
                  {rasterStatus === "slow"
                    ? `AI Engine Computing Spectral Overlay (${(elapsedLoadMs / 1000).toFixed(1)}s)...`
                    : "Loading AI Spectral Overlay..."}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Live Blue AOI Corner/Edge Drag Telemetry HUD */}
      {isDraggingVertex && liveDragAreaKm2 !== null && (
        <div className="pointer-events-none absolute inset-x-0 top-5 z-30 flex justify-center px-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#38BDF8]/50 bg-[#1b1e23]/95 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#38BDF8]" />
            <span>Resizing Blue AOI Boundary</span>
            <span>·</span>
            <span className="font-mono font-semibold text-[#38BDF8]">
              {formatArea(liveDragAreaKm2 * 1_000_000)}
            </span>
            <span className="text-white/60">(Release mouse to apply)</span>
          </div>
        </div>
      )}

      {/* Live Polygon Drawing Status Bar */}
      {isDrawing ? (
        <div className="pointer-events-none absolute inset-x-0 top-5 z-30 flex justify-center px-4">
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center gap-3 rounded-xl border px-4 py-2 text-xs shadow-xl backdrop-blur-md ${
              isAreaOversized
                ? "border-crimson-400/60 bg-crimson-400/20 text-crimson-400"
                : "border-[#38BDF8]/50 bg-[#1b1e23]/95 text-white"
            }`}
          >
            <span
              className={`size-2 animate-ping rounded-full ${isAreaOversized ? "bg-crimson-400" : "bg-[#38BDF8]"}`}
              aria-hidden="true"
            />
            <div className="flex items-center gap-2">
              <span className="font-semibold">Drawing Custom AOI · Vertex {activeVertices.length + 1}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                Area: <strong>{formatArea(liveAreaKm2 * 1_000_000)}</strong>
                {isAreaOversized ? " (Exceeds 100\u00A0km² limit)" : " / 100\u00A0km² max"}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-white/70">
                {activeVertices.length >= 3
                  ? "Click first point, double-click, or press Enter to finish · Esc to cancel"
                  : "Click map to place corners · Esc to cancel"}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

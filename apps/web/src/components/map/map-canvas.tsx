"use client";

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  calculatePolygonAreaKm2,
  formatArea,
  getEoxTileUrl,
  MAX_AOI_KM2,
} from "@/lib/tiles";

if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

export interface MapFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: {
    id: number;
    class: string;
    label: string;
    area_m2: number;
    confidence: number;
    greenness_delta?: number | undefined;
    bareness_delta?: number | undefined;
  };
}

interface MapCanvasProps {
  yearT1: number;
  yearT2: number;
  polygon: [number, number][] | null;
  features?: MapFeature[] | undefined;
  isDrawing: boolean;
  onDrawingChange: (drawing: boolean) => void;
  onPolygonChange: (polygon: [number, number][] | null) => void;
  selectedFeatureId?: number | null | undefined;
  onSelectFeature?: ((id: number | null) => void) | undefined;
  compareMode?: boolean | undefined;
  center?: [number, number] | undefined;
  zoom?: number | undefined;
}

function buildMapStyle(year: number): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      "carto-dark": {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "CartoDB Dark Matter",
      },
      "s2-cloudless": {
        type: "raster",
        tiles: [getEoxTileUrl(year)],
        tileSize: 256,
        maxzoom: 14,
        attribution: "Sentinel-2 cloudless by EOX IT Services GmbH",
      },
    },
    layers: [
      {
        id: "carto-base",
        type: "raster",
        source: "carto-dark",
        minzoom: 0,
        maxzoom: 20,
      },
      {
        id: "s2-layer",
        type: "raster",
        source: "s2-cloudless",
        minzoom: 4,
        maxzoom: 14,
        paint: {
          "raster-opacity": 0.95,
          "raster-fade-duration": 300,
        },
      },
    ],
  };
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
  center = [-62.905, -9.702],
  zoom = 12.5,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const compareContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const compareMapRef = useRef<maplibregl.Map | null>(null);

  // Drawing state
  const [activeVertices, setActiveVertices] = useState<[number, number][]>([]);
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);
  const [sliderPos, setSliderPos] = useState(50); // percentage for compare mode
  const isDraggingSlider = useRef(false);

  // Sync maps during compare mode
  const syncMaps = useCallback((source: maplibregl.Map, target: maplibregl.Map) => {
    let active = false;
    const onMove = () => {
      if (active) return;
      active = true;
      target.jumpTo({
        center: source.getCenter(),
        zoom: source.getZoom(),
        bearing: source.getBearing(),
        pitch: source.getPitch(),
      });
      active = false;
    };
    source.on("move", onMove);
    return () => {
      source.off("move", onMove);
    };
  }, []);

  // Initialize Primary Map (Year T2 or base)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(yearT2),
      center,
      zoom,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      // 1. AOI polygon source & layers
      map.addSource("aoi-polygon-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: polygon
            ? [
                {
                  type: "Feature",
                  geometry: {
                    type: "Polygon",
                    coordinates: [
                      polygon[0]?.[0] === polygon[polygon.length - 1]?.[0] &&
                      polygon[0]?.[1] === polygon[polygon.length - 1]?.[1]
                        ? polygon
                        : [...polygon, polygon[0] ?? [0, 0]],
                    ],
                  },
                  properties: {},
                },
              ]
            : [],
        },
      });

      map.addLayer({
        id: "aoi-fill",
        type: "fill",
        source: "aoi-polygon-source",
        paint: {
          "fill-color": "#FFB020",
          "fill-opacity": 0.12,
        },
      });

      map.addLayer({
        id: "aoi-stroke",
        type: "line",
        source: "aoi-polygon-source",
        paint: {
          "line-color": "#FFB020",
          "line-width": 2,
          "line-dasharray": [4, 2],
        },
      });

      // 2. Active Drawing rubber-band source & layers
      map.addSource("drawing-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "drawing-fill",
        type: "fill",
        source: "drawing-source",
        paint: {
          "fill-color": "#3DD6C3",
          "fill-opacity": 0.15,
        },
      });

      map.addLayer({
        id: "drawing-line",
        type: "line",
        source: "drawing-source",
        paint: {
          "line-color": "#3DD6C3",
          "line-width": 2,
        },
      });

      map.addLayer({
        id: "drawing-points",
        type: "circle",
        source: "drawing-source",
        paint: {
          "circle-radius": 5,
          "circle-color": "#3DD6C3",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#05080C",
        },
      });

      // 3. Change Polygons from ML vectorization
      map.addSource("change-features-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features,
        },
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
            "#FF5240",
            "vegetation_loss_to_bare",
            "#FF5240",
            "new_built_or_bare",
            "#FFB020",
            "bare_to_built",
            "#FFB020",
            "vegetation_gain",
            "#10B981",
            "surface_change",
            "#3DD6C3",
            "#FFB020",
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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Initialize Secondary Map for Compare Mode (Year T1)
  useEffect(() => {
    if (!compareMode) {
      if (compareMapRef.current) {
        compareMapRef.current.remove();
        compareMapRef.current = null;
      }
      return;
    }

    if (!compareContainerRef.current || compareMapRef.current || !mapRef.current) return;

    const mainCenter = mapRef.current.getCenter();
    const mainZoom = mapRef.current.getZoom();

    const compareMap = new maplibregl.Map({
      container: compareContainerRef.current,
      style: buildMapStyle(yearT1),
      center: [mainCenter.lng, mainCenter.lat],
      zoom: mainZoom,
      attributionControl: false,
    });

    compareMapRef.current = compareMap;

    const cleanSync1 = syncMaps(mapRef.current, compareMap);
    const cleanSync2 = syncMaps(compareMap, mapRef.current);

    return () => {
      cleanSync1();
      cleanSync2();
      compareMap.remove();
      compareMapRef.current = null;
    };
  }, [compareMode, yearT1, syncMaps]);

  // Update Raster Tile Year when yearT2 changes on primary map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource("s2-cloudless") as maplibregl.RasterTileSource | undefined;
    if (source) {
      map.setStyle(buildMapStyle(yearT2));
    }
  }, [yearT2]);

  // Update AOI Polygon layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("aoi-polygon-source") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    if (polygon && polygon.length >= 3) {
      const ring =
        polygon[0]?.[0] === polygon[polygon.length - 1]?.[0] &&
        polygon[0]?.[1] === polygon[polygon.length - 1]?.[1]
          ? polygon
          : [...polygon, polygon[0] ?? [0, 0]];

      src.setData({
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
      });
    } else {
      src.setData({ type: "FeatureCollection", features: [] });
    }
  }, [polygon]);

  // Update Change Polygons layer
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

  // Fly to selected feature or center
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || selectedFeatureId == null) return;
    const feat = features.find((f) => f.properties.id === selectedFeatureId);
    if (feat && feat.geometry.coordinates[0]?.[0]) {
      const ring = feat.geometry.coordinates[0];
      const lons = ring.map((p) => p[0] ?? 0);
      const lats = ring.map((p) => p[1] ?? 0);
      const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      map.flyTo({ center: [centerLon, centerLat], zoom: 14, duration: 1000 });
    }
  }, [selectedFeatureId, features]);

  // Multi-vertex drawing mouse/keyboard events
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!isDrawing) {
      map.getCanvas().style.cursor = "";
      setActiveVertices([]);
      setCursorPos(null);
      const src = map.getSource("drawing-source") as maplibregl.GeoJSONSource | undefined;
      if (src && map.isStyleLoaded()) {
        src.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }

    map.getCanvas().style.cursor = "crosshair";

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const currentPoint: [number, number] = [
        Number(e.lngLat.lng.toFixed(6)),
        Number(e.lngLat.lat.toFixed(6)),
      ];
      setCursorPos(currentPoint);

      const src = map.getSource("drawing-source") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;

      if (activeVertices.length === 0) {
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
        const ringWithCursor = [...activeVertices, currentPoint, activeVertices[0]!];
        src.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [ringWithCursor] },
              properties: {},
            },
            ...activeVertices.map((v) => ({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: v },
              properties: {},
            })),
          ],
        });
      }
    };

    const finishDrawing = (vertices: [number, number][]) => {
      if (vertices.length >= 3) {
        const closed = [...vertices, vertices[0]!];
        onPolygonChange(closed);
      }
      setActiveVertices([]);
      setCursorPos(null);
      onDrawingChange(false);
    };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const clickPoint: [number, number] = [
        Number(e.lngLat.lng.toFixed(6)),
        Number(e.lngLat.lat.toFixed(6)),
      ];

      // Check if user clicked near first vertex to close
      if (activeVertices.length >= 3 && activeVertices[0]) {
        const [v0Lon, v0Lat] = activeVertices[0];
        const dist = Math.hypot(clickPoint[0] - v0Lon, clickPoint[1] - v0Lat);
        if (dist < 0.002) {
          finishDrawing(activeVertices);
          return;
        }
      }

      setActiveVertices((prev) => [...prev, clickPoint]);
    };

    const onDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      if (activeVertices.length >= 3) {
        finishDrawing(activeVertices);
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
  }, [isDrawing, activeVertices, onDrawingChange, onPolygonChange]);

  // Keyboard shortcut handler for drawing (Enter to complete, Esc to cancel, Backspace to undo)
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

  // Live area calculation while drawing
  const currentDrawPoints =
    cursorPos && activeVertices.length >= 2
      ? [...activeVertices, cursorPos]
      : activeVertices;
  const liveAreaKm2 =
    currentDrawPoints.length >= 3 ? calculatePolygonAreaKm2(currentDrawPoints) : 0;
  const isAreaOversized = liveAreaKm2 > MAX_AOI_KM2;

  // Swipe slider move handlers
  const handleSliderMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const percent = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative size-full overflow-hidden bg-ink-950 select-none outline-none"
    >
      {/* Primary Map (T2 or Main) */}
      <div ref={containerRef} className="absolute inset-0 size-full" />

      {/* Compare Map (T1) with horizontal swipe clip-path */}
      {compareMode ? (
        <div
          ref={compareContainerRef}
          className="pointer-events-none absolute inset-0 size-full"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        />
      ) : null}

      {/* Split Slider Handle for Compare Mode */}
      {compareMode ? (
        <div
          role="slider"
          aria-label="Satellite temporal swipe slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={sliderPos}
          tabIndex={0}
          onPointerDown={(e) => {
            isDraggingSlider.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (isDraggingSlider.current) handleSliderMove(e.clientX);
          }}
          onPointerUp={() => {
            isDraggingSlider.current = false;
          }}
          className="absolute inset-y-0 z-20 w-1 cursor-ew-resize bg-signal-400 touch-none shadow-[0_0_20px_rgba(255,176,32,0.8)]"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -ms-4 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-signal-400 bg-ink-950/90 text-signal-400 backdrop-blur">
            <span className="font-mono text-[9px] tracking-tighter">T₁|T₂</span>
          </div>

          <div className="pointer-events-none absolute top-4 -translate-x-full pr-3">
            <span className="rounded-full border border-bone-100/10 bg-ink-950/80 px-2.5 py-1 font-mono text-[10px] tracking-widest text-bone-200 uppercase backdrop-blur">
              {yearT1} Baseline
            </span>
          </div>

          <div className="pointer-events-none absolute top-4 translate-x-full pl-3">
            <span className="rounded-full border border-signal-400/30 bg-ink-950/80 px-2.5 py-1 font-mono text-[10px] tracking-widest text-signal-400 uppercase backdrop-blur">
              {yearT2} Target
            </span>
          </div>
        </div>
      ) : null}

      {/* Live Polygon Drawing HUD Badge */}
      {isDrawing ? (
        <div className="pointer-events-none absolute top-6 inset-x-0 z-30 flex justify-center">
          <div
            className={`flex items-center gap-3 rounded-full border px-5 py-2.5 shadow-2xl backdrop-blur-md transition-colors ${
              isAreaOversized
                ? "border-alert-500/80 bg-alert-500/20 text-alert-400"
                : "border-signal-400/60 bg-ink-950/90 text-bone-100"
            }`}
          >
            <div
              className={`size-2.5 rounded-full animate-ping ${
                isAreaOversized ? "bg-alert-400" : "bg-signal-400"
              }`}
            />
            <div className="font-mono text-xs">
              <span className="font-semibold text-bone-100 uppercase tracking-widest">
                Vertex {activeVertices.length + 1}
              </span>
              <span className="mx-2 text-bone-100/40">|</span>
              <span>
                Area:{" "}
                <strong
                  className={
                    isAreaOversized ? "text-alert-400 font-bold" : "text-signal-400 font-bold"
                  }
                >
                  {formatArea(liveAreaKm2 * 1_000_000)}
                </strong>
                {isAreaOversized ? " (Exceeds 100 km² limit)" : " / 100 km² max"}
              </span>
              <span className="mx-2 text-bone-100/40">|</span>
              <span className="text-bone-300">
                {activeVertices.length >= 3
                  ? "Click start / Enter to finish · Esc to cancel"
                  : "Click map to add boundary points"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Subtle Satellite Imagery Attribution Badge */}
      <div className="pointer-events-none absolute bottom-3 start-4 z-10 flex items-center gap-2 rounded-full border border-bone-100/10 bg-ink-950/80 px-3 py-1 font-mono text-[10px] tracking-wider text-bone-400 uppercase backdrop-blur">
        <span>Sentinel-2 Cloudless {compareMode ? `${yearT1} vs ${yearT2}` : yearT2}</span>
        <span>·</span>
        <span>EOX IT Services</span>
      </div>
    </div>
  );
}

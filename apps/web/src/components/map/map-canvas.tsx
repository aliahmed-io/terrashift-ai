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
  basemapSource?: "s2" | "mapbox" | undefined;
  center?: [number, number] | undefined;
  zoom?: number | undefined;
}

function buildMapStyle(year: number): maplibregl.StyleSpecification {
  const mapboxToken = process.env["NEXT_PUBLIC_MAPBOX_TOKEN"];
  const sources: maplibregl.StyleSpecification["sources"] = {
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
  };

  const layers: maplibregl.StyleSpecification["layers"] = [
    {
      id: "carto-base",
      type: "raster",
      source: "carto-dark",
      minzoom: 0,
      maxzoom: 22,
    },
    {
      id: "s2-layer",
      type: "raster",
      source: "s2-cloudless",
      minzoom: 0,
      maxzoom: 22,
      paint: {
        "raster-opacity": 0.95,
        "raster-fade-duration": 200,
      },
    },
  ];

  if (mapboxToken) {
    sources["mapbox-satellite"] = {
      type: "raster",
      tiles: [
        `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.png?access_token=${mapboxToken}`,
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© Mapbox © OpenStreetMap",
    };

    layers.push({
      id: "mapbox-layer",
      type: "raster",
      source: "mapbox-satellite",
      minzoom: 0,
      maxzoom: 22,
      layout: {
        visibility: "none",
      },
      paint: {
        "raster-opacity": 0.95,
        "raster-fade-duration": 200,
      },
    });
  }

  return {
    version: 8,
    sources,
    layers,
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
  basemapSource = "s2",
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

  const activeVerticesRef = useRef<[number, number][]>([]);
  activeVerticesRef.current = activeVertices;

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

  // Update Basemap layer visibility on primary and compare maps
  useEffect(() => {
    const updateVisibility = (map: maplibregl.Map | null) => {
      if (!map || !map.isStyleLoaded()) return;
      if (map.getLayer("s2-layer")) {
        map.setLayoutProperty("s2-layer", "visibility", basemapSource === "s2" ? "visible" : "none");
      }
      if (map.getLayer("mapbox-layer")) {
        map.setLayoutProperty(
          "mapbox-layer",
          "visibility",
          basemapSource === "mapbox" ? "visible" : "none",
        );
      }
    };
    updateVisibility(mapRef.current);
    updateVisibility(compareMapRef.current);
  }, [basemapSource]);

  // Initialize Primary Map (Year T2 or main)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(yearT2),
      center,
      zoom,
      minZoom: 1,
      maxZoom: 21,
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

    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

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

    // Attach ResizeObserver to guarantee WebGL canvas stays sharp and full-bleed
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

  // Initialize Secondary Map for Compare Mode (Year T1)
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
      style: buildMapStyle(yearT1),
      center: [mainCenter.lng, mainCenter.lat],
      zoom: mainZoom,
      minZoom: 1,
      maxZoom: 21,
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

    compareMap.touchZoomRotate.disableRotation();

    compareMap.on("load", () => {
      if (polygon && polygon.length >= 3) {
        compareMap.addSource("compare-aoi-source", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
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
            ],
          },
        });
        compareMap.addLayer({
          id: "compare-aoi-fill",
          type: "fill",
          source: "compare-aoi-source",
          paint: { "fill-color": "#FFB020", "fill-opacity": 0.12 },
        });
        compareMap.addLayer({
          id: "compare-aoi-stroke",
          type: "line",
          source: "compare-aoi-source",
          paint: { "line-color": "#FFB020", "line-width": 2, "line-dasharray": [4, 2] },
        });
      }

      if (basemapSource === "mapbox") {
        if (compareMap.getLayer("s2-layer")) {
          compareMap.setLayoutProperty("s2-layer", "visibility", "none");
        }
        if (compareMap.getLayer("mapbox-layer")) {
          compareMap.setLayoutProperty("mapbox-layer", "visibility", "visible");
        }
      }
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
  }, [compareMode, yearT1, syncMaps, polygon, basemapSource]);

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

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative flex size-full overflow-hidden bg-ink-950 select-none outline-none focus-visible:ring-1 focus-visible:ring-signal-400"
    >
      {/* Permanent Side-by-Side Map Containers (No reparenting / no WebGL destruction) */}
      <div
        className={`relative h-full overflow-hidden transition-[width] duration-300 ease-out ${
          compareMode ? "w-1/2 border-r border-white/10" : "w-0 hidden pointer-events-none"
        }`}
      >
        <div ref={compareContainerRef} className="size-full" />
        {compareMode && (
          <div className="pointer-events-none absolute top-3 start-3 z-10 flex items-center gap-2 rounded-md border border-white/10 bg-ink-950/85 px-2.5 py-1 text-xs font-medium text-bone-200 backdrop-blur shadow-sm">
            <span className="size-1.5 rounded-full bg-bone-400" aria-hidden="true" />
            <span>Baseline ({yearT1})</span>
          </div>
        )}
      </div>

      <div
        className={`relative h-full overflow-hidden transition-[width] duration-300 ease-out ${
          compareMode ? "w-1/2" : "w-full"
        }`}
      >
        <div ref={containerRef} className="size-full" />
        {compareMode && (
          <div className="pointer-events-none absolute top-3 start-3 z-10 flex items-center gap-2 rounded-md border border-signal-400/30 bg-ink-950/85 px-2.5 py-1 text-xs font-medium text-signal-400 backdrop-blur shadow-sm">
            <span
              className="size-1.5 rounded-full bg-signal-400 animate-pulse"
              aria-hidden="true"
            />
            <span>Target ({yearT2}) & Detected Changes</span>
          </div>
        )}
      </div>

      {/* Live Polygon Drawing Status Bar */}
      {isDrawing ? (
        <div className="pointer-events-none absolute top-3 inset-x-0 z-30 flex justify-center px-4">
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center gap-3 rounded-lg border px-4 py-2 text-xs shadow-lg backdrop-blur-md transition-colors ${
              isAreaOversized
                ? "border-alert-500/80 bg-alert-500/20 text-alert-400"
                : "border-signal-400/60 bg-ink-950/90 text-bone-100"
            }`}
          >
            <span
              className={`size-2 rounded-full animate-ping ${
                isAreaOversized ? "bg-alert-400" : "bg-signal-400"
              }`}
              aria-hidden="true"
            />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-bone-100">
                Vertex {activeVertices.length + 1}
              </span>
              <span className="text-bone-400" aria-hidden="true">
                ·
              </span>
              <span className="tabular-nums">
                Area:{" "}
                <strong
                  className={
                    isAreaOversized ? "text-alert-400 font-bold" : "text-signal-400 font-bold"
                  }
                >
                  {formatArea(liveAreaKm2 * 1_000_000)}
                </strong>
                {isAreaOversized ? " (Exceeds 100\u00A0km² limit)" : " / 100\u00A0km² max"}
              </span>
              <span className="text-bone-400" aria-hidden="true">
                ·
              </span>
              <span className="text-bone-300">
                {activeVertices.length >= 3
                  ? "Click start or press Enter to finish · Esc to cancel"
                  : "Click map to add boundary points · Esc to cancel"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Discreet Satellite Source Attribution */}
      <div className="pointer-events-none absolute bottom-3 start-3 z-10 flex items-center gap-2 rounded-md border border-white/5 bg-ink-950/80 px-2.5 py-1 text-[11px] text-bone-400 backdrop-blur">
        <span>
          {basemapSource === "mapbox"
            ? "Mapbox Satellite Aerial"
            : `Sentinel-2 Cloudless (${compareMode ? `${yearT1} vs ${yearT2}` : yearT2})`}
        </span>
        <span aria-hidden="true">·</span>
        <span>{basemapSource === "mapbox" ? "© Mapbox" : "EOX IT Services"}</span>
      </div>
    </div>
  );
}

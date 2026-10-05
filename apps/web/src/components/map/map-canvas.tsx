"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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
    ndvi_delta?: number | undefined;
    ndbi_delta?: number | undefined;
  };
}

interface MapCanvasProps {
  bbox: [number, number, number, number]; // [west, south, east, north]
  features?: MapFeature[] | undefined;
  onBboxChange?: ((newBbox: [number, number, number, number]) => void) | undefined;
  onSelectPolygon?: ((id: number) => void) | undefined;
  selectedPolygonId?: number | null | undefined;
}

const CARTO_DARK_STYLE: maplibregl.StyleSpecification = {
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
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto-dark-layer",
      type: "raster",
      source: "carto-dark",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

function bboxToPolygon(b: [number, number, number, number]) {
  const [west, south, east, north] = b;
  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [west, north],
          [east, north],
          [east, south],
          [west, south],
          [west, north],
        ],
      ],
    },
    properties: {},
  };
}

export function MapCanvas({
  bbox,
  features = [],
  onBboxChange,
  onSelectPolygon,
  selectedPolygonId,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const clickStartRef = useRef<[number, number] | null>(null);

  const centerLon = (bbox[0] + bbox[2]) / 2;
  const centerLat = (bbox[1] + bbox[3]) / 2;

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_DARK_STYLE,
      center: [centerLon, centerLat],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      // 1. AOI Bounding Box Layer
      map.addSource("aoi-bbox-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [bboxToPolygon(bbox)],
        },
      });

      map.addLayer({
        id: "aoi-bbox-fill",
        type: "fill",
        source: "aoi-bbox-source",
        paint: {
          "fill-color": "#FFB020",
          "fill-opacity": 0.08,
        },
      });

      map.addLayer({
        id: "aoi-bbox-line",
        type: "line",
        source: "aoi-bbox-source",
        paint: {
          "line-color": "#FFB020",
          "line-width": 2,
          "line-dasharray": [4, 2],
        },
      });

      // 2. Change Polygons Layer
      map.addSource("change-polygons-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features,
        },
      });

      map.addLayer({
        id: "change-polygons-fill",
        type: "fill",
        source: "change-polygons-source",
        paint: {
          "fill-color": [
            "match",
            ["get", "class"],
            "vegetation_loss_to_bare",
            "#FF5240",
            "vegetation_to_built",
            "#FFB020",
            "bare_to_built",
            "#FF8A00",
            "water_change",
            "#3DD6C3",
            "#FFB020",
          ],
          "fill-opacity": 0.5,
        },
      });

      map.addLayer({
        id: "change-polygons-line",
        type: "line",
        source: "change-polygons-source",
        paint: {
          "line-color": "#FFFFFF",
          "line-width": 1.5,
        },
      });

      map.on("click", "change-polygons-fill", (e: maplibregl.MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const clicked = e.features[0];
        const id = clicked?.properties ? Number(clicked.properties["id"]) : null;
        if (id && onSelectPolygon) {
          onSelectPolygon(id);
        }
      });

      map.on("mouseenter", "change-polygons-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "change-polygons-fill", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center & bbox layer when bbox changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    map.flyTo({
      center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
      zoom: 12,
      duration: 1200,
    });

    const src = map.getSource("aoi-bbox-source") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features: [bboxToPolygon(bbox)],
      });
    }
  }, [bbox]);

  // Update change polygons layer when features change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const src = map.getSource("change-polygons-source") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features,
      });
    }
  }, [features]);

  // Interactive draw handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (!isDrawing) return;
      const { lng, lat } = e.lngLat;

      if (!clickStartRef.current) {
        clickStartRef.current = [lng, lat];
      } else {
        const [startLng, startLat] = clickStartRef.current;
        const west = Math.min(startLng, lng);
        const east = Math.max(startLng, lng);
        const south = Math.min(startLat, lat);
        const north = Math.max(startLat, lat);

        if (east - west > 0.005 && north - south > 0.005 && onBboxChange) {
          onBboxChange([
            Number(west.toFixed(5)),
            Number(south.toFixed(5)),
            Number(east.toFixed(5)),
            Number(north.toFixed(5)),
          ]);
        }
        clickStartRef.current = null;
        setIsDrawing(false);
      }
    };

    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [isDrawing, onBboxChange]);

  return (
    <div className="relative size-full overflow-hidden rounded-2xl border border-bone-100/10 bg-ink-950">
      <div ref={containerRef} className="size-full" />

      {/* Floating Toolbar */}
      <div className="absolute start-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setIsDrawing(!isDrawing);
            clickStartRef.current = null;
          }}
          className={`rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-widest backdrop-blur transition-colors ${
            isDrawing
              ? "border border-signal-400 bg-signal-400 text-ink-950"
              : "border border-bone-100/20 bg-ink-950/80 text-bone-100 hover:border-signal-400 hover:text-signal-400"
          }`}
        >
          {isDrawing ? "Click 2nd corner to finish" : "Draw custom AOI"}
        </button>
      </div>

      {/* Coordinate & Scale Badge */}
      <div className="pointer-events-none absolute bottom-4 start-4 z-10 rounded bg-ink-950/85 px-3 py-1.5 font-mono text-[10px] tracking-wider text-bone-300 uppercase backdrop-blur border border-bone-100/10">
        AOI: [{bbox[0].toFixed(3)}, {bbox[1].toFixed(3)}] to [{bbox[2].toFixed(3)}, {bbox[3].toFixed(3)}] · Free CartoDB Dark Matter
      </div>
    </div>
  );
}

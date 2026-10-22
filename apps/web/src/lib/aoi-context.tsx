"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";

export interface ActiveAoi {
  name: string;
  polygon: [number, number][];
  yearT1: number;
  yearT2: number;
  threshold?: number;
  center?: [number, number];
  zoom?: number;
  source: "drawn" | "preset" | "search";
}

export * from "./corridors";
import {
  CORRIDOR_PROFILES,
  getTemporalModifier,
  type CorridorId,
  type CorridorProfile,
  type MonthLabel,
} from "./corridors";

interface AoiContextType {
  activeAoi: ActiveAoi | null;
  setActiveAoi: (aoi: ActiveAoi | null) => void;
  updatePolygon: (polygon: [number, number][], name?: string) => void;
  clearAoi: () => void;
  activeCorridorId: CorridorId;
  setActiveCorridorId: (id: CorridorId) => void;
  activeCorridor: CorridorProfile;
  activeYear: number;
  setActiveYear: (year: number) => void;
  activeMonth: MonthLabel;
  setActiveMonth: (month: MonthLabel) => void;
  temporalModifier: number;
  getRasterUrl: (effect: string, customThreshold?: number) => string;
}

const STORAGE_KEY = "terrashift_active_aoi";

const AoiContext = createContext<AoiContextType | undefined>(undefined);

export function AoiProvider({ children }: { children: React.ReactNode }) {
  const [activeAoi, setActiveAoiState] = useState<ActiveAoi | null>(null);
  const [activeCorridorId, setActiveCorridorIdState] = useState<CorridorId>("roshn");
  const [activeYear, setActiveYear] = useState<number>(2024);
  const [activeMonth, setActiveMonth] = useState<MonthLabel>("Jul");
  const [liveCorridor, setLiveCorridor] = useState<CorridorProfile>(CORRIDOR_PROFILES["roshn"]);

  // Initialize from sessionStorage safely after mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ActiveAoi;
        if (parsed && Array.isArray(parsed.polygon) && parsed.polygon.length >= 3) {
          setActiveAoiState(parsed);
        }
      }
    } catch {
      // Ignore sessionStorage parsing or quota errors
    }
  }, []);

  const setActiveAoi = useCallback((aoi: ActiveAoi | null) => {
    setActiveAoiState(aoi);
    try {
      if (aoi) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(aoi));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage unavailable / private mode
    }
  }, []);

  const setActiveCorridorId = useCallback(
    (id: CorridorId) => {
      setActiveCorridorIdState(id);
      const profile = CORRIDOR_PROFILES[id];
      const lons = profile.polygon.map((p) => p[0]);
      const lats = profile.polygon.map((p) => p[1]);
      const center: [number, number] = [
        (Math.min(...lons) + Math.max(...lons)) / 2,
        (Math.min(...lats) + Math.max(...lats)) / 2,
      ];
      setActiveAoi({
        name: profile.name,
        polygon: profile.polygon,
        yearT1: 2018,
        yearT2: activeYear,
        threshold: 0.45,
        center,
        zoom: 13,
        source: "preset",
      });
    },
    [activeYear, setActiveAoi]
  );

  const updatePolygon = useCallback((polygon: [number, number][], name = "Custom Map Studio AOI") => {
    if (!polygon || polygon.length < 3) return;
    const lons = polygon.map((p) => p[0]);
    const lats = polygon.map((p) => p[1]);
    const center: [number, number] = [
      (Math.min(...lons) + Math.max(...lons)) / 2,
      (Math.min(...lats) + Math.max(...lats)) / 2,
    ];

    setActiveAoiState((prev) => {
      const next: ActiveAoi = {
        name,
        polygon,
        yearT1: prev?.yearT1 ?? 2018,
        yearT2: prev?.yearT2 ?? 2024,
        threshold: prev?.threshold ?? 0.50,
        center,
        zoom: prev?.zoom ?? 13,
        source: "drawn",
      };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage ignored
      }
      return next;
    });
  }, []);

  const clearAoi = useCallback(() => {
    setActiveAoi(null);
  }, [setActiveAoi]);

  // Fetch dynamic live telemetry whenever corridor, year, or month changes
  useEffect(() => {
    let cancelled = false;
    const base = CORRIDOR_PROFILES[activeCorridorId];

    fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        corridorId: activeCorridorId,
        yearT1: 2018,
        yearT2: activeYear,
        month: activeMonth,
        threshold: activeAoi?.threshold ?? 0.45,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && data.name) {
          setLiveCorridor({
            ...base,
            ...data,
            polygon: base.polygon,
          });
        }
      })
      .catch(() => {
        // Keep current base profile on error
      });

    return () => {
      cancelled = true;
    };
  }, [activeCorridorId, activeYear, activeMonth, activeAoi?.threshold]);

  const activeCorridor = liveCorridor || CORRIDOR_PROFILES[activeCorridorId];
  const temporalModifier = useMemo(
    () => getTemporalModifier(activeYear, activeMonth),
    [activeYear, activeMonth]
  );

  const getRasterUrl = useCallback(
    (effect: string, customThreshold?: number) => {
      const tau = customThreshold ?? activeAoi?.threshold ?? 0.45;
      return `/api/raster/${activeCorridorId}/${effect}?yearT1=2018&yearT2=${activeYear}&threshold=${tau}`;
    },
    [activeCorridorId, activeYear, activeAoi?.threshold]
  );

  const value = useMemo(
    () => ({
      activeAoi,
      setActiveAoi,
      updatePolygon,
      clearAoi,
      activeCorridorId,
      setActiveCorridorId,
      activeCorridor,
      activeYear,
      setActiveYear,
      activeMonth,
      setActiveMonth,
      temporalModifier,
      getRasterUrl,
    }),
    [
      activeAoi,
      setActiveAoi,
      updatePolygon,
      clearAoi,
      activeCorridorId,
      setActiveCorridorId,
      activeCorridor,
      activeYear,
      activeMonth,
      temporalModifier,
      getRasterUrl,
    ]
  );

  return <AoiContext.Provider value={value}>{children}</AoiContext.Provider>;
}

export function useAoi(): AoiContextType {
  const ctx = useContext(AoiContext);
  if (!ctx) {
    throw new Error("useAoi must be used within an AoiProvider");
  }
  return ctx;
}

"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { AoiProvider } from "@/lib/aoi-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AoiProvider>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </AoiProvider>
  );
}

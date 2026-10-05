"use client";

import { useEffect, useRef } from "react";
import { paintScene, type PaintMode } from "@/lib/paint";
import type { Scene } from "@/lib/scene";

interface SceneCanvasProps {
  scene: Scene;
  mode: PaintMode;
  className?: string;
}

export function SceneCanvas({ scene, mode, className }: SceneCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintScene(ref.current, scene, mode);
  }, [scene, mode]);
  return <canvas ref={ref} aria-hidden="true" className={className} />;
}

interface ModeCanvasProps {
  scene: Scene;
  mode: PaintMode;
  className?: string;
}

const LAYER = "absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 ease-expo";

export function ModeCanvas({ scene, mode, className }: ModeCanvasProps) {
  const a = useRef<HTMLCanvasElement>(null);
  const b = useRef<HTMLCanvasElement>(null);
  const front = useRef<0 | 1 | null>(null);

  useEffect(() => {
    const next: 0 | 1 = front.current === 0 ? 1 : 0;
    const incoming = next === 0 ? a.current : b.current;
    const outgoing = next === 0 ? b.current : a.current;
    if (!incoming) return;
    paintScene(incoming, scene, mode);
    incoming.classList.remove("opacity-0");
    incoming.classList.add("opacity-100");
    outgoing?.classList.remove("opacity-100");
    outgoing?.classList.add("opacity-0");
    front.current = next;
  }, [scene, mode]);

  return (
    <div className={className}>
      <canvas ref={a} aria-hidden="true" className={LAYER} />
      <canvas ref={b} aria-hidden="true" className={LAYER} />
    </div>
  );
}

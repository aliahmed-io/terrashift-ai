import type { Scene } from "@/lib/scene";

interface RegionOverlayProps {
  scene: Scene;
  className?: string;
  showIds?: boolean;
  fill?: boolean;
}

export function RegionOverlay({ scene, className, showIds = true, fill = false }: RegionOverlayProps) {
  return (
    <svg
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      {scene.regions.map((r) => (
        <g key={r.id}>
          <ellipse
            cx={r.cx}
            cy={r.cy}
            rx={r.rx + 4}
            ry={r.ry + 4}
            fill={fill ? "rgba(255,176,32,0.16)" : "none"}
            stroke="#FFB020"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          {showIds ? (
            <text
              x={r.cx}
              y={r.cy - r.ry - 10}
              textAnchor="middle"
              fontSize={11}
              fontFamily="var(--font-jetbrains)"
              fill="#FFB020"
            >
              {String(r.id).padStart(2, "0")}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

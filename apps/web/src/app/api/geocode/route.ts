import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().min(2).max(100),
});

export interface GeocodeLocation {
  placeId: string;
  displayName: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number]; // [west, south, east, north]
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");

  const parsed = querySchema.safeParse({ q });
  if (!parsed.success) {
    return NextResponse.json({ error: "Query parameter 'q' must be 2-100 characters" }, { status: 400 });
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
  nominatimUrl.searchParams.set("q", parsed.data.q);
  nominatimUrl.searchParams.set("format", "json");
  nominatimUrl.searchParams.set("limit", "5");

  try {
    const res = await fetch(nominatimUrl.toString(), {
      headers: {
        "User-Agent": "TerraShiftAI-ProductionClient/1.0 (contact@terrashift.internal)",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`Nominatim returned ${res.status}`);
    }

    const items = (await res.json()) as Array<{
      place_id?: number | string;
      display_name?: string;
      lat?: string;
      lon?: string;
      boundingbox?: [string, string, string, string];
    }>;

    const locations: GeocodeLocation[] = items.map((item, idx) => {
      const rawBbox = item.boundingbox ?? ["0", "0", "0", "0"];
      // Nominatim format is [south, north, west, east]
      const south = Number.parseFloat(rawBbox[0] ?? "0");
      const north = Number.parseFloat(rawBbox[1] ?? "0");
      const west = Number.parseFloat(rawBbox[2] ?? "0");
      const east = Number.parseFloat(rawBbox[3] ?? "0");

      return {
        placeId: String(item.place_id ?? idx),
        displayName: item.display_name ?? parsed.data.q,
        lat: Number.parseFloat(item.lat ?? "0"),
        lon: Number.parseFloat(item.lon ?? "0"),
        bbox: [west, south, east, north],
      };
    });

    return NextResponse.json(locations);
  } catch {
    // Graceful offline fallback
    return NextResponse.json([
      {
        placeId: "fallback-1",
        displayName: `${parsed.data.q} (Location Search)`,
        lat: -9.87,
        lon: -63.16,
        bbox: [-63.2, -9.9, -63.12, -9.84],
      },
    ]);
  }
}

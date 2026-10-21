"""FastAPI REST Service for TerraShift AI Change Detection Platform."""

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List

import httpx
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from terrashift.acquisition.tiles import AoiError, TileError
from terrashift.api.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ReportRequest,
    StacSearchRequest,
)
from terrashift.pipeline import PROVENANCE, run_analysis
from terrashift.report.pdf import generate_pdf_report

app = FastAPI(
    title="TerraShift AI Geospatial Microservice",
    version="1.1.0",
    description="Bi-temporal Sentinel-2 change detection, vectorisation and auditing.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def _sse(payload: Dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _stream(req: AnalyzeRequest) -> Iterator[str]:
    try:
        for event in run_analysis(req):
            yield _sse(event)
    except AoiError as exc:
        yield _sse({"error": {"code": exc.code, "message": exc.message}})
    except TileError as exc:
        yield _sse({"error": {"code": "IMAGERY_UNAVAILABLE", "message": str(exc)}})


@app.get("/healthz")
def healthz() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": "terrashift-ml",
        "provenance": PROVENANCE,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/v1/search-location")
def search_location(q: str = Query(..., min_length=2)) -> List[Dict[str, Any]]:
    """Geocoding proxy over OpenStreetMap Nominatim."""
    headers = {"User-Agent": "TerraShiftAI/1.1 (open-source change detection)"}
    params = {"q": q, "format": "json", "limit": 6}
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
            resp.raise_for_status()
            results = resp.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Geocoding service unavailable") from exc

    clean: List[Dict[str, Any]] = []
    for r in results:
        south, north, west, east = (float(v) for v in r["boundingbox"])
        clean.append(
            {
                "place_id": r.get("place_id"),
                "display_name": r.get("display_name"),
                "lat": float(r["lat"]),
                "lon": float(r["lon"]),
                "bbox": [west, south, east, north],
            }
        )
    return clean


@app.post("/v1/analyze/stream")
def analyze_stream(req: AnalyzeRequest) -> StreamingResponse:
    """Server-Sent Events stream: progress events followed by a final result event."""
    return StreamingResponse(
        _stream(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/v1/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """Synchronous variant of the analysis pipeline."""
    try:
        final: Dict[str, Any] = {}
        for event in run_analysis(req):
            if event.get("done"):
                final = event["result"]
    except AoiError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": exc.message}) from exc
    except TileError as exc:
        raise HTTPException(status_code=502, detail={"code": "IMAGERY_UNAVAILABLE", "message": str(exc)}) from exc
    return AnalyzeResponse(**final)


from terrashift.api.schemas import AnalyzeRequest, AnalyzeResponse, ReportRequest, StacSearchRequest


@app.post("/v1/report")
def export_report(req: ReportRequest) -> Response:
    t1_b64 = req.image_t1_base64
    t2_b64 = req.image_t2_base64

    if (not t1_b64 or not t2_b64) and req.polygon and len(req.polygon) >= 3:
        try:
            import base64
            import io
            from PIL import Image
            from terrashift.acquisition.tiles import fetch_mosaic
            from terrashift.geo.bounds import make_pixel_grid

            grid = make_pixel_grid(req.polygon, target_dim=256)
            if not t1_b64:
                m1 = fetch_mosaic(req.year_t1, grid)
                buf1 = io.BytesIO()
                Image.fromarray(m1).save(buf1, format="JPEG", quality=80)
                t1_b64 = base64.b64encode(buf1.getvalue()).decode("ascii")

            if not t2_b64:
                m2 = fetch_mosaic(req.year_t2, grid)
                buf2 = io.BytesIO()
                Image.fromarray(m2).save(buf2, format="JPEG", quality=80)
                t2_b64 = base64.b64encode(buf2.getvalue()).decode("ascii")
        except Exception:
            pass

    pdf_bytes = generate_pdf_report(
        metadata=req.metadata,
        features=req.features,
        image_t1_base64=t1_b64,
        image_t2_base64=t2_b64,
        overlay_base64=req.overlay_base64,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=terrashift-audit-report.pdf"},
    )


@app.post("/v1/stac/search")
def search_stac_scenes(req: StacSearchRequest) -> Dict[str, Any]:
    """Query Element84 AWS Earth Search for real Sentinel-2 L2A scenes."""
    from datetime import date
    from terrashift.acquisition.stac import STACClient

    client = STACClient()
    target_date = date(req.year or 2024, req.month or 6, 15)
    scenes = client.search_scenes(
        bbox=req.bbox,
        target_date=target_date,
        window_days=45,
        max_cloud_cover=req.max_cloud_cover or 20.0,
    )
    return {
        "count": len(scenes),
        "scenes": [
            {
                "scene_id": s.scene_id,
                "datetime": s.datetime,
                "cloud_cover": s.cloud_cover,
                "bbox": s.bbox,
                "assets": s.assets,
            }
            for s in scenes
        ],
    }


@app.get("/v1/model/weights")
def download_model_weights() -> Response:
    """Download the trained PyTorch Siamese U-Net checkpoint (.pt)."""
    import os
    ckpt_path = os.path.join(
        os.path.dirname(__file__), "..", "models", "siamese_unet_checkpoint.pt"
    )
    if not os.path.exists(ckpt_path):
        raise HTTPException(status_code=404, detail="Model checkpoint not found")
    with open(ckpt_path, "rb") as f:
        data = f.read()
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=siamese_unet_checkpoint.pt"},
    )


@app.post("/v1/ablation")
def run_ablation_endpoint(req: AnalyzeRequest) -> Dict[str, Any]:
    """Run 4-way model ablation (L1-RGB, Spectral-Otsu, FC-EF, FC-Siam-diff) & XAI stage extraction."""
    from terrashift.acquisition import tiles
    from terrashift.inference.ablation import run_ablation_study

    ring = [list(p) for p in req.polygon]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    bbox = [min(lons), min(lats), max(lons), max(lats)]
    try:
        grid = tiles.plan_grid(bbox)
        rgb1 = tiles.fetch_mosaic(req.year_t1, grid)
        rgb2 = tiles.fetch_mosaic(req.year_t2, grid)
        valid = tiles.polygon_mask(ring, grid)
        if valid.sum() < 16:
            valid[:] = True
    except (AoiError, TileError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return run_ablation_study(rgb1, rgb2, valid, req.year_t1, req.year_t2)


@app.post("/v1/timeseries")
def run_timeseries_endpoint(req: AnalyzeRequest) -> Dict[str, Any]:
    """Run BFAST multi-year time-series breakpoint analysis (2017-2024) and 2026-2030 spatial forecast."""
    from terrashift.inference.timeseries import run_timeseries_study

    try:
        return run_timeseries_study([list(p) for p in req.polygon])
    except (AoiError, TileError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/v1/lab/analyze")
def run_lab_endpoint(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Run Siamese U-Net inference on custom uploaded Before/After images or LEVIR-CD/OSCD samples."""
    from terrashift.inference.pair_lab import run_pair_lab_analysis

    sample_id = payload.get("sample_id")
    img1 = payload.get("image_t1_base64")
    img2 = payload.get("image_t2_base64")
    try:
        return run_pair_lab_analysis(
            sample_id=sample_id,
            image_t1_base64=img1,
            image_t2_base64=img2,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Image pair processing error: {exc}") from exc


@app.post("/v1/carbon")
def run_carbon_endpoint(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Run IPCC Tier-1 / WRI Carbon-Budget flux & Urban Heat Island analysis."""
    from terrashift.inference.carbon import run_carbon_flux_analysis

    polygon = payload.get(
        "polygon",
        [[-61.96, -10.89], [-61.91, -10.89], [-61.91, -10.84], [-61.96, -10.84], [-61.96, -10.89]],
    )
    t1_year = int(payload.get("year_t1", 2018))
    t2_year = int(payload.get("year_t2", 2024))
    biome_id = str(payload.get("biome_id", "tropical_rainforest"))
    pool_mode = str(payload.get("pool_mode", "biomass_soil"))
    carbon_price_usd = float(payload.get("carbon_price_usd", 35.0))
    try:
        return run_carbon_flux_analysis(
            polygon=[list(p) for p in polygon],
            t1_year=t1_year,
            t2_year=t2_year,
            biome_id=biome_id,
            pool_mode=pool_mode,
            carbon_price_usd=carbon_price_usd,
        )
    except (AoiError, TileError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _get_db():
    import sqlite3
    db_path = os.path.join(os.path.dirname(__file__), "..", "..", ".cache", "terrashift.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS watchlist_items (
            id TEXT PRIMARY KEY,
            title TEXT,
            region TEXT,
            category TEXT,
            lat REAL,
            lon REAL,
            t1 INTEGER,
            t2 INTEGER,
            delta_pct REAL,
            delta_label TEXT,
            area_ha REAL,
            cloud_cover REAL,
            confidence REAL,
            alert_status TEXT,
            threshold_rule TEXT,
            revisit_days INTEGER,
            summary TEXT,
            created_at TEXT
        )
    """)
    conn.commit()
    return conn


@app.get("/v1/watchlist")
def get_watchlist() -> List[Dict[str, Any]]:
    conn = _get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM watchlist_items ORDER BY created_at DESC")
    rows = cursor.fetchall()
    cols = [d[0] for d in cursor.description]
    conn.close()
    return [dict(zip(cols, r)) for r in rows]


@app.post("/v1/watchlist")
def add_watchlist_item(item: Dict[str, Any]) -> Dict[str, Any]:
    from datetime import datetime, timezone
    conn = _get_db()
    created_at = datetime.now(timezone.utc).isoformat()
    conn.execute("""
        INSERT OR REPLACE INTO watchlist_items 
        (id, title, region, category, lat, lon, t1, t2, delta_pct, delta_label, area_ha, cloud_cover, confidence, alert_status, threshold_rule, revisit_days, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        str(item.get("id", f"WATCH_{int(datetime.now().timestamp())}")),
        str(item.get("title", "Custom Watch Area")),
        str(item.get("region", "User Defined AOI")),
        str(item.get("category", "urban")),
        float(item.get("lat", 24.835)),
        float(item.get("lon", 46.745)),
        int(item.get("t1", 2018)),
        int(item.get("t2", 2024)),
        float(item.get("deltaPct", item.get("delta_pct", 0.0))),
        str(item.get("deltaLabel", item.get("delta_label", "Monitored AOI"))),
        float(item.get("areaHa", item.get("area_ha", 100.0))),
        float(item.get("cloudCover", item.get("cloud_cover", 0.1))),
        float(item.get("confidence", 0.95)),
        str(item.get("alertStatus", item.get("alert_status", "ACTIVE"))),
        str(item.get("thresholdRule", item.get("threshold_rule", "Default Rule"))),
        int(item.get("revisitDays", item.get("revisit_days", 5))),
        str(item.get("summary", "")),
        created_at,
    ))
    conn.commit()
    conn.close()
    return {"status": "success", "id": item.get("id")}


@app.delete("/v1/watchlist/{item_id}")
def delete_watchlist_item(item_id: str) -> Dict[str, Any]:
    conn = _get_db()
    conn.execute("DELETE FROM watchlist_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": item_id}

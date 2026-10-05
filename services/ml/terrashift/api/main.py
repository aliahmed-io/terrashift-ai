"""FastAPI REST Service for TerraShift AI Change Detection Platform."""

import json
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List

import httpx
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from terrashift.acquisition.tiles import AoiError, TileError
from terrashift.api.schemas import AnalyzeRequest, AnalyzeResponse, ReportRequest
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
    allow_methods=["GET", "POST"],
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


@app.post("/v1/report")
def export_report(req: ReportRequest) -> Response:
    pdf_bytes = generate_pdf_report(req.metadata, req.features)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=terrashift-audit-report.pdf"},
    )


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


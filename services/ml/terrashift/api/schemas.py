"""Pydantic request and response schemas for TerraShift API endpoints."""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, model_validator

class AnalyzeRequest(BaseModel):
    bbox: List[float] = Field(
        ...,
        description="Bounding box [west, south, east, north] in EPSG:4326 degrees",
        min_length=4,
        max_length=4,
    )
    date_t1: str = Field(..., description="Temporal baseline date (YYYY-MM-DD)")
    date_t2: str = Field(..., description="Temporal comparison date (YYYY-MM-DD)")
    use_real_stac: bool = Field(
        default=True,
        description="If True, query Element84 AWS Earth Search STAC for live Sentinel-2 imagery; falls back gracefully if offline",
    )

    @model_validator(mode="after")
    def validate_dates_and_bbox(self) -> "AnalyzeRequest":
        west, south, east, north = self.bbox
        if not (-180.0 <= west < east <= 180.0):
            raise ValueError(f"Invalid longitude span: [{west}, {east}]")
        if not (-90.0 <= south < north <= 90.0):
            raise ValueError(f"Invalid latitude span: [{south}, {north}]")
        if self.date_t1 >= self.date_t2:
            raise ValueError("date_t1 must be strictly earlier than date_t2")
        return self

class PolygonFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: Dict[str, Any]
    properties: Dict[str, Any]

class AnalyzeResponse(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    metadata: Dict[str, Any]
    features: List[PolygonFeature]
    cloud_fraction_t1: float
    cloud_fraction_t2: float
    provenance: str

class PreviewRequest(BaseModel):
    bbox: List[float]
    date: str

class PreviewResponse(BaseModel):
    rgb_jpeg_base64: str
    bounds: List[float]
    cloud_fraction: float

class ReportRequest(BaseModel):
    metadata: Dict[str, Any]
    features: List[Dict[str, Any]]

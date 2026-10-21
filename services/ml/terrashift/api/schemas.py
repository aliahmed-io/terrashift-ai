from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from terrashift.acquisition.tiles import MAX_YEAR, MIN_YEAR


class AnalyzeRequest(BaseModel):
    polygon: List[List[float]] = Field(
        ...,
        min_length=3,
        description="Area of interest ring as [lon, lat] pairs (EPSG:4326). The ring may be open or closed.",
    )
    year_t1: int = Field(..., ge=MIN_YEAR, le=MAX_YEAR)
    year_t2: int = Field(..., ge=MIN_YEAR, le=MAX_YEAR)
    threshold: float = Field(default=0.50, ge=0.10, le=0.90, description="Change probability threshold tau")
    min_area_m2: float = Field(default=2000.0, ge=100.0, le=500000.0, description="Minimum polygon area in m²")

    @model_validator(mode="after")
    def validate_request(self) -> "AnalyzeRequest":
        for pt in self.polygon:
            if len(pt) != 2:
                raise ValueError("Each polygon vertex must be [lon, lat]")
            lon, lat = pt
            if not (-180.0 <= lon <= 180.0 and -85.0 <= lat <= 85.0):
                raise ValueError(f"Vertex out of range: [{lon}, {lat}]")
        if self.year_t1 >= self.year_t2:
            raise ValueError("year_t1 must be earlier than year_t2")
        return self


class PolygonFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: Dict[str, Any]
    properties: Dict[str, Any]


class AnalyzeResponse(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    metadata: Dict[str, Any]
    features: List[PolygonFeature]
    provenance: str


class ReportRequest(BaseModel):
    metadata: Dict[str, Any]
    features: List[Dict[str, Any]]
    image_t1_base64: Optional[str] = None
    image_t2_base64: Optional[str] = None
    overlay_base64: Optional[str] = None


class StacSearchRequest(BaseModel):
    bbox: List[float] = Field(..., min_length=4, max_length=4, description="[west, south, east, north]")
    year: Optional[int] = Field(default=2024, ge=MIN_YEAR, le=MAX_YEAR)
    month: Optional[int] = Field(default=6, ge=1, le=12)
    max_cloud_cover: Optional[float] = Field(default=20.0, ge=0.0, le=100.0)

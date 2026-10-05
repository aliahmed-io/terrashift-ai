"""Application configuration and constants for TerraShift ML microservice."""

import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    # 100% Free Public STAC endpoint (Element84 AWS Earth Search)
    STAC_API_URL: str = os.getenv("STAC_API_URL", "https://earth-search.aws.element84.com/v1")
    STAC_COLLECTION: str = os.getenv("STAC_COLLECTION", "sentinel-2-l2a")
    
    # Cloud gating threshold: reject scene if cloud & shadow cover exceeds this percentage
    MAX_CLOUD_COVER_PERCENT: float = 20.0
    
    # Maximum allowed bounding box area in square kilometers for synchronous processing
    MAX_AOI_KM2: float = 100.0
    
    # Internal service authentication token for Next.js BFF proxy
    INTERNAL_TOKEN: str = os.getenv("ML_INTERNAL_TOKEN", "terrashift-internal-prod-key")
    
    # Pixel resolution in meters for Sentinel-2 optical bands (B02, B03, B04, B08)
    PIXEL_RESOLUTION_M: float = 10.0
    
    # Model configuration
    MODEL_IN_CHANNELS: int = 5  # [R, G, B, NDVI, NDBI]
    MODEL_THRESHOLD: float = 0.50

settings = Settings()

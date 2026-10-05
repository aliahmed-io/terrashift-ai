"""Element84 AWS Earth Search STAC client for free Sentinel-2 Level-2A imagery."""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Dict, List, Optional
import httpx
from terrashift.config import settings

@dataclass
class SceneRef:
    scene_id: str
    datetime: str
    cloud_cover: float
    bbox: List[float]
    assets: Dict[str, str]  # band name -> download/read URL

class STACClient:
    def __init__(self, endpoint: str = settings.STAC_API_URL):
        self.endpoint = endpoint
        self.search_url = f"{endpoint}/search"

    def search_scenes(
        self,
        bbox: List[float],  # [west, south, east, north]
        target_date: date,
        window_days: int = 15,
        max_cloud_cover: float = settings.MAX_CLOUD_COVER_PERCENT,
    ) -> List[SceneRef]:
        """Search Sentinel-2 L2A scenes around target date within +- window_days
        having cloud cover below max_cloud_cover.
        Uses 100% free Element84 AWS Earth Search STAC (No API key required).
        """
        start = (target_date - timedelta(days=window_days)).isoformat()
        end = (target_date + timedelta(days=window_days)).isoformat()
        datetime_range = f"{start}T00:00:00Z/{end}T23:59:59Z"

        payload: Dict[str, Any] = {
            "collections": [settings.STAC_COLLECTION],
            "bbox": bbox,
            "datetime": datetime_range,
            "query": {
                "eo:cloud_cover": {"lt": max_cloud_cover}
            },
            "limit": 10,
            "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}]
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(self.search_url, json=payload)
                resp.raise_for_status()
                data = resp.json()
        except Exception:
            # Return empty list on network failure or offline test
            return []

        features = data.get("features", [])
        scenes: List[SceneRef] = []

        for feat in features:
            props = feat.get("properties", {})
            assets_raw = feat.get("assets", {})
            asset_map: Dict[str, str] = {}
            
            # Map canonical band aliases (Element84 uses red, green, blue, nir, visual, scl)
            for alias in ["red", "green", "blue", "nir", "swir16", "scl", "visual"]:
                if alias in assets_raw and "href" in assets_raw[alias]:
                    asset_map[alias] = assets_raw[alias]["href"]
            
            # Also support standard Sentinel-2 band names (B04, B03, B02, B08, B11, SCL)
            for b_name in ["B04", "B03", "B02", "B08", "B11", "SCL"]:
                if b_name in assets_raw and "href" in assets_raw[b_name]:
                    asset_map[b_name.lower()] = assets_raw[b_name]["href"]

            scenes.append(
                SceneRef(
                    scene_id=feat.get("id", "unknown"),
                    datetime=props.get("datetime", ""),
                    cloud_cover=float(props.get("eo:cloud_cover", 0.0)),
                    bbox=feat.get("bbox", bbox),
                    assets=asset_map,
                )
            )

        return scenes

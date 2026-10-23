"""OSCD (Onera Satellite Change Detection) Sentinel-2 Dataset Adapter.

Reference:
- Daudt et al., 'Urban Change Detection for Multispectral Earth Observation
  Using Convolutional Neural Networks', IEEE IGARSS 2018.
- Daudt et al., 'Fully Convolutional Siamese Networks for Change Detection',
  IEEE ICIP 2018.

Dataset splits:
- 14 training cities worldwide
- 10 test cities worldwide (held-out)
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Dict, List, Literal, Optional, Tuple

import httpx
import numpy as np
from numpy.typing import NDArray
from PIL import Image
import pyarrow.parquet as pq

try:
    import torch
    from torch.utils.data import Dataset
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    Dataset = object  # type: ignore

HF_OSCD_BASE = "https://huggingface.co/datasets/blanchon/OSCD_RGB/resolve/main/data"
DEFAULT_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".cache" / "oscd"


def ensure_oscd_data(cache_dir: Optional[Path] = None) -> Tuple[Path, Path]:
    """Download and cache OSCD train and test parquet files if not already cached."""
    cache = cache_dir or DEFAULT_CACHE_DIR
    cache.mkdir(parents=True, exist_ok=True)

    train_path = cache / "train.parquet"
    test_path = cache / "test.parquet"

    if not train_path.exists() or train_path.stat().st_size < 1000:
        url = f"{HF_OSCD_BASE}/train-00000-of-00001.parquet"
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            with open(train_path, "wb") as f:
                f.write(resp.content)

    if not test_path.exists() or test_path.stat().st_size < 1000:
        url = f"{HF_OSCD_BASE}/test-00000-of-00001.parquet"
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            with open(test_path, "wb") as f:
                f.write(resp.content)

    return train_path, test_path


class OSCDScene:
    """Represents a single registered bitemporal Sentinel-2 pair with change ground truth."""

    def __init__(
        self,
        scene_id: str,
        t1_rgb: NDArray[np.uint8],
        t2_rgb: NDArray[np.uint8],
        gt_mask: NDArray[np.bool_],
    ) -> None:
        self.scene_id = scene_id
        self.t1_rgb = t1_rgb
        self.t2_rgb = t2_rgb
        self.gt_mask = gt_mask
        self.height, self.width = gt_mask.shape

    @property
    def change_ratio(self) -> float:
        total = self.height * self.width
        return float(np.sum(self.gt_mask)) / total if total > 0 else 0.0


def load_oscd_split(
    split: Literal["train", "val", "test"] = "test",
    cache_dir: Optional[Path] = None,
) -> List[OSCDScene]:
    """Load OSCD scenes for train, validation (last 2 scenes of train), or test."""
    train_path, test_path = ensure_oscd_data(cache_dir)
    target_path = test_path if split == "test" else train_path

    table = pq.read_table(target_path)
    num_rows = len(table)

    if split == "train":
        row_indices = list(range(0, num_rows - 2))  # 12 scenes for training
    elif split == "val":
        row_indices = list(range(num_rows - 2, num_rows))  # 2 scenes held-out for validation
    else:
        row_indices = list(range(num_rows))  # 10 official test scenes

    scenes: List[OSCDScene] = []
    for idx in row_indices:
        b1 = table["image1"][idx]["bytes"].as_py()
        b2 = table["image2"][idx]["bytes"].as_py()
        bm = table["mask"][idx]["bytes"].as_py()

        p1 = table["image1"][idx]["path"].as_py() or f"{split}_{idx:02d}"

        im1 = Image.open(io.BytesIO(b1)).convert("RGB")
        im2 = Image.open(io.BytesIO(b2)).convert("RGB")
        imm = Image.open(io.BytesIO(bm))

        arr1 = np.asarray(im1, dtype=np.uint8)
        arr2 = np.asarray(im2, dtype=np.uint8)
        arrm = np.asarray(imm) > 0  # Binary ground truth

        scenes.append(OSCDScene(scene_id=p1, t1_rgb=arr1, t2_rgb=arr2, gt_mask=arrm))

    return scenes


if HAS_TORCH:
    class OSCDDataset(Dataset):
        """PyTorch Dataset yielding 256x256 bitemporal patches for Siamese training."""

        def __init__(
            self,
            split: Literal["train", "val", "test"] = "train",
            patch_size: int = 256,
            patches_per_scene: int = 16,
            cache_dir: Optional[Path] = None,
            seed: int = 42,
        ) -> None:
            self.scenes = load_oscd_split(split, cache_dir)
            self.patch_size = patch_size
            self.patches_per_scene = patches_per_scene
            self.rng = np.random.default_rng(seed)
            self.total_patches = len(self.scenes) * self.patches_per_scene

        def __len__(self) -> int:
            return self.total_patches

        def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
            scene_idx = idx // self.patches_per_scene
            scene = self.scenes[scene_idx]

            h, w = scene.height, scene.width
            ps = self.patch_size

            # Random crop
            if h > ps and w > ps:
                y = self.rng.integers(0, h - ps)
                x = self.rng.integers(0, w - ps)
                crop_t1 = scene.t1_rgb[y : y + ps, x : x + ps]
                crop_t2 = scene.t2_rgb[y : y + ps, x : x + ps]
                crop_m = scene.gt_mask[y : y + ps, x : x + ps]
            else:
                crop_t1 = np.pad(scene.t1_rgb, ((0, max(0, ps - h)), (0, max(0, ps - w)), (0, 0)))[:ps, :ps]
                crop_t2 = np.pad(scene.t2_rgb, ((0, max(0, ps - h)), (0, max(0, ps - w)), (0, 0)))[:ps, :ps]
                crop_m = np.pad(scene.gt_mask, ((0, max(0, ps - h)), (0, max(0, ps - w))))[:ps, :ps]

            # 5-channel stack: [R, G, B, ExcessGreen, RedGreenRatio]
            f1 = crop_t1.astype(np.float32) / 255.0
            f2 = crop_t2.astype(np.float32) / 255.0

            eps = 1e-6
            exg1 = np.clip((2.0 * f1[..., 1] - f1[..., 0] - f1[..., 2]) / (f1.sum(axis=-1) + eps) * 2.5, -1.0, 1.0)
            exg2 = np.clip((2.0 * f2[..., 1] - f2[..., 0] - f2[..., 2]) / (f2.sum(axis=-1) + eps) * 2.5, -1.0, 1.0)

            bare1 = np.clip((f1[..., 0] - f1[..., 1]) / (f1[..., 0] + f1[..., 1] + eps) * 4.0, -1.0, 1.0)
            bare2 = np.clip((f2[..., 0] - f2[..., 1]) / (f2[..., 0] + f2[..., 1] + eps) * 4.0, -1.0, 1.0)

            t1_5ch = np.stack([f1[..., 0], f1[..., 1], f1[..., 2], exg1, bare1], axis=0)
            t2_5ch = np.stack([f2[..., 0], f2[..., 1], f2[..., 2], exg2, bare2], axis=0)

            return (
                torch.from_numpy(t1_5ch).float(),
                torch.from_numpy(t2_5ch).float(),
                torch.from_numpy(crop_m.astype(np.float32)).unsqueeze(0),
            )

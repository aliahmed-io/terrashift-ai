"""Siamese U-Net architecture for bi-temporal multispectral change detection."""

from typing import Tuple
import numpy as np
from numpy.typing import NDArray

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    nn = object  # type: ignore

if HAS_TORCH:
    class DoubleConv(nn.Module):
        def __init__(self, in_ch: int, out_ch: int):
            super().__init__()
            self.net = nn.Sequential(
                nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
                nn.BatchNorm2d(out_ch),
                nn.ReLU(inplace=True),
                nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1, bias=False),
                nn.BatchNorm2d(out_ch),
                nn.ReLU(inplace=True),
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            return self.net(x)

    class SiameseUNet(nn.Module):
        """5-channel Siamese U-Net:
        Shared encoder weights between T1 and T2 to guarantee invariance.
        Multi-scale feature difference + summation fusion at each skip layer.
        """
        def __init__(self, in_channels: int = 5, base_channels: int = 32):
            super().__init__()
            b = base_channels
            self.enc1 = DoubleConv(in_channels, b)
            self.pool1 = nn.MaxPool2d(2)
            self.enc2 = DoubleConv(b, b * 2)
            self.pool2 = nn.MaxPool2d(2)
            self.enc3 = DoubleConv(b * 2, b * 4)
            self.pool3 = nn.MaxPool2d(2)
            self.enc4 = DoubleConv(b * 4, b * 8)

            # Feature fusion 1x1 convs (concatenating |f1-f2| and f1+f2 = 2x channels)
            self.fuse1 = nn.Conv2d(b * 2, b, kernel_size=1)
            self.fuse2 = nn.Conv2d(b * 4, b * 2, kernel_size=1)
            self.fuse3 = nn.Conv2d(b * 8, b * 4, kernel_size=1)
            self.fuse4 = nn.Conv2d(b * 16, b * 8, kernel_size=1)

            # Decoder
            self.up3 = nn.ConvTranspose2d(b * 8, b * 4, kernel_size=2, stride=2)
            self.dec3 = DoubleConv(b * 8, b * 4)
            self.up2 = nn.ConvTranspose2d(b * 4, b * 2, kernel_size=2, stride=2)
            self.dec2 = DoubleConv(b * 4, b * 2)
            self.up1 = nn.ConvTranspose2d(b * 2, b, kernel_size=2, stride=2)
            self.dec1 = DoubleConv(b * 2, b)

            self.final_head = nn.Conv2d(b, 1, kernel_size=1)

        def forward_encoder(self, x: torch.Tensor):
            e1 = self.enc1(x)
            e2 = self.enc2(self.pool1(e1))
            e3 = self.enc3(self.pool2(e2))
            e4 = self.enc4(self.pool3(e3))
            return e1, e2, e3, e4

        def fuse_features(self, f1: torch.Tensor, f2: torch.Tensor, fuse_layer: nn.Conv2d) -> torch.Tensor:
            diff = torch.abs(f1 - f2)
            add = f1 + f2
            cat = torch.cat([diff, add], dim=1)
            return fuse_layer(cat)

        def forward(self, t1: torch.Tensor, t2: torch.Tensor) -> torch.Tensor:
            # Shared encoder passes
            e1_1, e2_1, e3_1, e4_1 = self.forward_encoder(t1)
            e1_2, e2_2, e3_2, e4_2 = self.forward_encoder(t2)

            # Difference-guided skip connections
            f1 = self.fuse_features(e1_1, e1_2, self.fuse1)
            f2 = self.fuse_features(e2_1, e2_2, self.fuse2)
            f3 = self.fuse_features(e3_1, e3_2, self.fuse3)
            f4 = self.fuse_features(e4_1, e4_2, self.fuse4)

            # Decoder
            d3 = self.dec3(torch.cat([self.up3(f4), f3], dim=1))
            d2 = self.dec2(torch.cat([self.up2(d3), f2], dim=1))
            d1 = self.dec1(torch.cat([self.up1(d2), f1], dim=1))

            logits = self.final_head(d1)
            return logits

def run_physics_guided_inference(
    stack_t1: NDArray[np.float32],  # (5, H, W)
    stack_t2: NDArray[np.float32],  # (5, H, W)
    threshold: float = 0.50,
) -> Tuple[NDArray[np.float32], NDArray[np.uint8]]:
    """Physics-guided change probability and binary mask generation.
    Computes spectral vector angle and radiometric delta between T1 and T2.
    Output:
    - probability_map: (H, W) float32 in [0.0, 1.0]
    - binary_mask: (H, W) uint8 {0, 1}
    """
    # Channel 0,1,2 = RGB, Channel 3 = NDVI, Channel 4 = NDBI
    rgb_delta = np.sqrt(np.sum((stack_t2[:3] - stack_t1[:3]) ** 2, axis=0))  # Euclidean RGB difference
    ndvi_delta = np.abs(stack_t2[3] - stack_t1[3])  # Significant vegetation change
    ndbi_delta = np.abs(stack_t2[4] - stack_t1[4])  # Significant built-up change

    # Combined radiometric score (penalizing pure brightness shifts with index guidance)
    index_signal = (ndvi_delta * 1.5 + ndbi_delta * 1.5) / 2.0
    combined_score = (rgb_delta * 0.4 + index_signal * 0.6)

    prob = 1.0 / (1.0 + np.exp(-10.0 * (combined_score - 0.28)))
    prob = np.clip(prob, 0.0, 1.0).astype(np.float32)
    binary = (prob >= threshold).astype(np.uint8)

    return prob, binary

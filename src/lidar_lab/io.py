"""Minimal nuScenes-compatible LiDAR I/O without automatic downloads."""
from pathlib import Path
import numpy as np
from .geometry import validate_points


def load_points(path: str | Path) -> np.ndarray:
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(path)
    if path.suffix.lower()=='.bin':
        raw = np.fromfile(path,dtype=np.float32)
        if len(raw)%5:
            raise ValueError("nuScenes .bin files require 5 float32 values per point")
        return validate_points(raw.reshape(-1,5))
    if path.suffix.lower()=='.npy':
        return validate_points(np.load(path, allow_pickle=False))
    raise ValueError("Supported point cloud formats: .bin (nuScenes), .npy")

"""Deterministic, device-independent 3D point processing.

These reference implementations prioritize auditability rather than GPU speed.
Patch labels are spatial cluster IDs, not learned dVAE codebook tokens.
"""
from __future__ import annotations

from dataclasses import dataclass
import numpy as np


@dataclass(frozen=True)
class PatchResult:
    points: np.ndarray
    center_indices: np.ndarray
    neighbor_indices: np.ndarray
    patches: np.ndarray
    centers: np.ndarray
    point_patch_id: np.ndarray
    normalized_patches: np.ndarray


def validate_points(points: np.ndarray, *, limit: int = 300000) -> np.ndarray:
    arr = np.asarray(points, dtype=np.float32)
    if arr.ndim != 2 or arr.shape[1] not in (3, 4, 5):
        raise ValueError("Expected a point cloud with shape (N,3), (N,4), or (N,5)")
    if not 1 <= len(arr) <= limit:
        raise ValueError(f"Point count must be within [1, {limit}]")
    if not np.isfinite(arr).all():
        raise ValueError("Point coordinates must be finite")
    return arr


def farthest_point_sampling(xyz: np.ndarray, n_centers: int, *, seed: int = 42) -> np.ndarray:
    """FPS with unique centers, O(N*G) and bounded memory."""
    xyz = validate_points(xyz)[:, :3]
    n = len(xyz)
    if not 1 <= n_centers <= n:
        raise ValueError("Center count must be between 1 and number of points")
    rng = np.random.default_rng(seed)
    selected = np.empty(n_centers, dtype=np.int64)
    distance = np.full(n, np.inf, dtype=np.float64)
    available = np.ones(n, dtype=bool)
    current = int(rng.integers(n))
    for i in range(n_centers):
        selected[i] = current
        available[current] = False
        difference = xyz - xyz[current]
        distance = np.minimum(distance, np.einsum('nd,nd->n', difference, difference))
        if i != n_centers-1:
            distance[~available] = -1
            current = int(np.argmax(distance))
    return selected


def knn_indices(xyz: np.ndarray, centers: np.ndarray, k: int) -> np.ndarray:
    xyz = validate_points(xyz)[:, :3]
    centers = np.asarray(centers, dtype=np.float32)
    if centers.ndim != 2 or centers.shape[1] != 3:
        raise ValueError("Centers must be (G,3)")
    if not 1 <= k <= len(xyz):
        raise ValueError("k must be in [1, N]")
    neighbors = np.empty((len(centers), k), dtype=np.int64)
    for i, center in enumerate(centers):
        squared = np.einsum('nd,nd->n', xyz - center, xyz - center)
        partition = np.argpartition(squared, k - 1)[:k]
        neighbors[i] = partition[np.lexsort((partition, squared[partition]))]
    return neighbors


def make_patches(points: np.ndarray, groups: int=64, k: int=32, seed: int=42) -> PatchResult:
    points = validate_points(points)
    xyz = points[:, :3]
    idx = farthest_point_sampling(xyz, groups, seed=seed)
    centers = xyz[idx]
    neighbors = knn_indices(xyz, centers, k)
    patches = xyz[neighbors]
    # Assign every original point to its closest patch center in chunks.
    patch_ids = np.empty(len(xyz), dtype=np.int32)
    for start in range(0, len(xyz), 8192):
        batch = xyz[start:start+8192]
        distances = ((batch[:, None, :] - centers[None, :, :])**2).sum(-1)
        patch_ids[start:start+len(batch)] = np.argmin(distances, axis=1)
    normalized = patches - centers[:, None, :]
    return PatchResult(points, idx, neighbors, patches, centers, patch_ids, normalized)


def subsample(points: np.ndarray, maximum: int=8000, seed: int=42) -> np.ndarray:
    points = validate_points(points)
    if maximum < 1:
        raise ValueError("maximum must be positive")
    if len(points) <= maximum:
        return points
    rng = np.random.default_rng(seed)
    return points[np.sort(rng.choice(len(points), maximum, replace=False))]


def scene_metrics(points: np.ndarray, result: PatchResult) -> dict:
    xyz = points[:, :3]
    extent = xyz.max(axis=0) - xyz.min(axis=0)
    ranges = np.linalg.norm(xyz,axis=1)
    return {
        "point_count": int(len(points)),
        "patch_count": int(len(result.centers)),
        "neighbors_per_patch": int(result.patches.shape[1]),
        "spatial_extent_m": [round(float(x),2) for x in extent],
        "mean_range_m": round(float(ranges.mean()),2),
        "max_range_m": round(float(ranges.max()),2),
        "unique_patch_assignments": int(len(np.unique(result.point_patch_id))),
    }


def random_center_sampling(xyz: np.ndarray, n_centers: int, *, seed: int = 42) -> np.ndarray:
    """Uniform random reference sampling without replacement (deterministic seed)."""
    xyz = validate_points(xyz)[:, :3]
    if not 1 <= n_centers <= len(xyz):
        raise ValueError('Center count must be between 1 and number of points')
    return np.random.default_rng(seed).choice(len(xyz), n_centers, replace=False)


def coverage_metrics(xyz: np.ndarray, centers: np.ndarray) -> dict[str, float]:
    """Geometric nearest-center distances in meters, computed in bounded chunks."""
    xyz = validate_points(xyz)[:, :3]
    centers = validate_points(centers)[:, :3]
    distances = np.empty(len(xyz), dtype=np.float64)
    for start in range(0, len(xyz), 4096):
        batch = xyz[start:start + 4096]
        dist_squared = ((batch[:, None, :] - centers[None, :, :]) ** 2).sum(-1)
        distances[start:start + len(batch)] = np.sqrt(np.min(dist_squared, axis=1))
    return {
        'mean_m': round(float(np.mean(distances)), 4),
        'p95_m': round(float(np.percentile(distances, 95)), 4),
        'max_m': round(float(np.max(distances)), 4),
    }

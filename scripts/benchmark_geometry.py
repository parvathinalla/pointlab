"""Deterministic geometric reference benchmark, independent of trained models.

Usage:
    python scripts/benchmark_geometry.py --seed 42 --groups 64 --out artifacts/coverage.json
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from time import perf_counter

from lidar_lab.demo import make_demo_scene
from lidar_lab.geometry import (
    farthest_point_sampling, random_center_sampling, coverage_metrics
)


def run(seed: int, groups: int) -> dict:
    points = make_demo_scene(seed)[:, :3]
    methods = {}
    for name, sampler in [('fps', farthest_point_sampling), ('random', random_center_sampling)]:
        start = perf_counter()
        indices = sampler(points, groups, seed=seed)
        sample_ms = (perf_counter() - start) * 1000
        metrics = coverage_metrics(points, points[indices])
        # Only timed within this process; never compare across environments.
        methods[name] = {'coverage_m': metrics, 'sample_time_ms_local': round(sample_ms, 3)}
    return {
        'experiment': 'geometric_reference_coverage', 'seed': seed,
        'point_count': len(points), 'centers': groups,
        'source': 'procedural_synthetic_scene', 'methods': methods,
        'interpretation': 'Lower nearest-center distance is better. These are not learned-model or driving benchmarks.',
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--groups', type=int, default=64)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if not 1 <= args.groups <= 6000:
        parser.error('--groups must be in [1, 6000]')
    result = run(args.seed, args.groups)
    content = json.dumps(result, indent=2) + '\n'
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(content)
        print(f'Wrote {args.out}')
    else:
        print(content)


if __name__ == '__main__':
    main()

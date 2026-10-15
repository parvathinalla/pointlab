# Architecture and interface contract

## Goals

The service deliberately separates **geometric preprocessing** from research networks whose weights/results are not validated. No accidental substitution of random patch IDs for learned codebook tokens.

### Reference geometry

1. Validate float coordinates (N×3, N×4, or N×5), finite values, bounds and size.
2. Subsample deterministically to a maximum of 12,000 for display.
3. Apply FPS seeded first-center selection; each iteration chooses the point with maximal minimum squared distance to centers already selected. Complexity **O(NG)** time, O(N) memory.
4. Apply brute-force kNN for each center; sort ties deterministically. Complexity approximately **O(GN)** pairwise distances plus partial selection and top-k ordering.
5. Build centered patches by subtracting the selected centers from their neighbor xyz arrays. A point may be in several overlapping kNN patches.
6. For view colors only, assign **each point to its nearest center**. These colors are spatial Voronoi-like IDs, not the overlap membership of kNN patches, learned codebook tokens, or semantic classes.

The last distinction matters: the viewer's Patch Inspector highlights center assignments, **not the exact kNN overlap membership**. We encourage PRs adding an alternate true-neighborhood overlay, with a clear legend.

### Synthetic demonstration

`demo.make_demo_scene(seed)` creates a road-like ground, two box shells resembling vehicles, a building-like vertical shell and a cylinder of points. All are procedural geometry, not sensor returns from a real drive. No object detection is claimed.

### Data and API

| Route | Limits | Output |
|---|---|---|
| `/api/scene/demo` | seed 0..100000, groups 4..256, neighbors 4..128 | xyz list, center indices, centers, point-to-center groups, geometric metrics |
| `/api/scene/upload` | `.bin` / `.npy` only; 4 MiB max; same parameter bounds | same schema, source `uploaded_point_cloud` |
| `/api/benchmark/demo` | seed 0..100000, groups 4..256 | FPS/random nearest-center mean, p95, max distance |

The `source` and `mode` fields explicitly identify demos. Uploads are read in-memory, not written to a persistent dataset. `allow_pickle=False` for NumPy files. The server does not have application authentication, quotas, or a persistence layer; deploy it to a trusted environment or put it behind appropriate network security and rate limiting before opening it to untrusted traffic.

**NuScenes `.bin`** expects five little-endian native `float32` channel values per point (XYZ, intensity, ring). The demo reads XYZ. **`.npy`** accepts a standard numeric rank-2 NumPy array with 3, 4 or 5 columns. No `.npz` or pickle serialization is accepted.

### Static-only deployment

`python scripts/build_static_site.py` copies the interface and bundles a fixed procedurally generated scene into `docs/site/`.

- A lightweight JavaScript adapter replaces the API's synthetic sample and benchmark endpoints. Geometry recomputes in-browser; no external calls are made for those endpoints.
- Browser static preview uses the **same algorithmic definitions**, but a different seeded random number generator and rounding. Do not assume numerical identity with the Python backend.
- Browser-only data upload is intentionally blocked; use the local FastAPI service for `.bin`/`.npy`.
- If you alter the Python scene generator or frontend, rebuild the static site and check both versions.

### Extension modules

A new sampler goes in `geometry.py`, with reproducible test cases in `tests/test_geometry.py` and an explicit benchmark API entry. Novel ML experiments must stay under distinct research modules so that random/demo and trained outputs cannot be mistaken for each other.

### Security & deployment

The 4 MiB upload limit and bounded point subsampling limit computation, not all denial-of-service risks. Browsers and public servers remain vulnerable to aggressive request rates; use standard TLS termination, authentication as needed, and rate limiting for internet deployment.

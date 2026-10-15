"""Public demo API. Synthetic points or explicitly uploaded local files only."""
from __future__ import annotations
import io
from pathlib import Path
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .demo import make_demo_scene
from .geometry import make_patches, scene_metrics, subsample, validate_points

APP_DIR = Path(__file__).resolve().parents[2]
app = FastAPI(title="POINT//LAB Research Workbench", version="0.2.0")
app.mount('/assets',StaticFiles(directory=APP_DIR/'web'),name='assets')


@app.get('/')
def home():
    return FileResponse(APP_DIR/'web'/'index.html')


@app.get('/api/health')
def health():
    return {'status':'ok', 'mode':'research-demo', 'trained_model_loaded':False}


def encode_scene(points, groups, neighbors, seed, source):
    try:
        points = validate_points(points, limit=100000)
        points = subsample(points, maximum=12000, seed=seed)
        grouped = make_patches(points, groups=groups, k=neighbors, seed=seed)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        'source':source, 'mode':'geometric_patches_not_learned_tokens',
        'points':points[:,:3].round(4).tolist(),
        'patch_ids':grouped.point_patch_id.tolist(),
        'center_indices':grouped.center_indices.tolist(),
        'centers':grouped.centers.round(4).tolist(),
        'metrics':scene_metrics(points, grouped),
        'note':'Patch IDs are geometrical assignments, not trained Point-BERT codebook token predictions.',
    }


@app.get('/api/scene/demo')
def demo(seed:int=Query(42,ge=0,le=100000), groups:int=Query(64,ge=4,le=256),
         neighbors:int=Query(32,ge=4,le=128)):
    return encode_scene(make_demo_scene(seed),groups,neighbors,seed,'synthetic_demo')


@app.post('/api/scene/upload')
async def upload(file: UploadFile=File(...), groups:int=Query(64,ge=4,le=256),
                 neighbors:int=Query(32,ge=4,le=128)):
    name = Path(file.filename or '').name.lower()
    if not name.endswith(('.bin','.npy')):
        raise HTTPException(status_code=415,detail='Upload .bin or .npy point clouds only')
    payload = await file.read(4*1024*1024+1)
    if len(payload)>4*1024*1024:
        raise HTTPException(status_code=413,detail='Max upload size: 4 MB')
    try:
        if name.endswith('.bin'):
            raw = np.frombuffer(payload,dtype=np.float32)
            if len(raw)%5:
                raise ValueError('Expected 5 float32 values per nuScenes point')
            xyz = raw.reshape(-1,5)
        else:
            xyz = np.load(io.BytesIO(payload),allow_pickle=False)
        return encode_scene(xyz,groups,neighbors,42,'uploaded_point_cloud')
    except (ValueError, OSError, TypeError) as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc


@app.get('/api/benchmark/demo')
def benchmark_demo(seed: int = Query(42, ge=0, le=100000),
                   groups: int = Query(64, ge=4, le=256)):
    """Reference geometric coverage comparison; not ML accuracy nor stable speed benchmark."""
    from .geometry import farthest_point_sampling, random_center_sampling, coverage_metrics
    points = make_demo_scene(seed)[:, :3]
    fps_ids = farthest_point_sampling(points, groups, seed=seed)
    random_ids = random_center_sampling(points, groups, seed=seed)
    return {
        'source': 'synthetic_demo',
        'dataset_points': len(points), 'num_centers': groups, 'seed': seed,
        'metric': 'distance_to_nearest_sampled_center_in_meters',
        'lower_is_better': True,
        'methods': {
            'fps': coverage_metrics(points, points[fps_ids]),
            'random': coverage_metrics(points, points[random_ids]),
        },
        'note': ('Algorithmic nearest-center coverage on the same seeded synthetic geometry. '
                 'This is NOT a learned-model score, point-cloud segmentation benchmark, '
                 'or evidence of general performance superiority.'),
    }

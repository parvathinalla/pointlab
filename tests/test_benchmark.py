from fastapi.testclient import TestClient
import numpy as np
from lidar_lab.api import app
from lidar_lab.demo import make_demo_scene
from lidar_lab.geometry import farthest_point_sampling, random_center_sampling, coverage_metrics

client = TestClient(app)


def test_random_sampling_is_deterministic():
    xyz=make_demo_scene(seed=7)
    a=random_center_sampling(xyz,12,seed=7)
    b=random_center_sampling(xyz,12,seed=7)
    assert len(np.unique(a))==12
    assert np.array_equal(a,b)


def test_coverage_metrics_known_simple_points():
    data=np.array([[0,0,0],[2,0,0],[4,0,0]],dtype='float32')
    m=coverage_metrics(data,np.array([[0,0,0]],dtype='float32'))
    assert m['max_m']==4
    assert m['mean_m']==2


def test_fps_not_worse_worst_radius_than_random_on_reference_scene():
    xyz=make_demo_scene(seed=42)
    fps=farthest_point_sampling(xyz,32,seed=42)
    rand=random_center_sampling(xyz,32,seed=42)
    assert coverage_metrics(xyz,xyz[fps])['max_m'] <= coverage_metrics(xyz,xyz[rand])['max_m']


def test_benchmark_api_schema():
    response=client.get('/api/benchmark/demo?seed=42&groups=24')
    assert response.status_code == 200
    result=response.json()
    assert result['source']=='synthetic_demo'
    assert result['lower_is_better'] is True
    assert result['num_centers']==24
    assert all('p95_m' in result['methods'][key] for key in ['fps','random'])


def test_benchmark_api_rejects_excessive_groups():
    assert client.get('/api/benchmark/demo?groups=257').status_code==422

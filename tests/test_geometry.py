import numpy as np
import pytest
from lidar_lab.demo import make_demo_scene
from lidar_lab.geometry import farthest_point_sampling, knn_indices, make_patches, subsample, validate_points
from lidar_lab.io import load_points


def test_demo_is_reproducible():
    assert np.array_equal(make_demo_scene(7),make_demo_scene(7))
    assert not np.array_equal(make_demo_scene(7),make_demo_scene(8))


def test_fps_unique_deterministic():
    pts = make_demo_scene(1,1000)
    a=farthest_point_sampling(pts,32,seed=1)
    b=farthest_point_sampling(pts,32,seed=1)
    assert np.array_equal(a,b)
    assert len(set(a))==32


def test_knn_returns_nearest():
    pts=np.array([[0,0,0],[1,0,0],[10,0,0]],dtype='float32')
    n=knn_indices(pts,pts[:1],2)
    assert n.tolist()==[[0,1]]


def test_patches_and_assignments():
    pts=make_demo_scene(42,800)
    r=make_patches(pts,16,8)
    assert r.patches.shape==(16,8,3)
    assert r.normalized_patches.shape==(16,8,3)
    assert r.centers.shape==(16,3)
    assert len(r.point_patch_id)==len(pts)
    assert r.point_patch_id.min()>=0
    assert r.point_patch_id.max()<16


def test_fps_rejects_bad_counts():
    pts=np.random.default_rng(42).random((5,3))
    for bad in [0,6]:
        with pytest.raises(ValueError):farthest_point_sampling(pts,bad)


def test_validation_rejects_nan_and_shapes():
    with pytest.raises(ValueError): validate_points(np.array([[np.nan,1,0]]))
    with pytest.raises(ValueError): validate_points(np.ones((3,2)))


def test_subsample_deterministic():
    pts=make_demo_scene(4,2000)
    assert np.array_equal(subsample(pts,200,1),subsample(pts,200,1))


def test_nuscenes_bin(tmp_path):
    x=np.arange(20,dtype=np.float32).reshape(4,5)
    f=tmp_path/'frame.bin'
    x.tofile(f)
    assert np.array_equal(load_points(f),x)


def test_bad_bin(tmp_path):
    f=tmp_path/'bad.bin'
    np.arange(8,dtype=np.float32).tofile(f)
    with pytest.raises(ValueError):load_points(f)

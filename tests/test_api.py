import io
import numpy as np
from fastapi.testclient import TestClient
from lidar_lab.api import app

client=TestClient(app)


def test_health():
    assert client.get('/api/health').json()['trained_model_loaded'] is False


def test_home():
    r=client.get('/')
    assert r.status_code==200 and 'POINT//LAB' in r.text


def test_demo_shape():
    r=client.get('/api/scene/demo?groups=12&neighbors=6')
    assert r.status_code==200
    j=r.json()
    assert j['source']=='synthetic_demo'
    assert len(j['centers'])==12
    assert len(j['points'])==len(j['patch_ids'])


def test_reject_params():
    assert client.get('/api/scene/demo?groups=0').status_code==422


def test_upload_bin():
    payload=np.random.default_rng(42).random((100,5)).astype('float32').tobytes()
    r=client.post('/api/scene/upload?groups=12&neighbors=8',files={'file':('lidar.bin',payload,'application/octet-stream')})
    assert r.status_code==200
    assert len(r.json()['points'])==100


def test_upload_wrong_extension():
    r=client.post('/api/scene/upload',files={'file':('test.txt',b'not data','text/plain')})
    assert r.status_code==415


def test_upload_invalid_array():
    data=io.BytesIO()
    np.save(data, np.ones((2,2),dtype='float32'))
    r=client.post('/api/scene/upload',files={'file':('bad.npy',data.getvalue(),'application/octet-stream')})
    assert r.status_code==422

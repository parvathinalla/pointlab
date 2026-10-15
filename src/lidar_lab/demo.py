"""Procedural scene for interface demos; NOT captured or labeled nuScenes data."""
import numpy as np


def make_demo_scene(seed: int = 42, density: int=6000) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n_ground = int(density * .58)
    ground = np.column_stack((
        rng.uniform(-42, 42, n_ground),
        rng.uniform(-23, 23, n_ground),
        rng.normal(-1.5, .045, n_ground)
    ))
    def box_shell(cx, cy, l, w, h, n):
        side = rng.integers(0,5,n)
        x = rng.uniform(-l/2,l/2,n)
        y = rng.uniform(-w/2,w/2,n)
        z = rng.uniform(-1.45,-1.45+h,n)
        x[side == 0] = -l/2
        x[side == 1] = l/2
        y[side == 2] = -w/2
        y[side == 3] = w/2
        z[side == 4] = -1.45+h
        return np.column_stack((x+cx,y+cy,z))
    car_a = box_shell(11,-6,4.5,2.1,1.8,int(density*.15))
    car_b = box_shell(-15,8,4.3,1.9,1.7,int(density*.12))
    building = box_shell(24,22,13,3,10,int(density*.13))
    n_person = max(60,int(density*.02))
    theta = rng.uniform(0,2*np.pi,n_person)
    z = rng.uniform(-1.4,.4,n_person)
    person = np.column_stack((5+.30*np.cos(theta),9+.25*np.sin(theta),z))
    return np.concatenate([ground, car_a, car_b, building, person]).astype('float32')

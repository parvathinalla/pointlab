"""Command-line entrypoints for repeatable point cloud experiments."""
import argparse, json
from .demo import make_demo_scene
from .geometry import make_patches, scene_metrics, subsample
from .io import load_points


def main():
    p=argparse.ArgumentParser(description='POINT//LAB research toolkit')
    p.add_argument('--file',help='nuScenes .bin or numpy .npy; default synthetic demo')
    p.add_argument('--groups',type=int,default=64)
    p.add_argument('--neighbors',type=int,default=32)
    p.add_argument('--seed',type=int,default=42)
    p.add_argument('--max-points',type=int,default=12000)
    args=p.parse_args()
    xyz=load_points(args.file) if args.file else make_demo_scene(args.seed)
    xyz=subsample(xyz,args.max_points,args.seed)
    result=make_patches(xyz,args.groups,args.neighbors,args.seed)
    print(json.dumps({'source':args.file or 'synthetic_demo','metrics':scene_metrics(xyz,result),
                      'note':'Geometric patch clusters; not learned codebook tokens'},indent=2))

if __name__=='__main__':main()

"""Generate a standalone GitHub Pages demo with all reference geometry in-browser."""
from __future__ import annotations
import json, shutil
from pathlib import Path

import numpy as np
from lidar_lab.demo import make_demo_scene

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'docs' / 'site'


def main() -> None:
    assets = DEST / 'assets'
    assets.mkdir(parents=True, exist_ok=True)
    for fname in ['style.css', 'app.js', 'favicon.svg', 'static-api.js']:
        shutil.copyfile(ROOT / 'web' / fname, assets / fname)
    # Fixed seed scene. All third-party data intentionally excluded.
    pts = np.round(make_demo_scene(seed=42).astype(np.float64), 3).tolist()
    (assets / 'scene-data.js').write_text('window.__POINTLAB_STATIC_POINTS='+json.dumps(pts,separators=(',',':'))+';\n')
    html = (ROOT / 'web' / 'index.html').read_text()
    html = html.replace('href="/assets/', 'href="./assets/').replace('src="/assets/', 'src="./assets/')
    html = html.replace('href="/docs"', 'href="https://github.com/parvathinalla/pointlab#api"')
    html = html.replace('SELF-HOSTED APP', 'BROWSER-ONLY DEMO').replace('FILES PROCESSED BY THIS SERVER', 'STATIC DEMO: SYNTHETIC GEOMETRY ONLY')
    html = html.replace('<script type="module" src="./assets/app.js"></script>',
        '<script src="./assets/scene-data.js"></script>\n<script src="./assets/static-api.js"></script>\n<script type="module" src="./assets/app.js"></script>')
    (DEST / 'index.html').write_text(html)
    (DEST / '.nojekyll').write_text('')
    print(f'Created offline/browser-only demo: {DEST}; {len(pts)} synthetic points')

if __name__ == '__main__':main()

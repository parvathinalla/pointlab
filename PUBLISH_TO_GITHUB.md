# Publish POINT//LAB

The public URL does not exist until you create the repository and push it.

## Route A: import the source archive

1. Create a **public, empty** repository on GitHub named `pointlab` under `parvathinalla` (or your preferred name). Do not initialize it with a README, license or .gitignore since those already exist.
2. Unzip `pointlab-source.zip`, open a terminal in the resulting `pointlab` folder.
3. Run:

```bash
git init
git add .
git commit -m "feat: launch POINT//LAB open perception workbench"
git branch -M main
git remote add origin https://github.com/parvathinalla/pointlab.git
git push -u origin main
```

If you cloned the supplied `.bundle`, it already contains a local commit history. Use `git remote add origin` then `git push -u origin main` instead of recommitting.

## Launch the clickable demo

- Open the repository → **Settings → Pages** → select **GitHub Actions** as the build/deployment source.
- Open **Actions** and run **Deploy browser demo** if a deployment did not start with the initial push.
- After the workflow succeeds, your GitHub Pages URL should be `https://parvathinalla.github.io/pointlab/`.
- Add that URL under **About → Website** in the repository sidebar.
- Upload `docs/media/social-preview.png` in repository **Settings → General → Social preview**.
- Add repository topics: `lidar`, `point-cloud`, `point-bert`, `autonomous-driving`, `computer-vision`, `3d-visualization`, `nuscenes`, `machine-learning`, `research`, `open-source`.
- Consider pinning the repository on your GitHub profile and writing a short post with the demo link and one reproducible benchmark result, appropriately described as *synthetic geometric coverage*.

## Before making claims

- Do not claim this project reproduces Point-BERT paper scores, predicts driving scenes, or trains a fused RGB/LiDAR model.
- Original notebooks are included for academic provenance; read any applicable collaboration/IP agreements before redistributing team-owned material.
- The dataset is **not** bundled; users must obtain nuScenes under its own license.

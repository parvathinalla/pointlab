# Contributing to POINT//LAB

Thank you for helping make 3D perception more inspectable.

## 5-minute first PR

1. Fork the repository and create a branch, e.g. `feat/voxel-grid` or `docs/typo`.
2. Install Python 3.10+: `python -m pip install -e '.[test]'`.
3. Run `pytest -q` before changes, then after.
4. If you changed the browser experience, rebuild static demo: `PYTHONPATH=src python scripts/build_static_site.py`.
5. Open a PR with a screenshot (for UI changes), a minimal before/after explanation, and a test when you changed behavior.

## What we welcome

- Documented reference implementations of sampling, filtering, nearest-neighbor and visualization methods.
- Reproducibility improvements, accessible controls, browser performance and numerical testing.
- Dataset adapters that **do not redistribute third-party licensed data**.
- Honest experiments with baselines, seeds, train/validation isolation, hardware and runtime disclosure.

## Scientific integrity

Use **synthetic** for procedurally generated scenes. Call nearest-center spatial IDs **geometric patch IDs**, not pretrained token IDs. Never claim novel benchmark numbers without a complete, runnable evaluation on a named dataset and evaluation split. Keep research models, geometric visualizations, and experimental results explicitly separate. See [Research Notes](docs/RESEARCH_NOTES.md).

## PR checklist

- [ ] The change has a short motivation and clear scope.
- [ ] `pytest -q` passes.
- [ ] Docs and type hints cover new public methods.
- [ ] The demo doesn't silently imply trained model inference.
- [ ] Data licensing and privacy boundaries are respected.
- [ ] Any new benchmark includes exact settings, seed, metric definitions and caveats.

## Community standards

Be patient, kind and precise in technical feedback. Look for issues marked `good first issue` after the repository is published, or propose a small self-contained change.

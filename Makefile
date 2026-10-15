.PHONY: install run test benchmark static
install:
	python -m pip install -e '.[test]'
run:
	uvicorn lidar_lab.api:app --reload
test:
	pytest -q
benchmark:
	python scripts/benchmark_geometry.py --seed 42 --groups 64
static:
	PYTHONPATH=src python scripts/build_static_site.py

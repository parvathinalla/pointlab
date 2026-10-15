# Experiment provenance & research integrity

## Sources reviewed (uploaded notebooks)

| Notebook | Implements | Evidence of execution | Claims not established |
|---|---|---|---|
| `pointbert_lidar_tokenization_plotly.ipynb` | FPS, kNN local grouping, Plotly 3D visuals, **random simulated** token colors | Initial import/install log; no executed retrieval/training results | No learned tokenization or benchmark |
| `pointbert_nuscenes_full_visual.ipynb` | DGCNN, dVAE, Gumbel-Softmax codebook, Folding decoder, masked Transformer, exploratory lidarseg evaluation | dVAE **shape smoke** executed. Actual nuScenes load failed due to `/content` vs Windows path. | No recorded end-to-end pretraining, segmentation accuracy, or released weights |
| `omnivec2_rgb_pretraining.ipynb` | RGB masked patch pretraining (224px, 16px patches, mask ratio 0.75); scene-level train/val split | Recorded nuScenes table load, 1950/474 train/val images, model 5.99M parameters, epoch logs 1–15 | No evidence of 100 completed epochs or of pretrained RGB/LiDAR fusion |

The nuScenes-download cells were run in an environment where `wget` and `apt-get` failed; output text saying “fully downloaded” is not proof. The OmniVec2 dataset appears to have been available by the time the training cell ran, but the notebooks do not establish the exact setup.

## Project boundaries

The API viewer implements **FPS + kNN geometric grouping**, not the DGCNN learned tokenizer. These geometric cluster IDs are only for visualization. Original notebooks are preserved under `notebooks/original` (with prior metadata outputs). The dashboard cannot claim learned tokens, segmentation accuracy, or future prediction without checkpoints and a standardized test run.

## Technical diligence / TODO before publishing quantitative model results

1. Obtain nuScenes mini through the official download/access workflow and set the local dataroot (no automatic downloading). Do not commit datasets or private keys.
2. Fix absolute Colab `/content` paths and avoid notebook shell calls with platform-specific syntax.
3. Check notebook dVAE `NUM_TOKENS` consistency; the config cell says 512 while the recorded output reports logits of dimension 8192. A clean kernel restart and shape test are required.
4. Split train and validation by **scene** for LiDAR too, not random individual frames, to reduce temporal leakage.
5. Replace Python-global stochastic-depth decisions with independently sampled per-example drop path if evaluating architecture faithfully.
6. Use fixed seeds, train/val/test manifests, checkpoint metadata, exact hyperparameter provenance and transparent metrics.
7. Add tests for consistent point ordering when mapping lidarseg point labels to sampled groups.
8. Keep Point-BERT-inspired and OmniVec2-inspired branches separate until cross-modal fusion is actually implemented and evaluated.
9. Do not call a token cluster a semantic class or a synthetic-demo metric a trained-model result.

## Benchmark design

For LiDAR: frozen encoder with linear probe on nuScenes lidarseg; per-class and macro mIoU, overall accuracy, latency per batch, codebook perplexity/utilization, reconstruction Chamfer. For RGB: masked pixel MSE on held-out scenes, reconstruction panels, and downstream task evaluation. Compare to simple non-pretrained baselines, repeat seeds, disclose computational budget. Future-scene prediction requires a temporal modeling objective and separate validation and is currently **not implemented**.

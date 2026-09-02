# WLASL browser bundle

This directory is intentionally separate from every CSL asset.

The official WLASL pretrained checkpoints are PyTorch RGB-video models; they
cannot be loaded by TensorFlow.js unchanged. Install a browser-converted model
whose input is `[batch, time, height, width, 3]` (NTHWC), then add:

- `model.json` plus its generated weight shards
- `labels.json`, in the exact output-index order used by the checkpoint

Update `manifest.json` to match the checkpoint's frame count, image size and
normalization, then set `enabled` to `true`. Start with WLASL100: a 2,000-class
I3D bundle is usually too large for dependable browser inference.

Do not use the repository's `asl_word_model.json` landmark naming for this
bundle. That legacy path remains supported separately.


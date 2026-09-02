# WLASL integration plan

## What WLASL provides

WLASL is an isolated, word-level ASL **RGB video dataset** with standard
100/300/1000/2000-gloss subsets. The official repository also publishes
PyTorch I3D and pose-TGCN checkpoints. Those files are not TensorFlow.js model
bundles and cannot be copied directly into this browser app.

The app now keeps three independent recognition contracts:

| Mode | Input | Asset location |
| --- | --- | --- |
| ASL spelling | 30 x 63 hand landmarks | `public/asl-model*` files |
| ASL words / WLASL | sampled square RGB clip | `public/models/asl/wlasl/` |
| CSL words | CSL landmark graph/crops | existing `csl*` files |

No WLASL code imports or changes the CSL feature pipeline.

## Recommended first milestone

Use WLASL100 first. Browser video models are much heavier than landmark models,
and confirming the complete 100-class path is more useful than beginning with a
large WLASL2000 download that may not run reliably on mobile hardware.

1. Download the official WLASL metadata, videos, and the matching pretrained
   checkpoint. Keep the official train/validation/test split when evaluating.
2. Confirm the checkpoint's exact input contract in its training code: frame
   count, crop size, RGB channel order, normalization, and output-index mapping.
3. Convert or export the network as a TensorFlow.js Layers model with one NTHWC
   input: `[batch, time, height, width, 3]`. Conversion is a model-development
   step, not a file rename; unsupported PyTorch operations may require an ONNX
   or TensorFlow intermediate and output-parity testing.
4. Put `model.json`, all generated weight shards, and `labels.json` under
   `public/models/asl/wlasl/`. Labels must be an array in classifier output order.
5. Edit `public/models/asl/wlasl/manifest.json` to match the exported checkpoint and
   set `enabled` to `true`.
6. Serve the repository over HTTP, choose **ASL Words**, and test complete signs
   centered in the camera for the configured clip duration.

## Required acceptance checks

- Compare the converted model's logits against the original checkpoint on the
  same preprocessed clip before trusting browser results.
- Test on signers absent from training; random video splits can leak signer and
  source appearance.
- Verify every label index against the checkpoint rather than alphabetizing the
  gloss list.
- Measure browser memory and inference latency on the actual target device.
- Add an explicit idle/no-sign policy. WLASL classes contain signs, so a plain
  classifier will otherwise choose a word even when nobody is signing.

The checked-in manifest stays disabled because this repository does not contain
a WLASL checkpoint or its authoritative label-index file.

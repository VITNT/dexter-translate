# Third-party notices and credits

This project combines original application code with models, libraries, fonts,
icons, and research released by other authors. Each upstream component remains
subject to its own license and terms.

## CADT Cambodian Sign Language models and remaining references

The CSL temporal weights in `public/models/csl/cadt-word-v1/`, the static LandmarkNet
weights in `public/models/csl/static-landmark-v1.json`, and the remaining reference
images in `public/images/csl/reference/` are derived from the upstream project titled
**Khmer Sign Language Translation System**:

<https://github.com/Phal-Sovandy/Khmer-Sign-Language-Translation-System>

Copyright (c) 2025 Khmer Sign Language Translation System

ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER
RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE
USE OR PERFORMANCE OF THIS SOFTWARE.

## WLASL and I3D

The optional ASL Words service is designed around the official WLASL300 I3D
implementation and checkpoint from:

<https://github.com/dxli94/WLASL>

WLASL is released under the Computational Use of Data Agreement (C-UDA), is
limited by its authors to academic and computational use, and is not allowed
for commercial use. The WLASL source, dataset, and checkpoint are deliberately
excluded from this repository and must be installed separately under those
terms.

Please cite:

Dongxu Li, Cristian Rodriguez, Xin Yu, and Hongdong Li. “Word-level Deep Sign
Language Recognition from Video: A New Large-scale Dataset and Methods
Comparison.” IEEE Winter Conference on Applications of Computer Vision, 2020,
pages 1459–1469.

## Browser libraries and landmark models

- TensorFlow.js 4.10.0 — TensorFlow Authors — Apache License 2.0 —
  <https://github.com/tensorflow/tfjs>
- MediaPipe Tasks Vision 0.10.0, Hand Landmarker, and Pose Landmarker Lite —
  Google/MediaPipe Authors — Apache License 2.0 —
  <https://github.com/google-ai-edge/mediapipe>
- Fingerpose 0.1.0 — Andreas Schallwig; based on FingerPoseEstimate by Prasad
  Pai — MIT License — <https://github.com/andypotato/fingerpose>

## Wikimedia Commons ASL reference videos

SignDex includes three short American Sign Language reference clips from
Wikimedia Commons:

- “ASL BOOK justsign.ogv” by Richard Goodrow — CC BY 3.0 —
  <https://commons.wikimedia.org/wiki/File:ASL_BOOK_justsign.ogv>
- “Hello1.ogv” by E5SUON — CC BY-SA 3.0 —
  <https://commons.wikimedia.org/wiki/File:Hello1.ogv>
- “About- General sign.ogv” by Underresearched — CC BY-SA 3.0 —
  <https://commons.wikimedia.org/wiki/File:About-_General_sign.ogv>

The bundled WebM files are Wikimedia Commons-generated transcodes of the
originals; no additional modifications were made by this project. License texts are available at <https://creativecommons.org/licenses/by/3.0/> and
<https://creativecommons.org/licenses/by-sa/3.0/>.

## Fonts and icons

- DM Sans, Manrope, Roboto, and Battambang are loaded through Google Fonts and
  are distributed under the SIL Open Font License 1.1. Their individual source
  and copyright metadata is maintained in the
  <https://github.com/google/fonts> repository.
- Material-style interface icon paths are derived from Google Material Design
  Icons, available under the Apache License 2.0:
  <https://github.com/google/material-design-icons>

## Optional local ASL service dependencies

The packages listed in `asl_service/requirements.txt` are installed separately
and are not vendored into this repository: FastAPI, NumPy, OpenCV, PyTorch,
TorchVision, python-multipart, and Uvicorn. Their upstream licenses and notices
continue to apply. The local virtual environment and downloaded model
checkpoints are excluded from version control.

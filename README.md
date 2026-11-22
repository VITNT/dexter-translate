# Dexter Sign Language Recognition

For a one-link GitHub-to-Vercel deployment, follow
[DEPLOY_VERCEL.md](DEPLOY_VERCEL.md). For a fresh local clone, follow
[SETUP.md](SETUP.md). VS Code **Go Live** alone is
not enough for local ASL Words because WLASL300 needs Python and its checkpoint
is excluded from Git. In production, Vercel serves the frontend and small
JavaScript routes while Google Cloud Run runs WLASL inference. Cloud Run reads
the restricted checkpoint from private Vercel Blob storage using a credential
kept in Google Secret Manager.

CSL Words runs the released CADT 75-class temporal model directly in the
browser. ASL Words is a separate WLASL/I3D integration and does not share the
CSL model or preprocessing.

## SignDex coverage

The learning catalog contains all 26 ASL fingerspelling letters plus 3
open-license ASL word videos, alongside the original 11 CSL visual references.

## Run Locally

Install the Next.js dependencies, copy `.env.example` to `.env.local`, and run:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000/`. The Next.js server includes the
`/api/config`, `/api/translate`, and `/api/speech` routes; a plain static file
server is no longer sufficient. The complete Windows, macOS/Linux, Docker, and
Vercel instructions are in [SETUP.md](SETUP.md).

## Deploy

The public application stays on one Vercel URL. Vercel exposes the Cloud Run
backend URL through `/api/config`; the browser sends ASL clips directly to the
service. The restricted checkpoint and two official support files remain
outside Git in a private Vercel Blob store. See
[DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).

## WLASL300 service

The isolated ASL-word backend lives in `asl_service/` and uses the official
PyTorch I3D implementation under `third_party/WLASL/`. Installation details for
the required checkpoint are in `asl_service/models/README.md`.

After installing the checkpoint and Python requirements, run:

```powershell
.venv\Scripts\python.exe -m uvicorn asl_service.app:app --host 127.0.0.1 --port 8001
```

Check `http://127.0.0.1:8001/health`. It should report `"status":"ready"`.
The live ASL-word client will use a rolling sign window; 300 ms is reserved for
prediction checks/cooldown, not used as the full sign duration. Each 2.5-second
capture is decoded into a motion-focused, contiguous 64-frame window. Its short
edge is resized to 256 pixels without changing aspect ratio, followed by the
released checkpoint's 224-pixel center crop. This avoids stretching a widescreen
webcam image into a square and distorting the signer's motion.
Because WLASL has no idle class, motion, confidence, and top-two-margin gates
reject no-sign windows instead of forcing an arbitrary vocabulary word.
Pausing or resuming the camera clears all cached recognition frames.

### Local ASL common-word geometry

ASL Words also includes a small deterministic landmark recognizer for
**Hello**, **OK**, and **I love you**. It runs before WLASL and remains available
when the optional word-model service is offline. The rules use palm-width
normalized distances, 3D joint angles, a short hold window, and face/shoulder
relative motion rather than fixed camera pixels. Hello requires an open palm to
move outward from the temple; OK requires a thumb/index pinch with the other
three fingers extended; I love you requires the index, pinky, and thumb extended
with the middle and ring fingers curled. A detected static word must be released
or changed before it can be accepted again.

## CADT CSL model

CSL Words uses the released CADT checkpoint converted deterministically from
Keras HDF5 to TensorFlow.js:

```text
30 video frames
  -> up to two MediaPipe hands in detection order
  -> wrist-relative XYZ landmarks (126 values per frame)
  -> two-layer LSTM
  -> one of 75 CADT CSL classes
  -> confidence, top-two-margin, temporal voting, and release gates
```

The public name, asset folders, documentation, tests, and safe internal adapter
names use CSL. A few serialized upstream identifiers retain their original
names so the converted checkpoint remains traceable to its source.

The model bundle lives in `public/models/csl/cadt-word-v1/` and is served from
`/models/csl/cadt-word-v1/`. A released 42-class
static LandmarkNet remains a final fallback if the temporal bundle cannot be
loaded. Six approved reference images appear in the CSL dictionary; removed
images render as unavailable rather than being requested. Source and license
details are recorded in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

CSL draws the lightweight hand skeleton but does not load or run the full body
Pose tracker. The CADT classifier receives only its original two-hand landmark
input.

### CSL testing and tuning

CSL Words uses one fixed runtime pipeline: 36 evenly timed frames, three
overlapping 30-frame predictions, probability averaging, and conservative
same-label confirmation from the static model. Test each sign repeatedly and
record correct, wrong, and rejected outcomes.
The adjustable CSL values are kept together in
`public/models/csl/cadt-word-v1/metadata.json`: `confidenceThreshold`,
`confidenceMargin`, capture/window sizes and offsets, and the static-agreement
settings. Static agreement never inserts a different word; it can only support
the exact label already predicted by the temporal model.
See [`docs/csl-testing.md`](docs/csl-testing.md) and its CSV template for the
procedure, including idle false-activation tests.

The linked upstream repository does not publish the raw 22,000-image or
1,900-video datasets described by its documentation, so this repository cannot
honestly retrain or independently validate the CADT temporal model. See
[`docs/csl-external-resources.md`](docs/csl-external-resources.md).

WLASL has a separate RGB-video bundle at `public/models/asl/wlasl/`; see its
README and manifest for the browser model contract.
The end-to-end acquisition, conversion, and validation checklist is in
`docs/wlasl-integration.md`.
Optional legacy ASL word files can still be installed as
`asl_word_model.json`, `asl_word_model.weights.bin`, `asl_word_labels.json`, and
`asl_word_model_metadata.json`; without them, ASL Words reports that no word
model is installed instead of accidentally using the CSL model bundle.

## Verification

Run the deterministic feature and migration tests with:

```bash
npm test
npm run build
```

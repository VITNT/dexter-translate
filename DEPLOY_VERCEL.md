# Deploy Dexter with Vercel and Google Cloud Run

The public site and lightweight JavaScript routes run on Vercel. The
memory-heavy WLASL300 FastAPI/PyTorch service runs on Google Cloud Run, and its
restricted assets remain in private Vercel Blob storage.

```text
Vercel
  static frontend
  /api/config
  /api/translate
       |
       | browser uploads a 2.5-second WebM clip
       v
Google Cloud Run
  FastAPI /health and /predict
  PyTorch WLASL300 inference
       |
       | token from Google Secret Manager
       v
Private Vercel Blob
  wlasl/wlasl300.pt
  wlasl/pytorch_i3d.py
  wlasl/wlasl_class_list.txt
```

Cloud Run requires a billing account even when usage stays within its free
allowance. The allowance is not a hard spending cap, so configure a Google
Cloud budget alert. This service limits itself to one instance and scales to
zero when idle to keep demo usage small.

Do not commit `.env.local`, `wlasl300.pt`, the downloaded WLASL repository, or
the Blob token. WLASL is restricted to academic/computational,
non-commercial use by its authors.

## 1. Store the restricted files privately

Create a private Vercel Blob store, connect it to the Vercel project, and upload
these exact pathnames:

| Local file | Private Blob pathname |
|---|---|
| `asl_service/models/wlasl300.pt` | `wlasl/wlasl300.pt` |
| `third_party/WLASL/code/I3D/pytorch_i3d.py` | `wlasl/pytorch_i3d.py` |
| `third_party/WLASL/code/I3D/preprocess/wlasl_class_list.txt` | `wlasl/wlasl_class_list.txt` |

The Vercel CLI can upload them after the project is linked:

```bash
npx vercel@latest login
npx vercel@latest link
npx vercel@latest env pull .env.local
npx vercel@latest blob put asl_service/models/wlasl300.pt --pathname wlasl/wlasl300.pt --access private
npx vercel@latest blob put third_party/WLASL/code/I3D/pytorch_i3d.py --pathname wlasl/pytorch_i3d.py --access private
npx vercel@latest blob put third_party/WLASL/code/I3D/preprocess/wlasl_class_list.txt --pathname wlasl/wlasl_class_list.txt --access private
```

Keep the generated `BLOB_READ_WRITE_TOKEN` private. It is needed by Cloud Run,
and by Dexter's server-only Vercel account storage, never by browser code.

## 2. Put the Blob credential in Google Secret Manager

Select a Google Cloud project with billing enabled, then enable the required
APIs:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
gcloud secrets create dexter-vercel-blob-token --replication-policy=automatic
gcloud secrets versions add dexter-vercel-blob-token --data-file=-
```

The last command reads the token from standard input. Paste only the token and
finish the input; do not put it in shell history.

Create a dedicated runtime identity and grant it access only to that secret:

```bash
gcloud iam service-accounts create dexter-wlasl-runtime --display-name="Dexter WLASL runtime"
gcloud secrets add-iam-policy-binding dexter-vercel-blob-token \
  --member="serviceAccount:dexter-wlasl-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 3. Deploy the WLASL backend to Cloud Run

The root `Dockerfile` builds the backend. `.dockerignore` and `.gcloudignore`
exclude the checkpoint, downloaded WLASL repository, frontend, tests, and local
secrets from the image and Cloud Build upload.

```bash
gcloud run deploy dexter-wlasl \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --service-account dexter-wlasl-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --set-secrets BLOB_READ_WRITE_TOKEN=dexter-vercel-blob-token:latest \
  --set-env-vars DEXTER_ALLOWED_ORIGINS=https://YOUR_PROJECT.vercel.app,WLASL_RUNTIME_ROOT=/tmp/dexter-wlasl,WLASL_MAX_CONCURRENT_INFERENCES=1,WLASL_INFERENCE_QUEUE_TIMEOUT_SECONDS=30,MAX_UPLOAD_BYTES=20971520 \
  --memory 4Gi \
  --cpu 1 \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 1 \
  --timeout 300 \
  --execution-environment gen2 \
  --cpu-boost
```

For Vercel preview deployments, optionally add a narrowly scoped CORS regex:

```bash
gcloud run services update dexter-wlasl \
  --region asia-southeast1 \
  --update-env-vars 'DEXTER_ALLOWED_ORIGIN_REGEX=^https://YOUR_PROJECT(-[a-zA-Z0-9-]+)?-YOUR_TEAM\.vercel\.app$'
```

On a cold start, the service downloads the three private assets to ephemeral
`/tmp` storage and loads the model. Inference is serialized to one request at a
time to protect the 4 GiB instance. Requests waiting longer than 30 seconds
receive HTTP 429 rather than forming an unbounded queue.

Verify the service URL reported by `gcloud run deploy`:

```bash
curl https://YOUR_CLOUD_RUN_URL/health
```

The response should report `"status":"ready"`, both assets as found, and
`"classes":300`.

## 4. Connect and deploy Vercel

Import the repository as a **Next.js** project and keep the repository root as
Vercel's Root Directory. Vercel should detect the framework from `package.json`;
`vercel.json` pins `framework` to `nextjs` as part of the deploy contract. Keep
the standard detected commands and directories—do not override Build Command,
Output Directory, Install Command, or Development Command. Set these variables
for Production and Preview:

```text
GEMINI_API_KEY=<your Google AI Studio key>
GEMINI_MODEL=gemma-4-31b-it
AUTH_SECRET=<at least 32 random characters>
BLOB_READ_WRITE_TOKEN=<private Blob store token>
WLASL_API_URL=https://YOUR_CLOUD_RUN_URL
```

`WLASL_API_URL` is public configuration and must not have a trailing slash.
All other values above are server-only and must never use a `NEXT_PUBLIC_`
prefix.

Deploy and verify:

```bash
npm install
npm test
npm run build
npx vercel@latest deploy --prod
curl https://YOUR_PROJECT.vercel.app/api/config
```

The local test suite validates the Vercel/Next.js contract before deployment:
the Next.js framework preset, standard package scripts, route-level function
durations, excluded Cloud Run sources, and this guide's project settings. A
successful `next build` additionally verifies that all pages and route handlers
compile for production.

`/api/config` must return the Cloud Run URL:

```json
{"wlaslApiUrl":"https://YOUR_CLOUD_RUN_URL"}
```

## 5. Production verification

1. Open the Vercel URL over HTTPS and grant camera access.
2. Select **ASL Words** and allow extra time for the first Cloud Run cold start.
3. Record one complete sign and confirm `/predict` returns a result.
4. Confirm **Interpret Context** works through `/api/translate`.
5. Create a Google Cloud budget alert and review Cloud Run usage periodically.

## Current Dexter deployment

- Frontend: `https://dexter-translate.vercel.app`
- WLASL backend: `https://dexter-wlasl-735462023324.asia-southeast1.run.app`
- Health: `https://dexter-wlasl-735462023324.asia-southeast1.run.app/health`

## Troubleshooting

- **`/health` returns `missing_model`:** confirm all three private Blob
  pathnames exactly match the table and that the Secret Manager token belongs
  to that store.
- **Cloud Run cannot read the secret:** confirm the runtime service account has
  `roles/secretmanager.secretAccessor` on `dexter-vercel-blob-token`.
- **First request is slow:** a scale-from-zero instance must download the
  private assets and load PyTorch before it can become ready.
- **CORS error:** make `DEXTER_ALLOWED_ORIGINS` exactly match the Vercel origin,
  without a trailing slash, then deploy a new Cloud Run revision.
- **Prediction queues under multiple users:** this is intentional on the
  low-cost CPU configuration. Concurrency and maximum instances are capped.
- **Clip upload returns 413:** keep each recorded clip below 20 MB.
- **Interpret Context fails:** verify the Vercel `GEMINI_API_KEY` and redeploy.
- **Vercel blocks a private-repository deployment:** ensure the Git commit
  author has contributing access to the Vercel project, or deploy a clean local
  source archive without Git metadata.

The public link to share is the Vercel URL. Visitors do not need Google Cloud,
Vercel Blob, or Secret Manager credentials.

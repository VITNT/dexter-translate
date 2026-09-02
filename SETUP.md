# Dexter setup and deployment

For the production, one-link Vercel workflow, use
[DEPLOY_VERCEL.md](DEPLOY_VERCEL.md). This document covers local development
and the optional external-container alternative.

Dexter has two runtime pieces:

1. **Next.js browser application** — ASL spelling and CSL/KSL recognition run
   in the browser. Next.js also runs the small `/api/translate`, `/api/speech`,
   and `/api/config` route handlers.
2. **Optional ASL Words service** — WLASL300 video inference runs in the
   `asl_service` FastAPI application. It requires PyTorch, the official WLASL
   source, and a separately obtained checkpoint.

The public site remains usable without the Python service: ASL spelling,
CSL/KSL words, the dictionary, and browser translation UI still load. Only
ASL Words is unavailable.

## Prerequisites

- Git
- Python 3.11 or 3.12
- Node.js 20.9 or newer
- Internet access: TensorFlow.js, MediaPipe, fonts, and landmark models are
  loaded from their upstream CDNs
- A webcam and a browser that supports `getUserMedia`
- Docker only when packaging the optional ASL Words backend

## 1. Fresh clone

```powershell
git clone <your-repository-url>
cd asl-cool-testing
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```dotenv
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemma-4-31b-it
AUTH_SECRET=generate-at-least-32-random-characters
BLOB_READ_WRITE_TOKEN=your-private-vercel-blob-token
STRIPE_SECRET_KEY=sk_test_or_live_key
STRIPE_WEBHOOK_SECRET=whsec_endpoint_secret
WLASL_API_URL=http://127.0.0.1:8001
```

`GEMINI_API_KEY` enables **Interpret Context**. `AUTH_SECRET` signs secure
login cookies, while `BLOB_READ_WRITE_TOKEN` stores password-hashed accounts in
private Vercel Blob. Never place these values in browser code or commit
`.env.local`. `WLASL_API_URL` is public configuration, not a secret.

`STRIPE_SECRET_KEY` creates hosted recurring Checkout and customer-portal
sessions. Register `https://YOUR_DOMAIN/api/billing/webhook` as a Stripe
webhook endpoint for `checkout.session.completed`,
`customer.subscription.created`, `customer.subscription.updated`, and
`customer.subscription.deleted`, then store its signing secret as
`STRIPE_WEBHOOK_SECRET`. Dexter defines the $4.99/month Pro and $300/year B2B
prices in server-side Checkout requests, so separate Stripe Price IDs are not
required.

Dexter's public landing page is `/`, and the translator at `/translate` works
without an account. Account creation at `/signup` and login at `/login` are
optional. The dictionary is also public so every visitor can explore it.

## 2. Install the optional ASL Words service

Skip this section if only ASL spelling and CSL/KSL are needed.

Create the Python environment on Windows:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r asl_service\requirements.txt
```

On macOS/Linux:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r asl_service/requirements.txt
```

Install the official WLASL repository at the exact expected location:

```powershell
git clone https://github.com/dxli94/WLASL.git third_party/WLASL
```

Then follow [asl_service/models/README.md](asl_service/models/README.md) to
obtain the official WLASL300 checkpoint. These files must exist:

```text
asl_service/models/wlasl300.pt
third_party/WLASL/code/I3D/pytorch_i3d.py
third_party/WLASL/code/I3D/preprocess/wlasl_class_list.txt
```

WLASL is limited to academic/computational, non-commercial use. Its source and
checkpoint are intentionally not committed or included in either deployment
bundle.

Start the backend on Windows:

```powershell
.venv\Scripts\python.exe -m uvicorn asl_service.app:app --host 127.0.0.1 --port 8001
```

On macOS/Linux:

```bash
.venv/bin/python -m uvicorn asl_service.app:app --host 127.0.0.1 --port 8001
```

Open <http://127.0.0.1:8001/health>. Continue only when it returns
`"status":"ready"`.

## 3. Run the complete site locally

In a second terminal, install dependencies and run Next.js from the repository
root:

```powershell
npm.cmd install
npm.cmd run dev
```

On macOS/Linux the equivalent commands are `npm install` and `npm run dev`.
Open <http://localhost:3000/>.

The site now depends on Next.js routing and server-rendered pages, so a basic
static file server is not supported.

## 4. Package the ASL Words backend

The Docker build deliberately excludes the locally installed restricted WLASL
files. The container downloads them from private Vercel Blob at runtime, using
`BLOB_READ_WRITE_TOKEN` from the environment:

```powershell
docker build -t dexter-asl .
docker run --rm -p 8001:7860 `
  --env-file .env.local `
  -e DEXTER_ALLOWED_ORIGINS=http://localhost:8000 `
  dexter-asl
```

`BLOB_READ_WRITE_TOKEN` must be present in `.env.local`, normally after linking
the Vercel project and running `vercel env pull`. CPU works but can be slow;
GPU compute gives substantially better response time. Configure:

```text
PORT=7860
DEXTER_ALLOWED_ORIGINS=https://your-project.vercel.app
MAX_UPLOAD_BYTES=20971520
WLASL_MAX_CONCURRENT_INFERENCES=1
WLASL_INFERENCE_QUEUE_TIMEOUT_SECONDS=30
```

For changing Vercel preview domains, the backend can additionally use:

```text
DEXTER_ALLOWED_ORIGIN_REGEX=^https://[a-zA-Z0-9-]+\.vercel\.app$
```

Use an exact production origin whenever possible. Add authentication and
host-level rate limits before sharing an expensive public GPU endpoint.

## 5. Deploy to Vercel

Use the separate production-only [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md) guide.
It deploys the browser app and JavaScript routes to Vercel, the Python inference
service to Google Cloud Run, and the restricted WLASL assets to private Vercel
Blob with its credential in Google Secret Manager.

## 6. Verify

```powershell
npm.cmd test
npm.cmd run build
.venv\Scripts\python.exe -m unittest discover -s asl_service\tests -p "test_*.py"
```

Manual checks:

- ASL Spelling starts the camera and recognizes static letters.
- CSL/KSL loads the 75-class browser model.
- `POST /api/translate` works when `GEMINI_API_KEY` is present.
- ASL Words is enabled only when the configured backend reports ready.
- The deployed page receives camera permission over HTTPS.

## Files that must stay in Git

- `app/**`, `components/**`, `client/**`, and `app/globals.css`
- `app/api/**`, `server/api/**`, and `lib/**`
- `src/pipeline/*.mjs` runtime modules
- `public/asl-model.json`, `public/asl-model.weights.bin`, and `public/asl-labels.json`
- `public/models/csl/**` and `public/models/asl/wlasl/manifest.json`
- `public/images/**`, `public/logo.png`, `package.json`, `package-lock.json`,
  `next.config.js`, `vercel.json`, and `.vercelignore`
- `asl_service` source, Python requirements, root Dockerfile, and model-install README

Files intentionally excluded from Git include secrets, virtual environments,
the WLASL repository/checkpoint, external datasets, recordings, caches, and
deployment-local state.

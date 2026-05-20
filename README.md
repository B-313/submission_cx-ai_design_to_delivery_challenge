# Design-to-Delivery Accelerator

Prompt Intelligence Engine (PIE) and Retrieval-Augmented Generation (RAG) for pharma client briefs.
This repo is built as a secure Vercel frontend plus Supabase Edge Functions backend, with optional local AI prototypes for development.

## What This Project Is

- A pharma-focused brief generation workflow for content, compliance, and review teams.
- PIE analyzes the project prompt, audience, jurisdiction, risk, tone, and readability.
- RAG provides pharma-specific context from reference documents during generation and review.
- The app supports structured brief generation, governance checks, and submit-ready output.

## Architecture Overview

- `src/`: React + TypeScript + Vite frontend.
- `supabase/functions/`: server-side AI and compliance workflows hosted as Supabase Edge Functions.
- `pie-engine/`: local Python prototype for prompt enrichment and analytics, not required for hosted production.
- `rag engine/`: optional local RAG demo engine, intended for development or offline proof-of-concept only.
- `tests/`: Playwright and Vitest coverage for UI and workflow behavior.

## Hosting Recommendations

- **Frontend:** deploy on Vercel.
- **Backend:** deploy protected APIs on Supabase Edge Functions.
- **Secrets:** keep all API keys and service-role credentials in Vercel/Supabase environment settings only.
- Do not commit `.env` or secret values into Git.

## How the Core Mechanism Works

### PIE (Prompt Intelligence Engine)

PIE is the first layer of the workflow. It evaluates a user brief with:

- jurisdiction detection based on country and prompt content
- risk scoring using pharma-sensitive keywords
- tone analysis against approved brand voice criteria
- readability prediction for patient vs professional audiences
- regulatory guidance injection for GDPR, FDA, EMA/MHRA, and other markets

The classifier logic is implemented in the backend function `supabase/functions/pie-classify/index.ts` and the frontend uses this output to enrich the generation request.

### RAG (Retrieval-Augmented Generation)

RAG supplies context from selected industry documents and reference material.

- `supabase/functions/_shared/pfizerRag.ts` retrieves and formats relevant context.
- The RAG context is embedded into the AI prompt before generation or review.
- This improves accuracy and reduces unsupported claims in pharma-focused copy.

### AI Classifiers and Review Flow

There are two main classifier/review functions:

- `pie-classify`: scores incoming briefs for audience fit, regulatory risk, tone, and readability.
- `review-content`: runs a model-based compliance review and returns structured issues, severity labels, and remediation recommendations.

The system is intentionally hybrid:

- rule-based scoring handles jurisdiction, risk keywords, tone guidance, and readability targets.
- model-based review uses structured tool/function output to return JSON-safe compliance findings.

## Folder Structure

- `src/` — frontend app and workflow UI
- `src/integrations/supabase/` — Supabase client and protected invocation helpers
- `src/components/` — UI panels, builder, review, submission flow
- `supabase/functions/` — deployed edge functions for AI workflows
- `supabase/functions/_shared/` — shared utilities such as RAG retrieval and API auth
- `pie-engine/` — local Python prompt engine prototype
- `rag engine/` — local RAG demo engine
- `tests/` — E2E and unit test suites

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Run frontend

```sh
npm install
npm run dev
```

Open the app at:

- `http://localhost:8080`

### Optional local AI prototype

The local Python prototype is only for development testing. Install dependencies with:

```sh
python -m pip install -r pie-engine/requirements
```

## Environment Configuration

Use `.env` for local frontend settings and keep it out of Git.

Frontend `.env` sample:

```env
VITE_SUPABASE_PROJECT_ID=<your-supabase-project-id>
VITE_SUPABASE_URL=https://<your-supabase-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
VITE_FORCE_LOCAL_AI=false
```

Supabase Edge Function secrets:

- `GROQ_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not store these values in the repository.

## Deployment

### Vercel (frontend)

Deploy the `src/` app on Vercel and configure the environment variables listed above.

### Supabase Edge Functions (backend)

Deploy the functions from `supabase/functions/`:

```sh
supabase functions deploy pie-classify generate-brief review-content notify-reviewer analyze-brief --project-ref <project-ref>
```

## Testing

Run unit tests:

```sh
npm test
```

Run E2E tests:

```sh
npx playwright test
```

## Git Safety Notes

- Never commit `.env` files or secret keys.
- Keep all API credentials in Vercel/Supabase settings.
- Remove large generated or binary artifacts from Git.
- This README uses placeholders only; replace them with your own deployment values.

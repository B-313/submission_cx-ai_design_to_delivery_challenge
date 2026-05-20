# Design-to-Delivery Accelerator

Prompt Intelligence Engine for pharma web content delivery. The app takes a project prompt, enriches it with audience and compliance context, generates a structured brief, builds a landing page draft, runs review checks, and supports governed submission.

## What This Project Is

- Frontend workflow app for content teams, designers, and reviewers.
- Prompt Intelligence Engine (PIE) runs before generation.
- Compliance-focused review step with actionable recommendations.
- Submission step with export and audit-oriented flow.

## Tech Stack

- React + TypeScript + Vite
- Tailwind + shadcn-ui
- Supabase Edge Functions (server-side AI and protected operations)
- Groq-backed generation in edge functions
- Playwright + Vitest for testing

## Live URL

- Production: https://prompt-muse-ai-75.vercel.app

## How To Open Locally

Access key document removed from repository.

Requirements:

- Node.js 18+
- npm

Commands:

```sh
npm install
npm run dev
```

Then open:

- http://localhost:8080

Optional production preview:

```sh
npm run build
npm run preview
```

PIE Python requirements:

```sh
.python.exe -m pip install -r pie-engine/requirements
```

## Required Environment Variables

Frontend (`.env`):

```env
VITE_SUPABASE_PROJECT_ID=kehzckmgtpqkstjohpaf
VITE_SUPABASE_URL=https://kehzckmgtpqkstjohpaf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<supabase-anon-publishable-key>
VITE_FORCE_LOCAL_AI=false
```

Supabase Edge Function secrets:

```env
judge_access=judge_access
GROQ_API_KEY=<valid-groq-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Notes:

- Registration no longer requires a pre-shared judge access key.
- Users can optionally provide their own API key at registration to enable protected AI endpoints.
- Without an API key, the app uses default demo capabilities.
- Protected function calls send `x-api-key` header if a key is provided.

## How To Use The App (Quick Flow)

1. Register with your user details (all fields required).
2. Optional: Enter your own API key if you have one, or leave blank to use demo mode.
3. Fill ideation questionnaire (build type, audience, region).
4. Enter project prompt and clinical/regulatory details.
5. Click `Generate Brief`.
6. Approve brief and move to Builder.
7. Run/complete Review; accept or decline findings.
8. Proceed to Submit; agree to terms and submit.

## Testing

Unit tests:

```sh
npm test
```

E2E tests:

```sh
npx playwright test
```

## Deploy

### Vercel (Frontend)

Set these env vars in Vercel project settings:

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_FORCE_LOCAL_AI=false`

Then deploy from the target Git branch.

### Supabase (Edge Functions)

Deploy functions:

```sh
supabase functions deploy pie-classify generate-brief review-content notify-reviewer analyze-brief --project-ref kehzckmgtpqkstjohpaf
```

## Repository Notes

- Branch used for final submission updates: `working-b38c41e`
- Keep `.env` out of commits.
- Large artifacts (`*.zip`, extracted folders, test outputs) should stay untracked.

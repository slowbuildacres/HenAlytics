# Henalytics

A homestead tracker for gardens, egg layers, and meat chickens.
With cloud accounts, photo uploads, and farmhand sharing.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.local.example` to `.env.local` and fill in your keys.

3. Run locally:
   ```bash
   npm run dev
   ```
   Then open http://localhost:5173

   ⚠️ Note: the in-app feedback/farmhand-invite emails won't actually send during `npm run dev` because the serverless function only runs in production. Test those features by deploying to Vercel and using the live URL.

## Build for production

```bash
npm run build
```

## Environment variables

| Name | Where used | Required? | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Yes | Public — safe in frontend |
| `VITE_SUPABASE_ANON_KEY` | Browser | Yes | Public — safe in frontend |
| `RESEND_API_KEY` | `/api/send-email` (server) | Yes for emails | SECRET — never expose to browser |
| `EMAIL_FROM` | `/api/send-email` | Optional | Default: `onboarding@resend.dev` |
| `OWNER_EMAIL` | `/api/send-email` | Optional | Default: `slowbuildacres@gmail.com` |

In Vercel, all five go in **Settings → Environment Variables**.
The `VITE_*` ones must be exposed to Production+Preview (Development is optional).
The others can be Production+Preview only — they're never used in the browser.

## Deployment

Auto-deploys to Vercel when pushed to the `main` branch on GitHub.

# Henalytics

A homestead tracker for gardens, egg layers, and meat chickens.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` (copy from `.env.local.example`) and fill in your Supabase keys:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Run locally:
   ```bash
   npm run dev
   ```
   Then open http://localhost:5173

## Build for production

```bash
npm run build
```

## Deployment

Auto-deploys to Vercel when pushed to the `main` branch on GitHub.
Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) need to be set in the Vercel project settings.

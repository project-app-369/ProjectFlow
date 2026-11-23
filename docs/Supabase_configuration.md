# Supabase configuration

Project Flow uses Supabase project `dulzdonvhjkvqmthsezh`. The v3 browser app calls `https://dulzdonvhjkvqmthsezh.supabase.co/functions/v1/project-flow-api-v3`.

## Files and values

| File or location | Setting | Purpose |
| --- | --- | --- |
| `app/apps/api-v2/.env.local` (private, ignored by Git) | `SUPABASE_DB_URL` | Session pooler PostgreSQL connection string, including the database password. Used by local API v2 and migration tools. |
| Same file | `API_V2_TOKEN` | Private bearer token for the Node API v2. Keep it on the server or in a server-side proxy. |
| Same file | `SUPABASE_PROJECT_REF` | Project identifier used by `deploy:edge-v3`. This is not a secret. |
| Same file, optional | `SUPABASE_ACCESS_TOKEN` | Personal access token for Supabase CLI deployment. An existing CLI login also works. |
| Same file, optional | `SESSION_SECRET` | Signing secret for password sessions on the Node API. Set the same value as an Edge Function secret when enabling sign-in on API v3. |
| Supabase Edge Function environment | `SUPABASE_DB_URL` | Database connection supplied to the function runtime. Never embed this value in the web app. |
| Supabase Edge Function secrets, optional | `SESSION_SECRET` | Enables password sign-in for the deployed API v3 function. Configure separately from the local env file. |
| `app/apps/web/.env.v3` (public, tracked) | `VITE_API_MODE=sheets`, `VITE_SHEETS_URL` | Selects the current route contract and points builds to API v3. The `sheets` mode name describes the route contract; API v3 stores data in Supabase. |
| Same public file | `VITE_SPREADSHEET_URL` | Link to the original Google Sheet backup. |

`app/apps/api-v2/example.env` is the template for the private file. The local `.env.local` already contains the configured database URL and API v2 token. Its values must remain out of Git, logs, screenshots, and browser builds. The optional deployment and session secrets are only needed for those features.

Do not add a service role key, database password, `API_V2_TOKEN`, `SESSION_SECRET`, or Supabase personal access token to any `VITE_` variable. Vite includes those variables in the static JavaScript. The v3 Edge Function is deployed as a public endpoint; it does not currently require a browser API token. Password sign-in becomes active when `SESSION_SECRET` is set on the function and the app's users have passwords.

To deploy from the workspace, add a personal access token to the private `.env.local` or authenticate with `npx supabase login`, then run `pnpm --filter @projectflow/api-v2 deploy:edge-v3` from `app/`. The command loads `.env.local` and uses `SUPABASE_PROJECT_REF`. To build the CDN package, run `pnpm --filter @projectflow/web build:static`; it reads the public `.env.v3` endpoint.

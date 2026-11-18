Project Flow v3 — static distribution
=====================================

Upload every file in this folder to the same directory on any HTTPS shared host or CDN. Open index.html through the host URL. The bundle uses hash-based routes, so it works under a subdirectory without server rewrite rules.

API: https://dulzdonvhjkvqmthsezh.supabase.co/functions/v1/project-flow-api-v3
Data: Supabase Project Flow. The original Google Sheet remains a backup.

This build retains public editing. Anyone who can open the app can select a demo identity and edit permitted records; the static files contain no database password or server-side secret. Use HTTPS for the host. To restrict editing later, add real Supabase authentication and authorization before redistributing.

The service worker is not registered in this portable build, preventing path conflicts when the app is hosted under a subdirectory.
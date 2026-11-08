# 0001 — Stack, development database and catalog

Status: accepted (first slice)

## Decisions

- **Stack follows spec §11.1**: React + Vite, TanStack Query/Table, ECharts, NestJS, PostgreSQL, REST. Redis/BullMQ and S3 storage are deferred until a module needs jobs or files. Versions are recorded in `pnpm-lock.yaml`.
- **ORM: Drizzle.** Typed SQL with committed migrations, and one schema runs on both node-postgres and PGlite.
- **Development database: PGlite fallback.** Docker was not available on the first development machine, and a Postgres install should not be a prerequisite for a first run. With no `DATABASE_URL` the API runs on embedded PGlite (PostgreSQL compiled to WASM); with one it uses PostgreSQL. Both run the same migrations. Production uses PostgreSQL only.
- **TypeScript pinned to 5.9.** TypeScript 7 ships only the `tsc` executable and the Nest CLI needs the compiler API. Revisit when Nest supports it.
- **Module catalog is code, project state is data.** Manifests (key, phase, availability, dependencies) live in `registry/catalog.ts` so they are versioned with the code that implements them (spec MOD-01, MOD-07). Per-project operation state and its change log are tables (MOD-02, MOD-03).
- **Defaults**: modules that are Available or In development start Enabled; later-phase modules start Disabled but can be switched on and show a placeholder. Planned items are visible only in Settings until enabled (NAV-01).
- **Flat module layout for now.** One Nest module with a folder per feature. Split into Nest modules with explicit boundaries once a second module owns its own tables (ARCH-01).
- **Port 3100** for the API, because 3000 is frequently occupied on developer machines.

## Known gaps

No identity: requests run as `demo-user` and the project comes from the URL. Spec §2 (roles, project membership, effective access) must land before any real data is loaded. Reference data is seeded from a JSON extract of the workbooks; an import pipeline with validation and idempotency keys (API-02) replaces that.

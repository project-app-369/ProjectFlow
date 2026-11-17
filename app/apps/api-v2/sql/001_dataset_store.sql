-- Private application schema. Supabase's Data API exposes only configured schemas;
-- do not add projectflow_v2 to Exposed Schemas. API v2 uses a server-side PG connection.
create schema if not exists projectflow_v2;

create table if not exists projectflow_v2.datasets (
  name text primary key,
  gid integer not null unique,
  header jsonb not null check (jsonb_typeof(header) = 'array'),
  updated_at timestamptz not null default now()
);

create table if not exists projectflow_v2.dataset_rows (
  dataset text not null references projectflow_v2.datasets(name) on delete cascade,
  position integer not null check (position >= 0),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (dataset, position)
);

create index if not exists dataset_rows_project_idx
  on projectflow_v2.dataset_rows (dataset, (data ->> 'projectId'));

create table if not exists projectflow_v2.imports (
  id bigserial primary key,
  source text not null,
  imported_at timestamptz not null default now(),
  sheet_count integer not null,
  row_count integer not null,
  sha256 text not null
);

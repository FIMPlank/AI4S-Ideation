-- Minimal stand-in for the parts of Supabase the migrations use, so the RLS test
-- runs on plain Postgres (docker postgres:17). Not needed with `supabase start`.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema public, auth, extensions to anon, authenticated;

create table auth.users (
  id uuid primary key,
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz default now()
);

-- like Supabase: the JWT's "sub" claim
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

-- Supabase's default privileges on public (RLS is what protects the tables)
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

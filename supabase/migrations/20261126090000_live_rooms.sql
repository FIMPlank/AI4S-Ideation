-- Live-Raum: rooms, members, workshop data, RLS and RPCs.
-- Plan: "Live-Raum: Plan" (Claude Doc). Mirrors src/workshop/rules.ts.
--
-- Security model in short:
--   * Every browser is an anonymous Supabase user (role "authenticated").
--   * Rooms are never listable: only members read a room's rows (RLS).
--   * Room state (step, timer, groups, draws, reveal, close) changes only through
--     SECURITY DEFINER RPCs that check the caller is the room's facilitator.
--   * Votes and ratings: each person reads only their own until the facilitator
--     reveals that step.
--   * Closed rooms are read-only. Rooms are deleted 30 days after creation.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Pure helpers (same rules as src/workshop/settings.ts and program.ts)
-- ---------------------------------------------------------------------------

create or replace function public.valid_settings(s jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(s) = 'object'
    and jsonb_typeof(s->'groupCount') = 'number' and (s->>'groupCount')::numeric between 1 and 7
    and (s->>'groupCount')::numeric = trunc((s->>'groupCount')::numeric)
    and jsonb_typeof(s->'dotsPerPerson') = 'number' and (s->>'dotsPerPerson')::numeric between 2 and 5
    and (s->>'dotsPerPerson')::numeric = trunc((s->>'dotsPerPerson')::numeric)
    and jsonb_typeof(s->'timerPresetsMin') = 'array'
    and jsonb_array_length(s->'timerPresetsMin') between 1 and 6
    and not exists (
      select 1 from jsonb_array_elements(s->'timerPresetsMin') e
      where jsonb_typeof(e) <> 'number' or e::text::numeric not between 1 and 120
    )
    and jsonb_typeof(s->'klaerung'->'enabled') = 'boolean'
    and jsonb_typeof(s->'klaerung'->'minutes') = 'number' and (s->'klaerung'->>'minutes')::numeric between 1 and 60
    and jsonb_typeof(s->'pitch'->'enabled') = 'boolean'
    and jsonb_typeof(s->'pitch'->'minutesPerGroup') = 'number' and (s->'pitch'->>'minutesPerGroup')::numeric between 1 and 15
    and pg_column_size(s) < 2000
$$;

-- The flat step list of a program: lobby → enabled steps of each mode → ende.
create or replace function public.workshop_steps(p_program text, s jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with modes(mode, ord) as (
    select * from (values
      ('inspiration-2', 1), ('inspiration-1', 2), ('strategie', 3)
    ) v(mode, ord)
    where p_program = 'komplett' or v.mode = p_program
  ),
  steps(mode, key, ord) as (
    values
      ('inspiration-2', 'i2.lesen', 1), ('inspiration-2', 'i2.markieren', 2),
      ('inspiration-2', 'i2.aufloesen', 3), ('inspiration-2', 'i2.diskutieren', 4),
      ('inspiration-1', 'i1.gruppen', 1), ('inspiration-1', 'i1.ziehen', 2),
      ('inspiration-1', 'i1.lesen', 3), ('inspiration-1', 'i1.klaerung', 4),
      ('inspiration-1', 'i1.entwickeln', 5), ('inspiration-1', 'i1.pitch', 6),
      ('strategie', 'st.auswaehlen', 1), ('strategie', 'st.diskutieren', 2),
      ('strategie', 'st.bewerten', 3), ('strategie', 'st.umsetzung', 4)
  )
  select array['lobby'] || coalesce(array_agg(st.key order by m.ord, st.ord), '{}') || array['ende']
  from modes m
  join steps st on st.mode = m.mode
  where (st.key <> 'i1.klaerung' or coalesce((s->'klaerung'->>'enabled')::boolean, true))
    and (st.key <> 'i1.pitch' or coalesce((s->'pitch'->>'enabled')::boolean, true))
$$;

-- ---------------------------------------------------------------------------
-- Tables. Random uuid keys everywhere: Realtime sends DELETE events unfiltered
-- with only the primary key, so a key like (user, card) would leak hidden votes.
-- ---------------------------------------------------------------------------

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  title text not null default '' check (char_length(title) <= 120),
  program text not null check (program in ('inspiration-1', 'inspiration-2', 'strategie', 'komplett')),
  settings jsonb not null check (public.valid_settings(settings)),
  status text not null default 'lobby' check (status in ('lobby', 'running', 'closed')),
  step_key text not null default 'lobby' check (step_key = any (public.workshop_steps(program, settings))),
  step_started_at timestamptz not null default now(),
  timer_duration_ms integer check (timer_duration_ms between 0 and 21600000),
  timer_ends_at timestamptz,
  timer_paused_ms integer check (timer_paused_ms between 0 and 21600000),
  revealed text[] not null default '{}' check (cardinality(revealed) <= 20),
  pitch_group smallint check (pitch_group between 1 and 7),
  -- prepared for the research opt-in (later prompt); nothing sets it yet
  research_mode boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
comment on table public.rooms is 'Live-Raum workshop rooms. Never listable; read by members (RLS), changed only via RPCs. Deleted 30 days after creation.';

-- Facilitator secret, hashed. No policies: invisible to every client.
create table public.room_secrets (
  room_id uuid primary key references public.rooms on delete cascade,
  secret_hash bytea not null
);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('facilitator', 'participant')),
  display_name text not null check (char_length(display_name) between 1 and 40),
  group_no smallint check (group_no between 1 and 7),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  research_consent boolean not null default false,
  unique (room_id, user_id)
);
create index on public.room_members (user_id);

create table public.group_draws (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  group_no smallint not null check (group_no between 1 and 7),
  archetype_id text not null check (archetype_id ~ '^a[1-7]$'),
  method text not null check (method in ('random', 'manual', 'priorisiert')),
  drawn_by uuid,
  drawn_at timestamptz not null default now(),
  unique (room_id, group_no),
  -- never the same archetype twice in a room, even with simultaneous draws
  unique (room_id, archetype_id)
);

create table public.selections (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  kind text not null check (kind in ('relevant_archetype', 'strategy_target')),
  ref_type text not null check (ref_type in ('archetype', 'card', 'idea')),
  ref_id text not null check (char_length(ref_id) between 1 and 64),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (room_id, kind, ref_type, ref_id),
  unique (room_id, id)
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  group_no smallint not null check (group_no between 1 and 7),
  -- for the Realtime filter: phones listen to their own group only
  room_group text generated always as (room_id::text || ':' || group_no::text) stored,
  title text not null default '' check (char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 1000),
  inspired_by text check (inspired_by ~ '^a[1-7]-case-[1-4]$'),
  target text not null default '' check (char_length(target) <= 500),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ideas (room_id, group_no);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  user_id uuid not null default auth.uid(),
  card_id text not null check (card_id ~ '^a[1-7]-case-[1-4]$'),
  created_at timestamptz not null default now(),
  unique (room_id, user_id, card_id)
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  selection_id uuid not null,
  user_id uuid not null default auth.uid(),
  criterion text not null check (criterion in ('nachhaltigkeit', 'umsetzbarkeit', 'geschaeftsnutzen')),
  score smallint not null check (score between 1 and 5),
  updated_at timestamptz not null default now(),
  foreign key (room_id, selection_id) references public.selections (room_id, id) on delete cascade,
  unique (selection_id, user_id, criterion)
);
create index on public.ratings (room_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  step_key text not null check (step_key ~ '^[a-z0-9.]{1,40}$'),
  topic text not null check (topic ~ '^[a-z0-9_-]{1,40}$'),
  selection_id uuid,
  body text not null check (char_length(body) between 1 and 500),
  author_id uuid not null default auth.uid(),
  by_facilitator boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (room_id, selection_id) references public.selections (room_id, id) on delete cascade
);
create index on public.notes (room_id);

create table public.impl_steps (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  selection_id uuid not null,
  what text not null default '' check (char_length(what) <= 300),
  who text not null default '' check (char_length(who) <= 80),
  due date,
  position integer not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (room_id, selection_id) references public.selections (room_id, id) on delete cascade
);
create index on public.impl_steps (room_id);

-- Failed join/claim attempts, to slow down code guessing. No policies.
create table public.join_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index on public.join_attempts (user_id, at);

-- ---------------------------------------------------------------------------
-- Membership helpers for policies (SECURITY DEFINER: they read room_members
-- without recursing into its own policy)
-- ---------------------------------------------------------------------------

create or replace function public.is_member(p_room uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.room_members m where m.room_id = p_room and m.user_id = auth.uid()) $$;

create or replace function public.is_facilitator(p_room uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.room_members m where m.room_id = p_room and m.user_id = auth.uid() and m.role = 'facilitator') $$;

create or replace function public.my_group(p_room uuid)
returns smallint language sql stable security definer set search_path = ''
as $$ select m.group_no from public.room_members m where m.room_id = p_room and m.user_id = auth.uid() $$;

create or replace function public.room_open(p_room uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.rooms r where r.id = p_room and r.status <> 'closed') $$;

create or replace function public.room_step(p_room uuid)
returns text language sql stable security definer set search_path = ''
as $$ select r.step_key from public.rooms r where r.id = p_room $$;

create or replace function public.is_revealed(p_room uuid, p_step text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.rooms r where r.id = p_room and p_step = any (r.revealed)) $$;

-- Raises a client-readable error; the message is a DenyReason of src/workshop/rules.ts.
create or replace function public.deny(reason text)
returns void language plpgsql set search_path = ''
as $$ begin raise exception '%', reason using errcode = 'P0001', hint = 'workshop'; end $$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

create trigger ideas_touch before update on public.ideas for each row execute function public.touch_updated_at();
create trigger ratings_touch before update on public.ratings for each row execute function public.touch_updated_at();

-- ≤ 20 ideas per group
create or replace function public.ideas_limit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.room_id::text || ':' || new.group_no, 0));
  if (select count(*) from public.ideas i where i.room_id = new.room_id and i.group_no = new.group_no) >= 20 then
    perform public.deny('too-many-ideas');
  end if;
  return new;
end $$;
create trigger ideas_limit before insert on public.ideas for each row execute function public.ideas_limit();

-- dot budget per person
create or replace function public.votes_limit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare dots integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.room_id::text || ':' || new.user_id::text, 0));
  select (r.settings->>'dotsPerPerson')::integer into dots from public.rooms r where r.id = new.room_id;
  if (select count(*) from public.votes v where v.room_id = new.room_id and v.user_id = new.user_id) >= dots then
    perform public.deny('no-dots-left');
  end if;
  return new;
end $$;
create trigger votes_limit before insert on public.votes for each row execute function public.votes_limit();

-- ratings only on strategy items
create or replace function public.ratings_target()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.selections s where s.id = new.selection_id and s.kind = 'strategy_target') then
    perform public.deny('not-found');
  end if;
  return new;
end $$;
create trigger ratings_target before insert on public.ratings for each row execute function public.ratings_target();

-- notes: the server decides whether a note is the facilitator's
create or replace function public.notes_author()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.by_facilitator := public.is_facilitator(new.room_id);
  new.created_at := now();
  return new;
end $$;
create trigger notes_author before insert on public.notes for each row execute function public.notes_author();

-- ---------------------------------------------------------------------------
-- Privileges + RLS
-- ---------------------------------------------------------------------------

revoke all on public.rooms, public.room_secrets, public.room_members, public.group_draws, public.selections,
  public.ideas, public.votes, public.ratings, public.notes, public.impl_steps, public.join_attempts
  from anon, authenticated;

grant select on public.rooms, public.room_members, public.group_draws to authenticated;
grant select, insert, delete on public.selections, public.ideas, public.votes, public.ratings, public.notes, public.impl_steps to authenticated;
-- column-level: ids, rooms and authors can't be changed after insert
grant update (position) on public.selections to authenticated;
grant update (title, description, inspired_by, target) on public.ideas to authenticated;
grant update (score) on public.ratings to authenticated;
grant update (body) on public.notes to authenticated;
grant update (what, who, due, position) on public.impl_steps to authenticated;

alter table public.rooms enable row level security;
alter table public.room_secrets enable row level security;
alter table public.room_members enable row level security;
alter table public.group_draws enable row level security;
alter table public.selections enable row level security;
alter table public.ideas enable row level security;
alter table public.votes enable row level security;
alter table public.ratings enable row level security;
alter table public.notes enable row level security;
alter table public.impl_steps enable row level security;
alter table public.join_attempts enable row level security;

create policy "members read their room" on public.rooms for select to authenticated
  using ((select public.is_member(id)));

create policy "members read members" on public.room_members for select to authenticated
  using ((select public.is_member(room_id)));

create policy "members read draws" on public.group_draws for select to authenticated
  using ((select public.is_member(room_id)));

create policy "members read selections" on public.selections for select to authenticated
  using ((select public.is_member(room_id)));
create policy "facilitator writes selections" on public.selections for insert to authenticated
  with check ((select public.is_facilitator(room_id)) and (select public.room_open(room_id)));
create policy "facilitator orders selections" on public.selections for update to authenticated
  using ((select public.is_facilitator(room_id)) and (select public.room_open(room_id)));
create policy "facilitator removes selections" on public.selections for delete to authenticated
  using ((select public.is_facilitator(room_id)) and (select public.room_open(room_id)));

create policy "members read ideas" on public.ideas for select to authenticated
  using ((select public.is_member(room_id)));
create policy "group adds ideas" on public.ideas for insert to authenticated
  with check (
    created_by = (select auth.uid()) and (select public.room_open(room_id))
    and ((select public.is_facilitator(room_id)) or group_no = (select public.my_group(room_id)))
  );
create policy "group edits ideas" on public.ideas for update to authenticated
  using ((select public.room_open(room_id)) and ((select public.is_facilitator(room_id)) or group_no = (select public.my_group(room_id))));
create policy "group deletes ideas" on public.ideas for delete to authenticated
  using ((select public.room_open(room_id)) and ((select public.is_facilitator(room_id)) or group_no = (select public.my_group(room_id))));

create policy "own votes, all after reveal" on public.votes for select to authenticated
  using (
    (user_id = (select auth.uid()) and (select public.is_member(room_id)))
    or ((select public.is_member(room_id)) and (select public.is_revealed(room_id, 'i2.markieren')))
  );
create policy "vote while marking" on public.votes for insert to authenticated
  with check (
    user_id = (select auth.uid()) and (select public.is_member(room_id)) and (select public.room_open(room_id))
    and (select public.room_step(room_id)) = 'i2.markieren'
  );
create policy "unvote while marking" on public.votes for delete to authenticated
  using (
    user_id = (select auth.uid()) and (select public.room_open(room_id))
    and (select public.room_step(room_id)) = 'i2.markieren'
  );

create policy "own ratings, all after reveal" on public.ratings for select to authenticated
  using (
    (user_id = (select auth.uid()) and (select public.is_member(room_id)))
    or ((select public.is_member(room_id)) and (select public.is_revealed(room_id, 'st.bewerten')))
  );
create policy "rate while rating" on public.ratings for insert to authenticated
  with check (
    user_id = (select auth.uid()) and (select public.is_member(room_id)) and (select public.room_open(room_id))
    and (select public.room_step(room_id)) = 'st.bewerten'
  );
create policy "re-rate while rating" on public.ratings for update to authenticated
  using (
    user_id = (select auth.uid()) and (select public.room_open(room_id))
    and (select public.room_step(room_id)) = 'st.bewerten'
  );
create policy "unrate while rating" on public.ratings for delete to authenticated
  using (
    user_id = (select auth.uid()) and (select public.room_open(room_id))
    and (select public.room_step(room_id)) = 'st.bewerten'
  );

create policy "members read notes" on public.notes for select to authenticated
  using ((select public.is_member(room_id)));
create policy "members add notes" on public.notes for insert to authenticated
  with check (author_id = (select auth.uid()) and (select public.is_member(room_id)) and (select public.room_open(room_id)));
create policy "authors edit notes" on public.notes for update to authenticated
  using (author_id = (select auth.uid()) and (select public.room_open(room_id)));
create policy "authors or facilitator delete notes" on public.notes for delete to authenticated
  using ((author_id = (select auth.uid()) or (select public.is_facilitator(room_id))) and (select public.room_open(room_id)));

create policy "members read steps" on public.impl_steps for select to authenticated
  using ((select public.is_member(room_id)));
create policy "members add steps" on public.impl_steps for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.is_member(room_id)) and (select public.room_open(room_id)));
create policy "authors or facilitator edit steps" on public.impl_steps for update to authenticated
  using ((created_by = (select auth.uid()) or (select public.is_facilitator(room_id))) and (select public.room_open(room_id)));
create policy "authors or facilitator delete steps" on public.impl_steps for delete to authenticated
  using ((created_by = (select auth.uid()) or (select public.is_facilitator(room_id))) and (select public.room_open(room_id)));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.require_user()
returns uuid language plpgsql stable set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then perform public.deny('not-member'); end if;
  return uid;
end $$;

-- 20 failed attempts per 10 minutes and user
create or replace function public.check_attempts(uid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.join_attempts a where a.user_id = uid and a.at > now() - interval '10 minutes') >= 20 then
    perform public.deny('rate-limited');
  end if;
end $$;

create or replace function public.facilitator_room(p_room uuid)
returns public.rooms language plpgsql security definer set search_path = ''
as $$
declare r public.rooms;
begin
  perform public.require_user();
  select * into r from public.rooms where id = p_room for update;
  if not found or not public.is_member(p_room) then perform public.deny('not-found'); end if;
  if not public.is_facilitator(p_room) then perform public.deny('not-facilitator'); end if;
  if r.status = 'closed' then perform public.deny('closed'); end if;
  return r;
end $$;

create or replace function public.create_room(p_title text, p_program text, p_settings jsonb)
returns table (room_id uuid, code text, facilitator_secret text)
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_secret text;
  v_room uuid;
  bytes bytea;
begin
  if (select count(*) from public.rooms r where r.created_by = uid and r.created_at > now() - interval '1 day') >= 10 then
    perform public.deny('rate-limited');
  end if;
  if char_length(coalesce(p_title, '')) > 120 then perform public.deny('too-long'); end if;
  if not public.valid_settings(p_settings) then perform public.deny('invalid'); end if;
  for attempt in 1..20 loop
    bytes := extensions.gen_random_bytes(6);
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
    end loop;
    begin
      insert into public.rooms (code, title, program, settings, created_by)
      values (v_code, trim(coalesce(p_title, '')), p_program, p_settings, uid)
      returning id into v_room;
      exit;
    exception when unique_violation then
      v_room := null;
    end;
  end loop;
  if v_room is null then perform public.deny('invalid'); end if;
  v_secret := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.room_secrets (room_id, secret_hash) values (v_room, extensions.digest(v_secret, 'sha256'));
  insert into public.room_members (room_id, user_id, role, display_name) values (v_room, uid, 'facilitator', 'Moderation');
  return query select v_room, v_code, v_secret;
end $$;

create or replace function public.join_room(p_code text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  r public.rooms;
  v_name text := regexp_replace(trim(coalesce(p_display_name, '')), '\s+', ' ', 'g');
begin
  perform public.check_attempts(uid);
  select * into r from public.rooms where rooms.code = upper(regexp_replace(p_code, '[\s-]', '', 'g')) for update;
  if not found then
    insert into public.join_attempts (user_id) values (uid);
    perform public.deny('not-found');
  end if;
  if char_length(v_name) = 0 then perform public.deny('invalid'); end if;
  if char_length(v_name) > 40 then perform public.deny('too-long'); end if;
  if exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = uid) then
    if r.status <> 'closed' then
      update public.room_members set display_name = v_name, last_seen_at = now() where room_id = r.id and user_id = uid;
    end if;
    return r.id;
  end if;
  if r.status = 'closed' then perform public.deny('closed'); end if;
  if (select count(*) from public.room_members m where m.room_id = r.id and m.role = 'participant') >= 80 then
    perform public.deny('room-full');
  end if;
  insert into public.room_members (room_id, user_id, role, display_name) values (r.id, uid, 'participant', v_name);
  return r.id;
end $$;

create or replace function public.claim_facilitator(p_code text, p_secret text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  v_room uuid;
begin
  perform public.check_attempts(uid);
  select r.id into v_room
  from public.rooms r join public.room_secrets s on s.room_id = r.id
  where r.code = upper(p_code) and s.secret_hash = extensions.digest(coalesce(p_secret, ''), 'sha256');
  if v_room is null then
    insert into public.join_attempts (user_id) values (uid);
    perform public.deny('not-found');
  end if;
  insert into public.room_members (room_id, user_id, role, display_name)
  values (v_room, uid, 'facilitator', 'Moderation')
  on conflict (room_id, user_id) do update set role = 'facilitator', group_no = null;
  return v_room;
end $$;

-- the room id for a code, for members only (a reload with a saved session)
create or replace function public.my_room(p_code text)
returns uuid language sql stable security definer set search_path = ''
as $$
  select r.id from public.rooms r
  join public.room_members m on m.room_id = r.id and m.user_id = auth.uid()
  where r.code = upper(p_code)
$$;

create or replace function public.rename_me(p_room uuid, p_display_name text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_name text := regexp_replace(trim(coalesce(p_display_name, '')), '\s+', ' ', 'g');
begin
  perform public.require_user();
  if not public.room_open(p_room) then perform public.deny('closed'); end if;
  if char_length(v_name) not between 1 and 40 then perform public.deny('invalid'); end if;
  update public.room_members set display_name = v_name where room_id = p_room and user_id = auth.uid();
  if not found then perform public.deny('not-member'); end if;
end $$;

create or replace function public.set_step(p_room uuid, p_expected text, p_next text)
returns void language plpgsql security definer set search_path = ''
as $$
declare r public.rooms := public.facilitator_room(p_room);
begin
  if r.step_key <> p_expected then perform public.deny('stale-step'); end if;
  if not (p_next = any (public.workshop_steps(r.program, r.settings))) then perform public.deny('invalid'); end if;
  update public.rooms set
    step_key = p_next,
    step_started_at = now(),
    timer_duration_ms = null, timer_ends_at = null, timer_paused_ms = null,
    pitch_group = case when p_next = 'i1.pitch' then coalesce(pitch_group, 1) else null end,
    status = case when p_next <> 'lobby' and status = 'lobby' then 'running' else status end,
    -- entering "Auflösen" reveals the votes
    revealed = case when p_next = 'i2.aufloesen' and not ('i2.markieren' = any (revealed))
      then array_append(revealed, 'i2.markieren') else revealed end
  where id = p_room;
end $$;

create or replace function public.set_timer(p_room uuid, p_action text, p_ms integer default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare r public.rooms := public.facilitator_room(p_room);
begin
  if p_action in ('start', 'add') and (p_ms is null or p_ms <= 0 or p_ms > 10800000) then perform public.deny('invalid'); end if;
  case p_action
    when 'start' then
      update public.rooms set timer_duration_ms = p_ms, timer_ends_at = now() + p_ms * interval '1 millisecond', timer_paused_ms = null where id = p_room;
    when 'pause' then
      if r.timer_ends_at is not null then
        update public.rooms set timer_paused_ms = greatest(0, (extract(epoch from (r.timer_ends_at - now())) * 1000)::integer), timer_ends_at = null where id = p_room;
      end if;
    when 'resume' then
      if r.timer_paused_ms is not null then
        update public.rooms set timer_ends_at = now() + r.timer_paused_ms * interval '1 millisecond', timer_paused_ms = null where id = p_room;
      end if;
    when 'add' then
      if r.timer_ends_at is not null then
        update public.rooms set timer_duration_ms = coalesce(timer_duration_ms, 0) + p_ms,
          timer_ends_at = greatest(r.timer_ends_at, now()) + p_ms * interval '1 millisecond' where id = p_room;
      elsif r.timer_paused_ms is not null then
        update public.rooms set timer_duration_ms = coalesce(timer_duration_ms, 0) + p_ms, timer_paused_ms = r.timer_paused_ms + p_ms where id = p_room;
      else
        update public.rooms set timer_duration_ms = p_ms, timer_ends_at = now() + p_ms * interval '1 millisecond' where id = p_room;
      end if;
    when 'clear' then
      update public.rooms set timer_duration_ms = null, timer_ends_at = null, timer_paused_ms = null where id = p_room;
    else
      perform public.deny('invalid');
  end case;
end $$;

create or replace function public.update_settings(p_room uuid, p_settings jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  r public.rooms := public.facilitator_room(p_room);
  n integer;
begin
  if not public.valid_settings(p_settings) then perform public.deny('invalid'); end if;
  if not (r.step_key = any (public.workshop_steps(r.program, p_settings))) then perform public.deny('invalid'); end if;
  n := (p_settings->>'groupCount')::integer;
  update public.rooms set settings = p_settings where id = p_room;
  update public.room_members set group_no = null where room_id = p_room and group_no > n;
  delete from public.group_draws where room_id = p_room and group_no > n;
end $$;

-- p_assignment: {"<member id>": <group no or null>, ...}
create or replace function public.set_groups(p_room uuid, p_assignment jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  r public.rooms := public.facilitator_room(p_room);
  n integer := (r.settings->>'groupCount')::integer;
  e record;
  g integer;
begin
  if jsonb_typeof(p_assignment) <> 'object' then perform public.deny('invalid'); end if;
  for e in select * from jsonb_each(p_assignment) loop
    if jsonb_typeof(e.value) = 'null' then g := null;
    elsif jsonb_typeof(e.value) = 'number' then g := (e.value::text)::integer;
    else perform public.deny('invalid');
    end if;
    if g is not null and (g < 1 or g > n) then perform public.deny('invalid'); end if;
    update public.room_members set group_no = g
    where room_id = p_room and id = (e.key)::uuid and role = 'participant';
  end loop;
end $$;

-- "Ziehen": a group member or the facilitator; the server picks a free archetype.
create or replace function public.draw_archetype(p_room uuid, p_group integer)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  r public.rooms;
  v_arch text;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or not public.is_member(p_room) then perform public.deny('not-found'); end if;
  if r.status = 'closed' then perform public.deny('closed'); end if;
  if not (public.is_facilitator(p_room) or public.my_group(p_room) = p_group) then perform public.deny('not-your-group'); end if;
  if p_group < 1 or p_group > (r.settings->>'groupCount')::integer then perform public.deny('invalid'); end if;
  if exists (select 1 from public.group_draws d where d.room_id = p_room and d.group_no = p_group) then perform public.deny('taken'); end if;
  select a into v_arch
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']) a
  where not exists (select 1 from public.group_draws d where d.room_id = p_room and d.archetype_id = a)
  order by random() limit 1;
  if v_arch is null then perform public.deny('taken'); end if;
  insert into public.group_draws (room_id, group_no, archetype_id, method, drawn_by) values (p_room, p_group, v_arch, 'random', uid);
  return v_arch;
end $$;

-- Manual override (or null to reset).
create or replace function public.set_draw(p_room uuid, p_group integer, p_archetype text, p_method text default 'manual')
returns void language plpgsql security definer set search_path = ''
as $$
declare r public.rooms := public.facilitator_room(p_room);
begin
  if p_group < 1 or p_group > (r.settings->>'groupCount')::integer then perform public.deny('invalid'); end if;
  delete from public.group_draws where room_id = p_room and group_no = p_group;
  if p_archetype is null then return; end if;
  begin
    insert into public.group_draws (room_id, group_no, archetype_id, method, drawn_by) values (p_room, p_group, p_archetype, p_method, auth.uid());
  exception
    when unique_violation then perform public.deny('taken');
    when check_violation then perform public.deny('invalid');
  end;
end $$;

create or replace function public.reveal(p_room uuid, p_step text)
returns void language plpgsql security definer set search_path = ''
as $$
declare r public.rooms := public.facilitator_room(p_room);
begin
  if p_step not in ('i2.markieren', 'st.bewerten') then perform public.deny('invalid'); end if;
  if not (p_step = any (r.revealed)) then
    update public.rooms set revealed = array_append(revealed, p_step) where id = p_room;
  end if;
end $$;

create or replace function public.set_pitch_group(p_room uuid, p_group integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare r public.rooms := public.facilitator_room(p_room);
begin
  if p_group is not null and (p_group < 1 or p_group > (r.settings->>'groupCount')::integer) then perform public.deny('invalid'); end if;
  update public.rooms set pitch_group = p_group, timer_duration_ms = null, timer_ends_at = null, timer_paused_ms = null where id = p_room;
end $$;

create or replace function public.close_room(p_room uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.facilitator_room(p_room);
  update public.rooms set status = 'closed', timer_duration_ms = null, timer_ends_at = null, timer_paused_ms = null where id = p_room;
end $$;

-- Progress before reveal: counts only, never the distribution.
create or replace function public.step_progress(p_room uuid)
returns table (participants integer, voted integer, rated integer)
language sql stable security definer set search_path = ''
as $$
  with r as (select * from public.rooms where id = p_room and public.is_member(p_room)),
  p as (select m.user_id from public.room_members m, r where m.room_id = r.id and m.role = 'participant'),
  targets as (select s.id from public.selections s, r where s.room_id = r.id and s.kind = 'strategy_target')
  select
    (select count(*) from p)::integer,
    (select count(*) from p where (select count(*) from public.votes v, r where v.room_id = r.id and v.user_id = p.user_id)
      >= (select (settings->>'dotsPerPerson')::integer from r))::integer,
    (select count(*) from p where (select count(*) from targets) > 0 and
      (select count(*) from public.ratings x where x.selection_id in (select id from targets) and x.user_id = p.user_id)
      = (select count(*) * 3 from targets))::integer
  from r
$$;

-- Everything the caller may read, in one round trip (SECURITY INVOKER: RLS applies).
create or replace function public.room_snapshot(p_room uuid)
returns jsonb language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'room', (select to_jsonb(r) from public.rooms r where r.id = p_room),
    'members', coalesce((select jsonb_agg(to_jsonb(m) order by m.joined_at) from public.room_members m where m.room_id = p_room), '[]'),
    'draws', coalesce((select jsonb_agg(to_jsonb(d) order by d.group_no) from public.group_draws d where d.room_id = p_room), '[]'),
    'ideas', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at) from public.ideas i where i.room_id = p_room), '[]'),
    'votes', coalesce((select jsonb_agg(to_jsonb(v)) from public.votes v where v.room_id = p_room), '[]'),
    'ratings', coalesce((select jsonb_agg(to_jsonb(x)) from public.ratings x where x.room_id = p_room), '[]'),
    'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at) from public.notes n where n.room_id = p_room), '[]'),
    'selections', coalesce((select jsonb_agg(to_jsonb(s) order by s.position) from public.selections s where s.room_id = p_room), '[]'),
    'implSteps', coalesce((select jsonb_agg(to_jsonb(s) order by s.position) from public.impl_steps s where s.room_id = p_room), '[]'),
    'serverNow', now()
  )
$$;

create or replace function public.server_now()
returns timestamptz language sql stable set search_path = '' as $$ select now() $$;

-- Keep-alive for the free plan (GitHub Actions calls it every 3 days).
create or replace function public.ping()
returns text language sql stable set search_path = '' as $$ select 'ok'::text $$;

-- Daily cleanup (pg_cron, see the next migration): rooms after 30 days, anonymous
-- users without rooms after 30 days, old join attempts.
create or replace function public.expire_rooms()
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  delete from public.rooms where created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  delete from public.join_attempts where at < now() - interval '1 day';
  delete from auth.users u
  where u.is_anonymous
    and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
    and not exists (select 1 from public.room_members m where m.user_id = u.id);
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Function privileges: nothing for anon except the clock and the ping
-- ---------------------------------------------------------------------------

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'valid_settings', 'workshop_steps', 'is_member', 'is_facilitator', 'my_group', 'room_open', 'room_step',
      'is_revealed', 'deny', 'touch_updated_at', 'ideas_limit', 'votes_limit', 'ratings_target', 'notes_author',
      'require_user', 'check_attempts', 'facilitator_room', 'create_room', 'join_room', 'claim_facilitator', 'my_room',
      'rename_me', 'set_step', 'set_timer', 'update_settings', 'set_groups', 'draw_archetype', 'set_draw', 'reveal',
      'set_pitch_group', 'close_room', 'step_progress', 'room_snapshot', 'server_now', 'ping', 'expire_rooms')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function
  public.is_member(uuid), public.is_facilitator(uuid), public.my_group(uuid), public.room_open(uuid),
  public.room_step(uuid), public.is_revealed(uuid, text), public.valid_settings(jsonb), public.workshop_steps(text, jsonb),
  public.create_room(text, text, jsonb), public.join_room(text, text), public.claim_facilitator(text, text),
  public.my_room(text), public.rename_me(uuid, text), public.set_step(uuid, text, text), public.set_timer(uuid, text, integer),
  public.update_settings(uuid, jsonb), public.set_groups(uuid, jsonb), public.draw_archetype(uuid, integer),
  public.set_draw(uuid, integer, text, text), public.reveal(uuid, text), public.set_pitch_group(uuid, integer),
  public.close_room(uuid), public.step_progress(uuid), public.room_snapshot(uuid)
  to authenticated;
grant execute on function public.server_now(), public.ping() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: Postgres Changes for the room tables (RLS applies per subscriber)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.rooms, public.room_members, public.group_draws, public.selections,
      public.ideas, public.votes, public.ratings, public.notes, public.impl_steps;
  end if;
end $$;

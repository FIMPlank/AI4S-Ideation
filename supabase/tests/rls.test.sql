-- RLS and RPC test with several anonymous users. Run with scripts/rls-test.sh.
-- Everything runs in one transaction and is rolled back at the end.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
begin;

create schema rls_test;
grant usage on schema rls_test to authenticated, anon;

-- log in as an anonymous user (creates the auth.users row)
create function rls_test.login(uid uuid) returns void language plpgsql security definer as $$
begin
  insert into auth.users (id) values (uid) on conflict do nothing;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', true)::text, false);
end $$;
grant execute on function rls_test.login(uuid) to authenticated;

create function rls_test.count(q text, expected bigint, label text) returns void language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) q', q) into n;
  if n <> expected then raise exception 'FAIL %: expected % rows, got %', label, expected, n; end if;
  raise notice 'ok   %', label;
end $$;

create function rls_test.fails(q text, pattern text, label text) returns void language plpgsql as $$
declare ok boolean := false;
begin
  begin
    execute q;
  exception when others then
    if sqlerrm not like pattern then raise exception 'FAIL %: wrong error "%"', label, sqlerrm; end if;
    ok := true;
  end;
  if not ok then raise exception 'FAIL %: no error', label; end if;
  raise notice 'ok   %', label;
end $$;

create function rls_test.eq(actual text, expected text, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then raise exception 'FAIL %: expected %, got %', label, expected, actual; end if;
  raise notice 'ok   %', label;
end $$;
grant execute on all functions in schema rls_test to authenticated, anon;

\set fac     '''00000000-0000-0000-0000-00000000000f'''
\set anna    '''00000000-0000-0000-0000-00000000000a'''
\set ben     '''00000000-0000-0000-0000-00000000000b'''
\set eve     '''00000000-0000-0000-0000-00000000000e'''
\set laptop2 '''00000000-0000-0000-0000-000000000002'''
\set settings '''{"groupCount": 2, "dotsPerPerson": 3, "timerPresetsMin": [5, 10], "klaerung": {"enabled": true, "minutes": 15}, "pitch": {"enabled": true, "minutesPerGroup": 2}}'''

set role authenticated;

-- ---- steps match src/workshop/program.ts -------------------------------------
select rls_test.eq(public.workshop_steps('komplett', :settings)::text,
  '{lobby,i2.lesen,i2.markieren,i2.aufloesen,i2.diskutieren,i1.gruppen,i1.ziehen,i1.lesen,i1.klaerung,i1.entwickeln,i1.pitch,st.auswaehlen,st.diskutieren,st.bewerten,st.umsetzung,ende}',
  'workshop_steps(komplett)');
select rls_test.eq(public.workshop_steps('inspiration-1', '{"klaerung": {"enabled": false}, "pitch": {"enabled": false}}')::text,
  '{lobby,i1.gruppen,i1.ziehen,i1.lesen,i1.entwickeln,ende}', 'workshop_steps without optional steps');

-- ---- create + join -------------------------------------------------------------
select rls_test.login(:fac);
select rls_test.fails($$select public.create_room('x', 'komplett', '{"groupCount": 9}')$$, 'invalid', 'create_room rejects invalid settings');
select room_id as room, code, facilitator_secret as secret from public.create_room('RLS-Test', 'komplett', :settings) \gset
\set room '''':room''''
\set code '''':code''''
\set secret '''':secret''''
select rls_test.count($$select 1 from public.room_members where role = 'facilitator'$$, 1, 'creator is facilitator');
select rls_test.fails($$select 1 from public.room_secrets$$, '%permission denied%', 'secret hash is invisible');

select rls_test.login(:anna);
select rls_test.fails($$select public.join_room('ZZZZZZ', 'Anna')$$, 'not-found', 'unknown code');
select rls_test.fails(format($$select public.join_room(%L, %L)$$, :code, repeat('x', 41)), 'too-long', 'name ≤ 40');
select public.join_room(lower(:code), '  Anna  ');
select rls_test.count($$select 1 from public.room_members where display_name = 'Anna'$$, 1, 'join trims the name, code is case-insensitive');
select rls_test.login(:ben);
select public.join_room(:code, 'Ben');

-- ---- a non-member can't read a room -------------------------------------------
select rls_test.login(:eve);
select rls_test.count($$select 1 from public.rooms$$, 0, 'non-member: no rooms');
select rls_test.count($$select 1 from public.room_members$$, 0, 'non-member: no members');
select rls_test.eq((public.room_snapshot(:room)->'room')::text, 'null', 'non-member: empty snapshot');
select rls_test.count(format($$select * from public.step_progress(%L)$$, :room), 0, 'non-member: no progress');
select rls_test.eq(public.my_room(:code)::text, null, 'non-member: my_room is null');
select rls_test.fails(format($$insert into public.notes (room_id, step_key, topic, body) values (%L, 'lobby', 'x', 'hi')$$, :room), '%row-level security%', 'non-member: cannot write');

-- ---- participants can't change room state --------------------------------------
select rls_test.login(:anna);
select rls_test.count($$select 1 from public.rooms$$, 1, 'member reads the room');
select rls_test.fails(format($$select public.set_step(%L, 'lobby', 'i2.lesen')$$, :room), 'not-facilitator', 'participant: no set_step');
select rls_test.fails(format($$select public.set_timer(%L, 'start', 60000)$$, :room), 'not-facilitator', 'participant: no timer');
select rls_test.fails(format($$select public.reveal(%L, 'i2.markieren')$$, :room), 'not-facilitator', 'participant: no reveal');
select rls_test.fails(format($$select public.close_room(%L)$$, :room), 'not-facilitator', 'participant: no close');
select rls_test.fails(format($$update public.rooms set status = 'closed' where id = %L$$, :room), '%permission denied%', 'participant: no direct room update');
select rls_test.fails(format($$update public.room_members set role = 'facilitator' where room_id = %L$$, :room), '%permission denied%', 'participant: cannot promote self');
select rls_test.fails(format($$insert into public.selections (room_id, kind, ref_type, ref_id) values (%L, 'relevant_archetype', 'archetype', 'a1')$$, :room), '%row-level security%', 'participant: no selections');

-- ---- step changes with expected step ------------------------------------------
select rls_test.login(:fac);
select public.set_step(:room, 'lobby', 'i2.lesen');
select rls_test.fails(format($$select public.set_step(%L, 'lobby', 'i2.lesen')$$, :room), 'stale-step', 'no double advance');
select rls_test.fails(format($$select public.set_step(%L, 'i2.lesen', 'nope')$$, :room), 'invalid', 'unknown step');
select public.set_step(:room, 'i2.lesen', 'i2.markieren');
select public.set_timer(:room, 'start', 300000);
select rls_test.count($$select 1 from public.rooms where timer_ends_at > now() + interval '4 minutes'$$, 1, 'timer end timestamp set');

-- ---- votes hidden until reveal -------------------------------------------------
select rls_test.login(:anna);
select rls_test.fails(format($$insert into public.votes (room_id, card_id) values (%L, 'a1-archetype')$$, :room), '%check constraint%', 'only case cards');
insert into public.votes (room_id, card_id) values (:room, 'a1-case-1'), (:room, 'a2-case-1'), (:room, 'a3-case-1');
select rls_test.fails(format($$insert into public.votes (room_id, card_id) values (%L, 'a4-case-1')$$, :room), 'no-dots-left', 'dot budget');
select rls_test.fails(format($$insert into public.votes (room_id, user_id, card_id) values (%L, %L, 'a5-case-1')$$, :room, :ben), '%row-level security%', 'cannot vote as someone else');
select rls_test.login(:ben);
insert into public.votes (room_id, card_id) values (:room, 'a1-case-1');
select rls_test.count($$select 1 from public.votes$$, 1, 'participant sees only own votes before reveal');
select rls_test.count(format($$select 1 from jsonb_array_elements(public.room_snapshot(%L)->'votes')$$, :room), 1, 'snapshot hides others'' votes');
select rls_test.login(:fac);
select rls_test.count($$select 1 from public.votes$$, 0, 'facilitator sees no votes before reveal');
select rls_test.count(format($$select 1 from public.step_progress(%L) where participants = 2 and voted = 1$$, :room), 1, 'progress shows counts only');
select public.set_step(:room, 'i2.markieren', 'i2.aufloesen');
select rls_test.login(:ben);
select rls_test.count($$select 1 from public.votes$$, 4, 'after reveal everyone sees all votes');
select rls_test.fails(format($$insert into public.votes (room_id, card_id) values (%L, 'a4-case-2')$$, :room), '%row-level security%', 'no voting after the step');

-- ---- groups, draws, ideas -------------------------------------------------------
select rls_test.login(:fac);
select public.set_step(:room, 'i2.aufloesen', 'i2.diskutieren');
select public.set_step(:room, 'i2.diskutieren', 'i1.gruppen');
select public.set_groups(:room, jsonb_build_object(
  (select id from public.room_members where user_id = :anna), 1,
  (select id from public.room_members where user_id = :ben), 2));
select rls_test.fails(format($$select public.set_groups(%L, jsonb_build_object((select id from public.room_members where user_id = %L), 3))$$, :room, :anna), 'invalid', 'group number ≤ groupCount');
select public.set_step(:room, 'i1.gruppen', 'i1.ziehen');
select rls_test.login(:anna);
select rls_test.fails(format($$select public.draw_archetype(%L, 2)$$, :room), 'not-your-group', 'draw only for own group');
select public.draw_archetype(:room, 1) as drawn \gset
select rls_test.fails(format($$select public.draw_archetype(%L, 1)$$, :room), 'taken', 'one draw per group');
select rls_test.fails(format($$select public.set_draw(%L, 2, 'a1')$$, :room), 'not-facilitator', 'participant: no manual draw');
select rls_test.login(:fac);
select rls_test.fails(format($$select public.set_draw(%L, 2, %L)$$, :room, :'drawn'), 'taken', 'no duplicate archetype');
select public.set_draw(:room, 2, case when :'drawn' = 'a7' then 'a6' else 'a7' end);
select public.set_step(:room, 'i1.ziehen', 'i1.lesen');
select public.set_step(:room, 'i1.lesen', 'i1.klaerung');
select public.set_step(:room, 'i1.klaerung', 'i1.entwickeln');

select rls_test.login(:anna);
insert into public.ideas (room_id, group_no, title, inspired_by) values (:room, 1, 'Digitaler Zwilling', 'a1-case-2');
select rls_test.fails(format($$insert into public.ideas (room_id, group_no, title) values (%L, 2, 'fremd')$$, :room), '%row-level security%', 'no ideas in another group');
select rls_test.fails(format($$insert into public.ideas (room_id, group_no, title) values (%L, 1, %L)$$, :room, repeat('x', 121)), '%check constraint%', 'idea title ≤ 120');
select rls_test.fails($$update public.ideas set group_no = 2$$, '%permission denied%', 'group of an idea is fixed');
select rls_test.login(:ben);
update public.ideas set title = 'gekapert';
delete from public.ideas;
select rls_test.login(:anna);
select rls_test.count($$select 1 from public.ideas where title = 'Digitaler Zwilling'$$, 1, 'another group cannot edit or delete ideas');
update public.ideas set description = 'Beschreibung';
select rls_test.count($$select 1 from public.ideas where description = 'Beschreibung'$$, 1, 'group member edits own group idea');
select rls_test.login(:fac);
update public.ideas set target = 'Produktion';
select rls_test.count($$select 1 from public.ideas where target = 'Produktion'$$, 1, 'facilitator edits any idea');

-- ---- notes ----------------------------------------------------------------------
select rls_test.login(:anna);
insert into public.notes (room_id, step_key, topic, body, by_facilitator) values (:room, 'i2.diskutieren', 'relevant', 'Notiz', true);
select rls_test.count($$select 1 from public.notes where by_facilitator$$, 0, 'by_facilitator is set by the server');
select rls_test.login(:ben);
update public.notes set body = 'überschrieben';
select rls_test.count($$select 1 from public.notes where body = 'Notiz'$$, 1, 'others cannot edit a note');

-- ---- the facilitator link -------------------------------------------------------
select rls_test.login(:laptop2);
select rls_test.fails(format($$select public.claim_facilitator(%L, 'falsch')$$, :code), 'not-found', 'wrong secret');
select public.claim_facilitator(:code, :secret);
select rls_test.eq(public.my_room(:code)::text, :room, 'facilitator link joins the room');
select public.set_step(:room, 'i1.entwickeln', 'i1.pitch');
select rls_test.count($$select 1 from public.rooms where step_key = 'i1.pitch' and pitch_group = 1$$, 1, 'second device can moderate');

-- ---- strategy: selections, hidden ratings, steps --------------------------------
select public.set_step(:room, 'i1.pitch', 'st.auswaehlen');
insert into public.selections (room_id, kind, ref_type, ref_id) values (:room, 'strategy_target', 'archetype', 'a2') returning id as sel \gset
\set sel '''':sel''''
select public.set_step(:room, 'st.auswaehlen', 'st.diskutieren');
select public.set_step(:room, 'st.diskutieren', 'st.bewerten');
select rls_test.login(:anna);
insert into public.ratings (room_id, selection_id, criterion, score) values (:room, :sel, 'umsetzbarkeit', 4), (:room, :sel, 'geschaeftsnutzen', 3), (:room, :sel, 'nachhaltigkeit', 5);
select rls_test.fails(format($$insert into public.ratings (room_id, selection_id, criterion, score) values (%L, %L, 'umsetzbarkeit', 6)$$, :room, :sel), '%check constraint%', 'score 1–5');
update public.ratings set score = 5 where criterion = 'umsetzbarkeit';
select rls_test.login(:ben);
insert into public.ratings (room_id, selection_id, criterion, score) values (:room, :sel, 'umsetzbarkeit', 2);
select rls_test.count($$select 1 from public.ratings$$, 1, 'ratings hidden before reveal');
select rls_test.login(:fac);
select rls_test.count(format($$select 1 from public.step_progress(%L) where rated = 1$$, :room), 1, 'rating progress counts complete raters');
select public.reveal(:room, 'st.bewerten');
select rls_test.login(:ben);
select rls_test.count($$select 1 from public.ratings$$, 4, 'ratings visible after reveal');
select rls_test.fails(format($$select public.set_step(%L, 'st.bewerten', 'st.umsetzung')$$, :room), 'not-facilitator', 'participant cannot advance');
select rls_test.login(:fac);
select public.set_step(:room, 'st.bewerten', 'st.umsetzung');
select rls_test.login(:anna);
insert into public.impl_steps (room_id, selection_id, what, who, due) values (:room, :sel, 'Datenquellen sichten', 'IT-Leitung', '2027-01-31');
select rls_test.login(:ben);
update public.impl_steps set what = 'x';
select rls_test.count($$select 1 from public.impl_steps where what = 'Datenquellen sichten'$$, 1, 'others cannot edit a step');

-- ---- closed rooms are read-only --------------------------------------------------
select rls_test.login(:fac);
select public.close_room(:room);
select rls_test.fails(format($$select public.set_step(%L, 'st.umsetzung', 'ende')$$, :room), 'closed', 'closed: no step change');
select rls_test.login(:anna);
select rls_test.fails(format($$insert into public.notes (room_id, step_key, topic, body) values (%L, 'ende', 'x', 'spät')$$, :room), '%row-level security%', 'closed: no new notes');
update public.ideas set title = 'zu spät';
select rls_test.count($$select 1 from public.ideas where title = 'Digitaler Zwilling'$$, 1, 'closed: ideas unchanged');
select rls_test.count($$select 1 from public.rooms$$, 1, 'closed: still readable');
select rls_test.login(:eve);
select rls_test.fails(format($$select public.join_room(%L, 'Eve')$$, :code), 'closed', 'closed: no new members');

-- ---- expiry ----------------------------------------------------------------------
reset role;
update public.rooms set created_at = now() - interval '31 days' where id = :room;
select rls_test.eq(public.expire_rooms()::text, '1', 'expire_rooms deletes old rooms');
select rls_test.count($$select 1 from public.ideas$$, 0, 'expiry cascades');

-- ---- anon gets nothing but the clock -----------------------------------------------
set role anon;
select rls_test.eq(public.ping(), 'ok', 'anon: ping');
select rls_test.fails($$select public.create_room('x', 'komplett', '{}')$$, '%permission denied%', 'anon: no create_room');
select rls_test.fails($$select 1 from public.rooms$$, '%permission denied%', 'anon: no tables');
reset role;

\echo 'RLS test: all checks passed'
rollback;

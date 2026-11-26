-- Deletes rooms 30 days after creation (and orphaned anonymous users), daily at 03:00 UTC.
-- Skipped where pg_cron isn't available (plain Postgres in the RLS test).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('live-rooms-expiry', '0 3 * * *', 'select public.expire_rooms()');
  end if;
end $$;

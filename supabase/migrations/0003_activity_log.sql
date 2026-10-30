-- La Casita Especial · 0003 · activity log (reused from Sovereign, household-scoped)

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  pillar_key text,
  actor_id uuid references auth.users on delete set null,
  action text not null check (length(action) <= 300),
  source text not null default 'ui' check (source in ('ui','command')),
  raw_input text check (length(raw_input) <= 2000),
  created_at timestamptz not null default now()
);
create index activity_log_household_idx on activity_log (household_id, created_at desc);

/**
 * Defense in depth: the app never sends raw_input for sensitive pillars, and
 * the database refuses to keep it anyway.
 */
create or replace function activity_log_scrub() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- No resolved pillar, or a sensitive one: never keep what was typed.
  if new.raw_input is not null and (
    new.pillar_key is null
    or coalesce((
      select sensitive from pillars
      where household_id = new.household_id and key = new.pillar_key
    ), true)
  ) then
    new.raw_input := null;
  end if;
  new.actor_id := coalesce(new.actor_id, auth.uid());
  return new;
end;
$$;

create trigger activity_log_scrub
  before insert or update on activity_log for each row execute function activity_log_scrub();

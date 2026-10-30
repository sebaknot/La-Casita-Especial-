-- La Casita Especial · 0002 · pillars, schedule templates, items
--
-- Pillar keys are NOT check-constrained. The canonical list lives in
-- src/config/pillars.ts; the app upserts these rows from it, and items
-- reference them by foreign key.

create table pillars (
  household_id uuid not null references households on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name_en text not null,
  name_es text not null,
  icon text not null,
  -- sensitive = command-bar AI parsing off, raw_input never stored.
  -- It never hides anything from a household member.
  sensitive boolean not null default false,
  sort_order int not null default 0,
  primary key (household_id, key)
);

-- A schedule built once and applied to several people (school for both girls).
-- slots: [{"days":"MO,TU,TH,FR","start":"07:30","end":"14:50","title":"School"}, …]
create table schedule_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  pillar_key text not null,
  name text not null check (length(name) between 1 and 80),
  location text check (length(location) <= 120),
  slots jsonb not null default '[]' check (jsonb_typeof(slots) = 'array'),
  created_at timestamptz not null default now(),
  foreign key (household_id, pillar_key) references pillars (household_id, key) on update cascade
);

create table items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  pillar_key text not null,
  person_id uuid references people on delete set null,               -- whose item it is
  responsible_person_id uuid references people on delete set null,   -- who drives / picks up / hosts
  kind text not null check (kind in ('event','routine','task','project','record')),
  tag text check (tag ~ '^[a-z_]{1,30}$'),   -- pickup, dropoff, school, homework, supplies, uniform, …
  title text not null check (length(title) between 1 and 200),
  details text check (length(details) <= 2000),
  location text check (length(location) <= 120),

  -- Schedule, all in the household's local time (no timezone drift):
  starts_on date,        -- the date (one-off) or first date (recurring)
  ends_on date,          -- last date a recurring item applies
  start_time time,       -- null = all day / anytime
  end_time time,
  recurrence text check (recurrence is null or recurrence ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$'),
  due_date date,         -- tasks, steps, record review dates
  countdown boolean not null default false,

  status text not null default 'open'
    check (status in ('open','in_progress','waiting','done','archived')),
  priority smallint not null default 2 check (priority between 1 and 3),
  next_action text check (length(next_action) <= 200),
  waiting_on text check (length(waiting_on) <= 200),
  budget numeric(12,2) check (budget is null or budget >= 0),
  progress_done int check (progress_done >= 0),
  progress_total int check (progress_total > 0),
  parent_id uuid references items on delete cascade,          -- project → steps
  template_id uuid references schedule_templates on delete cascade,
  sort_order int not null default 0,

  -- Calendar sync (designed now, built in Phase 2)
  source text not null default 'app' check (source in ('app','google','ics')),
  external_id text,
  calendar_id text,

  created_by uuid references auth.users on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (household_id, pillar_key) references pillars (household_id, key) on update cascade,
  check (recurrence is null or starts_on is not null),
  check (kind <> 'routine' or recurrence is not null),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (end_time is null or start_time is null or end_time > start_time),
  check (progress_done is null or progress_total is null or progress_done <= progress_total),
  check (source = 'app' or external_id is not null),
  -- Records hold status and links only — and never identifiers.
  check (kind <> 'record' or (budget is null and progress_done is null)),
  check (kind <> 'record' or (coalesce(title,'') || ' ' || coalesce(details,'')) !~ '(\d{3}-?\d{2}-?\d{4})|(\d{8,})')
);

create index items_household_pillar_idx on items (household_id, pillar_key, status);
create index items_household_starts_idx on items (household_id, starts_on);
create index items_household_due_idx on items (household_id, due_date) where status in ('open','in_progress','waiting');
create index items_parent_idx on items (parent_id);
create index items_template_idx on items (template_id);
-- Imports from Google/ICS dedupe on external_id so they never echo back as duplicates.
create unique index items_external_uidx on items (household_id, source, calendar_id, external_id)
  where external_id is not null;

create trigger items_touch_updated_at
  before update on items for each row execute function touch_updated_at();

/** People and parents must belong to the item's own household; parents are projects in the same pillar. */
create or replace function items_check_refs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.person_id is not null and not exists (
    select 1 from people where id = new.person_id and household_id = new.household_id
  ) then raise exception 'person belongs to another household'; end if;

  if new.responsible_person_id is not null and not exists (
    select 1 from people where id = new.responsible_person_id and household_id = new.household_id
  ) then raise exception 'responsible person belongs to another household'; end if;

  if new.parent_id is not null and not exists (
    select 1 from items
    where id = new.parent_id and household_id = new.household_id
      and pillar_key = new.pillar_key and kind = 'project' and parent_id is null
  ) then raise exception 'steps must belong to a top-level project in the same pillar'; end if;

  return new;
end;
$$;

create trigger items_check_refs
  before insert or update of person_id, responsible_person_id, parent_id, household_id, pillar_key
  on items for each row execute function items_check_refs();

create table record_links (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items on delete cascade,
  label text not null check (length(label) between 1 and 80),
  url text not null check (url ~ '^https://'),
  created_at timestamptz not null default now()
);
create index record_links_item_idx on record_links (item_id);

-- One row per day a routine was done. Streaks are computed from these.
create table routine_completions (
  item_id uuid not null references items on delete cascade,
  on_date date not null,
  completed_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (item_id, on_date)
);

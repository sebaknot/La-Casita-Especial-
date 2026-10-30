-- La Casita Especial · 0001 · households, members, people
--
-- One household, equal members. Everyone in a household sees everything;
-- `role` exists only so roles can be added later without a migration scare
-- (it is deliberately not check-constrained).

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  timezone text not null default 'America/New_York',
  school_events_url text check (school_events_url is null or school_events_url ~ '^https://'),
  created_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null check (length(name) between 1 and 40),
  relation text not null default 'other'
    check (relation in ('self','partner','child','grandparent','relative','other')),
  color text not null default 'slate',   -- palette key; the palette lives in src/config/palette.ts
  birthday date,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index people_household_idx on people (household_id, sort_order);

create table household_members (
  household_id uuid not null references households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member',
  person_id uuid references people on delete set null,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on household_members (user_id);

-- A pending invite: when this email signs in, accept_invite() adds them.
create table household_invites (
  household_id uuid not null references households on delete cascade,
  email text not null check (email = lower(email) and email like '%@%'),
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (household_id, email)
);

/** True when the signed-in user belongs to the household. Used by every policy. */
create or replace function is_member(hh uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members
    where household_id = hh and user_id = auth.uid()
  );
$$;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

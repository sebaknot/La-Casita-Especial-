-- Sovereign · row level security
-- Only the allowlisted user (by email) may touch any row.
--
-- After running this, register your email:
--   insert into allowed_users (email) values ('you@example.com');
-- (Must match ALLOWED_EMAIL in your env and the Supabase auth user you create.)

create table allowed_users (
  email text primary key,
  role text not null default 'owner' check (role in ('owner','assistant'))
);

-- Never expose the allowlist itself through the API
alter table allowed_users enable row level security;

create or replace function is_allowed() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from allowed_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table items enable row level security;
alter table loans enable row level security;
alter table activity_log enable row level security;
alter table education_progress enable row level security;

create policy "allowlisted full access" on items
  for all to authenticated using (is_allowed()) with check (is_allowed());

create policy "allowlisted full access" on loans
  for all to authenticated using (is_allowed()) with check (is_allowed());

create policy "allowlisted full access" on activity_log
  for all to authenticated using (is_allowed()) with check (is_allowed());

create policy "allowlisted full access" on education_progress
  for all to authenticated using (is_allowed()) with check (is_allowed());

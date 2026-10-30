-- La Casita Especial · 0004 · row level security + household RPCs
--
-- One rule everywhere: you can touch a row when you are a member of its
-- household. There is no per-member or per-pillar visibility.

alter table households enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;
alter table people enable row level security;
alter table pillars enable row level security;
alter table schedule_templates enable row level security;
alter table items enable row level security;
alter table record_links enable row level security;
alter table routine_completions enable row level security;
alter table activity_log enable row level security;

create policy "members read" on households for select to authenticated using (is_member(id));
create policy "members update" on households for update to authenticated using (is_member(id)) with check (is_member(id));

-- Memberships are created only through create_household() / accept_invite().
create policy "members read" on household_members for select to authenticated using (is_member(household_id));
create policy "update own link" on household_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members manage" on household_invites for all to authenticated
  using (is_member(household_id)) with check (is_member(household_id));
create policy "members manage" on people for all to authenticated
  using (is_member(household_id)) with check (is_member(household_id));
create policy "members manage" on pillars for all to authenticated
  using (is_member(household_id)) with check (is_member(household_id));
create policy "members manage" on schedule_templates for all to authenticated
  using (is_member(household_id)) with check (is_member(household_id));
create policy "members manage" on items for all to authenticated
  using (is_member(household_id)) with check (is_member(household_id));

create policy "members manage" on record_links for all to authenticated
  using (exists (select 1 from items i where i.id = item_id and is_member(i.household_id)))
  with check (exists (select 1 from items i where i.id = item_id and is_member(i.household_id)));
create policy "members manage" on routine_completions for all to authenticated
  using (exists (select 1 from items i where i.id = item_id and is_member(i.household_id)))
  with check (exists (select 1 from items i where i.id = item_id and is_member(i.household_id)));

-- The log is append-only.
create policy "members read" on activity_log for select to authenticated using (is_member(household_id));
create policy "members append" on activity_log for insert to authenticated with check (is_member(household_id));

/** Creates the caller's household. A user belongs to at most one. */
create or replace function create_household(p_name text, p_timezone text default 'America/New_York')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  hh uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'already in a household';
  end if;

  insert into households (name, timezone)
  values (coalesce(nullif(trim(p_name), ''), 'La Casita'), coalesce(p_timezone, 'America/New_York'))
  returning id into hh;

  insert into household_members (household_id, user_id) values (hh, auth.uid());
  return hh;
end;
$$;

/** Joins the household that invited the caller's email, if any. */
create or replace function accept_invite() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  hh uuid;
  me text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or me = '' then return null; end if;

  select household_id into hh from household_members where user_id = auth.uid() limit 1;
  if hh is not null then return hh; end if;

  select household_id into hh from household_invites where email = me
  order by created_at limit 1;
  if hh is null then return null; end if;

  insert into household_members (household_id, user_id) values (hh, auth.uid());
  delete from household_invites where email = me;
  return hh;
end;
$$;

revoke execute on function create_household(text, text) from anon;
revoke execute on function accept_invite() from anon;

-- Run after migrations. Fails loudly (ON_ERROR_STOP) if any expectation breaks.
\set ON_ERROR_STOP on
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'moni@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'andy@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'stranger@example.com');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false),
       set_config('request.jwt.claim.email', 'moni@example.com', false);

select create_household('La Casita') as hh \gset
-- the app upserts pillars from config; mimic that:
insert into pillars (household_id, key, name_en, name_es, icon, sensitive) values
  (:'hh','work','Work','Trabajo','briefcase',true),
  (:'hh','kids','Kids','Niñas','sparkle',false),
  (:'hh','home','Home Ops','Casa','home',false),
  (:'hh','family','Family & Events','Familia y eventos','gift',false),
  (:'hh','faith','Faith','Fe','candle',false);
select seed_household(:'hh', 'en');
select count(*) as items_seeded, count(*) > 40 as seed_ok from items \gset
\if :seed_ok
\else
  \echo 'seed produced too few items'
  select 1/0;
\endif
\echo seeded :items_seeded items

-- seed twice must fail
do $$ begin
  perform seed_household((select id from households limit 1), 'en');
  raise exception 'seeded twice';
exception when others then
  if sqlerrm = 'seeded twice' then raise; end if;
end $$;

-- invite Andy, then switch to him
insert into household_invites (household_id, email) values (:'hh', 'andy@example.com');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false),
       set_config('request.jwt.claim.email', 'andy@example.com', false);
select accept_invite() = :'hh' as andy_joined;
select count(*) = :items_seeded as andy_sees_everything from items;

-- sensitive pillar: raw_input is scrubbed by the DB
insert into activity_log (household_id, pillar_key, action, source, raw_input)
values (:'hh', 'work', 'Added task', 'command', 'secret project words');
insert into activity_log (household_id, pillar_key, action, source, raw_input)
values (:'hh', 'kids', 'Added task', 'command', 'dentist for gabi');
select (select raw_input from activity_log where pillar_key = 'work') is null as work_scrubbed,
       (select raw_input from activity_log where pillar_key = 'kids') = 'dentist for gabi' as kids_kept;

-- records reject identifiers
do $$ begin
  insert into items (household_id, pillar_key, kind, title)
  values ((select id from households limit 1), 'home', 'record', 'SSN 123-45-6789');
  raise exception 'record accepted an SSN';
exception when check_violation then null; end $$;

-- a stranger sees nothing and can't write
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false),
       set_config('request.jwt.claim.email', 'stranger@example.com', false);
select accept_invite() is null as stranger_not_invited;
select count(*) = 0 as stranger_sees_nothing from items;
do $$ begin
  insert into items (household_id, pillar_key, kind, title)
  values ('00000000-0000-0000-0000-000000000000', 'kids', 'task', 'x');
  raise exception 'stranger wrote';
exception when insufficient_privilege or foreign_key_violation then null; end $$;
reset role;

-- shape of the seeded kids schedule
select p.name, i.tag, i.title, i.recurrence, i.start_time, r.name as driver
from items i join people p on p.id = i.person_id left join people r on r.id = i.responsible_person_id
where i.pillar_key = 'kids' and i.tag in ('pickup','dropoff') order by p.name, i.start_time;

-- moving Ali's start date moves her rides too
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false),
       set_config('request.jwt.claim.email', 'moni@example.com', false);
select apply_template(t.id, p.id, date '2026-12-07')
from schedule_templates t, people p where p.name = 'Ali';
select bool_and(starts_on = date '2026-12-07') as ali_moved, count(*) as ali_school_items
from items i join people p on p.id = i.person_id where p.name = 'Ali' and i.template_id is not null;
reset role;

-- Sovereign v2 — domain renames, nested updates, subgroups, trackers.
--
-- Safe to run on live data: it renames values in place and never drops a
-- table that holds your rows. Run the whole file at once in the Supabase
-- SQL editor (it is wrapped in a transaction — all of it lands, or none).

begin;

-- 1. Domain renames ---------------------------------------------------
-- taxone → taxonomy · academy → fastc · ops → personal
-- education is retired; its rows move to lawschool (move CPA ones by hand).

alter table items drop constraint if exists items_domain_check;

update items set domain = 'taxonomy'  where domain = 'taxone';
update items set domain = 'fastc'     where domain = 'academy';
update items set domain = 'personal'  where domain = 'ops';
update items set domain = 'lawschool' where domain = 'education';

alter table items add constraint items_domain_check check (
  domain in ('taxonomy','unit77','porter','mortgages','lawschool','cpa','fastc','personal')
);

-- activity_log.domain is unconstrained free text — keep feed badges resolving.
update activity_log set domain = 'taxonomy'  where domain = 'taxone';
update activity_log set domain = 'fastc'     where domain = 'academy';
update activity_log set domain = 'personal'  where domain = 'ops';
update activity_log set domain = 'lawschool' where domain = 'education';

-- 2. Updates become children of a task or note ------------------------

alter table items add column if not exists parent_id uuid references items(id) on delete cascade;
create index if not exists items_parent_id_idx on items (parent_id);

-- Legacy standalone updates predate the parent requirement and would
-- violate the new constraint. Convert them to notes so the text survives
-- and stays visible instead of being rejected or orphaned.
update items set type = 'note' where type = 'update' and parent_id is null;

alter table items drop constraint if exists items_update_needs_parent;
alter table items add constraint items_update_needs_parent
  check (type <> 'update' or parent_id is not null);

-- 3. Optional link from an item to a specific loan --------------------

alter table items add column if not exists loan_id uuid references loans(id) on delete set null;
create index if not exists items_loan_id_idx on items (loan_id);

-- 4. Personal subgroups (family / goals) ------------------------------

alter table items add column if not exists subgroup text;
alter table items drop constraint if exists items_subgroup_check;
alter table items add constraint items_subgroup_check
  check (subgroup is null or subgroup in ('family','goals'));

create index if not exists items_subgroup_idx on items (domain, subgroup);

-- 5. Trackers ---------------------------------------------------------

create table if not exists law_school_prep (
  id int primary key default 1 check (id = 1),
  lsat_date date,
  lsat_registered bool not null default false,
  lsat_taken bool not null default false,
  personal_statement bool not null default false,
  recommendations bool not null default false,
  transcripts_ordered bool not null default false,
  cas_report bool not null default false,
  application_submitted bool not null default false
);
insert into law_school_prep (id) values (1) on conflict (id) do nothing;

create table if not exists cpa_sections (
  section text primary key check (section in ('AUD','FAR','REG','DISCIPLINE')),
  label text not null,
  status text not null default 'not_started'
    check (status in ('not_started','studying','scheduled','passed')),
  exam_date date,
  score int check (score between 0 and 99),
  sort_order int not null
);
insert into cpa_sections (section, label, sort_order) values
  ('AUD','AUD',1), ('FAR','FAR',2), ('REG','REG',3), ('DISCIPLINE','Discipline',4)
on conflict (section) do nothing;

-- Editable settings that shouldn't require a code change (FASTC schedule link).
create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  fastc_schedule_url text,
  fastc_schedule_label text
);
-- Seed with the existing Glynco/CITP link so nothing disappears; repoint or
-- clear it from the FASTC page if it doesn't apply there.
insert into app_settings (id, fastc_schedule_url, fastc_schedule_label)
values (1, 'https://exquisite-horse-722d7f.netlify.app', 'CITP-2633X Schedule')
on conflict (id) do nothing;

-- 6. RLS for the new tables (same allowlist rule as everything else) ---

alter table law_school_prep enable row level security;
alter table cpa_sections enable row level security;
alter table app_settings enable row level security;

drop policy if exists "allowlisted full access" on law_school_prep;
create policy "allowlisted full access" on law_school_prep
  for all to authenticated using (is_allowed()) with check (is_allowed());

drop policy if exists "allowlisted full access" on cpa_sections;
create policy "allowlisted full access" on cpa_sections
  for all to authenticated using (is_allowed()) with check (is_allowed());

drop policy if exists "allowlisted full access" on app_settings;
create policy "allowlisted full access" on app_settings
  for all to authenticated using (is_allowed()) with check (is_allowed());

commit;

-- Note: table education_progress is no longer used by the app (the WGU
-- tracker was replaced by Law School Prep and CPA Exam Prep). It is left
-- in place so no data is destroyed; drop it manually when you're ready.

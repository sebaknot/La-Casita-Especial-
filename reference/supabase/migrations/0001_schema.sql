-- Sovereign · schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- Core table: everything except loans lives here
create table items (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('taxone','unit77','porter','mortgages','education','academy','ops')),
  type text not null check (type in ('task','update','deadline','note')),
  title text not null,
  details text,
  status text not null default 'open' check (status in ('open','in_progress','done','archived')),
  priority int not null default 2 check (priority between 1 and 3), -- 1=critical
  due_date date,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Mortgage pipeline
create table loans (
  id uuid primary key default gen_random_uuid(),
  borrower_label text not null,        -- initials or short label, no full PII
  state text not null check (state in ('FL','GA')),
  loan_type text,                      -- conventional, FHA, VA, etc.
  stage text not null default 'lead' check (stage in
    ('lead','application','disclosures','processing','underwriting','conditions','clear_to_close','closed','dead')),
  target_close date,
  next_action text,
  notes text,
  updated_at timestamptz default now()
);

-- Activity log (fuels the home feed + audit trail of voice commands)
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  domain text,
  action text not null,                -- e.g. 'created item', 'moved loan to underwriting'
  source text not null default 'ui' check (source in ('ui','command','voice')),
  raw_input text,                      -- the original spoken/typed command if any
  created_at timestamptz default now()
);

-- Education tracker (single-row: WGU M.S. Accounting progress)
create table education_progress (
  id int primary key default 1 check (id = 1),
  courses_total int not null default 10 check (courses_total > 0),
  courses_done int not null default 5 check (courses_done >= 0),
  target_date date default '2026-07-31'
);
insert into education_progress (id) values (1);

-- Helpful indexes for the home board + domain pages
create index items_domain_status_idx on items (domain, status);
create index items_due_date_idx on items (due_date) where status in ('open','in_progress');
create index loans_stage_idx on loans (stage);
create index activity_log_created_idx on activity_log (created_at desc);

-- keep loans.updated_at fresh
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger loans_touch_updated_at
  before update on loans
  for each row execute function touch_updated_at();

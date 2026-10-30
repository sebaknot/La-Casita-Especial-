# Sovereign

Personal command center. One user, eight fronts, a command bar that speaks your language.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth) · Anthropic API · Vercel

---

## Domains

| Domain key | Page | What lives there |
| --- | --- | --- |
| `taxonomy` | `/taxonomy` | Taxonomy — the tax firm |
| `unit77` | `/unit77` | Unit 77 — AI automation agency |
| `porter` | `/porter` | Porter — logistics startup |
| `mortgages` | `/mortgages` | Loan pipeline **and** mortgage business tasks (licensing, CE, lenders, marketing) |
| `lawschool` | `/lawschool` | Law School Prep — LSAT countdown + application milestones |
| `cpa` | `/cpa` | CPA Exam Prep — AUD, FAR, REG, discipline |
| `fastc` | `/fastc` | FASTC — federal training + editable schedule link |
| `personal` | `/personal` | Personal — Family and Goals sections |

### Item model

Items are `task`, `note`, `deadline`, or `update`. Each type carries a consistent accent —
a 2px left border and a badge, nothing more:

| Type | Accent |
| --- | --- |
| `task` | Signal blue `#4E7CFF` |
| `note` | Warm stone `#8A8578` |
| `deadline` | Danger red `#C0392B` (date in bold mono) |
| `update` | Brass `#C9A227` (thread rail, no card of its own) |

**Updates are children, never siblings.** Every `update` has a `parent_id` pointing at a task
or note — enforced both in the API layer and by a DB check constraint. They render as an
indented brass timeline under their parent, collapsed except the most recent. Completing or
archiving a parent carries its whole thread along.

Personal items also carry a `subgroup` (`family` or `goals`); anything unassigned lands in an
Unsorted section with one-click assignment. Mortgage items may optionally set `loan_id` to tie
them to a specific loan file, which surfaces as a brass chip and a count on that loan's card.

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run the migrations in order:
   - [`0001_schema.sql`](supabase/migrations/0001_schema.sql) — `items`, `loans`, `activity_log`, indexes, triggers.
   - [`0002_rls.sql`](supabase/migrations/0002_rls.sql) — RLS + the `allowed_users` allowlist.
   - [`0003_v2_domains_nesting_trackers.sql`](supabase/migrations/0003_v2_domains_nesting_trackers.sql) — v2: domain renames, nested updates, subgroups, tracker tables.
3. Register yourself on the allowlist (must match `ALLOWED_EMAIL`):
   ```sql
   insert into allowed_users (email) values ('you@example.com');
   ```
4. Create your auth user: **Authentication → Users → Add user** (email + password, confirm email).
5. Recommended: **Authentication → Sign In / Up → disable "Allow new users to sign up"**.

### About migration 0003 (safe on live data)

It renames values in place inside a single transaction — all of it lands or none of it does.
No table holding your rows is dropped. Specifically it:

- renames domains `taxone → taxonomy`, `academy → fastc`, `ops → personal`, and moves retired
  `education` rows to `lawschool` (move any CPA ones by hand afterward), in both `items` and
  `activity_log`;
- adds `parent_id`, `loan_id`, and `subgroup` to `items`, with the constraint that an `update`
  must have a parent;
- **converts any pre-existing top-level `update` rows to `note`** so their text survives the new
  constraint instead of being rejected;
- creates `law_school_prep`, `cpa_sections`, and `app_settings` (with RLS matching every other
  table) and seeds their initial rows.

It is idempotent — safe to re-run. `education_progress` is left in place but is no longer used
by the app; drop it manually whenever you like.

### Security model

- **Proxy** (`src/proxy.ts`) blocks every route except `/login` unless the session email resolves
  to a role via `ALLOWED_EMAIL`. Non-allowlisted sessions are signed out on sight.
- **RLS** allows access only to authenticated users present in `allowed_users`.
- **Roles** (`src/lib/auth/roles.ts`): today only `owner`. An `assistant` role (read/write, no
  settings) can be added by extending `resolveRole` and the `can` map.

## 2. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `ALLOWED_EMAIL` | The one email allowed to sign in |
| `ANTHROPIC_API_KEY` | Powers the command bar parser (`POST /api/command`) |
| `COMMAND_MODEL` | Optional — parsing model, defaults to `claude-sonnet-4-6` |

> `NEXT_PUBLIC_*` values are inlined at **build** time. After changing them on Vercel you must
> redeploy — editing the variable alone does nothing to the running deployment.

## 3. Local development

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

## 4. Deploy to Vercel

1. Push to GitHub.
2. **Add New Project → Import** the repo (Next.js auto-detected).
3. Add the environment variables above under **Settings → Environment Variables** (Production).
4. Deploy. Pushes to the default branch redeploy automatically.
5. If the app is behind Vercel's login wall, turn off **Settings → Deployment Protection →
   Vercel Authentication** — Sovereign has its own auth.

## 5. Using the command bar

`Cmd+K` (or `Ctrl+K`) from anywhere, or tap the mic (Chrome/Edge; it stays open through pauses
and submits after 10s of silence, at 60s, or when you tap again):

- “Add to Porter: Steven finished the QR return flow, test by Friday”
- “Move the R.G. loan to underwriting”
- “Mark the Stripe subscription links done”
- “Note on the QR flow: links are live, tested both plans” → attaches an **update** to that task
- “Add to family: book flights for mom's birthday” → personal item in the Family section
- “New FL loan for J.M., application stage”

Commands are parsed by Claude into structured actions. Ambiguous commands come back as a clarify
question instead of a guess; a top-level `update` is never created — it's routed to its parent or
clarified. Every executed command lands in the activity log with its raw input, and the toast
carries a 10-second **Undo**.

## 6. Project map

```
src/
  proxy.ts                    auth guard
  app/
    (app)/                    protected shell: sidebar + command bar
      page.tsx                Command home — Empire Map (8 nodes), Today, Activity
      taxonomy/ unit77/ porter/    standard domain boards
      mortgages/              pipeline kanban + business task lane
      lawschool/              LSAT countdown + milestone stepper
      cpa/                    four section cards + progress bar
      fastc/                  editable schedule link + tasks
      personal/               Family / Goals / Unsorted
    api/command/              Claude parsing + execution (+ /undo)
    login/
  components/                 CommandBar, EmpireMap, ItemCard, PipelineBoard, trackers…
  lib/
    actions.ts                server actions
    queries.ts                server-component data fetchers
    types.ts                  domains, item model, type accents
    auth/roles.ts             role layer
    supabase/                 SSR + browser clients
supabase/migrations/          run these in the Supabase SQL editor, in order
```

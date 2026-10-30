# La Casita Especial

A calm household command dashboard for our family: two parents, two girls and
extended family. Phone first, bilingual (English default, Spanish toggle), and
installable as an app.

**Stack (exact versions, pinned in `package.json`):** Next.js 16.2.10 (App Router) ·
React 19.2.4 · TypeScript 5.9.3 · Tailwind CSS 4.3.2 · Supabase (`@supabase/ssr` 0.12.0,
`@supabase/supabase-js` 2.110.0) · Anthropic SDK 0.110.0 · ESLint 9.39.4 · Node 22 · Vercel.
No other runtime dependencies (recurrence, i18n and the kanban are in-house).

`reference/` is a read-only snapshot of Sovereign, the single-user dashboard this
app grew from. It is excluded from the build, typecheck and lint.

---

## What's in Phase 1

| Screen | What it does |
| --- | --- |
| **Home** (`/`) | Today on top, the rest of the week below, grouped by day, color per person. Pickups and drop-offs carry a "Driving: …" chip. Filter by person. "Two places at once" conflicts are flagged. Wide 3–6 column week on desktop. |
| **Quick Add** (`/add`, the + tab) | Title → who → type → pillar → when. Weekly day chips, end dates, driver, location, labels, next action / waiting on, countdowns, progress. Every save toasts with Undo. |
| **Command bar** (top, ⌘K) | Text only; English or Spanish. Claude turns "Ali dentista el jueves a las 3" into a real item, asks when something is ambiguous, and every result has a 10-second Undo. |
| **Kids** | Rides this week with a driver picker, each girl's week, reminders (homework, supplies, uniforms, school events, teacher meetings), routines, the school-events link, and the **school schedule template** — built once, applied to Gabi and to Ali (from Dec 1, TBD). |
| **Work** (private) | Projects on a kanban (To do / Doing / Waiting / Done) with **bold next action**, waiting-on, due date and a steps ring; tasks; hand-entered busy blocks. |
| **Home Ops, Faith** | Routines with check-off and streaks, progress rings (Bible chapters), projects with steps, lists. |
| **Other pillars** | Ready shells: same layout, empty-state invitation, add works today. |
| **Countdowns** | Trips, holidays (recurring ones roll forward) and birthdays. |
| **Settings** | People and colors, "this is me", household name, school events link, invite your partner, language, sign out. |

### Users

One household, equal members. Both parents see everything. Each can use their
own login (invite by email in Settings) or share one; both work. A `role`
column (default `member`, not constrained) exists so roles can come later
without a scary migration.

### Private ("sensitive") pillars

`sensitive: true` in `src/config/pillars.ts` means **only**:

1. the command bar is disabled on that pillar's pages (and its items' pages),
2. nothing from that pillar is sent to the Anthropic API — its items are left out
   of the parser's context and a parse that targets it is refused, and
3. `raw_input` is never stored for it — enforced in code **and** by a database trigger.

It never hides anything from a household member. Sensitive by default: Work,
Extended · Private, Relative's Projects, Household Finances.

One honest limit: if someone *types* private details into the command bar on a
non-private page, that text is the input and does go to the API. Use Quick Add
on the pillar page for those.

---

## 1. Supabase setup

1. Create a project named `la-casita-especial` at [supabase.com](https://supabase.com).
2. Run the migrations in order (SQL editor, or `supabase db push`):
   - `0001_households_people.sql`: households, members, invites, people, `is_member()`
   - `0002_pillars_items.sql`: pillars, schedule templates, items, record links, routine completions
   - `0003_activity_log.sql`: activity log + the `raw_input` scrub trigger
   - `0004_rls.sql`: row-level security (membership only) + `create_household()` / `accept_invite()`
   - `0005_templates_seed.sql`: `apply_template()` and `seed_household()` (our real schedule)
3. **Auth → URL configuration:** set the Site URL to your deployed URL and add
   `https://<your-domain>/auth/callback` as a redirect URL.
4. Sign up in the app. Onboarding creates the household and (checked by default)
   seeds the family schedule. Then invite your partner from Settings; when they
   sign up with that email they land in the same household.
5. Once both accounts exist, consider **Auth → Sign In / Up → disable new sign-ups**.

Seeded data is written in whichever language the app is set to at the moment you
create the household.

### Testing the database

`supabase/tests/run.sh` applies every migration to a throwaway local Postgres
(with a tiny stand-in for Supabase's `auth` schema) and checks: seeding, the
partner invite, household isolation, the `raw_input` scrub, the record
identifier guard, and template re-dating.

```bash
su postgres -c "bash supabase/tests/run.sh"
```

## 2. Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon/public key; all access goes through RLS |
| `ANTHROPIC_API_KEY` | for the command bar | Without it, the bar says it isn't set up; everything else works |
| `COMMAND_MODEL` | no | Parser model (default `claude-opus-5-5`) |
| `COMMAND_FALLBACK_MODEL` | no | Used automatically if the main model declines a request (default `claude-opus-4-8`) |

## 3. Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck && npm run lint && npm test && npm run build
```

`npm test` runs the schedule unit tests (recurrence, overdue tasks, streaks, conflicts).

**Deploy:** import the repo in Vercel, add the env vars, deploy. To install on a
phone, open the site and choose *Add to Home Screen* (iOS) or *Install app*
(Android/Chrome). Icons are rendered by `scripts/make-icons.mjs`.

---

## Add a pillar

1. Add the key to `PillarKey` in `src/config/pillars.ts`, then add its entry to
   `PILLARS` (icon, `sensitive`, `view`, `status`, `sortOrder`, optional `group`).
   The compiler refuses to build until you do.
2. Add its name and blurb under `pillars` in `src/i18n/en.ts` **and** `es.ts`
   (also enforced by the compiler).
3. Deploy. The app layout syncs the database `pillars` rows from the config on the
   next page load. No migration is needed: pillar keys are rows, not a check constraint.
4. Optional: give it a custom layout by adding a `view` (see `kids` / `work` in
   `src/app/(app)/p/[pillar]/page.tsx`). `list` gives you routines, progress,
   projects, lists, upcoming and records for free.

Every runtime lookup goes through `pillarConfig(key)`, which falls back (and treats
unknown keys as sensitive) instead of crashing.

## Add a language

1. Copy `src/i18n/es.ts` to e.g. `pt.ts`, type it as `Dictionary`, translate. The
   compiler lists every missing string.
2. Add it to `LOCALES` and the `Locale` type in `src/i18n/index.ts`.
3. Set its `locale` field (e.g. `"pt-BR"`), which drives date and time formatting, and
   widen `LocaleTag` in `src/lib/dates.ts`.
4. Turn the toggle (`src/components/LangToggle.tsx`) into a picker if there are
   more than two languages. The command bar automatically asks clarifying questions
   in the UI language.

---

## Data model (short)

- `households`, `household_members` (role default `member`), `household_invites`
- `people`: everyone in the family, each with a palette color
- `pillars`: config rows synced from code (`sensitive` drives the AI/raw-input rules)
- `items`: `kind` event | routine | task | project | record; `person_id` and
  `responsible_person_id` (who drives / hosts); `starts_on` / `ends_on` + local
  `start_time` / `end_time` + RRULE `recurrence`; `due_date`; `status`, `priority`,
  `next_action`, `waiting_on`, `budget`, progress; `parent_id` (project → steps);
  `template_id`; `countdown`; calendar-sync fields `source` / `external_id` /
  `calendar_id` (unique per source + calendar, so imports never duplicate)
- `schedule_templates`: e.g. school, applied per child with `apply_template()`
- `record_links`: records hold status + https links only; a check constraint rejects SSN-shaped and long digit runs
- `routine_completions`: one row per day a routine was done (streaks)
- `activity_log`: append-only; `raw_input` scrubbed for private pillars

Times are stored as local dates and times in the household's timezone (default
America/New_York), so a 7:30 drop-off stays 7:30 across DST.

## Phase 2 (designed, not built)

- **Calendar sync:** two-way sync with one shared Google Calendar named "La Casita"
  (the wall Skylight already reads Google), dedupe on `external_id`, a read-only ICS
  feed for Apple. The work calendar is **never** ingested; work stays as manual busy blocks.
- Full layouts for Family & Events, Health, Extended Family, Relative's Projects,
  Business Wind-down, Item Sales (the kanban is ready for it), Household Finances.
- Voice input for the command bar (Sovereign's mic code in `reference/` is the
  starting point; es-US / en-US).

## What came from Sovereign

Reused and adapted: the Claude command bar (JSON actions, clarify-on-ambiguity,
10s undo; now accent-aware Spanish matching and structured outputs), `activity_log`,
the kanban (now generic, with stacked columns on phones), optimistic updates with
rollback, the toast system (every mutation toasts), the Supabase SSR clients and
`proxy.ts`, and the `Record<Key, …>` completeness rule. Not reused: the hardcoded
domain check constraint, the `ALLOWED_EMAIL` single-user auth, and the Obsidian &
Brass theme.

-- La Casita Especial · 0005 · apply_template() + seed_household()
--
-- Both run as the caller (security invoker), so RLS still applies: you can
-- only apply templates and seed data inside your own household.

create or replace function pick_lang(p_locale text, p_en text, p_es text) returns text
language sql immutable as $$
  select case when p_locale = 'es' then p_es else p_en end;
$$;

/**
 * Applies a schedule template to one person: one recurring event per slot.
 * Re-applying replaces that person's school blocks (e.g. new times) but keeps
 * their drop-offs and pickups, which carry per-day exceptions — those are
 * only re-dated, so changing a start date moves the whole schedule.
 * With p_driver set, default drop-off/pickup items are created the first time.
 */
create or replace function apply_template(
  p_template uuid,
  p_person uuid,
  p_starts_on date,
  p_ends_on date default null,
  p_driver uuid default null,
  p_locale text default 'en'
) returns int
language plpgsql security invoker set search_path = public as $$
declare
  t schedule_templates;
  slot jsonb;
  who text;
  n int := 0;
  has_rides boolean;
begin
  select * into t from schedule_templates where id = p_template;
  if t.id is null then raise exception 'template not found'; end if;
  select name into who from people where id = p_person and household_id = t.household_id;
  if who is null then raise exception 'person not found'; end if;

  delete from items where template_id = t.id and person_id = p_person and tag = 'school';
  update items set starts_on = p_starts_on, ends_on = p_ends_on
  where template_id = t.id and person_id = p_person and tag in ('dropoff','pickup');

  select exists (
    select 1 from items where template_id = t.id and person_id = p_person and tag in ('dropoff','pickup')
  ) into has_rides;

  for slot in select * from jsonb_array_elements(t.slots) loop
    insert into items (household_id, pillar_key, person_id, kind, tag, title, location,
                       starts_on, ends_on, start_time, end_time, recurrence, template_id)
    values (t.household_id, t.pillar_key, p_person, 'event', 'school', slot ->> 'title', t.location,
            p_starts_on, p_ends_on, (slot ->> 'start')::time, (slot ->> 'end')::time,
            'FREQ=WEEKLY;BYDAY=' || (slot ->> 'days'), t.id);
    n := n + 1;

    if p_driver is not null and not has_rides then
      insert into items (household_id, pillar_key, person_id, responsible_person_id, kind, tag, title,
                         location, starts_on, ends_on, start_time, recurrence, template_id)
      values
        (t.household_id, t.pillar_key, p_person, p_driver, 'event', 'dropoff',
         pick_lang(p_locale, 'Drop-off · ', 'Dejar a ') || who, t.location,
         p_starts_on, p_ends_on, (slot ->> 'start')::time, 'FREQ=WEEKLY;BYDAY=' || (slot ->> 'days'), t.id),
        (t.household_id, t.pillar_key, p_person, p_driver, 'event', 'pickup',
         pick_lang(p_locale, 'Pickup · ', 'Recoger a ') || who, t.location,
         p_starts_on, p_ends_on, (slot ->> 'end')::time, 'FREQ=WEEKLY;BYDAY=' || (slot ->> 'days'), t.id);
    end if;
  end loop;
  return n;
end;
$$;

/**
 * Real starter schedule (first names only). Requires the household's pillar
 * rows to exist — the app syncs them from src/config/pillars.ts first.
 * Refuses to run twice.
 */
create or replace function seed_household(p_household uuid, p_locale text default 'en')
returns void
language plpgsql security invoker set search_path = public as $$
declare
  L text := case when p_locale = 'es' then 'es' else 'en' end;
  moni uuid; andy uuid; gabi uuid; ali uuid; abuelo uuid; mamita uuid;
  school uuid;
  proj uuid;
  ali_start date := date '2026-12-01';    -- exact date TBD
  gabi_start date := date '2026-08-10';
  since date := current_date - 28;
begin
  if not is_member(p_household) then raise exception 'not a member'; end if;
  if exists (select 1 from people where household_id = p_household) then
    raise exception 'household already has data';
  end if;
  if (select count(*) from pillars where household_id = p_household and key in ('kids','work','home','faith','family')) < 5 then
    raise exception 'pillars must be synced before seeding';
  end if;

  insert into people (household_id, name, relation, color, sort_order) values
    (p_household, 'Moni',   'self',        'blue',     1) returning id into moni;
  insert into people (household_id, name, relation, color, sort_order) values
    (p_household, 'Andy',   'partner',     'teal',     2) returning id into andy;
  insert into people (household_id, name, relation, color, sort_order) values
    (p_household, 'Gabi',   'child',       'coral',    3) returning id into gabi;
  insert into people (household_id, name, relation, color, sort_order) values
    (p_household, 'Ali',    'child',       'lavender', 4) returning id into ali;
  insert into people (household_id, name, relation, color, sort_order) values
    (p_household, 'Abuelo', 'grandparent', 'amber',    5) returning id into abuelo;
  insert into people (household_id, name, relation, color, sort_order) values
    (p_household, 'Mamita', 'grandparent', 'rose',     6) returning id into mamita;

  -- Link the person record to whoever is seeding (they can change it in Settings).
  update household_members set person_id = moni
  where household_id = p_household and user_id = auth.uid() and person_id is null;

  /* ---------- Kids: school, built once and applied twice ---------- */
  insert into schedule_templates (household_id, pillar_key, name, location, slots)
  values (p_household, 'kids', pick_lang(L, 'School', 'Escuela'), pick_lang(L, 'School', 'Escuela'),
    jsonb_build_array(
      jsonb_build_object('days','MO,TU,TH,FR','start','07:30','end','14:50','title', pick_lang(L,'School','Escuela')),
      jsonb_build_object('days','WE','start','07:30','end','14:00','title', pick_lang(L,'School · early release','Escuela · salida temprano'))
    ))
  returning id into school;

  -- Mom drops off every morning and picks up every afternoon by default…
  perform apply_template(school, gabi, gabi_start, null, moni, L);
  perform apply_template(school, ali,  ali_start,  null, moni, L);

  -- …with the real exceptions:
  -- Wed: Abuelo picks up Gabi at 2:00 and brings her home at 6:30.
  update items set responsible_person_id = abuelo
  where template_id = school and person_id = gabi and tag = 'pickup' and recurrence like '%BYDAY=WE';
  -- Gabi's Friday pickup moves to 4:15 (chess club). Split Fri off Mon/Tue/Thu.
  update items set recurrence = 'FREQ=WEEKLY;BYDAY=MO,TU,TH'
  where template_id = school and person_id = gabi and tag = 'pickup' and recurrence like '%MO,TU,TH,FR';
  insert into items (household_id, pillar_key, person_id, responsible_person_id, kind, tag, title, location,
                     starts_on, start_time, recurrence, template_id)
  values (p_household, 'kids', gabi, moni, 'event', 'pickup', pick_lang(L,'Pickup · Gabi (after chess)','Recoger a Gabi (después de ajedrez)'),
          pick_lang(L,'School','Escuela'), gabi_start, '16:15', 'FREQ=WEEKLY;BYDAY=FR', school);
  -- Fri: Abuelo picks up Ali at school and brings her home at 6:30.
  update items set recurrence = 'FREQ=WEEKLY;BYDAY=MO,TU,TH'
  where template_id = school and person_id = ali and tag = 'pickup' and recurrence like '%MO,TU,TH,FR';
  insert into items (household_id, pillar_key, person_id, responsible_person_id, kind, tag, title, location,
                     starts_on, start_time, recurrence, template_id)
  values (p_household, 'kids', ali, abuelo, 'event', 'pickup', pick_lang(L,'Pickup · Ali','Recoger a Ali'),
          pick_lang(L,'School','Escuela'), ali_start, '14:50', 'FREQ=WEEKLY;BYDAY=FR', school);

  -- Abuelo brings the girls home (part of the school schedule, so they move with it)
  insert into items (household_id, pillar_key, person_id, responsible_person_id, kind, tag, title, location,
                     starts_on, start_time, recurrence, template_id) values
    (p_household, 'kids', gabi, abuelo, 'event', 'dropoff', pick_lang(L,'Abuelo brings Gabi home','Abuelo trae a Gabi a casa'),
     pick_lang(L,'Home','Casa'), gabi_start, '18:30', 'FREQ=WEEKLY;BYDAY=WE', school),
    (p_household, 'kids', ali, abuelo, 'event', 'dropoff', pick_lang(L,'Abuelo brings Ali home','Abuelo trae a Ali a casa'),
     pick_lang(L,'Home','Casa'), ali_start, '18:30', 'FREQ=WEEKLY;BYDAY=FR', school);

  insert into items (household_id, pillar_key, person_id, responsible_person_id, kind, tag, title, location,
                     starts_on, ends_on, start_time, end_time, recurrence, details) values
    -- Gabi
    (p_household, 'kids', gabi, null, 'event', 'activity', pick_lang(L,'Volleyball (schedule TBD)','Voleibol (horario por confirmar)'),
     null, since, null, '15:00', null, 'FREQ=WEEKLY;BYDAY=MO',
     pick_lang(L,'Cross country ended. Volleyball likely — update times when confirmed.','Terminó cross country. Probablemente voleibol: actualiza el horario cuando se confirme.')),
    (p_household, 'kids', gabi, null, 'event', 'activity', pick_lang(L,'Chess club','Club de ajedrez'),
     pick_lang(L,'School','Escuela'), gabi_start, null, '14:50', '16:15', 'FREQ=WEEKLY;BYDAY=FR', null),
    -- Ali
    (p_household, 'kids', ali, null, 'event', 'activity', pick_lang(L,'Swimming','Natación'),
     null, since, null, '17:15', null, 'FREQ=WEEKLY;BYDAY=WE', null),
    (p_household, 'kids', ali, null, 'event', 'activity', pick_lang(L,'Dance','Baile'),
     pick_lang(L,'Dance studio','Estudio de baile'), since, null, '15:30', '16:15', 'FREQ=WEEKLY;BYDAY=TH', null),
    (p_household, 'kids', ali, andy, 'event', 'dropoff', pick_lang(L,'Drop-off · Ali at dance','Dejar a Ali en baile'),
     pick_lang(L,'Dance studio','Estudio de baile'), since, null, '15:30', null, 'FREQ=WEEKLY;BYDAY=TH', null),
    (p_household, 'kids', ali, moni, 'event', 'pickup', pick_lang(L,'Pickup · Ali at dance','Recoger a Ali en baile'),
     pick_lang(L,'Dance studio','Estudio de baile'), since, null, '16:15', null, 'FREQ=WEEKLY;BYDAY=TH', null);

  -- Routines and reminders
  insert into items (household_id, pillar_key, person_id, kind, tag, title, starts_on, recurrence, details) values
    (p_household, 'kids', gabi, 'routine', 'homework', pick_lang(L,'Homework day — plan the week''s packet','Día de tareas: planear el paquete de la semana'),
     since, 'FREQ=WEEKLY;BYDAY=TU', pick_lang(L,'A week of homework is handed out on Tuesdays.','Los martes entregan las tareas de toda la semana.')),
    (p_household, 'kids', null, 'routine', 'uniform', pick_lang(L,'Collect and wash uniforms','Recoger y lavar uniformes'),
     since, 'FREQ=WEEKLY;BYDAY=SA,SU', null);

  insert into items (household_id, pillar_key, person_id, kind, tag, title, due_date, details) values
    (p_household, 'kids', ali, 'task', 'school', pick_lang(L,'Confirm Ali''s first day at school','Confirmar el primer día de Ali en la escuela'),
     date '2026-11-20', pick_lang(L,'Her schedule is set to start Dec 1 — change it once the date is known.','Su horario empieza el 1 de dic.: cámbialo cuando se sepa la fecha.')),
    (p_household, 'kids', ali, 'task', 'uniform', pick_lang(L,'Order Ali''s school uniforms','Pedir los uniformes de Ali'), date '2026-11-25', null),
    (p_household, 'kids', ali, 'task', 'supplies', pick_lang(L,'School supplies for Ali','Útiles escolares para Ali'), date '2026-11-28', null),
    (p_household, 'kids', null, 'task', 'school_event', pick_lang(L,'Add the school events calendar link','Agregar el enlace del calendario de eventos escolares'),
     null, pick_lang(L,'Paste it in Settings when it arrives.','Pégalo en Ajustes cuando llegue.')),
    (p_household, 'kids', gabi, 'task', 'teacher_meeting', pick_lang(L,'Schedule a teacher meeting','Agendar reunión con la maestra'), null, null);

  /* ---------- Work (sensitive): generic titles, manual entry ---------- */
  insert into items (household_id, pillar_key, kind, title, status, priority, due_date, next_action)
  values (p_household, 'work', 'project', pick_lang(L,'Project A','Proyecto A'), 'in_progress', 1,
          current_date + 10, pick_lang(L,'Draft the outline','Redactar el esquema'))
  returning id into proj;
  insert into items (household_id, pillar_key, kind, parent_id, title, status, sort_order) values
    (p_household, 'work', 'task', proj, pick_lang(L,'Kickoff notes','Notas de arranque'), 'done', 1),
    (p_household, 'work', 'task', proj, pick_lang(L,'Draft the outline','Redactar el esquema'), 'open', 2),
    (p_household, 'work', 'task', proj, pick_lang(L,'Review with lead','Revisar con el líder'), 'open', 3);
  insert into items (household_id, pillar_key, kind, title, status, waiting_on, next_action) values
    (p_household, 'work', 'project', pick_lang(L,'Project B','Proyecto B'), 'waiting',
     pick_lang(L,'Sign-off','Aprobación'), pick_lang(L,'Follow up Friday','Dar seguimiento el viernes'));
  insert into items (household_id, pillar_key, kind, title, due_date) values
    (p_household, 'work', 'task', pick_lang(L,'Prep for weekly 1:1','Preparar la reunión 1:1 semanal'), current_date + 2);

  /* ---------- Home Ops (light) ---------- */
  insert into items (household_id, pillar_key, kind, tag, title, starts_on, recurrence) values
    (p_household, 'home', 'routine', 'cleaning', pick_lang(L,'Weekly clean','Limpieza semanal'), since, 'FREQ=WEEKLY;BYDAY=SA'),
    (p_household, 'home', 'routine', 'groceries', pick_lang(L,'Grocery run','Ir al súper'), since, 'FREQ=WEEKLY;BYDAY=SU'),
    (p_household, 'home', 'routine', 'cleaning', pick_lang(L,'Take out the trash','Sacar la basura'), since, 'FREQ=WEEKLY;BYDAY=TU,FR');
  insert into items (household_id, pillar_key, kind, tag, title) values
    (p_household, 'home', 'task', 'groceries', pick_lang(L,'Milk','Leche')),
    (p_household, 'home', 'task', 'groceries', pick_lang(L,'Eggs','Huevos')),
    (p_household, 'home', 'task', 'organization', pick_lang(L,'Sort the girls'' closet','Organizar el clóset de las niñas'));
  insert into items (household_id, pillar_key, kind, title, status) values
    (p_household, 'home', 'project', pick_lang(L,'Organize the garage','Organizar el garaje'), 'in_progress')
  returning id into proj;
  insert into items (household_id, pillar_key, kind, parent_id, title, status, sort_order) values
    (p_household, 'home', 'task', proj, pick_lang(L,'Donate pile','Separar para donar'), 'done', 1),
    (p_household, 'home', 'task', proj, pick_lang(L,'Buy shelves','Comprar repisas'), 'open', 2),
    (p_household, 'home', 'task', proj, pick_lang(L,'Label bins','Etiquetar cajas'), 'open', 3);

  /* ---------- Faith (light) ---------- */
  insert into items (household_id, pillar_key, kind, title, starts_on, recurrence) values
    (p_household, 'faith', 'routine', pick_lang(L,'Sunday Mass','Misa dominical'), since, 'FREQ=WEEKLY;BYDAY=SU'),
    (p_household, 'faith', 'routine', pick_lang(L,'Daily visit','Visita diaria'), since, 'FREQ=DAILY'),
    (p_household, 'faith', 'routine', pick_lang(L,'Confession','Confesión'), since, 'FREQ=MONTHLY;BYDAY=1SA');
  insert into items (household_id, pillar_key, person_id, kind, title, progress_done, progress_total) values
    (p_household, 'faith', moni, 'task', pick_lang(L,'Bible reading (chapters)','Lectura de la Biblia (capítulos)'), 0, 1189);
  insert into items (household_id, pillar_key, person_id, kind, title, status) values
    (p_household, 'faith', moni, 'project', pick_lang(L,'Retreat leadership','Liderazgo del retiro'), 'open');

  /* ---------- Family & Events: countdowns ---------- */
  insert into items (household_id, pillar_key, kind, title, starts_on, recurrence, countdown, details) values
    (p_household, 'family', 'event', pick_lang(L,'Christmas','Navidad'), date '2026-12-25', 'FREQ=YEARLY', true, null);
  -- The three annual trips are projects with countdowns. Dates are placeholders.
  insert into items (household_id, pillar_key, kind, title, starts_on, countdown, details) values
    (p_household, 'family', 'project', pick_lang(L,'Trip 1','Viaje 1'), current_date + 45,  true, pick_lang(L,'Destination and date TBD','Destino y fecha por confirmar')),
    (p_household, 'family', 'project', pick_lang(L,'Trip 2','Viaje 2'), current_date + 150, true, pick_lang(L,'Destination and date TBD','Destino y fecha por confirmar')),
    (p_household, 'family', 'project', pick_lang(L,'Trip 3','Viaje 3'), current_date + 260, true, pick_lang(L,'Destination and date TBD','Destino y fecha por confirmar'));
end;
$$;

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, dict, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n";
import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import { PILLAR_KEYS, PILLARS } from "@/config/pillars";
import { DEFAULT_TZ } from "@/lib/dates";
import type { Household } from "@/lib/types";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export async function getT() {
  return dict(await getLocale());
}

export interface Session {
  supabase: Supabase;
  userId: string | null;
  email: string | null;
  household: Household | null;
  personId: string | null;
}

/** The signed-in user and their household (one per user). Cached per request. */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null, email: null, household: null, personId: null };

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, person_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let household: Household | null = null;
  if (membership) {
    const { data } = await supabase
      .from("households")
      .select("id, name, timezone, school_events_url")
      .eq("id", membership.household_id)
      .single();
    household = (data as Household | null) ?? null;
  }

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    household,
    personId: (membership?.person_id as string | null) ?? null,
  };
});

export interface HouseholdSession extends Session {
  userId: string;
  household: Household;
}

/** For pages inside the app: signed in AND in a household, or redirect. */
export async function requireHousehold(): Promise<HouseholdSession> {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (!session.household) redirect("/onboarding");
  return session as HouseholdSession;
}

export function householdTZ(household: Household | null): string {
  return household?.timezone || DEFAULT_TZ;
}

/**
 * Keeps the household's `pillars` rows in step with src/config/pillars.ts.
 * Upserts only what differs, so a normal page load costs one small select.
 */
export async function syncPillars(supabase: Supabase, householdId: string): Promise<void> {
  const { data } = await supabase
    .from("pillars")
    .select("key, name_en, name_es, icon, sensitive, sort_order")
    .eq("household_id", householdId);

  const wanted = PILLAR_KEYS.map((key) => ({
    household_id: householdId,
    key,
    name_en: en.pillars[key].name,
    name_es: es.pillars[key].name,
    icon: PILLARS[key].icon,
    sensitive: PILLARS[key].sensitive,
    sort_order: PILLARS[key].sortOrder,
  }));

  const stale = wanted.filter((row) => {
    const current = data?.find((existing) => existing.key === row.key);
    return (
      !current ||
      current.name_en !== row.name_en ||
      current.name_es !== row.name_es ||
      current.icon !== row.icon ||
      current.sensitive !== row.sensitive ||
      current.sort_order !== row.sort_order
    );
  });

  if (stale.length > 0) {
    const { error } = await supabase.from("pillars").upsert(stale, { onConflict: "household_id,key" });
    if (error) console.error("Pillar sync failed:", error.message);
  }
}

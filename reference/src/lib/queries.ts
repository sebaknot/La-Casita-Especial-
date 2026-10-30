import { createClient } from "@/lib/supabase/server";
import { isoDaysFromToday, todayISO } from "@/lib/dates";
import {
  emptyDomainStats,
  type ActivityEntry,
  type AppSettings,
  type CpaSection,
  type Domain,
  type DomainStats,
  type Item,
  type LawSchoolPrep,
  type Loan,
} from "@/lib/types";

/** All non-archived items for a domain, parents and their updates alike. */
export async function getDomainItems(domain: Domain): Promise<Item[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("domain", domain)
    .neq("status", "archived")
    .order("status", { ascending: true })
    .order("priority", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as Item[];
}

export async function getLoans(): Promise<Loan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("loans")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data ?? []) as Loan[];
}

export async function getLawSchoolPrep(): Promise<LawSchoolPrep | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("law_school_prep")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data as LawSchoolPrep | null;
}

export async function getCpaSections(): Promise<CpaSection[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cpa_sections")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data ?? []) as CpaSection[];
}

export async function getAppSettings(): Promise<AppSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data as AppSettings | null;
}

export async function getActivity(limit = 20): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ActivityEntry[];
}

export interface HomeData {
  openItems: Item[];
  criticalCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
  perDomain: Record<Domain, DomainStats>;
  activeLoans: number;
  activity: ActivityEntry[];
}

export async function getHomeData(): Promise<HomeData> {
  const supabase = await createClient();
  const today = todayISO();
  const weekOut = isoDaysFromToday(7);

  const [itemsResult, loansResult, activityResult] = await Promise.all([
    supabase
      .from("items")
      .select("*")
      .in("status", ["open", "in_progress"])
      .neq("type", "update") // updates live inside their parent, not on the board
      .order("priority", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("loans")
      .select("id,stage")
      .not("stage", "in", "(closed,dead)"),
    supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const openItems = (itemsResult.data ?? []) as Item[];

  // Seeded from the canonical domain list, never from the query result — a
  // domain with zero rows must still have an entry.
  const perDomain = emptyDomainStats();

  let criticalCount = 0;
  let dueTodayCount = 0;
  let dueThisWeekCount = 0;

  for (const item of openItems) {
    const counts = perDomain[item.domain];
    if (!counts) continue;
    counts.open += 1;
    if (item.priority === 1) {
      counts.critical += 1;
      criticalCount += 1;
    }
    if (item.due_date) {
      if (item.due_date <= today) dueTodayCount += 1;
      else if (item.due_date <= weekOut) dueThisWeekCount += 1;
    }
  }

  const activeLoans = loansResult.data?.length ?? 0;
  // The mortgages node also counts its live pipeline as open work.
  perDomain.mortgages.open += activeLoans;

  return {
    openItems,
    criticalCount,
    dueTodayCount,
    dueThisWeekCount,
    perDomain,
    activeLoans,
    activity: (activityResult.data ?? []) as ActivityEntry[],
  };
}

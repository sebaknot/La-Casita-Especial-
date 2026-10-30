export type Domain =
  | "taxonomy"
  | "unit77"
  | "porter"
  | "mortgages"
  | "lawschool"
  | "cpa"
  | "fastc"
  | "personal";

export type ItemType = "task" | "update" | "deadline" | "note";
export type ItemStatus = "open" | "in_progress" | "done" | "archived";
export type Subgroup = "family" | "goals";

export interface Item {
  id: string;
  domain: Domain;
  type: ItemType;
  title: string;
  details: string | null;
  status: ItemStatus;
  priority: 1 | 2 | 3;
  due_date: string | null; // YYYY-MM-DD
  created_at: string;
  completed_at: string | null;
  parent_id: string | null;
  loan_id: string | null;
  subgroup: Subgroup | null;
}

export type LoanStage =
  | "lead"
  | "application"
  | "disclosures"
  | "processing"
  | "underwriting"
  | "conditions"
  | "clear_to_close"
  | "closed"
  | "dead";

export interface Loan {
  id: string;
  borrower_label: string;
  state: "FL" | "GA";
  loan_type: string | null;
  stage: LoanStage;
  target_close: string | null;
  next_action: string | null;
  notes: string | null;
  updated_at: string;
}

export type ActivitySource = "ui" | "command" | "voice";

export interface ActivityEntry {
  id: string;
  domain: string | null;
  action: string;
  source: ActivitySource;
  raw_input: string | null;
  created_at: string;
}

/* ---------------- Trackers ---------------- */

export interface LawSchoolPrep {
  id: 1;
  lsat_date: string | null;
  lsat_registered: boolean;
  lsat_taken: boolean;
  personal_statement: boolean;
  recommendations: boolean;
  transcripts_ordered: boolean;
  cas_report: boolean;
  application_submitted: boolean;
}

export type LawSchoolMilestone = Exclude<keyof LawSchoolPrep, "id" | "lsat_date">;

export const LAW_SCHOOL_MILESTONES: {
  key: LawSchoolMilestone;
  label: string;
}[] = [
  { key: "lsat_registered", label: "LSAT registered" },
  { key: "lsat_taken", label: "LSAT taken" },
  { key: "personal_statement", label: "Personal statement" },
  { key: "recommendations", label: "Letters of rec" },
  { key: "transcripts_ordered", label: "Transcripts ordered" },
  { key: "cas_report", label: "CAS report" },
  { key: "application_submitted", label: "Application submitted" },
];

export type CpaSectionId = "AUD" | "FAR" | "REG" | "DISCIPLINE";
export type CpaStatus = "not_started" | "studying" | "scheduled" | "passed";

export interface CpaSection {
  section: CpaSectionId;
  label: string;
  status: CpaStatus;
  exam_date: string | null;
  score: number | null;
  sort_order: number;
}

export const CPA_STATUSES: { id: CpaStatus; label: string }[] = [
  { id: "not_started", label: "Not started" },
  { id: "studying", label: "Studying" },
  { id: "scheduled", label: "Scheduled" },
  { id: "passed", label: "Passed" },
];

/** The discipline section is one of three choices under CPA Evolution. */
export const CPA_DISCIPLINES = ["BAR", "ISC", "TCP"] as const;

export interface AppSettings {
  id: 1;
  fastc_schedule_url: string | null;
  fastc_schedule_label: string | null;
}

/* ---------------- Domain registry ---------------- */

export const DOMAINS: Domain[] = [
  "taxonomy",
  "unit77",
  "porter",
  "mortgages",
  "lawschool",
  "cpa",
  "fastc",
  "personal",
];

export const DOMAIN_META: Record<
  Domain,
  { label: string; short: string; path: string; blurb: string }
> = {
  taxonomy: {
    label: "Taxonomy",
    short: "Taxonomy",
    path: "/taxonomy",
    blurb: "Tax firm",
  },
  unit77: {
    label: "Unit 77",
    short: "Unit 77",
    path: "/unit77",
    blurb: "AI automation agency",
  },
  porter: {
    label: "Porter",
    short: "Porter",
    path: "/porter",
    blurb: "Logistics startup",
  },
  mortgages: {
    label: "Mortgages",
    short: "Mortgages",
    path: "/mortgages",
    blurb: "Loan origination · FL / GA",
  },
  lawschool: {
    label: "Law School Prep",
    short: "Law",
    path: "/lawschool",
    blurb: "LSAT and applications",
  },
  cpa: {
    label: "CPA Exam Prep",
    short: "CPA",
    path: "/cpa",
    blurb: "AUD · FAR · REG · Discipline",
  },
  fastc: {
    label: "FASTC",
    short: "FASTC",
    path: "/fastc",
    blurb: "Federal training",
  },
  personal: {
    label: "Personal",
    short: "Personal",
    path: "/personal",
    blurb: "Family, goals, and admin",
  },
};

/**
 * Type identity used everywhere: list rows, home board, filter chips, badges.
 * Disciplined — a left border and a badge, never a tinted card background.
 */
export const TYPE_META: Record<
  ItemType,
  { label: string; border: string; badge: string; dot: string }
> = {
  task: {
    label: "Task",
    border: "border-l-signal",
    badge: "border-signal/45 text-signal",
    dot: "bg-signal",
  },
  note: {
    label: "Note",
    border: "border-l-warmstone",
    badge: "border-warmstone/45 text-warmstone",
    dot: "bg-warmstone",
  },
  deadline: {
    label: "Deadline",
    border: "border-l-danger",
    badge: "border-danger/50 text-danger",
    dot: "bg-danger",
  },
  update: {
    label: "Update",
    border: "border-l-brass",
    badge: "border-brass-soft text-brass",
    dot: "bg-brass",
  },
};

export const LOAN_STAGES: { id: LoanStage; label: string }[] = [
  { id: "lead", label: "Lead" },
  { id: "application", label: "Application" },
  { id: "disclosures", label: "Disclosures" },
  { id: "processing", label: "Processing" },
  { id: "underwriting", label: "Underwriting" },
  { id: "conditions", label: "Conditions" },
  { id: "clear_to_close", label: "Clear to Close" },
  { id: "closed", label: "Closed" },
  { id: "dead", label: "Dead" },
];

/** Types that can stand on their own. Updates are always children. */
export const PARENT_TYPES: { id: Exclude<ItemType, "update">; label: string }[] = [
  { id: "task", label: "Task" },
  { id: "note", label: "Note" },
  { id: "deadline", label: "Deadline" },
];

export const ITEM_TYPES: { id: ItemType; label: string }[] = [
  { id: "task", label: "Task" },
  { id: "update", label: "Update" },
  { id: "deadline", label: "Deadline" },
  { id: "note", label: "Note" },
];

export function isDomain(value: unknown): value is Domain {
  return typeof value === "string" && (DOMAINS as string[]).includes(value);
}

/* ---------------- Per-domain stats ---------------- */

export interface DomainStats {
  open: number;
  critical: number;
}

export const EMPTY_DOMAIN_STATS: DomainStats = { open: 0, critical: 0 };

/**
 * A zeroed entry for every domain.
 *
 * Written as an explicit literal on purpose: `Record<Domain, DomainStats>`
 * makes TypeScript reject this function if a domain is ever added to the
 * union without a seed here. Do not replace it with `{} as Record<…>` or a
 * reduce over query rows — deriving the key set from data is how a domain
 * with zero rows ends up undefined at read time.
 */
export function emptyDomainStats(): Record<Domain, DomainStats> {
  return {
    taxonomy: { ...EMPTY_DOMAIN_STATS },
    unit77: { ...EMPTY_DOMAIN_STATS },
    porter: { ...EMPTY_DOMAIN_STATS },
    mortgages: { ...EMPTY_DOMAIN_STATS },
    lawschool: { ...EMPTY_DOMAIN_STATS },
    cpa: { ...EMPTY_DOMAIN_STATS },
    fastc: { ...EMPTY_DOMAIN_STATS },
    personal: { ...EMPTY_DOMAIN_STATS },
  };
}

export function isLoanStage(value: unknown): value is LoanStage {
  return typeof value === "string" && LOAN_STAGES.some((s) => s.id === value);
}

export function isItemType(value: unknown): value is ItemType {
  return typeof value === "string" && ITEM_TYPES.some((t) => t.id === value);
}

export function isSubgroup(value: unknown): value is Subgroup {
  return value === "family" || value === "goals";
}

/** A parent item with its update thread attached, newest last. */
export interface ItemNode {
  item: Item;
  updates: Item[];
}

/** Groups a flat item list into parents + their update threads. */
export function buildItemTree(items: Item[]): ItemNode[] {
  const parents = items.filter((item) => !item.parent_id);
  const byParent = new Map<string, Item[]>();

  for (const item of items) {
    if (!item.parent_id) continue;
    const bucket = byParent.get(item.parent_id);
    if (bucket) bucket.push(item);
    else byParent.set(item.parent_id, [item]);
  }

  return parents.map((item) => ({
    item,
    updates: (byParent.get(item.id) ?? []).sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
  }));
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveRole, can } from "@/lib/auth/roles";
import {
  isDomain,
  isItemType,
  isLoanStage,
  isSubgroup,
  LOAN_STAGES,
  type ActivitySource,
  type CpaSectionId,
  type CpaStatus,
  type Domain,
  type Item,
  type ItemStatus,
  type ItemType,
  type LawSchoolMilestone,
  type Loan,
  type LoanStage,
  type Subgroup,
} from "@/lib/types";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function authorizedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!can.write(resolveRole(user?.email))) return null;
  return supabase;
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: {
    domain?: string | null;
    action: string;
    source?: ActivitySource;
    raw_input?: string | null;
  },
) {
  await supabase.from("activity_log").insert({
    domain: entry.domain ?? null,
    action: entry.action,
    source: entry.source ?? "ui",
    raw_input: entry.raw_input ?? null,
  });
}

function refresh() {
  revalidatePath("/", "layout");
}

/* ---------------- Items ---------------- */

export async function createItem(input: {
  domain: Domain;
  type: ItemType;
  title: string;
  details?: string | null;
  priority?: 1 | 2 | 3;
  due_date?: string | null;
  subgroup?: Subgroup | null;
  loan_id?: string | null;
}): Promise<ActionResult<Item>> {
  const supabase = await authorizedClient();
  if (!supabase) return { ok: false, error: "Unauthorized" };

  if (!isDomain(input.domain) || !isItemType(input.type) || !input.title.trim())
    return { ok: false, error: "Invalid item" };

  // Updates are never top-level — they belong to a task or note.
  if (input.type === "update")
    return { ok: false, error: "Updates must be attached to a task or note" };

  const { data, error } = await supabase
    .from("items")
    .insert({
      domain: input.domain,
      type: input.type,
      title: input.title.trim(),
      details: input.details?.trim() || null,
      priority: input.priority ?? 2,
      due_date: input.due_date || null,
      subgroup: isSubgroup(input.subgroup) ? input.subgroup : null,
      loan_id: input.loan_id || null,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    domain: input.domain,
    action: `Added ${input.type} “${input.title.trim()}”`,
  });
  refresh();
  return { ok: true, data: data as Item };
}

/** Attaches an update to an existing task or note. */
export async function addUpdate(
  parentId: string,
  text: string,
): Promise<ActionResult<Item>> {
  const supabase = await authorizedClient();
  if (!supabase) return { ok: false, error: "Unauthorized" };
  if (!text.trim()) return { ok: false, error: "Update text required" };

  const { data: parent, error: parentError } = await supabase
    .from("items")
    .select("id,domain,title,type")
    .eq("id", parentId)
    .single();
  if (parentError || !parent) return { ok: false, error: "Parent not found" };
  if (parent.type === "update")
    return { ok: false, error: "Can't attach an update to another update" };

  const { data, error } = await supabase
    .from("items")
    .insert({
      domain: parent.domain,
      type: "update",
      title: text.trim(),
      parent_id: parent.id,
      priority: 2,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    domain: parent.domain,
    action: `Update on “${parent.title}”`,
  });
  refresh();
  return { ok: true, data: data as Item };
}

export async function updateItem(
  id: string,
  patch: Partial<
    Pick<
      Item,
      | "title"
      | "details"
      | "type"
      | "status"
      | "priority"
      | "due_date"
      | "subgroup"
      | "loan_id"
    >
  >,
  options?: { silent?: boolean },
): Promise<ActionResult<Item>> {
  const supabase = await authorizedClient();
  if (!supabase) return { ok: false, error: "Unauthorized" };

  const update: Record<string, unknown> = { ...patch };
  if (patch.status === "done") update.completed_at = new Date().toISOString();
  if (patch.status && patch.status !== "done") update.completed_at = null;

  const { data, error } = await supabase
    .from("items")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  const item = data as Item;

  // Completing or archiving a parent carries its update thread along.
  if (patch.status === "done" || patch.status === "archived") {
    await supabase
      .from("items")
      .update({
        status: patch.status,
        completed_at: patch.status === "done" ? new Date().toISOString() : null,
      })
      .eq("parent_id", id);
  } else if (patch.status === "open" || patch.status === "in_progress") {
    await supabase
      .from("items")
      .update({ status: patch.status, completed_at: null })
      .eq("parent_id", id);
  }

  if (!options?.silent) {
    const verb =
      patch.status === "done"
        ? `Completed “${item.title}”`
        : patch.status === "archived"
          ? `Archived “${item.title}”`
          : patch.status === "open"
            ? `Reopened “${item.title}”`
            : `Updated “${item.title}”`;
    await logActivity(supabase, { domain: item.domain, action: verb });
  }
  refresh();
  return { ok: true, data: item };
}

export async function completeItem(id: string): Promise<ActionResult<Item>> {
  return updateItem(id, { status: "done" });
}

export async function setItemStatus(
  id: string,
  status: ItemStatus,
): Promise<ActionResult<Item>> {
  return updateItem(id, { status });
}

export async function setItemSubgroup(
  id: string,
  subgroup: Subgroup,
): Promise<ActionResult<Item>> {
  return updateItem(id, { subgroup }, { silent: true });
}

export async function deleteItem(id: string): Promise<ActionResult> {
  const supabase = await authorizedClient();
  if (!supabase) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function restoreItemStatus(
  id: string,
  status: ItemStatus,
): Promise<ActionResult<Item>> {
  return updateItem(id, { status }, { silent: true });
}

/* ---------------- Loans ---------------- */

export async function createLoan(input: {
  borrower_label: string;
  state: "FL" | "GA";
  loan_type?: string | null;
  stage?: LoanStage;
  target_close?: string | null;
  next_action?: string | null;
  notes?: string | null;
}): Promise<ActionResult<Loan>> {
  const supabase = await authorizedClient();
  if (!supabase) return { ok: false, error: "Unauthorized" };

  if (!input.borrower_label.trim() || !["FL", "GA"].includes(input.state))
    return { ok: false, error: "Invalid loan" };
  if (input.stage && !isLoanStage(input.stage))
    return { ok: false, error: "Invalid stage" };

  const { data, error } = await supabase
    .from("loans")
    .insert({
      borrower_label: input.borrower_label.trim(),
      state: input.state,
      loan_type: input.loan_type?.trim() || null,
      stage: input.stage ?? "lead",
      target_close: input.target_close || null,
      next_action: input.next_action?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    domain: "mortgages",
    action: `Added loan ${input.borrower_label.trim()} (${input.state})`,
  });
  refresh();
  return { ok: true, data: data as Loan };
}

export async function updateLoan(
  id: string,
  patch: Partial<
    Pick<
      Loan,
      | "borrower_label"
      | "state"
      | "loan_type"
      | "stage"
      | "target_close"
      | "next_action"
      | "notes"
    >
  >,
  options?: { silent?: boolean },
): Promise<ActionResult<Loan>> {
  const supabase = await authorizedClient();
  if (!supabase) return { ok: false, error: "Unauthorized" };

  if (patch.stage && !isLoanStage(patch.stage))
    return { ok: false, error: "Invalid stage" };

  const { data, error } = await supabase
    .from("loans")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  const loan = data as Loan;

  if (!options?.silent) {
    const action = patch.stage
      ? `Moved ${loan.borrower_label} to ${
          LOAN_STAGES.find((s) => s.id === patch.stage)?.label ?? patch.stage
        }`
      : `Updated loan ${loan.borrower_label}`;
    await logActivity(supabase, { domain: "mortgages", action });
  }
  refresh();
  return { ok: true, data: loan };
}

export async function deleteLoan(id: string): Promise<ActionResult> {
  const supabase = await authorizedClient();
  if (!supabase) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase.from("loans").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/* ---------------- Law School Prep ---------------- */

export async function updateLawSchool(patch: {
  lsat_date?: string | null;
  milestone?: { key: LawSchoolMilestone; value: boolean };
}): Promise<ActionResult> {
  const supabase = await authorizedClient();
  if (!supabase) return { ok: false, error: "Unauthorized" };

  const update: Record<string, unknown> = {};
  if (patch.lsat_date !== undefined) update.lsat_date = patch.lsat_date || null;
  if (patch.milestone) update[patch.milestone.key] = patch.milestone.value;
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase
    .from("law_school_prep")
    .update(update)
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    domain: "lawschool",
    action: patch.milestone
      ? `${patch.milestone.value ? "Completed" : "Reopened"} milestone: ${patch.milestone.key.replace(/_/g, " ")}`
      : `LSAT date → ${patch.lsat_date ?? "cleared"}`,
  });
  refresh();
  return { ok: true };
}

/* ---------------- CPA Exam Prep ---------------- */

export async function updateCpaSection(
  section: CpaSectionId,
  patch: {
    status?: CpaStatus;
    exam_date?: string | null;
    score?: number | null;
    label?: string;
  },
): Promise<ActionResult> {
  const supabase = await authorizedClient();
  if (!supabase) return { ok: false, error: "Unauthorized" };

  const update: Record<string, unknown> = {};
  if (patch.status) update.status = patch.status;
  if (patch.exam_date !== undefined) update.exam_date = patch.exam_date || null;
  if (patch.score !== undefined) update.score = patch.score;
  if (patch.label && section === "DISCIPLINE") update.label = patch.label;
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase
    .from("cpa_sections")
    .update(update)
    .eq("section", section);
  if (error) return { ok: false, error: error.message };

  if (patch.status) {
    await logActivity(supabase, {
      domain: "cpa",
      action: `${section} → ${patch.status.replace("_", " ")}`,
    });
  }
  refresh();
  return { ok: true };
}

/* ---------------- Settings (FASTC schedule link) ---------------- */

export async function updateScheduleLink(patch: {
  url: string | null;
  label: string | null;
}): Promise<ActionResult> {
  const supabase = await authorizedClient();
  if (!supabase) return { ok: false, error: "Unauthorized" };

  const url = patch.url?.trim() || null;
  if (url && !/^https?:\/\//i.test(url))
    return { ok: false, error: "Link must start with http:// or https://" };

  const { error } = await supabase
    .from("app_settings")
    .update({
      fastc_schedule_url: url,
      fastc_schedule_label: patch.label?.trim() || null,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    domain: "fastc",
    action: url ? "Updated schedule link" : "Cleared schedule link",
  });
  refresh();
  return { ok: true };
}

/* ---------------- Session ---------------- */

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRole, can } from "@/lib/auth/roles";
import { formatDue, todayISO } from "@/lib/dates";
import {
  isDomain,
  isItemType,
  isLoanStage,
  isSubgroup,
  DOMAIN_META,
  LOAN_STAGES,
  type Item,
  type Loan,
} from "@/lib/types";

export const runtime = "nodejs";

const MODEL = process.env.COMMAND_MODEL ?? "claude-sonnet-4-6";

interface CommandRequest {
  text: string;
  source: "command" | "voice";
}

type ParsedCommand =
  | { action: "create_item"; item: Record<string, unknown> }
  | { action: "update_item"; match: string; set: Record<string, unknown> }
  | { action: "add_update"; match: string; text: string }
  | { action: "create_loan"; loan: Record<string, unknown> }
  | { action: "update_loan"; match: string; set: Record<string, unknown> }
  | { action: "clarify"; question: string };

function systemPrompt(openItems: Item[], loans: Loan[]): string {
  const itemLines = openItems
    .slice(0, 60)
    .map((i) => `- [${i.domain}/${i.type}] ${i.title}`)
    .join("\n");
  const loanLines = loans
    .map((l) => `- ${l.borrower_label} (${l.state}, stage: ${l.stage})`)
    .join("\n");

  return `You parse natural-language commands for Sovereign, a personal command center. Today's date is ${todayISO()} (America/New_York).

Domains:
- taxonomy — the tax firm. Also said as "tax business", "the firm", "taxes", "Taxonomy".
- unit77 — AI automation agency. Also "unit 77", "the agency".
- porter — logistics startup.
- mortgages — loan origination pipeline plus the mortgage business itself (licensing, CE credits, lender onboarding, marketing).
- lawschool — Law School Prep: LSAT, personal statement, applications. Also "law school", "LSAT".
- cpa — CPA Exam Prep: AUD, FAR, REG, discipline section. Also "CPA", "the exam".
- fastc — federal training. Also "academy", "FASTC", "training".
- personal — everything personal: family, goals, VA claim, El Libro Gordo, admin.

Item types: task, deadline, note. (An "update" is never top-level — see add_update below.)
Item statuses: open, in_progress, done, archived. Priority: 1=critical, 2=normal (default), 3=low.
Personal items may carry a subgroup: "family" or "goals". Only the personal domain uses subgroup.
Loan stages: ${LOAN_STAGES.map((s) => s.id).join(", ")}. Loan states: FL, GA.

Currently open items:
${itemLines || "(none)"}

Loans in pipeline:
${loanLines || "(none)"}

Return ONLY a single JSON object — no prose, no markdown fences. One of:
{"action":"create_item","item":{"domain":"porter","type":"task","title":"Test QR return flow","details":"Steven finished it","priority":2,"due_date":"2026-07-10"}}
{"action":"create_item","item":{"domain":"personal","subgroup":"family","type":"task","title":"Book flights for mom's birthday"}}
{"action":"update_item","match":"stripe subscription links","set":{"status":"done"}}
{"action":"add_update","match":"stripe subscription links","text":"Links are live, tested both plans"}
{"action":"update_loan","match":"R.G.","set":{"stage":"underwriting","next_action":null}}
{"action":"create_loan","loan":{"borrower_label":"J.M.","state":"FL","stage":"application"}}
{"action":"clarify","question":"Which domain should this go in?"}

Rules:
- Resolve relative dates ("by Friday", "next week") to YYYY-MM-DD using today's date above.
- "details" captures secondary context; "title" is the actionable summary.
- Never emit type "update" in create_item. Progress reports about existing work ("Steven finished the QR flow", "sent the docs to underwriting", "note on the Vega return: client called back") are add_update: match the existing item and put the news in "text".
- Use add_update when the command reports something that happened to work that already exists. Use create_item when it asks for something new to be done.
- If a command both reports progress and asks for new work ("Steven finished the QR flow, test it by Friday"), prefer create_item for the new task and put the report in "details".
- For update_item / update_loan / add_update, "match" is a short phrase identifying the target from the lists above; only include changed fields in "set".
- For personal items, set subgroup to "family" or "goals" when the phrasing makes it clear ("add to family:", "my goal is", "for the kids"). Otherwise leave it out.
- If the domain is genuinely ambiguous, or an update/edit target doesn't clearly exist above, return the clarify action instead of guessing.`;
}

/** Case-insensitive fuzzy match; returns matches among candidates. */
function fuzzyMatch<T>(
  query: string,
  candidates: T[],
  keyOf: (candidate: T) => string,
): T[] {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s.]/g, " ").replace(/\s+/g, " ").trim();
  const q = normalize(query);
  if (!q) return [];

  const exact = candidates.filter((c) => normalize(keyOf(c)) === q);
  if (exact.length > 0) return exact;

  const substring = candidates.filter((c) => {
    const key = normalize(keyOf(c));
    return key.includes(q) || q.includes(key);
  });
  if (substring.length > 0) return substring;

  const tokens = q.split(" ").filter((t) => t.length > 2);
  if (tokens.length === 0) return [];
  return candidates.filter((c) => {
    const key = normalize(keyOf(c));
    return tokens.every((token) => key.includes(token));
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!can.write(resolveRole(user?.email))) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: CommandRequest;
  try {
    body = (await request.json()) as CommandRequest;
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid request" },
      { status: 400 },
    );
  }
  const text = (body.text ?? "").trim();
  const source = body.source === "voice" ? "voice" : "command";
  if (!text) {
    return NextResponse.json(
      { status: "error", message: "Empty command" },
      { status: 400 },
    );
  }

  // Context for the parser + fuzzy matching. Updates are children and are
  // never edit targets themselves, so they're excluded.
  const [itemsResult, loansResult] = await Promise.all([
    supabase
      .from("items")
      .select("*")
      .in("status", ["open", "in_progress"])
      .neq("type", "update")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("loans").select("*").not("stage", "in", "(closed,dead)"),
  ]);
  const openItems = (itemsResult.data ?? []) as Item[];
  const loans = (loansResult.data ?? []) as Loan[];

  let parsed: ParsedCommand;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(openItems, loans),
      messages: [{ role: "user", content: text }],
    });

    const raw = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    parsed = JSON.parse(raw) as ParsedCommand;
  } catch (error) {
    console.error("Command parse failed:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Couldn't parse that command. Try rephrasing.",
      },
      { status: 502 },
    );
  }

  async function log(domain: string | null, action: string) {
    await supabase.from("activity_log").insert({
      domain,
      action,
      source,
      raw_input: text,
    });
  }

  function clarify(question: string) {
    return NextResponse.json({ status: "clarify", question });
  }

  /** Resolves a fuzzy "match" phrase to exactly one open item. */
  type Resolution =
    | { ok: true; item: Item }
    | { ok: false; error: string };

  function resolveItem(match: string): Resolution {
    const matches = fuzzyMatch(String(match ?? ""), openItems, (i) => i.title);
    if (matches.length === 0)
      return {
        ok: false,
        error: `I couldn't find an open item matching “${match}”. Which item did you mean?`,
      };
    if (matches.length > 1)
      return {
        ok: false,
        error: `That matches ${matches.length} items: ${matches
          .slice(0, 4)
          .map((m) => `“${m.title}”`)
          .join(", ")}. Which one?`,
      };
    return { ok: true, item: matches[0] };
  }

  try {
    switch (parsed.action) {
      case "clarify":
        return clarify(
          String(parsed.question ?? "Can you be more specific?"),
        );

      case "create_item": {
        const item = parsed.item ?? {};
        const domain = item.domain;
        const title = typeof item.title === "string" ? item.title.trim() : "";

        if (!isDomain(domain) || !title)
          return clarify(
            "Which domain should this go in, and what's the task?",
          );

        // Updates can never be created top-level — reroute to add_update.
        if (item.type === "update") {
          const resolved = resolveItem(title);
          if (!resolved.ok)
            return clarify(
              `Updates attach to an existing task or note. ${resolved.error}`,
            );
          const { data, error } = await supabase
            .from("items")
            .insert({
              domain: resolved.item.domain,
              type: "update",
              title,
              parent_id: resolved.item.id,
              priority: 2,
            })
            .select()
            .single();
          if (error) throw error;
          await log(
            resolved.item.domain,
            `Update on “${resolved.item.title}”`,
          );
          return NextResponse.json({
            status: "executed",
            message: `Logged update on “${resolved.item.title}”`,
            undo: { op: "delete_item", id: (data as Item).id },
          });
        }

        const type = isItemType(item.type) ? item.type : "task";
        const priority =
          typeof item.priority === "number" &&
          item.priority >= 1 &&
          item.priority <= 3
            ? item.priority
            : 2;
        const due =
          typeof item.due_date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.due_date)
            ? item.due_date
            : null;
        const subgroup =
          domain === "personal" && isSubgroup(item.subgroup)
            ? item.subgroup
            : null;

        const { data, error } = await supabase
          .from("items")
          .insert({
            domain,
            type,
            title,
            details: typeof item.details === "string" ? item.details : null,
            priority,
            due_date: due,
            subgroup,
          })
          .select()
          .single();
        if (error) throw error;

        await log(domain, `Added ${type} “${title}”`);
        return NextResponse.json({
          status: "executed",
          message: `Added ${type} to ${DOMAIN_META[domain].short}${
            subgroup ? ` · ${subgroup}` : ""
          }${due ? ` · due ${formatDue(due)}` : ""}`,
          undo: { op: "delete_item", id: (data as Item).id },
        });
      }

      case "add_update": {
        const updateText =
          typeof parsed.text === "string" ? parsed.text.trim() : "";
        if (!updateText) return clarify("What's the update?");

        const resolved = resolveItem(parsed.match);
        if (!resolved.ok) return clarify(resolved.error);

        const { data, error } = await supabase
          .from("items")
          .insert({
            domain: resolved.item.domain,
            type: "update",
            title: updateText,
            parent_id: resolved.item.id,
            priority: 2,
          })
          .select()
          .single();
        if (error) throw error;

        await log(resolved.item.domain, `Update on “${resolved.item.title}”`);
        return NextResponse.json({
          status: "executed",
          message: `Logged update on “${resolved.item.title}”`,
          undo: { op: "delete_item", id: (data as Item).id },
        });
      }

      case "update_item": {
        const resolved = resolveItem(parsed.match);
        if (!resolved.ok) return clarify(resolved.error);
        const target = resolved.item;

        const set = parsed.set ?? {};
        const patch: Record<string, unknown> = {};
        if (
          typeof set.status === "string" &&
          ["open", "in_progress", "done", "archived"].includes(set.status)
        ) {
          patch.status = set.status;
          patch.completed_at =
            set.status === "done" ? new Date().toISOString() : null;
        }
        if (typeof set.title === "string" && set.title.trim())
          patch.title = set.title.trim();
        if (typeof set.details === "string" || set.details === null)
          patch.details = set.details;
        if (
          typeof set.priority === "number" &&
          set.priority >= 1 &&
          set.priority <= 3
        )
          patch.priority = set.priority;
        if (
          (typeof set.due_date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(set.due_date)) ||
          set.due_date === null
        )
          patch.due_date = set.due_date;
        if (isItemType(set.type) && set.type !== "update")
          patch.type = set.type;
        if (target.domain === "personal" && isSubgroup(set.subgroup))
          patch.subgroup = set.subgroup;

        if (Object.keys(patch).length === 0)
          return clarify(`What should change on “${target.title}”?`);

        const prev: Record<string, unknown> = {};
        for (const key of Object.keys(patch)) {
          prev[key] = (target as unknown as Record<string, unknown>)[key];
        }

        const { error } = await supabase
          .from("items")
          .update(patch)
          .eq("id", target.id);
        if (error) throw error;

        // Completing or archiving a parent carries its update thread along.
        if (patch.status === "done" || patch.status === "archived") {
          await supabase
            .from("items")
            .update({ status: patch.status })
            .eq("parent_id", target.id);
        }

        const message =
          patch.status === "done"
            ? `Marked “${target.title}” done`
            : `Updated “${target.title}”`;
        await log(target.domain, message);
        return NextResponse.json({
          status: "executed",
          message,
          undo: { op: "restore_item", id: target.id, prev },
        });
      }

      case "create_loan": {
        const loan = parsed.loan ?? {};
        const label =
          typeof loan.borrower_label === "string"
            ? loan.borrower_label.trim()
            : "";
        const state =
          loan.state === "GA" ? "GA" : loan.state === "FL" ? "FL" : null;
        if (!label || !state)
          return clarify(
            "What's the borrower label (initials) and state (FL or GA)?",
          );
        const stage = isLoanStage(loan.stage) ? loan.stage : "lead";

        const { data, error } = await supabase
          .from("loans")
          .insert({
            borrower_label: label,
            state,
            stage,
            loan_type: typeof loan.loan_type === "string" ? loan.loan_type : null,
            target_close:
              typeof loan.target_close === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(loan.target_close)
                ? loan.target_close
                : null,
            next_action:
              typeof loan.next_action === "string" ? loan.next_action : null,
            notes: typeof loan.notes === "string" ? loan.notes : null,
          })
          .select()
          .single();
        if (error) throw error;

        await log("mortgages", `Added loan ${label} (${state})`);
        return NextResponse.json({
          status: "executed",
          message: `Added ${state} loan ${label} · ${
            LOAN_STAGES.find((s) => s.id === stage)?.label ?? stage
          }`,
          undo: { op: "delete_loan", id: (data as Loan).id },
        });
      }

      case "update_loan": {
        const matches = fuzzyMatch(
          String(parsed.match ?? ""),
          loans,
          (l) => l.borrower_label,
        );
        if (matches.length === 0)
          return clarify(
            `No active loan matches “${parsed.match}”. Which borrower?`,
          );
        if (matches.length > 1)
          return clarify(
            `That matches ${matches.length} loans: ${matches
              .map((m) => m.borrower_label)
              .join(", ")}. Which one?`,
          );

        const target = matches[0];
        const set = parsed.set ?? {};
        const patch: Record<string, unknown> = {};
        if (isLoanStage(set.stage)) patch.stage = set.stage;
        if (typeof set.next_action === "string" || set.next_action === null)
          patch.next_action = set.next_action;
        if (typeof set.notes === "string" || set.notes === null)
          patch.notes = set.notes;
        if (typeof set.loan_type === "string") patch.loan_type = set.loan_type;
        if (
          (typeof set.target_close === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(set.target_close)) ||
          set.target_close === null
        )
          patch.target_close = set.target_close;
        if (set.state === "FL" || set.state === "GA") patch.state = set.state;

        if (Object.keys(patch).length === 0)
          return clarify(
            `What should change on the ${target.borrower_label} loan?`,
          );

        const prev: Record<string, unknown> = {};
        for (const key of Object.keys(patch)) {
          prev[key] = (target as unknown as Record<string, unknown>)[key];
        }

        const { error } = await supabase
          .from("loans")
          .update(patch)
          .eq("id", target.id);
        if (error) throw error;

        const message = patch.stage
          ? `Moved ${target.borrower_label} to ${
              LOAN_STAGES.find((s) => s.id === patch.stage)?.label ?? patch.stage
            }`
          : `Updated loan ${target.borrower_label}`;
        await log("mortgages", message);
        return NextResponse.json({
          status: "executed",
          message,
          undo: { op: "restore_loan", id: target.id, prev },
        });
      }

      default:
        return clarify("I didn't understand that. Try rephrasing?");
    }
  } catch (error) {
    console.error("Command execution failed:", error);
    return NextResponse.json(
      { status: "error", message: "Command understood but execution failed." },
      { status: 500 },
    );
  }
}

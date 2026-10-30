import { NextResponse } from "next/server";
import { dict, isLocale } from "@/i18n";
import { isISODate } from "@/lib/dates";
import { sanitizeItem } from "@/lib/itemInput";
import { getSession, type HouseholdSession } from "@/lib/session";

export const runtime = "nodejs";

interface UndoPayload {
  op: "delete_item" | "restore_item" | "delete_completion";
  id: string;
  date?: string;
  prev?: Record<string, unknown>;
}

/** Reverts a command-bar mutation. The client enforces the 10s window; RLS scopes it to the household. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.household) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hs = session as HouseholdSession;

  let undo: UndoPayload;
  let locale: unknown;
  try {
    const body = (await request.json()) as { undo: UndoPayload; locale?: unknown };
    undo = body.undo;
    locale = body.locale;
    if (!undo?.op || typeof undo.id !== "string") throw new Error("bad payload");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    let pillarKey: string | null = null;
    switch (undo.op) {
      case "delete_item": {
        const { data, error } = await hs.supabase.from("items").delete().eq("id", undo.id).select("pillar_key").maybeSingle();
        if (error) throw error;
        pillarKey = (data?.pillar_key as string) ?? null;
        break;
      }
      case "restore_item": {
        const prev = undo.prev ?? {};
        const { completed_at, ...fields } = prev;
        const people = await hs.supabase.from("people").select("id").eq("household_id", hs.household.id);
        const result = sanitizeItem(fields, new Set((people.data ?? []).map((p) => p.id as string)), true);
        if (!result.ok) throw new Error("bad restore payload");
        const patch: Record<string, unknown> = { ...result.patch };
        if ("completed_at" in prev) patch.completed_at = typeof completed_at === "string" ? completed_at : null;
        const { data, error } = await hs.supabase.from("items").update(patch).eq("id", undo.id).select("pillar_key").maybeSingle();
        if (error) throw error;
        pillarKey = (data?.pillar_key as string) ?? null;
        break;
      }
      case "delete_completion": {
        if (!isISODate(undo.date)) throw new Error("bad date");
        const { error } = await hs.supabase.from("routine_completions").delete().eq("item_id", undo.id).eq("on_date", undo.date);
        if (error) throw error;
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown undo op" }, { status: 400 });
    }

    await hs.supabase.from("activity_log").insert({
      household_id: hs.household.id,
      pillar_key: pillarKey,
      action: dict(isLocale(locale) ? locale : "en").commandServer.undoLog,
      source: "command",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Undo failed:", error);
    return NextResponse.json({ error: "Undo failed" }, { status: 500 });
  }
}

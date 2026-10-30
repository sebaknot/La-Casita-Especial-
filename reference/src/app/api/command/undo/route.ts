import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRole, can } from "@/lib/auth/roles";

export const runtime = "nodejs";

interface UndoPayload {
  op: "delete_item" | "restore_item" | "delete_loan" | "restore_loan";
  id: string;
  prev?: Record<string, unknown>;
}

/** Reverts a command-bar mutation. The client enforces the 10s window. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!can.write(resolveRole(user?.email))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let undo: UndoPayload;
  try {
    const body = (await request.json()) as { undo: UndoPayload };
    undo = body.undo;
    if (!undo?.op || typeof undo.id !== "string") throw new Error("bad payload");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    switch (undo.op) {
      case "delete_item": {
        const { error } = await supabase.from("items").delete().eq("id", undo.id);
        if (error) throw error;
        break;
      }
      case "restore_item": {
        const { error } = await supabase
          .from("items")
          .update(undo.prev ?? {})
          .eq("id", undo.id);
        if (error) throw error;
        break;
      }
      case "delete_loan": {
        const { error } = await supabase.from("loans").delete().eq("id", undo.id);
        if (error) throw error;
        break;
      }
      case "restore_loan": {
        const { error } = await supabase
          .from("loans")
          .update(undo.prev ?? {})
          .eq("id", undo.id);
        if (error) throw error;
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown undo op" }, { status: 400 });
    }

    await supabase.from("activity_log").insert({
      domain: undo.op.includes("loan") ? "mortgages" : null,
      action: "Undid last command",
      source: "command",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Undo failed:", error);
    return NextResponse.json({ error: "Undo failed" }, { status: 500 });
  }
}

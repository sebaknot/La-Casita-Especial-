/**
 * Role resolution for Sovereign.
 *
 * Today there is exactly one user (the owner, ALLOWED_EMAIL). The role layer
 * exists so a second "assistant" role (read/write, no settings) can be added
 * later by extending resolveRole + the `can` map — no rewrite of middleware,
 * actions, or routes required.
 */
export type Role = "owner" | "assistant";

export function resolveRole(email: string | null | undefined): Role | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();

  const owner = (process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase();
  if (owner && normalized === owner) return "owner";

  // Future: comma-separated ASSISTANT_EMAILS env var → "assistant"
  // const assistants = (process.env.ASSISTANT_EMAILS ?? "")
  //   .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  // if (assistants.includes(normalized)) return "assistant";

  return null;
}

export const can = {
  read: (role: Role | null): boolean => role !== null,
  write: (role: Role | null): boolean => role !== null,
  manageSettings: (role: Role | null): boolean => role === "owner",
};

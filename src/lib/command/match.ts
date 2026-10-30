/** Accent- and case-insensitive text key: "Mamá" → "mama", "Niñas" → "ninas". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fuzzy match adapted from Sovereign: exact, then substring, then all tokens.
 * Returns every candidate at the best tier so the caller can ask "which one?".
 */
export function fuzzyMatch<T>(query: string, candidates: T[], keyOf: (candidate: T) => string): T[] {
  const q = normalize(query);
  if (!q) return [];

  const exact = candidates.filter((c) => normalize(keyOf(c)) === q);
  if (exact.length > 0) return exact;

  const substring = candidates.filter((c) => {
    const key = normalize(keyOf(c));
    return key.includes(q) || q.includes(key);
  });
  if (substring.length > 0) return substring;

  const tokens = q.split(" ").filter((token) => token.length > 2);
  if (tokens.length === 0) return [];
  return candidates.filter((c) => {
    const key = normalize(keyOf(c));
    return tokens.every((token) => key.includes(token));
  });
}

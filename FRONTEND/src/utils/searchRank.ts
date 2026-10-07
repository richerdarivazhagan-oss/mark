/**
 * Relevance-based search ranking utility.
 *
 * Ranking priorities (lowest rank number = highest priority):
 *   0 — Exact match (field === query)
 *   1 — Title or field STARTS with query (e.g., "Student" for "stu")
 *   2 — Any word boundary STARTS with query (e.g., "Class Schedule" for "sch")
 *   3 — Contains query somewhere inside the field (e.g., "Attendance" for "s")
 *   4 — All search tokens match (multi-word match)
 *   5 — No match
 *
 * All comparisons are case-insensitive.
 */

export function fieldRank(field: string, query: string): number {
  if (!field) return 5;
  const f = field.trim().toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  if (!f) return 5;

  if (f === q) return 0;
  if (f.startsWith(q)) return 1;

  const words = f.split(/[\s,._\-/\\]+/).filter(Boolean);
  if (words.some((word) => word.startsWith(q))) return 2;
  if (f.includes(q)) return 3;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => f.includes(token))) {
    return 4;
  }

  return 5;
}

/** Return the best (lowest) rank across multiple fields. */
export function bestRank(query: string, ...fields: (string | undefined | null)[]): number {
  let best = 5;
  for (const f of fields) {
    if (!f) continue;
    const r = fieldRank(f, query);
    if (r < best) best = r;
    if (best === 0) break;
  }
  return best;
}

/**
 * Filter items by search query across the given field accessors,
 * then sort by rank (exact > starts-with > word-starts-with > contains > token-match).
 * Items that don't match any field are excluded.
 */
export function rankedSearch<T = any>(
  items: T[],
  query: string,
  fieldGetters: ((item: T) => any)[] = []
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items
    .map((item, originalIndex) => {
      let minRank = 5;

      if (fieldGetters.length === 0) {
        if (typeof item === 'string') {
          minRank = fieldRank(item, q);
        } else if (item && typeof item === 'object') {
          const strValues = Object.values(item)
            .filter((v) => typeof v === 'string' || typeof v === 'number')
            .map(String);
          minRank = bestRank(q, ...strValues);
        }
      } else {
        for (const getter of fieldGetters) {
          const raw = getter(item);
          const fields = Array.isArray(raw) ? raw : [raw];
          for (const f of fields) {
            if (!f) continue;
            const r = fieldRank(String(f), q);
            if (r < minRank) minRank = r;
            if (minRank === 0) break;
          }
          if (minRank === 0) break;
        }
      }

      return { item, rank: minRank, originalIndex };
    })
    .filter((entry) => entry.rank < 5)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.originalIndex - b.originalIndex;
    })
    .map((entry) => entry.item);
}

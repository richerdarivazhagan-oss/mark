/**
 * Relevance-based search and ranking utility for tables, lists, and search UI components.
 * 
 * Priorities:
 * Priority 1: Exact match (case-insensitive)
 * Priority 2: Title or whole text STARTS with search text
 * Priority 3: Any word inside the title/text STARTS with search text
 * Priority 4: Search text appears anywhere inside the text
 * Priority 5: All search tokens present in text
 */
export function searchAndRank<T>(
  items: T[],
  query: string,
  getText: (item: T) => string | (string | undefined | null)[]
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;

  const tokens = trimmed.split(/\s+/).filter(Boolean);

  const scored = items.map((item, originalIndex) => {
    const rawResult = getText(item);
    const textArray = (Array.isArray(rawResult) ? rawResult : [rawResult])
      .filter((t): t is string => Boolean(t))
      .map((t) => t.trim().toLowerCase());

    let maxScore = 0;

    for (const text of textArray) {
      if (text === trimmed) {
        maxScore = Math.max(maxScore, 1000);
      } else if (text.startsWith(trimmed)) {
        maxScore = Math.max(maxScore, 900);
      } else {
        const words = text.split(/[\s,._\-/\\]+/).filter(Boolean);
        const wordStartsWithQuery = words.some((word) => word.startsWith(trimmed));
        if (wordStartsWithQuery) {
          maxScore = Math.max(maxScore, 800);
        } else if (text.includes(trimmed)) {
          maxScore = Math.max(maxScore, 500);
        } else if (tokens.length > 1 && tokens.every((tok) => text.includes(tok))) {
          maxScore = Math.max(maxScore, 300);
        }
      }
    }

    return { item, score: maxScore, originalIndex };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.originalIndex - b.originalIndex;
    })
    .map((entry) => entry.item);
}

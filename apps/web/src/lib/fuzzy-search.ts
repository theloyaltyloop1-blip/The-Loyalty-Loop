// Typo-tolerant, ranked, accent-insensitive search over in-memory lists.
// Dependency-free on purpose. Identical copies live in apps/shopper/src,
// apps/retailer/src and apps/web/src/lib (the apps share no package) - keep them in sync.

/** Lowercase, strip accents, turn punctuation into spaces. "Café  Nero's" -> "cafe nero s". */
export function normaliseSearch(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Optimal-string-alignment distance (insert, delete, substitute, swap neighbours). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const rows: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    rows[i] = [i]
    for (let j = 1; j <= b.length; j++) rows[i][j] = i === 0 ? j : 0
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, rows[i - 2][j - 2] + 1)
      rows[i][j] = best
    }
  }
  return rows[a.length][b.length]
}

const typoAllowance = (length: number) => (length <= 3 ? 0 : length <= 7 ? 1 : 2)

// 0 = no match. Exact word 1, word prefix .9, inside a word .6, typo .45-.5.
function scoreToken(token: string, words: string[]): number {
  let best = 0
  for (const word of words) {
    if (word === token) return 1
    if (word.startsWith(token)) best = Math.max(best, 0.9)
    else if (token.length >= 2 && word.includes(token)) best = Math.max(best, 0.6)
    else {
      const allow = typoAllowance(token.length)
      if (allow > 0) {
        // Whole word ("nots" ~ "nuts") or the same-length start of the word ("nots" ~ "note" of "notes").
        const d = Math.min(editDistance(token, word), editDistance(token, word.slice(0, token.length)))
        if (d <= allow) best = Math.max(best, d === 1 ? 0.5 : 0.45)
      }
    }
  }
  return best
}

/**
 * Score one item against a query; 0 means "does not match".
 * `fields` are ordered most important first (name before address).
 * Every query word must match some field, so "nero high" narrows rather than widens.
 */
export function fuzzyScore(query: string, fields: Array<string | null | undefined>): number {
  const tokens = normaliseSearch(query).split(' ').filter(Boolean)
  if (!tokens.length) return 1
  const normalised = fields.map(normaliseSearch)
  const wordLists = normalised.map((f) => f.split(' ').filter(Boolean))
  let total = 0
  for (const token of tokens) {
    let best = 0
    wordLists.forEach((words, i) => { best = Math.max(best, scoreToken(token, words) * (1 - i * 0.12)) })
    if (best === 0) return 0
    total += best
  }
  const phrase = tokens.join(' ')
  if (normalised[0]?.startsWith(phrase)) total += 0.5 // name starts with exactly what was typed
  return total / tokens.length
}

/** Filter and rank. An empty query returns the list untouched (same order, same array). */
export function fuzzyFilter<T>(items: readonly T[], query: string, fields: (item: T) => Array<string | null | undefined>): T[] {
  if (!normaliseSearch(query)) return items as T[]
  return items
    .map((item, index) => ({ item, index, score: fuzzyScore(query, fields(item)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.item)
}

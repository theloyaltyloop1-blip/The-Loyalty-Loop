# Reel lesson: "never build a custom search bar with AI" (Kedasha Kerr)

Reel point: a plain `LIKE '%term%'` search misses typos ("nots"), synonyms and near words, has no relevance ranking and feels broken as data grows; use a real engine (Algolia, Elasticsearch, Meilisearch, OpenSearch, Typesense). Our constraint: small Supabase project, no new paid service. So: Postgres-native fuzzy search for server lists, a small dependency-free fuzzy ranker for lists already in memory.

## (a) Every search found, and what it was

| # | Where | Before | Now |
|---|---|---|---|
| 1 | Shopper Home search, `apps/shopper/App.tsx` `HomeTab` | `name.includes(q)` client-side, name only, every keystroke | `fuzzyFilter` over name, category, address; debounced 150 ms; ranked |
| 2 | Shopper Map search, `MapTab` | `name.includes(q)` | same. NB it only drives the "can't find your shop? Ask them to join" prompt; pins are **not** filtered (unchanged, see skipped) |
| 3 | Web shopper Home, `apps/web/src/pages/Home.tsx` | `includes` over a joined name/category/address/postcode string | `fuzzyFilter` + debounce; ranked |
| 4 | Web shopper map, `Discover.tsx` | `includes` over name/category/address | `fuzzyFilter` + debounce, postcode added; clearer empty text |
| 5 | Business app Members, `apps/retailer/App.tsx` `MembersPage` | `includes` on "first last" (so "Smith John" or "Jon" failed), no debounce, generic empty text | `fuzzyFilter` + debounce; empty state says whether there are no members at all or none match, and suggests checking spelling |
| 6 | Admin Businesses `admin_list_businesses` RPC | `ilike '%x%'` on name + owner email | new migration: accent-folded substring + trigram `word_similarity`, ranked (client was already debounced 300 ms) |
| 7 | Admin Users `admin_list_users` RPC | `ilike '%x%'` on email + name | same as 6 |
| 8 | Shop request search (`shop-request-search` edge fn / `ShopRequests` components) | Google Places text search (already fuzzy) | untouched; already debounced 400 ms |
| 9 | WhatsApp shop lookup `matchShops` (`supabase/functions/_shared/whatsapp-shops.ts`) | exact slug/name, else every typed word is a substring of the name | **untouched** (see skipped) |

Not found in this worktree: an admin `Directory.tsx` (the admin pages are `Businesses.tsx`, `Users.tsx`, `Loyalty.tsx`, `Audit.tsx`) and **no search box at all** on `apps/web/src/pages/owner/Customers.tsx` (it shows top-5 regulars and a "slipping" list, no filter). No customer/member search on the Business app beyond #5. If the Directory page exists on another branch it should use the same RPC pattern as #6.

## (b) Failure cases (old behaviour)
- Typos / transposed letters ("nots"->"Notes", "nreo"->"Nero"): no result.
- Accents ("cafe" vs "Café"): no result (`toLowerCase` does not fold accents).
- Word order / partial names in Members ("Smith John", "jon"): no result for the first.
- Ranking: results kept list order; a shop whose *address* contained the word ranked equal to one named it.
- Fields: shopper app searched name only, so a category or town typed in the box found nothing, although the web version did.
- Empty results: Members said "No matching members yet" even when the shop had none.
- Speed/scale: fine today for in-memory lists of hundreds. Admin RPCs did a sequential scan with leading-wildcard `ilike`, which no b-tree index can serve.

## (c) What changed (all in code, nothing applied)
- New matcher `fuzzy-search.ts` (identical copies: `apps/web/src/lib/`, `apps/shopper/src/`, `apps/retailer/src/`, because the apps share no package, same as `shop-features.ts`). Accent/punctuation folding; every typed word must match; exact word > word prefix > inside word > typo (edit distance 1 for 4-7 letter words, 2 for 8+, none for <=3, swaps count as 1); earlier fields (name) outweigh later ones; extra credit if the name starts with the typed phrase. Empty query returns the list unchanged.
- `use-debounced-value.ts` (same three places), 150 ms.
- Test: `apps/shopper/fuzzy-search.test.mjs` (10 tests, run `node --test apps/shopper/fuzzy-search.test.mjs`; passes).
- Migration **written, not applied**: `supabase/migrations/20261115120000_typo_tolerant_admin_search.sql` (pg_trgm + unaccent, immutable `search_norm()` wrapper, GIN trigram index on `businesses`, both admin RPCs rewritten with the same signatures and columns; threshold 0.4 is a tunable guess).
- Empty states improved in Members and web Discover.

## Skipped, and why
- **Dedicated engine (Algolia/Meilisearch/Typesense/etc.)**: not justified. Searchable rows are shops (hundreds to low thousands) and per-shop members (tens to thousands); the client ranker and trigram indexes handle that in milliseconds. Revisit when: shop directory passes roughly 20-50k searchable rows *and* is searched server-side, or you need synonyms ("chippy"="fish and chips"), facets with counts, or search-as-you-type across many millions of rows. Even then Meilisearch/Typesense self-hosted or Postgres `tsvector` + synonyms dictionary comes before a paid SaaS.
- **Synonyms**: nothing in the new code; the reel's synonym point is not solved. Cheapest later step: a small alias list in the matcher (e.g. "coffee"->"cafe") or a Postgres synonym dictionary.
- **Server-side shop search**: shops are loaded whole and filtered on the device; moving to an RPC would only add latency at this size.
- **Filtering map pins by the search text** (shopper MapTab): a behaviour change beyond "search quality"; flag for the owner.
- **WhatsApp `matchShops`**: a Deno shared file with its own tests and live bot behaviour; swapping it risks wrong auto-matches (a fuzzy hit could send someone to the wrong shop). Needs its own review.
- **Owner Customers search box**: no search exists to improve; adding one is a feature, and the list there is deliberately a short regulars/slipping view. `fuzzyFilter` is ready if wanted.
- Index on `auth.users.email`: not ours to alter; admin-only, small table.

## Untested / verify before shipping
- Typecheck: `tsc --noEmit` clean for `apps/shopper` and `apps/retailer`; `tsc -b` clean for `apps/web`. (Lint not run.)
- Migration was never run against Postgres: check `extensions` schema placement of pg_trgm/unaccent on the live project, that `word_similarity` resolves, the 0.4 threshold on real names, and `explain` on the GIN index. Roll back by re-applying the previous two function definitions (migrations 20261007073001 / 20261007073515); `search_norm` and the index are harmless to leave.
- No on-device or browser check of the UI changes (only the unit tests and typecheck). Ranking changes the visible order of shops while a search is typed (intended).
- Matcher cost is O(items x fields x words) per keystroke after debounce; fine for thousands, not for tens of thousands.

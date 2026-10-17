export type Card = { id: string; user_id: string; brand_key: string; label: string; card_number: string; barcode_format: import('./external-card-barcode').BarcodeFormat; created_at: string; updated_at: string }
type Store = { getItemAsync(key: string): Promise<string | null>; setItemAsync(key: string, value: string): Promise<void>; deleteItemAsync(key: string): Promise<void> }

// Per-card entries stay below SecureStore's small-value limits. One serial queue
// makes sign-out cleanup run after any already-pending cache writes.
export function createCardCache(store: Store) {
  let queue: Promise<unknown> = Promise.resolve()
  let generation = 0
  const signedOut = new Set<string>()
  const run = <T,>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn, fn)
    queue = next.catch(() => undefined)
    return next
  }
  const key = (owner: string, index: number) => `external-cards.${owner}.${index}`
  return {
    activate: (owner: string) => { signedOut.delete(owner) },
    read: (owner: string) => run(async () => {
      const cards: Card[] = []
      for (let i = 0; i < 30; i++) {
        const raw = await store.getItemAsync(key(owner, i))
        if (!raw) continue
        try { const card = JSON.parse(raw) as Card; if (card.user_id === owner) cards.push(card) } catch { /* Ignore corrupt local entries. */ }
      }
      return cards
    }),
    write: (owner: string, cards: Card[]) => {
      const ticket = generation
      return run(async () => {
        if (ticket !== generation || signedOut.has(owner)) return
        for (let i = 0; i < 30; i++) {
          if (cards[i]) await store.setItemAsync(key(owner, i), JSON.stringify(cards[i]))
          else await store.deleteItemAsync(key(owner, i))
        }
      })
    },
    clear: (owner: string) => {
      generation++
      signedOut.add(owner)
      return run(async () => {
        const results = await Promise.allSettled(Array.from({ length: 30 }, (_, i) => store.deleteItemAsync(key(owner, i))))
        if (results.some(result => result.status === 'rejected')) throw new Error('Wallet cache cleanup failed')
      })
    },
  }
}

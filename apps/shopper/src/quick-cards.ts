import { useCallback, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'

/** Cards the shopper chose to keep at the top of home ("quick cards").
 * Stored on this device per account, in the order they were picked. When the
 * list is empty, home falls back to the automatic pick: the card closest to
 * its next reward. */
export const QUICK_CARDS_MAX = 4

const keyFor = (userId: string) => `quick_cards_${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`

export function parseQuickCards(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, QUICK_CARDS_MAX) : []
  } catch {
    return []
  }
}

/** Adds or removes a shop, keeping pick order and the limit. */
export function toggleQuickCard(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter(existing => existing !== id)
  if (ids.length >= QUICK_CARDS_MAX) return ids
  return [...ids, id]
}

export function useQuickCards(userId: string) {
  const [ids, setIds] = useState<string[]>([])
  useEffect(() => {
    let active = true
    SecureStore.getItemAsync(keyFor(userId))
      .then(raw => { if (active) setIds(parseQuickCards(raw)) })
      .catch(() => undefined)
    return () => { active = false }
  }, [userId])
  const save = useCallback((next: string[]) => {
    setIds(next)
    const write = next.length
      ? SecureStore.setItemAsync(keyFor(userId), JSON.stringify(next))
      : SecureStore.deleteItemAsync(keyFor(userId))
    // Losing the choice only means home shows the automatic pick again.
    void write.catch(() => undefined)
  }, [userId])
  return { ids, save }
}

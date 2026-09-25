import { useCallback, useEffect, useRef, useState } from 'react'
import { NativeModules, Platform } from 'react-native'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Card linking (CARD_LINKING_PLAN.md §3 and §5). Card details are typed into
// Fidel's own native screen; this app never sees a card number. The server
// decides whether a card belongs to this user, so nothing here is trusted.

export type LinkedCard = { linkedCardId: string; scheme: string | null; lastNumbers: string | null; linkedAt: string }

type Session =
  | { enabled: false }
  | { enabled: true; atLimit: true; activeCount: number; limit: number; cards: LinkedCard[] }
  | {
      enabled: true
      atLimit: false
      activeCount: number
      limit: number
      cards: LinkedCard[]
      sdkKey: string
      programId: string
      metadataId: string
      consent: { companyName: string; programName: string; termsAndConditionsUrl: string; privacyPolicyUrl: string; deleteInstructions: string }
    }

export type LinkOutcome =
  | { kind: 'linked'; card: LinkedCard | null }
  | { kind: 'cancelled' }
  | { kind: 'pending' }
  | { kind: 'error'; title: string; message: string }

// The native module only exists in builds that include fidel-react-native.
// JavaScript also reaches older builds as an over-the-air update, and importing
// the package there would crash at start-up, so it is loaded lazily and only
// when the native side is present.
export function cardLinkingSupported(): boolean {
  return Platform.OS !== 'web' && NativeModules.NativeFidelBridge != null
}

function loadFidel(): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('fidel-react-native').default
}

async function invoke<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let code = 'server_error'
    if (error instanceof FunctionsHttpError) {
      const parsed = await error.context.json().catch(() => null)
      if (parsed && typeof parsed.error === 'string') code = parsed.error
    } else {
      code = 'network'
    }
    throw new CardLinkRequestError(code)
  }
  return data as T
}

class CardLinkRequestError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export const schemeLabel = (scheme: string | null) =>
  scheme === 'visa' ? 'Visa' : scheme === 'mastercard' ? 'Mastercard' : scheme === 'amex' ? 'Amex' : 'Card'

export const cardLabel = (card: LinkedCard) => `${schemeLabel(card.scheme)} •••• ${card.lastNumbers ?? '····'}`

type FidelResult =
  | { type: 'EnrollmentResult'; enrollmentResult?: { cardId?: string } }
  | { type: 'Error'; error?: { type?: string; subtype?: string } }

function runFidelScreen(session: Extract<Session, { atLimit: false }>): Promise<FidelResult> {
  const Fidel = loadFidel()
  return new Promise((resolve) => {
    let settled = false
    Fidel.setup(
      {
        sdkKey: session.sdkKey,
        programId: session.programId,
        programType: Fidel.ProgramType?.transactionSelect ?? 'transactionSelect',
        options: {
          allowedCountries: [Fidel.Country?.unitedKingdom ?? 'unitedKingdom'],
          defaultSelectedCountry: Fidel.Country?.unitedKingdom ?? 'unitedKingdom',
          supportedCardSchemes: [
            Fidel.CardScheme?.visa ?? 'visa',
            Fidel.CardScheme?.mastercard ?? 'mastercard',
            Fidel.CardScheme?.americanExpress ?? 'americanExpress',
          ],
          metaData: { id: session.metadataId },
        },
        consentText: session.consent,
      },
      (result: FidelResult) => {
        if (settled) return
        settled = true
        resolve(result)
      },
    )
    Fidel.start()
  })
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const CONFIG_ERRORS = new Set(['sdkConfigurationError', 'invalidSdkKey', 'invalidProgramId', 'inexistentProgram', 'unauthorized'])
const UNAVAILABLE: LinkOutcome = { kind: 'error', title: 'Card linking isn’t available', message: 'Please try again later.' }
const ELSEWHERE: LinkOutcome = {
  kind: 'error',
  title: 'This card is linked to another account',
  message: 'It needs to be removed there before it can be linked here.',
}

/** State and actions for the Linked cards screen, the shop prompt and the badge. */
export function useCardLinking(userId: string) {
  const supported = cardLinkingSupported()
  const [enabled, setEnabled] = useState(false)
  const [cards, setCards] = useState<LinkedCard[]>([])
  const [limit, setLimit] = useState(5)
  const [linkedShopIds, setLinkedShopIds] = useState<Set<string>>(new Set())
  const [stage, setStage] = useState<'idle' | 'preparing' | 'verifying'>('idle')
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (!supported) return
    try {
      const session = await invoke<Session>('fidel-card-session')
      setEnabled(session.enabled)
      if (!session.enabled) return
      setCards(session.cards)
      setLimit(session.limit)
      const { data } = await supabase.rpc('card_linked_business_ids')
      setLinkedShopIds(new Set((data ?? []) as string[]))
    } catch {
      // Card linking stays hidden when the server can't be reached.
    }
  }, [supported])

  /** Run when the Linked cards screen opens: stores any card Fidel enrolled
   * that we never saved (for example, the app closed mid-flow). */
  const recover = useCallback(async () => {
    if (!supported || busy.current) return
    try {
      const recovered = await invoke<{ status: string; cards: LinkedCard[] }>('fidel-card-claim')
      setCards(recovered.cards)
    } catch {
      // Silent: the list simply stays as it was.
    }
  }, [supported])

  useEffect(() => { void refresh() }, [refresh, userId])

  /** Runs the whole link flow. `beforeFidel` lets the caller close a pop-up
   * first: on iOS, Fidel's screen can't appear above an open sheet. */
  const link = useCallback(async (beforeFidel?: () => Promise<void>): Promise<LinkOutcome> => {
    if (!supported || busy.current) return UNAVAILABLE
    busy.current = true
    setStage('preparing')
    try {
      let session: Session
      try {
        session = await invoke<Session>('fidel-card-session')
      } catch (e) {
        return e instanceof CardLinkRequestError && e.code === 'network'
          ? { kind: 'error', title: 'You’re offline', message: 'Connect to the internet to link a card.' }
          : UNAVAILABLE
      }
      if (!session.enabled) return UNAVAILABLE
      if (session.atLimit) {
        return { kind: 'error', title: `You’ve linked ${session.limit} cards`, message: 'Remove one to add another.' }
      }
      if (beforeFidel) await beforeFidel()
      const result = await runFidelScreen(session)
      setStage('verifying')

      if (result.type === 'Error') {
        const type = result.error?.type
        const subtype = result.error?.subtype
        if (type === 'userCanceled') return { kind: 'cancelled' }
        if (type === 'deviceNotSecure') {
          return { kind: 'error', title: 'Card linking isn’t available on this device', message: 'It looks like the device’s security has been modified.' }
        }
        if (subtype === 'cardAlreadyExists') {
          // Maybe it was linked here already and the app closed before saving it.
          const recovered = await invoke<{ status: string; cards: LinkedCard[] }>('fidel-card-claim').catch(() => null)
          if (recovered) setCards(recovered.cards)
          if (recovered?.status === 'claimed') return { kind: 'linked', card: recovered.cards[recovered.cards.length - 1] ?? null }
          return ELSEWHERE
        }
        if ((type && CONFIG_ERRORS.has(type)) || (subtype && CONFIG_ERRORS.has(subtype))) {
          console.warn('card linking configuration error', type, subtype)
          return UNAVAILABLE
        }
        return { kind: 'error', title: 'Your card couldn’t be linked', message: 'Check the details and try again, or try a different card.' }
      }

      const cardId = result.enrollmentResult?.cardId
      // Fidel can take a moment to list a new card, so retry twice with backoff.
      for (const delay of [0, 1500, 3000]) {
        if (delay) await wait(delay)
        try {
          const claim = await invoke<{ status: string; cards: LinkedCard[] }>('fidel-card-claim', cardId ? { cardId } : {})
          setCards(claim.cards)
          if (claim.status === 'claimed' || claim.status === 'already_linked') {
            return { kind: 'linked', card: claim.cards[claim.cards.length - 1] ?? null }
          }
          if (claim.status === 'limit_reached') {
            return { kind: 'error', title: `You’ve already linked ${session.limit} cards`, message: 'Remove one to add another.' }
          }
          if (claim.status === 'already_linked_elsewhere') return ELSEWHERE
        } catch {
          // fall through to retry
        }
      }
      return { kind: 'pending' }
    } finally {
      busy.current = false
      setStage('idle')
    }
  }, [supported])

  const remove = useCallback(async (linkedCardId: string): Promise<boolean> => {
    const before = cards
    setCards((current) => current.filter((card) => card.linkedCardId !== linkedCardId))
    try {
      const result = await invoke<{ status: string; cards: LinkedCard[] }>('fidel-card-unlink', { linkedCardId })
      setCards(result.cards)
      return true
    } catch {
      setCards(before)
      return false
    }
  }, [cards])

  return { supported, enabled: supported && enabled, cards, limit, linkedShopIds, stage, refresh, recover, link, remove }
}

export type CardLinking = ReturnType<typeof useCardLinking>

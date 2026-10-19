import * as React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Coffee, Gem, Plus, QrCode, ScanLine, Star, Trash2 } from 'lucide-react'
import {
  PROGRAMMES,
  SHOP_KINDS,
  buildShopArgs,
  onboardingDefaults,
  programmeIdFor,
  type CurrencyInfo,
  type ProgrammeDraft,
  type ProgrammeId,
  type ShopKind,
} from '@loyalty-loop/loyalty'
import { useAuth } from '@/lib/auth-context'
import { useOwner } from '@/lib/owner-context'
import { addProgrammeContent, createShopWithProgramme } from '@/lib/businesses'
import loyaltyLoopLogo from '@/assets/loyalty-loop-mark.png'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { OwnerLoadError } from '@/components/owner-load-error'

const BRAND_COLOR = '#8B7355'

// Where the shop is decides its currency. Guessed from the browser's time zone;
// the owner can switch with the chip.
const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom', currency: { symbol: '£', scale: 1 } as CurrencyInfo },
  { code: 'PK', name: 'Pakistan', currency: { symbol: 'Rs', scale: 300 } as CurrencyInfo },
]

function guessCountryCode(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Karachi' ? 'PK' : 'GB'
  } catch {
    return 'GB'
  }
}

const KIND_ICONS = { everyday: Coffee, style: Gem, premium: Star } as const
const PROGRAMME_ORDER: ProgrammeId[] = ['stamps', 'tiers', 'points', 'spend']
const STEP_COUNT = 4

const inputClass =
  'h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground placeholder:text-muted-foreground outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-3 focus:ring-primary/20'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-semibold text-foreground mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function money(currency: CurrencyInfo, major: string) {
  const n = Number(String(major).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return `${currency.symbol}0`
  return `${currency.symbol}${currency.symbol.length > 1 ? ' ' : ''}${n.toLocaleString('en-GB')}`
}

/** "What your customers will see": a small version of their loyalty card. */
function CardPreview({
  programme, name, draft, currency,
}: { programme: ProgrammeId; name: string; draft: ProgrammeDraft; currency: CurrencyInfo }) {
  const title = name.trim() || 'Your shop'
  let body: React.ReactNode = null
  if (programme === 'stamps') {
    const total = Math.min(12, Math.max(1, Number(draft.rewards[0]?.amount) || 8))
    body = (
      <>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ' + (i < 3 ? 'bg-white text-black' : 'bg-white/25 text-white')}
            >
              {i < 3 ? <Check className="h-3 w-3" /> : ''}
            </span>
          ))}
        </div>
        <p className="text-sm font-semibold text-white">{draft.rewards[0]?.title || 'Your reward'} after {draft.rewards[0]?.amount || '8'} stamps</p>
      </>
    )
  } else if (programme === 'tiers') {
    body = (
      <>
        <div className="flex gap-1.5 mb-2">
          {draft.tiers.map((t, i) => (
            <span key={i} className="rounded-full px-2.5 py-1 text-[11px] font-bold text-black" style={{ backgroundColor: t.colour || '#fff' }}>
              {t.name || 'Level'}
            </span>
          ))}
        </div>
        <p className="text-sm font-semibold text-white">
          {draft.tiers[1] ? `${money(currency, draft.tiers[1].amount)} to reach ${draft.tiers[1].name || 'the next level'}` : 'Spend to reach the next level'}
        </p>
      </>
    )
  } else if (programme === 'points') {
    body = (
      <>
        <p className="text-3xl font-display font-bold text-white mb-1">240 <span className="text-sm font-semibold">points</span></p>
        <p className="text-sm font-semibold text-white">
          {draft.rewards[0] ? `${draft.rewards[0].title || 'Your reward'} at ${draft.rewards[0].amount} points` : 'Swap points for rewards'}
        </p>
      </>
    )
  } else {
    body = (
      <>
        <div className="h-2.5 rounded-full bg-white/25 mb-2 overflow-hidden"><div className="h-full w-1/3 rounded-full bg-white" /></div>
        <p className="text-sm font-semibold text-white">
          {draft.rewards[0] ? `${draft.rewards[0].title || 'Your reward'} at ${money(currency, draft.rewards[0].amount)} spent` : 'Earn rewards as you spend'}
        </p>
      </>
    )
  }
  return (
    <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: BRAND_COLOR }}>
      <p className="text-[11px] font-bold tracking-wide text-white/80 mb-1">WHAT YOUR CUSTOMERS WILL SEE</p>
      <p className="text-lg font-display font-bold text-white mb-3">{title}</p>
      {body}
    </div>
  )
}

export function OwnerOnboarding() {
  const { session, loading, rolesLoading, roles } = useAuth()
  const { businesses, business, needsRewardSetup, markRewardsReady, loading: ownerLoading, loadError, refetch, setBusinessId } = useOwner()
  const navigate = useNavigate()
  const [stepState, setStep] = React.useState(0)
  const [kind, setKind] = React.useState<ShopKind | null>(null)
  const [programme, setProgramme] = React.useState<ProgrammeId>('stamps')
  const [pickingProgramme, setPickingProgramme] = React.useState(false)
  const [name, setName] = React.useState('')
  const [countryCode, setCountryCode] = React.useState(guessCountryCode)
  const [draft, setDraft] = React.useState<ProgrammeDraft | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [liveId, setLiveId] = React.useState<string | null>(null)

  const country = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0]

  // A shop created earlier that still has no rewards or levels: skip straight to
  // the rewards step for that shop. Its programme is already fixed.
  const resumeBusiness = !liveId && businesses.length > 0 && business && needsRewardSetup ? business : null
  const resumeProgramme = resumeBusiness ? programmeIdFor(resumeBusiness) : null
  const step = liveId ? 3 : resumeBusiness ? 2 : stepState
  const activeProgramme = resumeProgramme ?? programme
  const activeCountry = resumeBusiness
    ? COUNTRIES.find((c) => c.code === (resumeBusiness as { country_code?: string }).country_code) ?? COUNTRIES[0]
    : country
  const activeName = resumeBusiness ? resumeBusiness.name : name

  // Starter rewards follow the programme, shop kind and currency until the owner edits them.
  React.useEffect(() => {
    if (step !== 2) return
    setDraft((current) => current ?? onboardingDefaults(activeProgramme, kind?.key ?? 'everyday', activeCountry.currency))
  }, [step, activeProgramme, kind, activeCountry])

  if (loading || rolesLoading || ownerLoading) return <BarePageSkeleton />
  if (!session) return <Navigate to="/login" replace />
  if (!roles.includes('business_owner')) return <Navigate to="/dashboard" replace />
  // Don't offer to create a shop when we simply couldn't load the existing one.
  if (loadError && businesses.length === 0) return <OwnerLoadError />
  if (businesses.length > 0 && !resumeBusiness && !liveId) return <Navigate to="/owner" replace />

  const lastEditable = 2
  const result = draft ? buildShopArgs(activeProgramme, draft) : null
  const canContinue =
    step === 0 ? kind !== null : step === 1 ? name.trim().length > 0 : step === 2 ? Boolean(result?.ok) : true

  function pickKind(k: ShopKind) {
    setKind(k)
    setProgramme(k.programme)
    setDraft(null)
    setPickingProgramme(false)
  }

  function pickProgramme(id: ProgrammeId) {
    setProgramme(id)
    setDraft(null)
    setPickingProgramme(false)
  }

  function setRewardField(index: number, patch: Partial<ProgrammeDraft['rewards'][number]>) {
    setDraft((d) => d && { ...d, rewards: d.rewards.map((r, i) => (i === index ? { ...r, ...patch } : r)) })
  }
  function setTierField(index: number, patch: Partial<ProgrammeDraft['tiers'][number]>) {
    setDraft((d) => d && { ...d, tiers: d.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) })
  }

  async function handleCreate() {
    if (!draft || !result || !result.ok) return
    setCreating(true)
    setError(null)
    try {
      let id: string
      if (resumeBusiness) {
        await addProgrammeContent(resumeBusiness.id, result.args)
        id = resumeBusiness.id
        markRewardsReady(id)
      } else {
        id = await createShopWithProgramme(
          { name: name.trim(), category: kind?.category ?? 'Retail', country_code: country.code, brand_color: BRAND_COLOR },
          result.args
        )
      }
      setLiveId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your shop. Try again.')
    } finally {
      setCreating(false)
    }
  }

  async function finish(destination: string) {
    if (!liveId) return
    await refetch()
    setBusinessId(liveId)
    void navigate(destination)
  }

  const cardClass = 'w-full text-left rounded-2xl border-2 p-4 transition-colors '

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4 py-10 sm:p-6">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 justify-center mb-6">
          <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain" />
          <span className="font-display font-semibold text-lg tracking-tight text-foreground">The Loyalty Loop</span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6" aria-label={`Step ${step + 1} of ${STEP_COUNT}`}>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span
              key={i}
              className={'h-2 rounded-full transition-all duration-300 ' + (i === step ? 'w-8 bg-primary' : i < step ? 'w-2 bg-olive' : 'w-2 bg-foreground/15')}
            />
          ))}
        </div>

        <div className="rounded-3xl bg-card ring-1 ring-foreground/8 p-6 shadow-[0_24px_60px_rgb(28_38_32/0.08)] sm:p-9">
          {step === 0 && (
            <>
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground mb-2">What kind of shop is it?</h1>
              <p className="text-foreground/70 mb-6">We'll set up the right kind of rewards for you.</p>
              <div className="grid gap-3 mb-4">
                {SHOP_KINDS.map((k) => {
                  const Icon = KIND_ICONS[k.key]
                  const active = kind?.key === k.key
                  return (
                    <button
                      data-press-feedback
                      key={k.key}
                      type="button"
                      onClick={() => pickKind(k)}
                      className={cardClass + (active ? 'border-primary bg-card' : 'border-border bg-white/40')}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-6 w-6 text-primary shrink-0" />
                        <span>
                          <span className="block font-bold text-foreground">{k.title}</span>
                          <span className="block text-sm text-foreground/70">{k.examples}</span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {kind && (
                <div className="rounded-2xl bg-sage p-4 text-sage-ink">
                  <p className="text-sm font-semibold text-foreground">
                    We suggest: {PROGRAMMES[programme].name}
                  </p>
                  <p className="text-sm text-foreground/80">{PROGRAMMES[programme].pitch}</p>
                  <button data-press-feedback type="button" onClick={() => setPickingProgramme((v) => !v)} className="mt-2 text-sm font-semibold text-primary underline">
                    {pickingProgramme ? 'Keep the suggestion' : 'Change'}
                  </button>
                  {pickingProgramme && (
                    <div className="grid gap-2 mt-3">
                      {PROGRAMME_ORDER.map((id) => (
                        <button
                          data-press-feedback
                          key={id}
                          type="button"
                          onClick={() => pickProgramme(id)}
                          className={'rounded-xl border-2 p-3 text-left ' + (programme === id ? 'border-primary bg-card' : 'border-border bg-white/60')}
                        >
                          <span className="block font-bold text-sm text-foreground">{id === 'spend' ? '£ Spend rewards' : PROGRAMMES[id].name}</span>
                          <span className="block text-xs text-foreground/70">{PROGRAMMES[id].pitch}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground mb-2">What's your shop called?</h1>
              <p className="text-foreground/70 mb-6">Customers will see this on their loyalty card.</p>
              <Field label="Shop name">
                <input className={inputClass} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bean & Bird" autoFocus />
              </Field>
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-sm text-foreground/70">Based in</span>
                {COUNTRIES.map((c) => (
                  <button
                    data-press-feedback
                    key={c.code}
                    type="button"
                    onClick={() => { setCountryCode(c.code); setDraft(null) }}
                    className={'rounded-full px-3 py-1.5 text-sm font-semibold border-2 ' + (c.code === countryCode ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground')}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <CardPreview programme={programme} name={name} draft={onboardingDefaults(programme, kind?.key ?? 'everyday', country.currency)} currency={country.currency} />
            </>
          )}

          {step === 2 && draft && (
            <>
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground mb-2">
                {activeProgramme === 'tiers' ? 'Your membership levels' : 'Your rewards'}
              </h1>
              <p className="text-foreground/70 mb-5">
                We've filled these in for you. Change anything, then tap Looks good.
              </p>

              {activeProgramme === 'tiers'
                ? draft.tiers.map((tier, index) => (
                    <div key={index} className="rounded-2xl bg-sage p-4 mb-3 text-sage-ink">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tier.colour }} /> Level {index + 1}
                        </span>
                        {draft.tiers.length > 1 && (
                          <button data-press-feedback type="button" onClick={() => setDraft((d) => d && { ...d, tiers: d.tiers.filter((_, i) => i !== index) })} className="flex items-center gap-1 text-xs font-semibold text-foreground/70 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Name"><input className={inputClass} value={tier.name} maxLength={40} onChange={(e) => setTierField(index, { name: e.target.value })} /></Field>
                        <Field label={`Spend in a year (${country.currency.symbol})`}>
                          <input className={inputClass} inputMode="decimal" value={tier.amount} onChange={(e) => setTierField(index, { amount: e.target.value.replace(/[^0-9.]/g, '') })} />
                        </Field>
                      </div>
                      <Field label="Perks (one per line)">
                        <textarea className={inputClass + ' h-24 py-3 resize-none'} value={tier.perks} onChange={(e) => setTierField(index, { perks: e.target.value })} />
                      </Field>
                    </div>
                  ))
                : draft.rewards.map((reward, index) => (
                    <div key={index} className="rounded-2xl bg-sage p-4 mb-3 text-sage-ink">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-foreground">Reward {draft.rewards.length > 1 ? index + 1 : ''}</span>
                        {draft.rewards.length > 1 && (
                          <button data-press-feedback type="button" onClick={() => setDraft((d) => d && { ...d, rewards: d.rewards.filter((_, i) => i !== index) })} className="flex items-center gap-1 text-xs font-semibold text-foreground/70 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        )}
                      </div>
                      <Field label="What do they get?">
                        <input className={inputClass} value={reward.title} maxLength={80} onChange={(e) => setRewardField(index, { title: e.target.value })} placeholder="e.g. Free coffee" />
                      </Field>
                      <Field
                        label={
                          activeProgramme === 'stamps' ? 'Stamps needed'
                            : activeProgramme === 'points' ? 'Points needed'
                            : `Customer spends (${activeCountry.currency.symbol})`
                        }
                      >
                        <input className={inputClass} inputMode="decimal" value={reward.amount} onChange={(e) => setRewardField(index, { amount: e.target.value.replace(/[^0-9.]/g, '') })} />
                      </Field>
                    </div>
                  ))}

              {(activeProgramme === 'tiers' ? draft.tiers.length < 8 : draft.rewards.length < 10) && (
                <button
                  data-press-feedback
                  type="button"
                  onClick={() =>
                    setDraft((d) =>
                      d && (activeProgramme === 'tiers'
                        ? { ...d, tiers: [...d.tiers, { name: '', amount: '', perks: '', colour: '#8F9BB3' }] }
                        : { ...d, rewards: [...d.rewards, { title: '', description: '', amount: '' }] })
                    )
                  }
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary mb-4"
                >
                  <Plus className="h-4 w-4" /> {activeProgramme === 'tiers' ? 'Add a level' : 'Add another reward'}
                </button>
              )}

              {activeProgramme === 'points' && (
                <Field label={`Points earned for every ${activeCountry.currency.symbol}1 spent`}>
                  <input className={inputClass} inputMode="numeric" value={draft.pointsPerPound} onChange={(e) => setDraft((d) => d && { ...d, pointsPerPound: e.target.value.replace(/[^0-9]/g, '') })} />
                </Field>
              )}

              <CardPreview programme={activeProgramme} name={activeName} draft={draft} currency={activeCountry.currency} />
              {result && !result.ok && <p className="text-sm text-foreground mt-3">{result.message}</p>}
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-olive text-olive-ink mx-auto mb-4">
                <Check className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground text-center mb-2">You're live!</h1>
              <p className="text-foreground/70 text-center mb-6">Customers can join {activeName} now. This is their card:</p>
              {draft && <div className="mb-6"><CardPreview programme={activeProgramme} name={activeName} draft={draft} currency={activeCountry.currency} /></div>}
              <div className="grid gap-3">
                <button data-press-feedback type="button" onClick={() => void finish('/owner/tools')} className="flex items-center justify-center gap-2 rounded-full bg-primary hover:bg-primary-hover text-primary-foreground font-semibold h-12">
                  <QrCode className="h-4 w-4" /> Print your QR poster
                </button>
                <button data-press-feedback type="button" onClick={() => void finish('/owner/scan')} className="flex items-center justify-center gap-2 rounded-full border-2 border-primary text-foreground font-semibold h-12">
                  <ScanLine className="h-4 w-4" /> Scan your first customer
                </button>
                <button data-press-feedback type="button" onClick={() => void finish('/owner')} className="text-sm font-semibold text-foreground/70 py-2">
                  Go to my dashboard
                </button>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive mt-4">{error}</p>}

          {step <= lastEditable && (
            <div className="flex items-center justify-between mt-6">
              <button
                data-press-feedback
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || Boolean(resumeBusiness)}
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground/70 disabled:opacity-0"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {step < lastEditable ? (
                <button
                  data-press-feedback
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canContinue}
                  className="flex items-center gap-2 rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground font-semibold px-6 h-12 disabled:opacity-50"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  data-press-feedback
                  onClick={handleCreate}
                  disabled={creating || !canContinue}
                  className="flex items-center gap-2 rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground font-semibold px-6 h-12 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Looks good'} <Check className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-foreground/70 mt-4">
          Add your address, phone, logo and photos later from your shop page. Your shop goes live the moment you finish.
        </p>
      </div>
    </div>
  )
}

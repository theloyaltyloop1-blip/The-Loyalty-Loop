import * as React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, Store, MapPin, Palette, Gift, ArrowRight, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useOwner } from '@/lib/owner-context'
import { createBusiness, addRewardCatalogItem, parsePoundsToPence, type Business } from '@/lib/businesses'
import { geocodeAddress } from '@/lib/geocode'
import { ShopMap, DEFAULT_MAP_CENTER } from '@/components/shop-map'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'
import { BarePageSkeleton } from '@/components/page-skeleton'

const CATEGORIES = ['Café', 'Restaurant', 'Barber', 'Salon', 'Bakery', 'Retail', 'Other']
const BRAND_COLORS = ['#8B7355', '#D9534F', '#3FA34D', '#3B82C4', '#8E5FC2', '#D6296B', '#1B3A4B', '#D98B4A']

const STEPS = [
  { key: 'basics', label: 'Basics', icon: Store },
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'brand', label: 'Brand', icon: Palette },
  { key: 'rewards', label: 'Rewards', icon: Gift },
] as const

// Customers earn by spending; each reward unlocks at a £ amount (ARCH_PLAN.md §4.11).
type RewardDraft = { title: string; description: string; amount: string }

const EMPTY_REWARD: RewardDraft = { title: '', description: '', amount: '20' }

const inputClass =
  'h-12 w-full rounded-xl border border-black/10 bg-white px-4 font-medium text-foreground placeholder:text-foreground/35 outline-none focus:border-primary'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold text-foreground mb-1.5">{label}</span>
      {children}
    </label>
  )
}

export function OwnerOnboarding() {
  const { session, loading, rolesLoading, roles } = useAuth()
  const { businesses, business, needsRewardSetup, markRewardsReady, loading: ownerLoading, refetch, setBusinessId } = useOwner()
  const navigate = useNavigate()
  const [stepState, setStep] = React.useState(0)
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [rewards, setRewards] = React.useState<RewardDraft[]>([EMPTY_REWARD])
  // Guards against creating a second shop if the reward inserts fail and the
  // owner retries "Go live".
  const createdRef = React.useRef<Business | null>(null)
  const [form, setForm] = React.useState<{
    name: string
    category: string
    description: string
    address: string
    postcode: string
    lat: number | null
    lng: number | null
    brand_color: string
  }>({
    name: '',
    category: CATEGORIES[0],
    description: '',
    address: '',
    postcode: '',
    lat: null,
    lng: null,
    brand_color: BRAND_COLORS[0],
  })
  const [geocoding, setGeocoding] = React.useState(false)
  const [pinTouched, setPinTouched] = React.useState(false)

  // Auto-places a pin from the address/postcode as the owner types, debounced
  // to respect Nominatim's ~1 req/sec free-tier usage policy. Once the owner
  // has manually dragged the pin (pinTouched), typing no longer overrides it.
  React.useEffect(() => {
    if (pinTouched) return
    const query = [form.address, form.postcode].filter(Boolean).join(', ')
    if (query.trim().length < 4) return
    const handle = setTimeout(async () => {
      setGeocoding(true)
      try {
        const result = await geocodeAddress(query)
        if (result) setForm((f) => ({ ...f, lat: result.lat, lng: result.lng }))
      } finally {
        setGeocoding(false)
      }
    }, 900)
    return () => clearTimeout(handle)
  }, [form.address, form.postcode, pinTouched])

  // A shop created earlier (e.g. before rewards were mandatory) that still
  // has no reward: skip straight to the rewards step for that shop.
  const resumeBusiness = businesses.length > 0 && business && needsRewardSetup ? business : null
  const step = resumeBusiness ? STEPS.length - 1 : stepState

  if (loading || rolesLoading || ownerLoading) return <BarePageSkeleton />
  if (!session) return <Navigate to="/login" replace />
  if (!roles.includes('business_owner')) return <Navigate to="/dashboard" replace />
  if (businesses.length > 0 && !resumeBusiness) return <Navigate to="/owner" replace />

  const rewardValid = (r: RewardDraft) => r.title.trim().length > 0 && parsePoundsToPence(r.amount) !== null
  const amountsDistinct = new Set(rewards.map((r) => parsePoundsToPence(r.amount))).size === rewards.length
  const canContinue =
    step === 0
      ? form.name.trim().length > 0 && Boolean(form.category)
      : step === 3
        ? rewards.length > 0 && rewards.every(rewardValid) && amountsDistinct
        : true

  function updateReward(index: number, patch: Partial<RewardDraft>) {
    setRewards((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function goNext() {
    setStep((s) => s + 1)
  }

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const target = resumeBusiness ?? createdRef.current ?? (createdRef.current = await createBusiness(session!.user.id, form))
      await Promise.all(
        rewards.map((r, i) =>
          addRewardCatalogItem(target.id, {
            title: r.title.trim(),
            description: r.description.trim() || null,
            spend_threshold_pence: parsePoundsToPence(r.amount)!,
            sort_order: i,
          })
        )
      )
      markRewardsReady(target.id)
      await refetch()
      setBusinessId(target.id)
      navigate('/owner')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your shop — try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 justify-center mb-8">
          <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain rounded-full" />
          <span className="font-display font-extrabold text-lg text-foreground">The Loyalty Loop</span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <div
                className={
                  'h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ' +
                  (i < step
                    ? 'bg-fun-green border-fun-green text-white'
                    : i === step
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-black/10 text-foreground/30')
                }
              >
                {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </div>
              {i < STEPS.length - 1 && (
                <div className={'h-0.5 w-10 ' + (i < step ? 'bg-fun-green' : 'bg-black/10')} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="rounded-3xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8">
          <h1 className="text-2xl font-display font-extrabold text-foreground mb-1">
            {step === 0 && "Let's set up your shop"}
            {step === 1 && 'Where are you?'}
            {step === 2 && 'Make it yours'}
            {step === 3 && (resumeBusiness ? `Add rewards for ${resumeBusiness.name}` : 'What can customers unlock?')}
          </h1>
          <p className="text-sm text-foreground/50 mb-6">
            {step === 0 && 'The basics — you can change all of this later.'}
            {step === 1 && "Shown to customers on your shop page. It's fine to skip this and add it later."}
            {step === 2 && 'Pick a brand color for your shop page and loyalty card.'}
            {step === 3 && 'Customers earn by spending. Add at least one reward and how much they spend to unlock it — bigger rewards can unlock at higher amounts, and the biggest starts a new round. You can change these in Settings later.'}
          </p>

          {step === 0 && (
            <>
              <Field label="Shop name *">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Bean & Bird"
                />
              </Field>
              <Field label="Category *">
                <select
                  className={inputClass}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Description">
                <textarea
                  className={inputClass + ' h-24 py-3 resize-none'}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="A sentence or two about your shop"
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Address">
                <input
                  className={inputClass}
                  value={form.address}
                  onChange={(e) => {
                    setPinTouched(false)
                    setForm({ ...form, address: e.target.value })
                  }}
                  placeholder="12 Balham High Road"
                />
              </Field>
              <Field label="Postcode">
                <input
                  className={inputClass}
                  value={form.postcode}
                  onChange={(e) => {
                    setPinTouched(false)
                    setForm({ ...form, postcode: e.target.value })
                  }}
                  placeholder="SW12 9AA"
                />
              </Field>

              <div className="mb-4">
                <span className="block text-sm font-semibold text-foreground mb-1.5">
                  Pin location {geocoding && <span className="text-foreground/40 font-normal">(finding address…)</span>}
                </span>
                <ShopMap
                  lat={form.lat ?? DEFAULT_MAP_CENTER.lat}
                  lng={form.lng ?? DEFAULT_MAP_CENTER.lng}
                  color={form.brand_color}
                  zoom={form.lat != null ? 15 : 11}
                  editable
                  onChange={(lat, lng) => {
                    setPinTouched(true)
                    setForm((f) => ({ ...f, lat, lng }))
                  }}
                />
                <p className="text-xs text-foreground/40 mt-1.5">
                  {form.lat != null
                    ? 'Drag the pin or click the map to fine-tune — this is what customers will see on your shop page.'
                    : 'Enter an address above to auto-place the pin, or click the map to set it manually.'}
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm font-semibold text-foreground mb-2">Brand color</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {BRAND_COLORS.map((c) => (
                  <button data-press-feedback
                    key={c}
                    onClick={() => setForm({ ...form, brand_color: c })}
                    className="h-9 w-9 rounded-full border-2"
                    style={{ backgroundColor: c, borderColor: c === form.brand_color ? '#1a1a1a' : 'transparent' }}
                  />
                ))}
              </div>

              <p className="text-sm text-foreground/60 mb-2">
                Customers earn rewards by spending: staff scan their QR and enter what they spent, and linked
                cards count automatically where available. You'll choose the rewards and amounts next.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              {rewards.map((reward, index) => (
                <div key={index} className="rounded-2xl border border-black/10 bg-white/60 p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-foreground">Reward {rewards.length > 1 ? index + 1 : ''}</span>
                    {rewards.length > 1 && (
                      <button data-press-feedback
                        type="button"
                        onClick={() => setRewards((list) => list.filter((_, i) => i !== index))}
                        className="flex items-center gap-1 text-xs font-semibold text-foreground/50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    )}
                  </div>
                  <Field label="Reward *">
                    <input
                      className={inputClass}
                      value={reward.title}
                      onChange={(e) => updateReward(index, { title: e.target.value })}
                      placeholder="e.g. Free coffee"
                    />
                  </Field>
                  <Field label="Details">
                    <input
                      className={inputClass}
                      value={reward.description}
                      onChange={(e) => updateReward(index, { description: e.target.value })}
                      placeholder="Anything customers should know"
                    />
                  </Field>
                  <Field label="Unlocks after spending (£) *">
                    <input
                      inputMode="decimal"
                      className={inputClass}
                      value={reward.amount}
                      onChange={(e) => updateReward(index, { amount: e.target.value.replace(/[^0-9.]/g, '') })}
                      placeholder="20"
                    />
                  </Field>
                </div>
              ))}
              <button data-press-feedback
                type="button"
                onClick={() => setRewards((list) => [...list, { ...EMPTY_REWARD, amount: '' }])}
                className="flex items-center gap-1.5 text-sm font-semibold text-primary mb-2"
              >
                <Plus className="h-4 w-4" /> Add another reward
              </button>
            </>
          )}

          {step === 3 && !amountsDistinct && (
            <p className="text-sm text-red-600 mb-4">Each reward needs a different amount.</p>
          )}
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <div className="flex items-center justify-between mt-4">
            <button data-press-feedback
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || Boolean(resumeBusiness)}
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground/50 disabled:opacity-0"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button data-press-feedback
                onClick={goNext}
                disabled={!canContinue}
                className="flex items-center gap-2 rounded-full bg-primary text-white font-bold px-6 h-12 disabled:opacity-50"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button data-press-feedback
                onClick={handleCreate}
                disabled={creating || !canContinue}
                className="flex items-center gap-2 rounded-full bg-primary text-white font-bold px-6 h-12 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Go live'} <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-foreground/40 mt-4">
          Your shop goes live the moment you finish — no waiting for approval. You can add a logo, cover photo
          and gallery from Settings afterwards.
        </p>
      </div>
    </div>
  )
}

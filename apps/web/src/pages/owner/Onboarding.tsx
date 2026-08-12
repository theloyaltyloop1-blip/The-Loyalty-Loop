import * as React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, Store, MapPin, Palette, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useOwner } from '@/lib/owner-context'
import { createBusiness, type Business } from '@/lib/businesses'
import { geocodeAddress } from '@/lib/geocode'
import { ShopMap } from '@/components/shop-map'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'

const CATEGORIES = ['Café', 'Restaurant', 'Barber', 'Salon', 'Bakery', 'Retail', 'Other']
const BRAND_COLORS = ['#8B7355', '#D9534F', '#3FA34D', '#3B82C4', '#8E5FC2', '#D6296B', '#1B3A4B', '#D98B4A']

const STEPS = [
  { key: 'basics', label: 'Basics', icon: Store },
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'brand', label: 'Brand & loyalty', icon: Palette },
] as const

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
  const { businesses, loading: ownerLoading, refetch, setBusinessId } = useOwner()
  const navigate = useNavigate()
  const [step, setStep] = React.useState(0)
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<{
    name: string
    category: string
    description: string
    address: string
    postcode: string
    lat: number | null
    lng: number | null
    brand_color: string
    loyalty_type: Business['loyalty_type']
    stamps_required: number
  }>({
    name: '',
    category: CATEGORIES[0],
    description: '',
    address: '',
    postcode: '',
    lat: null,
    lng: null,
    brand_color: BRAND_COLORS[0],
    loyalty_type: 'stamp_card',
    stamps_required: 10,
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

  if (loading || rolesLoading || ownerLoading) return null
  if (!session) return <Navigate to="/login" replace />
  if (!roles.includes('business_owner')) return <Navigate to="/dashboard" replace />
  if (businesses.length > 0) return <Navigate to="/owner" replace />

  const canContinue =
    step === 0
      ? form.name.trim().length > 0 && Boolean(form.category)
      : step === 2
        ? Number.isInteger(form.stamps_required) && form.stamps_required >= 1 && form.stamps_required <= 100
        : true

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const business = await createBusiness(session!.user.id, form)
      await refetch()
      setBusinessId(business.id)
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
          </h1>
          <p className="text-sm text-foreground/50 mb-6">
            {step === 0 && 'The basics — you can change all of this later.'}
            {step === 1 && "Shown to customers on your shop page. It's fine to skip this and add it later."}
            {step === 2 && 'Pick a brand color and how customers will earn rewards.'}
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

              {form.lat != null && form.lng != null ? (
                <div className="mb-4">
                  <span className="block text-sm font-semibold text-foreground mb-1.5">
                    Pin location {geocoding && <span className="text-foreground/40 font-normal">(finding address…)</span>}
                  </span>
                  <ShopMap
                    lat={form.lat}
                    lng={form.lng}
                    color={form.brand_color}
                    editable
                    onChange={(lat, lng) => {
                      setPinTouched(true)
                      setForm((f) => ({ ...f, lat, lng }))
                    }}
                  />
                  <p className="text-xs text-foreground/40 mt-1.5">
                    Drag the pin or click the map to fine-tune — this is what customers will see on your shop page.
                  </p>
                </div>
              ) : (
                <div className="mb-4 rounded-2xl border border-dashed border-black/15 bg-white/40 px-4 py-6 text-center text-sm text-foreground/40 flex items-center justify-center gap-2">
                  {geocoding && <Loader2 className="h-4 w-4 animate-spin" />}
                  {geocoding ? 'Finding your address…' : 'Enter an address to place a pin'}
                </div>
              )}
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

              <p className="text-sm font-semibold text-foreground mb-1">Loyalty program type</p>
              <p className="text-xs text-foreground/40 mb-3">You can change this any time.</p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { value: 'stamp_card' as const, title: 'Stamps' },
                  { value: 'points' as const, title: 'Points' },
                  { value: 'tiered' as const, title: 'Visits' },
                ].map((opt) => (
                  <button data-press-feedback
                    key={opt.value}
                    onClick={() => setForm({ ...form, loyalty_type: opt.value })}
                    className={
                      'rounded-xl border-2 py-3 font-bold text-sm ' +
                      (form.loyalty_type === opt.value
                        ? 'border-primary bg-white text-foreground'
                        : 'border-black/10 bg-white/40 text-foreground/60')
                    }
                  >
                    {opt.title}
                  </button>
                ))}
              </div>

              <Field label="How many to unlock a reward?">
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={inputClass}
                  value={form.stamps_required}
                  onChange={(e) => setForm({ ...form, stamps_required: Number(e.target.value) })}
                />
              </Field>
            </>
          )}

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <div className="flex items-center justify-between mt-4">
            <button data-press-feedback
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground/50 disabled:opacity-0"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button data-press-feedback
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue}
                className="flex items-center gap-2 rounded-full bg-primary text-white font-bold px-6 h-12 disabled:opacity-50"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button data-press-feedback
                onClick={handleCreate}
                disabled={creating}
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

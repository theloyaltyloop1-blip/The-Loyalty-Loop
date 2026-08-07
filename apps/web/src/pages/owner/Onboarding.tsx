import * as React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, Store, MapPin, Palette, ArrowRight, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useOwner } from '@/lib/owner-context'
import { createBusiness, type Business } from '@/lib/businesses'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'

const CATEGORIES = ['Café', 'Restaurant', 'Barber', 'Salon', 'Bakery', 'Retail', 'Other']
const BRAND_COLORS = ['#8B7355', '#D9534F', '#3FA34D', '#3B82C4', '#8E5FC2', '#D6296B', '#1B3A4B', '#D98B4A']

const STEPS = [
  { key: 'basics', label: 'Basics', icon: Store },
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'brand', label: 'Brand & loyalty', icon: Palette },
] as const

const inputClass =
  'h-12 w-full rounded-xl border border-black/10 bg-white px-4 font-medium text-[#1a1a1a] placeholder:text-[#1a1a1a]/35 outline-none focus:border-[#E8703B]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold text-[#1a1a1a] mb-1.5">{label}</span>
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
    brand_color: string
    loyalty_type: Business['loyalty_type']
    stamps_required: number
  }>({
    name: '',
    category: CATEGORIES[0],
    description: '',
    address: '',
    postcode: '',
    brand_color: BRAND_COLORS[0],
    loyalty_type: 'stamp_card',
    stamps_required: 10,
  })

  if (loading || rolesLoading || ownerLoading) return null
  if (!session) return <Navigate to="/login" replace />
  if (!roles.includes('business_owner')) return <Navigate to="/dashboard" replace />
  if (businesses.length > 0) return <Navigate to="/owner" replace />

  const canContinue =
    step === 0 ? form.name.trim().length > 0 && form.category : step === 1 ? true : true

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
    <div className="min-h-screen bg-[#F7ECDC] flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 justify-center mb-8">
          <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain rounded-full" />
          <span className="font-display font-extrabold text-lg text-[#1a1a1a]">The Loyalty Loop</span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <div
                className={
                  'h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ' +
                  (i < step
                    ? 'bg-[#3FA34D] border-[#3FA34D] text-white'
                    : i === step
                      ? 'bg-[#E8703B] border-[#E8703B] text-white'
                      : 'bg-white border-black/10 text-[#1a1a1a]/30')
                }
              >
                {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </div>
              {i < STEPS.length - 1 && (
                <div className={'h-0.5 w-10 ' + (i < step ? 'bg-[#3FA34D]' : 'bg-black/10')} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="rounded-3xl bg-[#FBF6EC] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8">
          <h1 className="text-2xl font-display font-extrabold text-[#1a1a1a] mb-1">
            {step === 0 && "Let's set up your shop"}
            {step === 1 && 'Where are you?'}
            {step === 2 && 'Make it yours'}
          </h1>
          <p className="text-sm text-[#1a1a1a]/50 mb-6">
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
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="12 Balham High Road"
                />
              </Field>
              <Field label="Postcode">
                <input
                  className={inputClass}
                  value={form.postcode}
                  onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                  placeholder="SW12 9AA"
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm font-semibold text-[#1a1a1a] mb-2">Brand color</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {BRAND_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, brand_color: c })}
                    className="h-9 w-9 rounded-full border-2"
                    style={{ backgroundColor: c, borderColor: c === form.brand_color ? '#1a1a1a' : 'transparent' }}
                  />
                ))}
              </div>

              <p className="text-sm font-semibold text-[#1a1a1a] mb-1">Loyalty program type</p>
              <p className="text-xs text-[#1a1a1a]/40 mb-3">You can change this any time.</p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { value: 'stamp_card' as const, title: 'Stamps' },
                  { value: 'points' as const, title: 'Points' },
                  { value: 'tiered' as const, title: 'Visits' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setForm({ ...form, loyalty_type: opt.value })}
                    className={
                      'rounded-xl border-2 py-3 font-bold text-sm ' +
                      (form.loyalty_type === opt.value
                        ? 'border-[#E8703B] bg-white text-[#1a1a1a]'
                        : 'border-black/10 bg-white/40 text-[#1a1a1a]/60')
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
                  className={inputClass}
                  value={form.stamps_required}
                  onChange={(e) => setForm({ ...form, stamps_required: Number(e.target.value) })}
                />
              </Field>
            </>
          )}

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#1a1a1a]/50 disabled:opacity-0"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue}
                className="flex items-center gap-2 rounded-full bg-[#E8703B] text-white font-bold px-6 h-12 disabled:opacity-50"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 rounded-full bg-[#E8703B] text-white font-bold px-6 h-12 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Go live'} <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-[#1a1a1a]/40 mt-4">
          Your shop goes live the moment you finish — no waiting for approval. You can add a logo, cover photo
          and gallery from Settings afterwards.
        </p>
      </div>
    </div>
  )
}

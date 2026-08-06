import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Store, Gift, Send, Shield, Users, CircleHelp, TriangleAlert, Plus, Trash2, Upload, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { useOwner } from '@/lib/owner-context'
import {
  updateBusiness,
  addRewardCatalogItem,
  deleteRewardCatalogItem,
  fetchRewardCatalog,
  type RewardCatalogItem,
} from '@/lib/businesses'

const CATEGORIES = ['Café', 'Restaurant', 'Barber', 'Salon', 'Bakery', 'Retail', 'Other']

const BRAND_COLORS = ['#8B7355', '#D9534F', '#3FA34D', '#3B82C4', '#8E5FC2', '#D6296B', '#1B3A4B', '#D98B4A']

const STAMP_ICON_PRESETS = ['⭐', '🍩', '✂️', '🍕', '☕', '🧁', '🍰', '🍞', '🍔', '🍟', '🌮', '💅', '🎁', '❤️']

const TABS = [
  { key: 'profile', label: 'Profile', icon: Store },
  { key: 'loyalty', label: 'Loyalty & rewards', icon: Gift },
  { key: 'winback', label: 'Win-back emails', icon: Send },
  { key: 'verification', label: 'Verification', icon: Shield },
  { key: 'staff', label: 'Staff', icon: Users },
  { key: 'help', label: 'Help & support', icon: CircleHelp },
  { key: 'danger', label: 'Danger zone', icon: TriangleAlert },
] as const

type TabKey = (typeof TABS)[number]['key']

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#FBF6EC] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 mb-5">
      {title && <h3 className="font-display font-bold text-[#1a1a1a] mb-4">{title}</h3>}
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold text-[#1a1a1a] mb-1.5">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'h-12 w-full rounded-xl border border-black/10 bg-white/60 px-4 font-medium text-[#1a1a1a] placeholder:text-[#1a1a1a]/35 outline-none focus:border-[#E8703B]'

function ProfileTab() {
  const { business, updateLocalBusiness } = useOwner()
  const [form, setForm] = React.useState({
    name: business?.name ?? '',
    category: business?.category ?? CATEGORIES[0],
    description: business?.description ?? '',
    address: business?.address ?? '',
    postcode: business?.postcode ?? '',
    website: business?.website ?? '',
    phone: business?.phone ?? '',
    instagram: business?.instagram ?? '',
  })
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    if (!business) return
    setForm({
      name: business.name,
      category: business.category ?? CATEGORIES[0],
      description: business.description ?? '',
      address: business.address ?? '',
      postcode: business.postcode ?? '',
      website: business.website ?? '',
      phone: business.phone ?? '',
      instagram: business.instagram ?? '',
    })
  }, [business?.id])

  if (!business) return null

  async function handleSave() {
    setSaving(true)
    try {
      await updateBusiness(business!.id, form)
      updateLocalBusiness(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SectionCard>
        <p className="text-xs font-bold uppercase tracking-wide text-[#1a1a1a]/40 mb-3">Storefront preview</p>
        <div className="rounded-2xl overflow-hidden border border-black/10">
          <div className="h-40 relative" style={{ backgroundColor: business.brand_color }}>
            <span className="absolute -bottom-5 left-5 h-12 w-12 rounded-xl bg-white flex items-center justify-center shadow">
              <Store className="h-5 w-5" style={{ color: business.brand_color }} />
            </span>
          </div>
          <div className="bg-white pt-8 pb-4 px-5">
            <p className="font-display font-bold text-[#1a1a1a]">{form.name || business.name}</p>
            <p className="text-sm text-[#1a1a1a]/50">{form.category}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Brand images">
        <p className="text-sm text-[#1a1a1a]/50 mb-4">
          A logo is shown as your shop's image across The Loyalty Loop (home feed, stamp card, announcements).
          Image upload isn't wired up yet — coming with storage buckets shortly.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {['Logo', 'Cover image'].map((label) => (
            <div key={label}>
              <p className="text-sm font-semibold text-[#1a1a1a] mb-1.5">{label}</p>
              <div className="h-32 rounded-xl border-2 border-dashed border-black/15 flex flex-col items-center justify-center gap-1 text-[#1a1a1a]/40 text-sm">
                <ImageIcon className="h-5 w-5" />
                Drag image here or pick file
              </div>
              <button
                disabled
                className="mt-2 flex items-center gap-2 rounded-full border border-black/15 px-4 h-9 text-sm font-semibold text-[#1a1a1a]/40"
              >
                <Upload className="h-3.5 w-3.5" /> Upload
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Basics">
        <Field label="Shop name *">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Category *">
          <select
            className={inputClass}
            value={form.category ?? ''}
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
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Location">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Address">
            <input
              className={inputClass}
              value={form.address ?? ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="Postcode">
            <input
              className={inputClass}
              value={form.postcode ?? ''}
              onChange={(e) => setForm({ ...form, postcode: e.target.value })}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Contact">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Website">
            <input
              className={inputClass}
              value={form.website ?? ''}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass}
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Instagram">
          <input
            className={inputClass}
            placeholder="@yourshop"
            value={form.instagram ?? ''}
            onChange={(e) => setForm({ ...form, instagram: e.target.value })}
          />
        </Field>
      </SectionCard>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-[#E8703B] text-white font-bold px-6 h-12 disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
      </button>
    </>
  )
}

function LoyaltyTab() {
  const { business, updateLocalBusiness } = useOwner()
  const [loyaltyType, setLoyaltyType] = React.useState(business?.loyalty_type ?? 'stamp_card')
  const [brandColor, setBrandColor] = React.useState(business?.brand_color ?? BRAND_COLORS[0])
  const [stampsRequired, setStampsRequired] = React.useState(business?.loyalty_config.stamps_required ?? 10)
  const [stampIcon, setStampIcon] = React.useState(business?.loyalty_config.stamp_icon ?? '⭐')
  const [signupReward, setSignupReward] = React.useState(business?.loyalty_config.signup_reward_title ?? '')
  const [catalog, setCatalog] = React.useState<RewardCatalogItem[]>([])
  const [newReward, setNewReward] = React.useState({ title: '', description: '', stamp_threshold: 10 })
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    if (!business) return
    setLoyaltyType(business.loyalty_type)
    setBrandColor(business.brand_color)
    setStampsRequired(business.loyalty_config.stamps_required ?? 10)
    setStampIcon(business.loyalty_config.stamp_icon ?? '⭐')
    setSignupReward(business.loyalty_config.signup_reward_title ?? '')
    fetchRewardCatalog(business.id).then(setCatalog)
  }, [business?.id])

  if (!business) return null

  async function handleSave() {
    setSaving(true)
    try {
      await updateBusiness(business!.id, {
        loyalty_type: loyaltyType,
        brand_color: brandColor,
        loyalty_config: { stamps_required: stampsRequired, stamp_icon: stampIcon, signup_reward_title: signupReward },
      })
      updateLocalBusiness({ loyalty_type: loyaltyType, brand_color: brandColor })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddReward() {
    if (!newReward.title.trim()) return
    const created = await addRewardCatalogItem(business!.id, {
      title: newReward.title,
      description: newReward.description || null,
      stamp_threshold: newReward.stamp_threshold,
      sort_order: catalog.length,
    })
    setCatalog([...catalog, created])
    setNewReward({ title: '', description: '', stamp_threshold: 10 })
  }

  async function handleDeleteReward(id: string) {
    await deleteRewardCatalogItem(id)
    setCatalog(catalog.filter((r) => r.id !== id))
  }

  return (
    <>
      <SectionCard title="Sign-up reward">
        <p className="text-sm text-[#1a1a1a]/50 mb-3">
          Something free just for joining your loyalty card — shown on your shop page so customers know what
          to expect before they sign up.
        </p>
        <input
          className={inputClass}
          placeholder="e.g. Free coffee just for joining"
          value={signupReward}
          onChange={(e) => setSignupReward(e.target.value)}
        />
      </SectionCard>

      <SectionCard title="Brand & loyalty">
        <p className="text-sm font-semibold text-[#1a1a1a] mb-1">Loyalty program type</p>
        <p className="text-sm text-[#1a1a1a]/50 mb-3">How will customers earn rewards? You can change this any time.</p>
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          {[
            { value: 'stamp_card' as const, title: 'Stamps', desc: 'Classic punch card. One stamp per visit, fills a grid.' },
            { value: 'points' as const, title: 'Points', desc: 'Award points per visit or spend. Best for variable rewards.' },
            { value: 'tiered' as const, title: 'Visits', desc: 'Just count visits. Simple and clean.' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLoyaltyType(opt.value)}
              className={
                'text-left rounded-xl border-2 p-4 transition-colors ' +
                (loyaltyType === opt.value ? 'border-[#E8703B] bg-white' : 'border-black/10 bg-white/40')
              }
            >
              <p className="font-bold text-[#1a1a1a] mb-1">{opt.title}</p>
              <p className="text-xs text-[#1a1a1a]/50">{opt.desc}</p>
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <p className="text-sm font-semibold text-[#1a1a1a] mb-2">Brand color</p>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-10 w-10 rounded-lg border border-black/10"
              />
              <input className={inputClass} value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {BRAND_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBrandColor(c)}
                  className="h-8 w-8 rounded-full border-2"
                  style={{ backgroundColor: c, borderColor: c === brandColor ? '#1a1a1a' : 'transparent' }}
                />
              ))}
            </div>

            <p className="text-xs font-bold uppercase tracking-wide text-[#1a1a1a]/40 mb-2">Card preview</p>
            <div className="rounded-xl border border-black/10 bg-white p-4 max-w-[220px]">
              <div
                className="h-11 w-11 rounded-lg flex items-center justify-center text-white font-display font-bold mb-3"
                style={{ backgroundColor: brandColor }}
              >
                {business.name.charAt(0).toUpperCase()}
              </div>
              <p className="font-bold text-sm text-[#1a1a1a]">{business.name}</p>
              <p className="text-[10px] uppercase text-[#1a1a1a]/40 mb-2">{business.category}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-[#1a1a1a]/60">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColor }} /> Tap to join
                </span>
                <span className="font-bold text-[#C9622E]">View →</span>
              </div>
            </div>
          </div>

          <div>
            <Field label="Stamps required for reward">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={stampsRequired}
                onChange={(e) => setStampsRequired(Number(e.target.value))}
              />
              <span className="text-xs text-[#1a1a1a]/40 mt-1 block">
                Used for shops without a reward catalogue. If you add catalogue tiers below, customers earn
                each tier's reward instead.
              </span>
            </Field>

            <p className="text-sm font-semibold text-[#1a1a1a] mb-1.5">Stamp icon</p>
            <p className="text-xs text-[#1a1a1a]/40 mb-2">
              Pick a preset or type your own emoji — this is what fills each slot on the card.
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {STAMP_ICON_PRESETS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setStampIcon(icon)}
                  className={
                    'h-9 w-9 rounded-lg border-2 flex items-center justify-center text-lg ' +
                    (icon === stampIcon ? 'border-[#E8703B]' : 'border-black/10')
                  }
                >
                  {icon}
                </button>
              ))}
            </div>
            <input
              className={inputClass + ' mb-3'}
              value={stampIcon}
              onChange={(e) => setStampIcon(e.target.value)}
            />

            <p className="text-xs font-bold uppercase tracking-wide text-[#1a1a1a]/40 mb-2">Card preview</p>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: Math.min(stampsRequired, 5) }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 w-9 rounded-full flex items-center justify-center text-base"
                  style={{ backgroundColor: i < 3 ? brandColor : 'transparent', border: i < 3 ? 'none' : '1px solid rgba(0,0,0,0.15)' }}
                >
                  {stampIcon}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <h3 className="font-display font-bold text-[#1a1a1a] mb-1">Reward catalogue *</h3>
        <p className="text-sm text-[#1a1a1a]/50 mb-4">
          Tell customers what they can earn — shown on your shop page before they join. Required: add at
          least one reward here to unlock scanning.
        </p>

        {catalog.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {catalog.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white/60 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-[#1a1a1a]">{r.title}</p>
                  <p className="text-xs text-[#1a1a1a]/50">
                    {r.description} · {r.stamp_threshold} stamps
                  </p>
                </div>
                <button onClick={() => handleDeleteReward(r.id)} className="text-[#1a1a1a]/40 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
          <Field label="Title">
            <input
              className={inputClass}
              placeholder="Free coffee"
              value={newReward.title}
              onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <input
              className={inputClass}
              placeholder="Any size, any time"
              value={newReward.description}
              onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
            />
          </Field>
          <Field label="Stamps">
            <input
              type="number"
              min={1}
              className={inputClass + ' w-24'}
              value={newReward.stamp_threshold}
              onChange={(e) => setNewReward({ ...newReward, stamp_threshold: Number(e.target.value) })}
            />
          </Field>
          <button
            onClick={handleAddReward}
            className="h-12 rounded-full bg-[#E8703B] text-white font-bold px-5 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </SectionCard>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-[#E8703B] text-white font-bold px-6 h-12 disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
      </button>
    </>
  )
}

function ComingSoonPanel({ label }: { label: string }) {
  return (
    <SectionCard>
      <p className="text-[#1a1a1a]/50">{label} lands here soon.</p>
    </SectionCard>
  )
}

export function OwnerSettings() {
  const { session, loading } = useAuth()
  const { business, loading: ownerLoading } = useOwner()
  const [tab, setTab] = React.useState<TabKey>('profile')

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  return (
    <OwnerLayout>
      <h1 className="text-3xl font-display font-extrabold text-[#1a1a1a] mb-5">Shop settings</h1>

      <div className="flex flex-wrap gap-1 border-b border-black/10 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ' +
              (tab === key
                ? 'border-[#1a1a1a] text-[#1a1a1a]'
                : 'border-transparent text-[#1a1a1a]/40 hover:text-[#1a1a1a]/70')
            }
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {ownerLoading ? null : !business ? (
        <p className="text-[#1a1a1a]/50">You don't have a shop yet.</p>
      ) : (
        <>
          {tab === 'profile' && <ProfileTab />}
          {tab === 'loyalty' && <LoyaltyTab />}
          {tab === 'winback' && <ComingSoonPanel label="Win-back emails" />}
          {tab === 'verification' && <ComingSoonPanel label="Business verification" />}
          {tab === 'staff' && <ComingSoonPanel label="Staff accounts" />}
          {tab === 'help' && <ComingSoonPanel label="Help & support" />}
          {tab === 'danger' && <ComingSoonPanel label="Danger zone" />}
        </>
      )}
    </OwnerLayout>
  )
}

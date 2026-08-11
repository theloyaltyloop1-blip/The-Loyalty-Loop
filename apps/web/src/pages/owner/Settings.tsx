import * as React from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Store, Gift, Send, Shield, Users, CircleHelp, TriangleAlert, Plus, Trash2, Upload, Image as ImageIcon, FileCheck, Clock, BadgeCheck, XCircle, UserPlus, ScanLine, MessageSquare } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { useOwner } from '@/lib/owner-context'
import {
  updateBusiness,
  uploadBusinessImage,
  addRewardCatalogItem,
  deleteRewardCatalogItem,
  fetchRewardCatalog,
  fetchWinbackLog,
  triggerWinbackEmails,
  submitVerificationDocument,
  fetchStaffMembers,
  inviteStaffMember,
  setStaffStatus,
  updateStaffPermissions,
  deleteOwnedBusiness,
  fetchBusinessPhotos,
  uploadGalleryPhoto,
  deleteBusinessPhoto,
  type RewardCatalogItem,
  type WinbackLogEntry,
  type StaffMember,
  type BusinessPhoto,
  type OpeningHours,
  type DayHours,
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
    <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 mb-5">
      {title && <h3 className="font-display font-bold text-foreground mb-4">{title}</h3>}
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold text-foreground mb-1.5">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'h-12 w-full rounded-xl border border-black/10 bg-white/60 px-4 font-medium text-foreground placeholder:text-foreground/35 outline-none focus:border-primary'

function BrandImageUpload({
  label,
  field,
  businessId,
  currentUrl,
  onUploaded,
}: {
  label: string
  field: 'logo_url' | 'cover_url'
  businessId: string
  currentUrl: string | null
  onUploaded: (url: string) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const updated = await uploadBusinessImage(businessId, field, file)
      onUploaded((updated[field] as string) ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-foreground mb-1.5">{label}</p>
      <div
        onClick={() => inputRef.current?.click()}
        className="h-32 rounded-xl border-2 border-dashed border-black/15 flex flex-col items-center justify-center gap-1 text-foreground/40 text-sm cursor-pointer overflow-hidden bg-white/40 hover:border-primary/50 transition-colors"
        style={
          currentUrl
            ? { backgroundImage: `url(${currentUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        {!currentUrl && (
          <>
            <ImageIcon className="h-5 w-5" />
            Drag image here or pick file
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-2 flex items-center gap-2 rounded-full border border-black/15 px-4 h-9 text-sm font-semibold text-foreground disabled:opacity-40"
      >
        <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : currentUrl ? 'Replace' : 'Upload'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

const DAYS: { key: keyof OpeningHours; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const DEFAULT_HOURS: DayHours = { closed: false, open: '09:00', close: '17:00' }

function OpeningHoursEditor({ hours, onChange }: { hours: OpeningHours; onChange: (h: OpeningHours) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {DAYS.map(({ key, label }) => {
        const day = hours[key] ?? { ...DEFAULT_HOURS, closed: true }
        return (
          <div key={key} className="flex items-center gap-3 flex-wrap">
            <span className="w-28 text-sm font-semibold text-foreground">{label}</span>
            <button
              onClick={() => onChange({ ...hours, [key]: { ...day, closed: !day.closed } })}
              className={
                'rounded-full px-3 h-8 text-xs font-bold ' +
                (day.closed ? 'bg-black/5 text-foreground/40' : 'bg-[#DFF3E3] text-fun-green')
              }
            >
              {day.closed ? 'Closed' : 'Open'}
            </button>
            {!day.closed && (
              <>
                <input
                  type="time"
                  value={day.open}
                  onChange={(e) => onChange({ ...hours, [key]: { ...day, open: e.target.value } })}
                  className="h-8 rounded-lg border border-black/10 bg-white px-2 text-sm"
                />
                <span className="text-foreground/30">–</span>
                <input
                  type="time"
                  value={day.close}
                  onChange={(e) => onChange({ ...hours, [key]: { ...day, close: e.target.value } })}
                  className="h-8 rounded-lg border border-black/10 bg-white px-2 text-sm"
                />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function GalleryTab({ businessId }: { businessId: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = React.useState<BusinessPhoto[]>([])
  const [loadingPhotos, setLoadingPhotos] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchBusinessPhotos(businessId).then(setPhotos).finally(() => setLoadingPhotos(false))
  }, [businessId])

  async function handleUpload(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const photo = await uploadGalleryPhoto(businessId, file, photos.length)
      setPhotos([...photos, photo])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    setPhotos(photos.filter((p) => p.id !== id))
    await deleteBusinessPhoto(id)
  }

  return (
    <SectionCard title="Gallery">
      <p className="text-sm text-foreground/50 mb-4">
        Extra photos shown on your shop page — your space, your food, your work. PNG, JPEG, WEBP or GIF, up to 5MB
        each.
      </p>
      {loadingPhotos ? (
        <p className="text-sm text-foreground/40">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded-xl overflow-hidden aspect-square group">
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => handleDelete(p.id)}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-xl border-2 border-dashed border-black/15 aspect-square flex flex-col items-center justify-center gap-1 text-foreground/40 hover:border-primary/50 transition-colors disabled:opacity-50"
          >
            <ImageIcon className="h-5 w-5" />
            <span className="text-xs font-semibold">{uploading ? 'Uploading…' : 'Add photo'}</span>
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files?.[0])}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </SectionCard>
  )
}

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
  const [hours, setHours] = React.useState<OpeningHours>(business?.opening_hours ?? {})
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
    setHours(business.opening_hours ?? {})
  }, [business?.id])

  if (!business) return null

  async function handleSave() {
    setSaving(true)
    try {
      await updateBusiness(business!.id, { ...form, opening_hours: hours })
      updateLocalBusiness({ ...form, opening_hours: hours })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SectionCard>
        <p className="text-xs font-bold uppercase tracking-wide text-foreground/40 mb-3">Storefront preview</p>
        <div className="rounded-2xl overflow-hidden border border-black/10">
          <div
            className="h-40 relative bg-cover bg-center"
            style={{
              backgroundColor: business.brand_color,
              backgroundImage: business.cover_url ? `url(${business.cover_url})` : undefined,
            }}
          >
            <span className="absolute -bottom-5 left-5 h-12 w-12 rounded-xl bg-white flex items-center justify-center shadow overflow-hidden">
              {business.logo_url ? (
                <img src={business.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-5 w-5" style={{ color: business.brand_color }} />
              )}
            </span>
          </div>
          <div className="bg-white pt-8 pb-4 px-5">
            <p className="font-display font-bold text-foreground">{form.name || business.name}</p>
            <p className="text-sm text-foreground/50">{form.category}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Brand images">
        <p className="text-sm text-foreground/50 mb-4">
          A logo is shown as your shop's image across The Loyalty Loop (home feed, stamp card, announcements).
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <BrandImageUpload
            label="Logo"
            field="logo_url"
            businessId={business.id}
            currentUrl={business.logo_url}
            onUploaded={(url) => updateLocalBusiness({ logo_url: url })}
          />
          <BrandImageUpload
            label="Cover image"
            field="cover_url"
            businessId={business.id}
            currentUrl={business.cover_url}
            onUploaded={(url) => updateLocalBusiness({ cover_url: url })}
          />
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

      <SectionCard title="Opening hours">
        <OpeningHoursEditor hours={hours} onChange={setHours} />
      </SectionCard>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-primary text-white font-bold px-6 h-12 disabled:opacity-50 mb-5"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
      </button>

      <GalleryTab businessId={business.id} />
    </>
  )
}

const UNIT_LABEL: Record<'stamp_card' | 'points' | 'tiered', string> = {
  stamp_card: 'Stamp',
  points: 'Point',
  tiered: 'Visit',
}

function LoyaltyTab() {
  const { business, updateLocalBusiness } = useOwner()
  const [loyaltyType, setLoyaltyType] = React.useState(business?.loyalty_type ?? 'stamp_card')
  const unit = UNIT_LABEL[loyaltyType]
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
        <p className="text-sm text-foreground/50 mb-3">
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
        <p className="text-sm font-semibold text-foreground mb-1">Loyalty program type</p>
        <p className="text-sm text-foreground/50 mb-3">How will customers earn rewards? You can change this any time.</p>
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
                (loyaltyType === opt.value ? 'border-primary bg-white' : 'border-black/10 bg-white/40')
              }
            >
              <p className="font-bold text-foreground mb-1">{opt.title}</p>
              <p className="text-xs text-foreground/50">{opt.desc}</p>
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">Brand color</p>
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

            <p className="text-xs font-bold uppercase tracking-wide text-foreground/40 mb-2">Card preview</p>
            <div className="rounded-xl border border-black/10 bg-white p-4 max-w-[220px]">
              <div
                className="h-11 w-11 rounded-lg flex items-center justify-center text-white font-display font-bold mb-3"
                style={{ backgroundColor: brandColor }}
              >
                {business.name.charAt(0).toUpperCase()}
              </div>
              <p className="font-bold text-sm text-foreground">{business.name}</p>
              <p className="text-[10px] uppercase text-foreground/40 mb-2">{business.category}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-foreground/60">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColor }} /> Tap to join
                </span>
                <span className="font-bold text-primary-hover">View →</span>
              </div>
            </div>
          </div>

          <div>
            <Field label={`${unit}s required for reward`}>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={stampsRequired}
                onChange={(e) => setStampsRequired(Number(e.target.value))}
              />
              <span className="text-xs text-foreground/40 mt-1 block">
                Used for shops without a reward catalogue. If you add catalogue tiers below, customers earn
                each tier's reward instead.
              </span>
            </Field>

            <p className="text-sm font-semibold text-foreground mb-1.5">{unit} icon</p>
            <p className="text-xs text-foreground/40 mb-2">
              Pick a preset or type your own emoji — this is what fills each slot on the card.
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {STAMP_ICON_PRESETS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setStampIcon(icon)}
                  className={
                    'h-9 w-9 rounded-lg border-2 flex items-center justify-center text-lg ' +
                    (icon === stampIcon ? 'border-primary' : 'border-black/10')
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

            <p className="text-xs font-bold uppercase tracking-wide text-foreground/40 mb-2">Card preview</p>
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
        <h3 className="font-display font-bold text-foreground mb-1">Reward catalogue *</h3>
        <p className="text-sm text-foreground/50 mb-4">
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
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <p className="text-xs text-foreground/50">
                    {r.description} · {r.stamp_threshold} {unit.toLowerCase()}{r.stamp_threshold === 1 ? '' : 's'}
                  </p>
                </div>
                <button onClick={() => handleDeleteReward(r.id)} className="text-foreground/40 hover:text-red-600">
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
          <Field label={`${unit}s`}>
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
            className="h-12 rounded-full bg-primary text-white font-bold px-5 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </SectionCard>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-primary text-white font-bold px-6 h-12 disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
      </button>
    </>
  )
}

function WinbackTab() {
  const { business } = useOwner()
  const [threshold, setThreshold] = React.useState(30)
  const [log, setLog] = React.useState<WinbackLogEntry[]>([])
  const [loadingLog, setLoadingLog] = React.useState(true)
  const [sending, setSending] = React.useState(false)
  const [result, setResult] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const loadLog = React.useCallback(() => {
    if (!business) return
    setLoadingLog(true)
    fetchWinbackLog(business.id)
      .then(setLog)
      .finally(() => setLoadingLog(false))
  }, [business?.id])

  React.useEffect(() => {
    loadLog()
  }, [loadLog])

  if (!business) return null

  async function handleSend() {
    setSending(true)
    setResult(null)
    setError(null)
    try {
      const res = await triggerWinbackEmails(business!.id, threshold)
      setResult(
        res.message ?? `Sent ${res.sent} email${res.sent === 1 ? '' : 's'}` +
          (res.skipped ? `, skipped ${res.skipped} (already emailed recently)` : '') +
          (res.errors ? `, ${res.errors} failed` : '')
      )
      loadLog()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send win-back emails')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <SectionCard title="Send win-back emails">
        <p className="text-sm text-foreground/50 mb-4">
          Emails members who haven't visited in a while, with a one-off coupon code, to bring them back.
          Skips anyone already emailed in the last 30 days or opted out of promos.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Inactive for at least (days)">
            <input
              type="number"
              min={1}
              className={inputClass + ' w-40'}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </Field>
          <button
            onClick={handleSend}
            disabled={sending}
            className="h-12 rounded-full bg-primary text-white font-bold px-6 flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send now'}
          </button>
        </div>
        {result && <p className="text-sm text-fun-green font-semibold mt-3">{result}</p>}
        {error && <p className="text-sm text-red-600 font-semibold mt-3">{error}</p>}
      </SectionCard>

      <SectionCard title="Send history">
        {loadingLog ? (
          <p className="text-sm text-foreground/40">Loading…</p>
        ) : log.length === 0 ? (
          <p className="text-sm text-foreground/40">No win-back emails sent yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {log.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white/60 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-foreground">{entry.recipient_email}</p>
                  <p className="text-xs text-foreground/50">
                    {entry.days_inactive} days inactive · code {entry.coupon_code} ·{' '}
                    {new Date(entry.sent_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={
                    'text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ' +
                    (entry.status === 'sent' ? 'bg-[#DFF3E3] text-fun-green' : 'bg-red-50 text-red-600')
                  }
                >
                  {entry.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  )
}

const VERIFICATION_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }
> = {
  unverified: { label: 'Not submitted', color: '#1a1a1a', bg: '#00000010', icon: Shield },
  pending: { label: 'Pending review', color: '#B8860B', bg: '#FFF3D6', icon: Clock },
  verified: { label: 'Verified', color: '#3FA34D', bg: '#DFF3E3', icon: BadgeCheck },
  rejected: { label: 'Rejected', color: '#C0392B', bg: '#FBE4E1', icon: XCircle },
}

function VerificationTab() {
  const { session } = useAuth()
  const { business, updateLocalBusiness } = useOwner()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [file, setFile] = React.useState<File | null>(null)
  const [label, setLabel] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!business || !session) return null

  const status = business.verification_status
  const meta = VERIFICATION_STATUS_META[status] ?? VERIFICATION_STATUS_META.unverified
  const StatusIcon = meta.icon
  const canSubmit = status === 'unverified' || status === 'rejected'

  async function handleSubmit() {
    if (!file || !label.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await submitVerificationDocument(business!.id, session!.user.id, file, label.trim())
      updateLocalBusiness({
        verification_status: updated.verification_status,
        verification_document_label: updated.verification_document_label,
        verification_submitted_at: updated.verification_submitted_at,
      })
      setFile(null)
      setLabel('')
      if (inputRef.current) inputRef.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SectionCard>
        <div className="flex items-center gap-3 mb-4">
          <span
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: meta.bg }}
          >
            <StatusIcon className="h-5 w-5" style={{ color: meta.color }} />
          </span>
          <div>
            <p className="font-display font-bold text-foreground">{meta.label}</p>
            <p className="text-xs text-foreground/50">
              {status === 'verified' && business.verification_document_label
                ? `Verified from ${business.verification_document_label}`
                : status === 'pending'
                  ? 'An admin will review your document soon.'
                  : status === 'rejected'
                    ? business.verification_rejection_reason ?? 'Your submission was rejected — resubmit below.'
                    : 'Upload a document to earn the verified badge.'}
            </p>
          </div>
        </div>
        <p className="text-sm text-foreground/50">
          A verified badge shows customers your shop is a real, checked business. It doesn't affect whether your
          shop is live — that already happened when you finished onboarding.
        </p>
      </SectionCard>

      {canSubmit && (
        <SectionCard title="Submit proof of business">
          <p className="text-sm text-foreground/50 mb-4">
            A VAT certificate, Companies House certificate, or a recent utility bill in your business's name.
            PNG, JPEG, WEBP or PDF, up to 10MB. Stored privately — only you and Loyalty Loop admins can see it.
          </p>
          <Field label="What is this document?">
            <input
              className={inputClass}
              placeholder="e.g. VAT certificate"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-full border border-black/15 px-4 h-11 text-sm font-semibold text-foreground mb-4"
          >
            <FileCheck className="h-4 w-4" /> {file ? file.name : 'Choose file'}
          </button>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting || !file || !label.trim()}
            className="rounded-full bg-primary text-white font-bold px-6 h-12 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </SectionCard>
      )}
    </>
  )
}

function PermissionToggle({
  icon: Icon,
  label,
  active,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={
        'flex items-center gap-2 rounded-full border-2 px-3.5 h-9 text-sm font-semibold transition-colors ' +
        (active ? 'border-primary bg-primary/10 text-primary-hover' : 'border-black/10 text-foreground/40')
      }
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )
}

function InviteStaffForm({ businessId, onInvited }: { businessId: string; onInvited: (s: StaffMember) => void }) {
  const [form, setForm] = React.useState({ name: '', email: '', password: '' })
  const [perms, setPerms] = React.useState({ can_scan_stamps: true, can_redeem_rewards: true, can_respond_reviews: false })
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleInvite() {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      setError('Name, email, and a password of at least 8 characters are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const staff = await inviteStaffMember(businessId, { ...form, ...perms })
      onInvited(staff)
      setForm({ name: '', email: '', password: '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add staff member')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SectionCard title="Invite staff">
      <p className="text-sm text-foreground/50 mb-4">
        You set their initial password — they can sign in immediately with the same login screen as owners, no
        confirmation email needed. Re-inviting a revoked email reuses the same account.
      </p>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Name">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Initial password">
          <input
            type="text"
            className={inputClass}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="min. 8 characters"
          />
        </Field>
      </div>
      <p className="text-sm font-semibold text-foreground mb-2">Permissions</p>
      <div className="flex flex-wrap gap-2 mb-5">
        <PermissionToggle
          icon={ScanLine}
          label="Scan stamps"
          active={perms.can_scan_stamps}
          onToggle={() => setPerms({ ...perms, can_scan_stamps: !perms.can_scan_stamps })}
        />
        <PermissionToggle
          icon={Gift}
          label="Redeem rewards"
          active={perms.can_redeem_rewards}
          onToggle={() => setPerms({ ...perms, can_redeem_rewards: !perms.can_redeem_rewards })}
        />
        <PermissionToggle
          icon={MessageSquare}
          label="Respond to reviews"
          active={perms.can_respond_reviews}
          onToggle={() => setPerms({ ...perms, can_respond_reviews: !perms.can_respond_reviews })}
        />
      </div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button
        onClick={handleInvite}
        disabled={submitting}
        className="flex items-center gap-2 rounded-full bg-primary text-white font-bold px-6 h-12 disabled:opacity-50"
      >
        <UserPlus className="h-4 w-4" /> {submitting ? 'Adding…' : 'Add staff member'}
      </button>
    </SectionCard>
  )
}

function StaffRow({ staff, onChange }: { staff: StaffMember; onChange: (s: StaffMember) => void }) {
  const [busy, setBusy] = React.useState(false)

  async function toggleStatus() {
    setBusy(true)
    try {
      const next = staff.status === 'revoked' ? 'active' : 'revoked'
      onChange(await setStaffStatus(staff.id, next))
    } finally {
      setBusy(false)
    }
  }

  async function togglePermission(key: 'can_scan_stamps' | 'can_redeem_rewards' | 'can_respond_reviews') {
    onChange(await updateStaffPermissions(staff.id, { [key]: !staff[key] }))
  }

  const revoked = staff.status === 'revoked'

  return (
    <div className="rounded-xl border border-black/10 bg-white/60 px-4 py-3">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
        <div>
          <p className="font-semibold text-foreground">
            {staff.name} {revoked && <span className="text-xs font-bold text-red-600 uppercase ml-1">Revoked</span>}
          </p>
          <p className="text-xs text-foreground/50">{staff.invited_email}</p>
        </div>
        <button
          onClick={toggleStatus}
          disabled={busy}
          className={
            'rounded-full px-4 h-9 text-sm font-bold disabled:opacity-50 ' +
            (revoked ? 'bg-fun-green text-white' : 'border border-red-300 text-red-600')
          }
        >
          {revoked ? 'Reactivate' : 'Revoke access'}
        </button>
      </div>
      {!revoked && (
        <div className="flex flex-wrap gap-2">
          <PermissionToggle
            icon={ScanLine}
            label="Scan stamps"
            active={staff.can_scan_stamps}
            onToggle={() => togglePermission('can_scan_stamps')}
          />
          <PermissionToggle
            icon={Gift}
            label="Redeem rewards"
            active={staff.can_redeem_rewards}
            onToggle={() => togglePermission('can_redeem_rewards')}
          />
          <PermissionToggle
            icon={MessageSquare}
            label="Respond to reviews"
            active={staff.can_respond_reviews}
            onToggle={() => togglePermission('can_respond_reviews')}
          />
        </div>
      )}
    </div>
  )
}

function StaffTab() {
  const { business } = useOwner()
  const [staff, setStaff] = React.useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = React.useState(true)

  React.useEffect(() => {
    if (!business) return
    fetchStaffMembers(business.id).then(setStaff).finally(() => setLoadingStaff(false))
  }, [business?.id])

  if (!business) return null

  return (
    <>
      <InviteStaffForm businessId={business.id} onInvited={(s) => setStaff([s, ...staff.filter((x) => x.id !== s.id)])} />

      <SectionCard title="Staff">
        {loadingStaff ? (
          <p className="text-sm text-foreground/40">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-foreground/40">No staff added yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {staff.map((s) => (
              <StaffRow key={s.id} staff={s} onChange={(updated) => setStaff((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))} />
            ))}
          </div>
        )}
      </SectionCard>
    </>
  )
}

function HelpTab() {
  const { business } = useOwner()

  return (
    <>
      <SectionCard title="Help & support">
        <p className="text-sm text-foreground/60">Send a message straight to the Loyalty Loop team. You can choose a priority and follow replies from the same place.</p>
        <Link to="/owner/support" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
          <MessageSquare className="h-4 w-4" /> Contact support
        </Link>
      </SectionCard>
      <SectionCard title="Quick answers">
        <div className="grid gap-3 text-sm text-foreground/65">
          <p><strong className="text-foreground">Award a stamp:</strong> open Scan & award from the owner menu, then scan the customer QR code or enter their code.</p>
          <p><strong className="text-foreground">Update your card:</strong> use Loyalty & rewards to change your reward threshold and rewards.</p>
          <p><strong className="text-foreground">Your shop:</strong> {business?.is_active ? 'Your shop is live for customers.' : 'Your shop is currently deactivated and hidden from customers.'}</p>
        </div>
      </SectionCard>
    </>
  )
}

function DangerTab() {
  const { business, updateLocalBusiness, refetch } = useOwner()
  const navigate = useNavigate()
  const [busy, setBusy] = React.useState(false)
  const [deleteName, setDeleteName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)

  if (!business) return null
  const shop = business

  async function setActive(isActive: boolean) {
    setBusy(true); setError(null)
    try {
      const updated = await updateBusiness(shop.id, { is_active: isActive })
      updateLocalBusiness(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your shop.')
    } finally { setBusy(false) }
  }

  async function deleteShop() {
    if (deleteName.trim() !== shop.name) return
    setBusy(true); setError(null)
    try {
      await deleteOwnedBusiness(shop.id, deleteName)
      await refetch()
      navigate('/owner')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your shop.')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <h3 className="font-display text-lg font-bold text-amber-950">{business.is_active ? 'Deactivate shop' : 'Reactivate shop'}</h3>
        <p className="mt-2 text-sm text-amber-950/70">{business.is_active ? 'Deactivation hides your shop and stops new customer joins. Your data stays safely in place, and you can reactivate it at any time.' : 'Reactivating makes your shop available to customers again.'}</p>
        <button onClick={() => setActive(!business.is_active)} disabled={busy} className="mt-4 rounded-xl border border-amber-500 px-4 py-2 text-sm font-bold text-amber-900 disabled:opacity-50">
          {busy ? 'Saving…' : business.is_active ? 'Deactivate shop' : 'Reactivate shop'}
        </button>
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h3 className="font-display text-lg font-bold text-red-800">Delete shop permanently</h3>
        <p className="mt-2 text-sm text-red-800/75">This permanently removes the shop, its members’ loyalty activity, rewards, reviews and related shop data. This cannot be undone.</p>
        {!confirmingDelete ? (
          <button onClick={() => setConfirmingDelete(true)} className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-700">Delete shop…</button>
        ) : (
          <div className="mt-4 max-w-md">
            <label className="block text-sm font-semibold text-red-900">Type <span className="font-bold">{business.name}</span> to confirm</label>
            <input value={deleteName} onChange={(e) => setDeleteName(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-red-300 bg-white px-3 outline-none focus:border-red-600" />
            <div className="mt-3 flex gap-2"><button onClick={deleteShop} disabled={busy || deleteName.trim() !== business.name} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Deleting…' : 'Delete permanently'}</button><button onClick={() => { setConfirmingDelete(false); setDeleteName('') }} disabled={busy} className="rounded-xl px-4 py-2 text-sm font-bold text-red-800">Cancel</button></div>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      </section>
    </div>
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
      <h1 className="text-3xl font-display font-extrabold text-foreground mb-5">Shop settings</h1>

      <div className="flex flex-wrap gap-1 border-b border-black/10 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ' +
              (tab === key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-foreground/40 hover:text-foreground/70')
            }
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {ownerLoading ? null : !business ? (
        <p className="text-foreground/50">You don't have a shop yet.</p>
      ) : (
        <>
          {tab === 'profile' && <ProfileTab />}
          {tab === 'loyalty' && <LoyaltyTab />}
          {tab === 'winback' && <WinbackTab />}
          {tab === 'verification' && <VerificationTab />}
          {tab === 'staff' && <StaffTab />}
          {tab === 'help' && <HelpTab />}
          {tab === 'danger' && <DangerTab />}
        </>
      )}
    </OwnerLayout>
  )
}

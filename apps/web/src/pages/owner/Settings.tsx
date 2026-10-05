import * as React from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Store, Gift, Send, Shield, Users, CircleHelp, TriangleAlert, Plus, Trash2, Upload, Image as ImageIcon, FileCheck, Clock, BadgeCheck, XCircle, UserPlus, ScanLine, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { useOwner } from '@/lib/owner-context'
import { geocodeAddress } from '@/lib/geocode'
import { ShopMap, DEFAULT_MAP_CENTER } from '@/components/shop-map'
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
  transferOwnedBusinessOwnership,
  parsePoundsToPence,
  type RewardCatalogItem,
  type WinbackLogEntry,
  type StaffMember,
  type BusinessPhoto,
  type OpeningHours,
  type DayHours,
} from '@/lib/businesses'
import { canDeleteCurrentAccount, requestAccountDeletion } from '@/lib/engagement'
import { BarePageSkeleton, SkeletonBlock } from '@/components/page-skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const CATEGORIES = ['Café', 'Restaurant', 'Barber', 'Salon', 'Bakery', 'Retail', 'Other']

const BRAND_COLORS = ['#8B7355', '#D9534F', '#3FA34D', '#3B82C4', '#8E5FC2', '#D6296B', '#1B3A4B', '#D98B4A']

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
    <div className="rounded-3xl bg-card ring-1 ring-foreground/8 p-6 mb-5 sm:p-7">
      {title && <h3 className="font-display text-xl font-semibold tracking-tight text-foreground mb-5">{title}</h3>}
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
  'h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground placeholder:text-muted-foreground outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-3 focus:ring-primary/20'

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
        className="h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground text-sm cursor-pointer overflow-hidden bg-white/40 hover:border-primary/50 transition-colors duration-150 ease-out"
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
      <button data-press-feedback
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-2 flex items-center gap-2 rounded-full border border-border px-4 h-9 text-sm font-semibold text-foreground disabled:opacity-40"
      >
        <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : currentUrl ? 'Replace' : 'Upload'}
      </button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
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
            <button data-press-feedback
              onClick={() => onChange({ ...hours, [key]: { ...day, closed: !day.closed } })}
              className={
                'rounded-full px-3 h-8 text-xs font-bold ' +
                (day.closed ? 'bg-secondary text-muted-foreground' : 'bg-sage text-sage-ink')
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
                  className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="time"
                  value={day.close}
                  onChange={(e) => onChange({ ...hours, [key]: { ...day, close: e.target.value } })}
                  className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
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
      <p className="text-sm text-muted-foreground mb-4">
        Extra photos shown on your shop page: your space, your food, your work. PNG, JPEG, WEBP or GIF, up to 5MB
        each.
      </p>
      {loadingPhotos ? (
        <div role="status" aria-label="Loading gallery" className="grid grid-cols-2 gap-3 sm:grid-cols-4"><span className="sr-only">Loading gallery</span><SkeletonBlock className="aspect-square" /><SkeletonBlock className="aspect-square" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded-xl overflow-hidden aspect-square group">
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button data-press-feedback
                    onClick={() => handleDelete(p.id)}
                    aria-label="Delete this photo"
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Delete this photo</TooltipContent>
              </Tooltip>
            </div>
          ))}
          <button data-press-feedback
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-xl border-2 border-dashed border-border aspect-square flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 transition-colors duration-150 ease-out disabled:opacity-50"
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
      {error && <p className="text-xs text-destructive">{error}</p>}
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
    lat: business?.lat ?? null,
    lng: business?.lng ?? null,
    website: business?.website ?? '',
    phone: business?.phone ?? '',
    instagram: business?.instagram ?? '',
    tiktok: business?.tiktok ?? '',
    youtube: business?.youtube ?? '',
  })
  const [hours, setHours] = React.useState<OpeningHours>(business?.opening_hours ?? {})
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [geocoding, setGeocoding] = React.useState(false)
  // Starts true so loading a shop that already has coordinates doesn't
  // immediately re-geocode and overwrite them — only a real edit to the
  // address/postcode fields (or the effect below) flips this back off.
  const [pinTouched, setPinTouched] = React.useState(true)

  React.useEffect(() => {
    if (!business) return
    setForm({
      name: business.name,
      category: business.category ?? CATEGORIES[0],
      description: business.description ?? '',
      address: business.address ?? '',
      postcode: business.postcode ?? '',
      lat: business.lat ?? null,
      lng: business.lng ?? null,
      website: business.website ?? '',
      phone: business.phone ?? '',
      instagram: business.instagram ?? '',
      tiktok: business.tiktok ?? '',
      youtube: business.youtube ?? '',
    })
    setHours(business.opening_hours ?? {})
    setPinTouched(true)
  }, [business?.id])

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
        <p className="text-sm font-semibold text-foreground mb-3">Storefront preview</p>
        <div className="rounded-2xl overflow-hidden border border-border">
          <div
            className="h-40 relative bg-cover bg-center"
            style={{
              backgroundColor: business.brand_color,
              backgroundImage: business.cover_url ? `url(${business.cover_url})` : undefined,
            }}
          >
            <span className="absolute -bottom-5 left-5 h-12 w-12 rounded-xl bg-card flex items-center justify-center shadow overflow-hidden">
              {business.logo_url ? (
                <img src={business.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-5 w-5" style={{ color: business.brand_color }} />
              )}
            </span>
          </div>
          <div className="bg-card pt-8 pb-4 px-5">
            <p className="font-display text-lg font-semibold tracking-tight text-foreground">{form.name || business.name}</p>
            <p className="text-sm text-muted-foreground">{form.category}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Brand images">
        <p className="text-sm text-muted-foreground mb-4">
          A logo is shown as your shop's image across The Loyalty Loop (home feed, loyalty card, announcements).
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
              onChange={(e) => {
                setPinTouched(false)
                setForm({ ...form, address: e.target.value })
              }}
            />
          </Field>
          <Field label="Postcode">
            <input
              className={inputClass}
              value={form.postcode ?? ''}
              onChange={(e) => {
                setPinTouched(false)
                setForm({ ...form, postcode: e.target.value })
              }}
            />
          </Field>
        </div>

        <div className="mt-4">
          <span className="block text-sm font-semibold text-foreground mb-1.5">
            Pin location {geocoding && <span className="text-muted-foreground font-normal">(finding address…)</span>}
          </span>
          <ShopMap
            lat={form.lat ?? DEFAULT_MAP_CENTER.lat}
            lng={form.lng ?? DEFAULT_MAP_CENTER.lng}
            color={business.brand_color}
            zoom={form.lat != null ? 15 : 11}
            editable
            onChange={(lat, lng) => {
              setPinTouched(true)
              setForm((f) => ({ ...f, lat, lng }))
            }}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            {form.lat != null
              ? 'Drag the pin or click the map to fine-tune. This is what customers will see on your shop page.'
              : 'Enter an address above to auto-place the pin, or click the map to set it manually.'}
          </p>
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
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Instagram"><input className={inputClass} placeholder="@yourshop" value={form.instagram ?? ''} onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></Field>
          <Field label="TikTok"><input className={inputClass} placeholder="@yourshop" value={form.tiktok ?? ''} onChange={(e) => setForm({ ...form, tiktok: e.target.value })} /></Field>
          <Field label="YouTube"><input className={inputClass} placeholder="Channel URL" value={form.youtube ?? ''} onChange={(e) => setForm({ ...form, youtube: e.target.value })} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="Opening hours">
        <OpeningHoursEditor hours={hours} onChange={setHours} />
      </SectionCard>

      <button data-press-feedback
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground font-semibold px-6 h-12 disabled:opacity-50 mb-5"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
      </button>

      <GalleryTab businessId={business.id} />
    </>
  )
}

const poundsLabel = (pence: number) => `£${pence % 100 === 0 ? pence / 100 : (pence / 100).toFixed(2)}`

const STAMP_ICON_PRESETS = ['⭐', '🍩', '✂️', '🍕', '☕', '🧁', '🍰', '🍞', '🍔', '🍟', '🌮', '💅', '🎁', '❤️']

const UNIT_LABEL: Record<'stamp_card' | 'points' | 'tiered', string> = {
  stamp_card: 'Stamp',
  points: 'Point',
  tiered: 'Visit',
}


function StampLoyaltyTab() {
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
        <p className="text-sm text-muted-foreground mb-3">
          Something free just for joining your loyalty card, shown on your shop page so customers know what
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
        <p className="text-sm text-muted-foreground mb-3">How will customers earn rewards? You can change this any time.</p>
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          {[
            { value: 'stamp_card' as const, title: 'Stamps', desc: 'Classic punch card. One stamp per visit, fills a grid.' },
            { value: 'points' as const, title: 'Points', desc: 'Award points per visit or spend. Best for variable rewards.' },
            { value: 'tiered' as const, title: 'Visits', desc: 'Just count visits. Simple and clean.' },
          ].map((opt) => (
            <button data-press-feedback
              key={opt.value}
              onClick={() => setLoyaltyType(opt.value)}
              className={
                'text-left rounded-xl border-2 p-4 transition-colors duration-150 ease-out ' +
                (loyaltyType === opt.value ? 'border-primary bg-card' : 'border-border bg-white/40')
              }
            >
              <p className="font-bold text-foreground mb-1">{opt.title}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <p tabIndex={0} className="text-sm font-semibold text-foreground mb-2 w-fit underline decoration-dotted decoration-foreground/30 underline-offset-2 outline-none">Brand color</p>
              </TooltipTrigger>
              <TooltipContent side="right">Shows on your loyalty card, QR code and shop page in the shopper app</TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-10 w-10 rounded-lg border border-border"
              />
              <input className={inputClass} value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {BRAND_COLORS.map((c) => (
                <Tooltip key={c}>
                  <TooltipTrigger asChild>
                    <button data-press-feedback
                      onClick={() => setBrandColor(c)}
                      aria-label={`Use ${c} as the brand color`}
                      className="h-8 w-8 rounded-full border-2"
                      style={{ backgroundColor: c, borderColor: c === brandColor ? '#1a1a1a' : 'transparent' }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{c}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            <p className="text-sm font-semibold text-foreground mb-2">Card preview</p>
            <div className="rounded-xl border border-border bg-card p-4 max-w-[220px]">
              <div
                className="h-11 w-11 rounded-lg flex items-center justify-center text-white font-display font-bold mb-3"
                style={{ backgroundColor: brandColor }}
              >
                {business.name.charAt(0).toUpperCase()}
              </div>
              <p className="font-bold text-sm text-foreground">{business.name}</p>
              <p className="text-xs text-muted-foreground mb-2">{business.category}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColor }} /> Tap to join
                </span>
                <span className="font-semibold text-primary">View →</span>
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
              <span className="text-xs text-muted-foreground mt-1 block">
                Used for shops without a reward catalogue. If you add catalogue tiers below, customers earn
                each tier's reward instead.
              </span>
            </Field>

            <p className="text-sm font-semibold text-foreground mb-1.5">{unit} icon</p>
            <p className="text-xs text-muted-foreground mb-2">
              Pick a preset or type your own emoji. This is what fills each slot on the card.
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {STAMP_ICON_PRESETS.map((icon) => (
                <button data-press-feedback
                  key={icon}
                  onClick={() => setStampIcon(icon)}
                  className={
                    'h-9 w-9 rounded-lg border-2 flex items-center justify-center text-lg ' +
                    (icon === stampIcon ? 'border-primary' : 'border-border')
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

            <p className="text-sm font-semibold text-foreground mb-2">Card preview</p>
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
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mb-1">Reward catalogue *</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Tell customers what they can earn, shown on your shop page before they join. Required: add at
          least one reward here to unlock scanning.
        </p>

        {catalog.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {catalog.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.description} · {r.stamp_threshold} {unit.toLowerCase()}{r.stamp_threshold === 1 ? '' : 's'}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button data-press-feedback onClick={() => handleDeleteReward(r.id)} aria-label={`Delete ${r.title}`} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Delete this reward</TooltipContent>
                </Tooltip>
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
          <button data-press-feedback
            onClick={handleAddReward}
            className="h-12 rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground font-semibold px-5 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </SectionCard>

      <button data-press-feedback
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground font-semibold px-6 h-12 disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
      </button>
    </>
  )
}


function LoyaltyTab() {
  const { business } = useOwner()
  return business?.reward_model === 'spend_threshold' ? <SpendLoyaltyTab /> : <StampLoyaltyTab />
}

function SpendLoyaltyTab() {
  const { business, updateLocalBusiness } = useOwner()
  const [brandColor, setBrandColor] = React.useState(business?.brand_color ?? BRAND_COLORS[0])
  const [signupReward, setSignupReward] = React.useState(business?.loyalty_config.signup_reward_title ?? '')
  const [catalog, setCatalog] = React.useState<RewardCatalogItem[]>([])
  // Customers earn by spending; each reward unlocks at a £ amount (ARCH_PLAN.md §4.11).
  const [newReward, setNewReward] = React.useState({ title: '', description: '', amount: '20' })
  const [rewardError, setRewardError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    if (!business) return
    setBrandColor(business.brand_color)
    setSignupReward(business.loyalty_config.signup_reward_title ?? '')
    fetchRewardCatalog(business.id).then(setCatalog)
  }, [business?.id])

  if (!business) return null

  async function handleSave() {
    setSaving(true)
    try {
      await updateBusiness(business!.id, {
        brand_color: brandColor,
        loyalty_config: { ...business!.loyalty_config, signup_reward_title: signupReward },
      })
      updateLocalBusiness({ brand_color: brandColor })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddReward() {
    setRewardError(null)
    if (!newReward.title.trim()) return setRewardError('Give the reward a name.')
    const pence = parsePoundsToPence(newReward.amount)
    if (pence === null) return setRewardError('Enter an amount between £1 and £10,000.')
    if (catalog.some((r) => r.spend_threshold_pence === pence)) {
      return setRewardError(`You already have a reward at ${poundsLabel(pence)}. Pick a different amount.`)
    }
    try {
      const created = await addRewardCatalogItem(business!.id, {
        title: newReward.title.trim(),
        description: newReward.description.trim() || null,
        spend_threshold_pence: pence,
        sort_order: catalog.length,
      })
      setCatalog(
        [...catalog, created].sort((a, b) => (a.spend_threshold_pence ?? 0) - (b.spend_threshold_pence ?? 0))
      )
      setNewReward({ title: '', description: '', amount: '' })
    } catch {
      setRewardError('Could not add that reward. Please try again.')
    }
  }

  async function handleDeleteReward(id: string) {
    await deleteRewardCatalogItem(id)
    setCatalog(catalog.filter((r) => r.id !== id))
  }

  return (
    <>
      <SectionCard title="Sign-up reward">
        <p className="text-sm text-muted-foreground mb-3">
          Something free just for joining your loyalty card, shown on your shop page so customers know what
          to expect before they sign up.
        </p>
        <input
          className={inputClass}
          placeholder="e.g. Free coffee just for joining"
          value={signupReward}
          onChange={(e) => setSignupReward(e.target.value)}
        />
      </SectionCard>

      <SectionCard title="Brand">
        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <p tabIndex={0} className="text-sm font-semibold text-foreground mb-2 w-fit underline decoration-dotted decoration-foreground/30 underline-offset-2 outline-none">Brand color</p>
              </TooltipTrigger>
              <TooltipContent side="right">Shows on your loyalty card, QR code and shop page in the shopper app</TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-10 w-10 rounded-lg border border-border"
              />
              <input className={inputClass} value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {BRAND_COLORS.map((c) => (
                <Tooltip key={c}>
                  <TooltipTrigger asChild>
                    <button data-press-feedback
                      onClick={() => setBrandColor(c)}
                      aria-label={`Use ${c} as the brand color`}
                      className="h-8 w-8 rounded-full border-2"
                      style={{ backgroundColor: c, borderColor: c === brandColor ? '#1a1a1a' : 'transparent' }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{c}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            <p className="text-sm font-semibold text-foreground mb-2">Card preview</p>
            <div className="rounded-xl border border-border bg-card p-4 max-w-[220px]">
              <div
                className="h-11 w-11 rounded-lg flex items-center justify-center text-white font-display font-bold mb-3"
                style={{ backgroundColor: brandColor }}
              >
                {business.name.charAt(0).toUpperCase()}
              </div>
              <p className="font-bold text-sm text-foreground">{business.name}</p>
              <p className="text-xs text-muted-foreground mb-2">{business.category}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColor }} /> Tap to join
                </span>
                <span className="font-semibold text-primary">View →</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground mb-1">How customers earn</p>
            <p className="text-sm text-muted-foreground">
              Customers earn by spending. Staff scan their QR code and enter what they spent, and linked cards
              count automatically where available. When they reach a reward's amount it's added to their
              wallet; after your biggest reward their progress starts a new round, carrying over anything extra.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mb-1">Rewards *</h3>
        <p className="text-sm text-muted-foreground mb-4">
          What customers earn and how much they spend to unlock it, shown on your shop page before they
          join. Add a bigger reward at a higher amount if you like. Required: add at least one reward to
          unlock scanning.
        </p>

        {catalog.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {catalog.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.description ? `${r.description} · ` : ''}
                    {r.spend_threshold_pence != null
                      ? `Unlocks after spending ${poundsLabel(r.spend_threshold_pence)}`
                      : 'No amount set yet'}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button data-press-feedback onClick={() => handleDeleteReward(r.id)} aria-label={`Delete ${r.title}`} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Delete this reward</TooltipContent>
                </Tooltip>
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
          <Field label="Spend (£)">
            <input
              inputMode="decimal"
              className={inputClass + ' w-24'}
              placeholder="20"
              value={newReward.amount}
              onChange={(e) => setNewReward({ ...newReward, amount: e.target.value.replace(/[^0-9.]/g, '') })}
            />
          </Field>
          <button data-press-feedback
            onClick={handleAddReward}
            className="h-12 rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground font-semibold px-5 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        {rewardError && <p className="text-sm text-destructive mt-3">{rewardError}</p>}
      </SectionCard>

      <button data-press-feedback
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground font-semibold px-6 h-12 disabled:opacity-50"
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
        <p className="text-sm text-muted-foreground mb-4">
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
          <button data-press-feedback
            onClick={handleSend}
            disabled={sending}
            className="h-12 rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground font-semibold px-6 flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send now'}
          </button>
        </div>
        {result && <p className="text-sm text-fun-green font-semibold mt-3">{result}</p>}
        {error && <p className="text-sm text-destructive font-semibold mt-3">{error}</p>}
      </SectionCard>

      <SectionCard title="Send history">
        {loadingLog ? (
          <div role="status" aria-label="Loading email history" className="space-y-2"><span className="sr-only">Loading email history</span><SkeletonBlock className="h-14" /><SkeletonBlock className="h-14" /></div>
        ) : log.length === 0 ? (
          <p className="text-sm text-muted-foreground">No win-back emails sent yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {log.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-foreground">{entry.recipient_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.days_inactive} days inactive · code {entry.coupon_code} ·{' '}
                    {new Date(entry.sent_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={
                    'text-xs font-bold px-2.5 py-1 rounded-full ' +
                    (entry.status === 'sent' ? 'bg-sage text-sage-ink' : 'bg-destructive/10 text-destructive')
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
            <p className="font-display text-lg font-semibold tracking-tight text-foreground">{meta.label}</p>
            <p className="text-xs text-muted-foreground">
              {status === 'verified' && business.verification_document_label
                ? `Verified from ${business.verification_document_label}`
                : status === 'pending'
                  ? 'An admin will review your document soon.'
                  : status === 'rejected'
                    ? business.verification_rejection_reason ?? 'Your submission was rejected. Resubmit below.'
                    : 'Upload a document to earn the verified badge.'}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          A verified badge shows customers your shop is a real, checked business. It doesn't affect whether your
          shop is live. That already happened when you finished onboarding.
        </p>
      </SectionCard>

      {canSubmit && (
        <SectionCard title="Submit proof of business">
          <p className="text-sm text-muted-foreground mb-4">
            A VAT certificate, Companies House certificate, or a recent utility bill in your business's name.
            PNG, JPEG, WEBP or PDF, up to 10MB. Stored privately. Only you and Loyalty Loop admins can see it.
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
          <button data-press-feedback
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-full border border-border px-4 h-11 text-sm font-semibold text-foreground mb-4"
          >
            <FileCheck className="h-4 w-4" /> {file ? file.name : 'Choose file'}
          </button>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <button data-press-feedback
            onClick={handleSubmit}
            disabled={submitting || !file || !label.trim()}
            className="rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground font-semibold px-6 h-12 disabled:opacity-50"
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
    <button data-press-feedback
      onClick={onToggle}
      className={
        'flex items-center gap-2 rounded-full border-2 px-3.5 h-9 text-sm font-semibold transition-colors duration-150 ease-out ' +
        (active ? 'border-primary bg-primary/10 text-primary-hover' : 'border-border text-muted-foreground')
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
      <p className="text-sm text-muted-foreground mb-4">
        You set their initial password. They can sign in immediately with the same login screen as owners, no
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
          label="Record purchases"
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
      {error && <p className="text-sm text-destructive mb-3">{error}</p>}
      <button data-press-feedback
        onClick={handleInvite}
        disabled={submitting}
        className="flex items-center gap-2 rounded-full bg-primary hover:bg-primary-hover transition-colors text-primary-foreground font-semibold px-6 h-12 disabled:opacity-50"
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
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
        <div>
          <p className="font-semibold text-foreground">
            {staff.name} {revoked && <span className="text-xs font-semibold text-destructive ml-1">Revoked</span>}
          </p>
          <p className="text-xs text-muted-foreground">{staff.invited_email}</p>
        </div>
        <button data-press-feedback
          onClick={toggleStatus}
          disabled={busy}
          className={
            'rounded-full px-4 h-9 text-sm font-bold disabled:opacity-50 ' +
            (revoked ? 'bg-fun-green text-white' : 'border border-destructive/30 text-destructive')
          }
        >
          {revoked ? 'Reactivate' : 'Revoke access'}
        </button>
      </div>
      {!revoked && (
        <div className="flex flex-wrap gap-2">
          <PermissionToggle
            icon={ScanLine}
            label="Record purchases"
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
          <div role="status" aria-label="Loading staff" className="space-y-3"><span className="sr-only">Loading staff</span><SkeletonBlock className="h-20" /><SkeletonBlock className="h-20" /></div>
        ) : staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">No staff added yet.</p>
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
        <p className="text-sm text-muted-foreground">Send a message straight to the Loyalty Loop team. You can choose a priority and follow replies from the same place.</p>
        <Link to="/owner/support" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-hover transition-colors px-5 py-3 text-sm font-semibold text-primary-foreground">
          <MessageSquare className="h-4 w-4" /> Contact support
        </Link>
      </SectionCard>
      <SectionCard title="Quick answers">
        <div className="grid gap-3 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Record a purchase:</strong> open Scan from the owner menu, scan the customer QR code or enter their code, then enter what they spent.</p>
          <p><strong className="text-foreground">Update your card:</strong> use Loyalty & rewards to change your rewards and how much customers spend to unlock them.</p>
          <p><strong className="text-foreground">Your shop:</strong> {business?.is_active ? 'Your shop is live for customers.' : 'Your shop is currently deactivated and hidden from customers.'}</p>
        </div>
      </SectionCard>
    </>
  )
}

function DangerTab() {
  const { business, businesses, updateLocalBusiness, refetch } = useOwner()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = React.useState(false)
  const [deleteName, setDeleteName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [activationSuccess, setActivationSuccess] = React.useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)
  const [newOwnerEmail, setNewOwnerEmail] = React.useState('')
  const [transferring, setTransferring] = React.useState(false)
  const [deletingAccount, setDeletingAccount] = React.useState(false)

  if (!business) return null
  const shop = business

  async function setActive(isActive: boolean) {
    if (busy) return
    setError(null); setActivationSuccess(null)
    if (!window.confirm(isActive ? 'Reactivate your shop and make it visible to customers again?' : 'Deactivate your shop? It will be hidden from customers. Your data will be kept.')) return
    setBusy(true)
    try {
      const { data, error: rpcError } = await supabase.rpc(
        isActive ? 'reactivate_my_business' : 'deactivate_my_business',
        { _business_id: shop.id },
      )
      if (rpcError) throw new Error(rpcError.message)
      const updated = Array.isArray(data) ? data[0] : data
      if (!updated || updated.id !== shop.id || updated.is_active !== isActive) throw new Error('Could not confirm the shop activation change. Refresh and try again.')
      updateLocalBusiness(updated)
      setActivationSuccess(isActive ? 'Your shop is active again.' : 'Your shop has been deactivated.')
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

  async function transferShop() {
    if (!newOwnerEmail.trim()) return
    setTransferring(true); setError(null)
    try {
      await transferOwnedBusinessOwnership(shop.id, newOwnerEmail)
      await refetch()
      navigate('/owner/settings?tab=danger', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not transfer this shop.')
    } finally { setTransferring(false) }
  }

  async function deleteAccount() {
    setDeletingAccount(true); setError(null)
    try {
      const status = await canDeleteCurrentAccount()
      if (!status.can_delete) throw new Error(status.reason ?? 'Resolve your shops first.')
      if (!window.confirm('Delete your account and personal data? This cannot be undone.')) return
      await requestAccountDeletion()
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account.')
    } finally { setDeletingAccount(false) }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-amber/30 p-6 sm:p-7">
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">{business.is_active ? 'Deactivate shop' : 'Reactivate shop'}</h3>
        <p className="mt-2 text-sm text-foreground/75">{business.is_active ? 'Deactivation hides your shop and stops new customer joins. Your data stays safely in place, and you can reactivate it at any time.' : 'Reactivating makes your shop available to customers again.'}</p>
        <button data-press-feedback onClick={() => setActive(!business.is_active)} disabled={busy} className="mt-4 rounded-full bg-card px-5 py-2.5 text-sm font-semibold text-foreground ring-1 ring-foreground/15 transition-colors hover:bg-secondary disabled:opacity-50">
          {busy ? 'Saving…' : business.is_active ? 'Deactivate shop' : 'Reactivate shop'}
        </button>
        {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>}
        {activationSuccess && <p role="status" className="mt-3 text-sm text-foreground">{activationSuccess}</p>}
      </section>

      <section className="rounded-3xl bg-destructive/8 p-6 ring-1 ring-destructive/20 sm:p-7">
        <h3 className="font-display text-lg font-semibold tracking-tight text-destructive">Delete shop permanently</h3>
        <p className="mt-2 text-sm text-foreground/75">This permanently removes the shop, its members’ loyalty activity, rewards, reviews and related shop data. This cannot be undone.</p>
        {!confirmingDelete ? (
          <button data-press-feedback onClick={() => setConfirmingDelete(true)} className="mt-4 rounded-full border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10">Delete shop…</button>
        ) : (
          <div className="mt-4 max-w-md">
            <label className="block text-sm font-semibold text-foreground">Type <span className="font-bold">{business.name}</span> to confirm</label>
            <input value={deleteName} onChange={(e) => setDeleteName(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-destructive/30 bg-card px-3.5 outline-none focus:border-destructive focus:ring-3 focus:ring-destructive/20" />
            <div className="mt-3 flex gap-2"><button data-press-feedback onClick={deleteShop} disabled={busy || deleteName.trim() !== business.name} className="rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40">{busy ? 'Deleting…' : 'Delete permanently'}</button><button data-press-feedback onClick={() => { setConfirmingDelete(false); setDeleteName('') }} disabled={busy} className="rounded-full px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10">Cancel</button></div>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}
      </section>

      <section className="rounded-3xl bg-destructive/8 p-6 ring-1 ring-destructive/20 sm:p-7">
        <h3 className="font-display text-lg font-semibold tracking-tight text-destructive">Transfer shop, then delete account</h3>
        <p className="mt-2 text-sm text-foreground/75">You cannot delete an owner account while it owns a shop. Transfer this shop to an existing Loyalty Loop account, or delete the shop and its customer data above.</p>
        <label className="mt-4 block text-sm font-semibold text-foreground" htmlFor="new-owner-email">New owner’s account email</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="new-owner-email" type="email" value={newOwnerEmail} onChange={(event) => setNewOwnerEmail(event.target.value)} placeholder="owner@example.com" className="h-11 flex-1 rounded-xl border border-destructive/30 bg-card px-3.5 outline-none focus:border-destructive focus:ring-3 focus:ring-destructive/20" />
          <button data-press-feedback onClick={transferShop} disabled={transferring || !newOwnerEmail.trim()} className="rounded-full border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40">{transferring ? 'Transferring…' : 'Transfer shop'}</button>
        </div>
      </section>

      {businesses.length === 0 && <section className="rounded-3xl bg-destructive/8 p-6 ring-1 ring-destructive/20 sm:p-7">
        <h3 className="font-display text-lg font-semibold tracking-tight text-destructive">Delete account permanently</h3>
        <p className="mt-2 text-sm text-foreground/75">All shops have been resolved. This permanently deletes your login and personal account data.</p>
        <button data-press-feedback onClick={deleteAccount} disabled={deletingAccount} className="mt-4 rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40">{deletingAccount ? 'Deleting account…' : 'Delete account permanently'}</button>
      </section>}
    </div>
  )
}

export function OwnerSettings() {
  const { session, loading, signOut } = useAuth()
  const { business, businesses, loading: ownerLoading } = useOwner()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const initialTab = TABS.some(({ key }) => key === requestedTab) ? (requestedTab as TabKey) : 'profile'
  const [tab, setTab] = React.useState<TabKey>(initialTab)

  function selectTab(nextTab: TabKey) {
    setTab(nextTab)
    setSearchParams({ tab: nextTab }, { replace: true })
  }

  if (loading) return <BarePageSkeleton />
  if (!session) return <Navigate to="/login" replace />
  if (ownerLoading || !business) {
    return (
      <OwnerLayout>
        <SkeletonBlock className="h-9 w-52 mb-2" />
        <SkeletonBlock className="h-5 w-40 mb-6" />
        <div className="flex gap-1.5 mb-7">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} className="h-8 w-24" />)}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card p-5 ring-1 ring-foreground/8">
              <SkeletonBlock className="h-5 w-2/3" />
              <SkeletonBlock className="mt-3 h-4 w-full" />
              <SkeletonBlock className="mt-2 h-4 w-4/5" />
            </div>
          ))}
        </div>
      </OwnerLayout>
    )
  }

  return (
    <OwnerLayout>
      <h1 className="text-3xl font-display font-bold tracking-tight text-foreground mb-6 sm:text-4xl">Shop settings</h1>

      <div role="tablist" aria-label="Settings sections" className="-mx-1 mb-7 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button data-press-feedback
            key={key}
            onClick={() => selectTab(key)}
            role="tab"
            aria-selected={tab === key}
            className={
              'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ease-out ' +
              (tab === key
                ? key === 'danger' ? 'bg-destructive/12 text-destructive' : 'bg-peach text-peach-ink'
                : 'bg-card text-muted-foreground ring-1 ring-foreground/8 hover:text-foreground')
            }
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {ownerLoading ? null : !business ? (
        <section className="rounded-3xl bg-destructive/8 p-6 ring-1 ring-destructive/20 sm:p-7">
          <h2 className="font-display text-xl font-semibold tracking-tight text-destructive">Delete account</h2>
          <p className="mt-2 text-sm text-foreground/75">You have no shops assigned to this account. Deleting it permanently removes your login and personal data.</p>
          <button data-press-feedback onClick={async () => {
            const status = await canDeleteCurrentAccount()
            if (!status.can_delete) return window.alert(status.reason ?? 'Resolve ownership first.')
            if (!window.confirm('Delete your account and personal data? This cannot be undone.')) return
            await requestAccountDeletion(); await signOut()
          }} disabled={businesses.length > 0} className="mt-4 rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40">Delete account permanently</button>
        </section>
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

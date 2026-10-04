import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { User, Bell, LogOut, Copy, Check, Trash2, Share2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageSkeleton } from '@/components/page-skeleton'
import { getReferralCode, requestAccountDeletion } from '@/lib/engagement'
import {RequestedShops} from '@/components/shop-requests'
import { ActivityFeed } from '@/pages/Activity'

interface ProfileData {
  first_name: string | null
  last_name: string | null
  phone: string | null
  postcode: string | null
  stamp_code: string
}

interface SettingsData {
  notify_offers: boolean
  notify_rewards: boolean
  notify_stamps: boolean
}

const inputClass =
  'h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground placeholder:text-muted-foreground outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-3 focus:ring-primary/20'

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/8 p-6 sm:p-7">
      {title && <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-5">{title}</h2>}
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

export function ProfilePage() {
  const { session, loading, signOut } = useAuth()
  const [profile, setProfile] = React.useState<ProfileData | null>(null)
  const [settings, setSettings] = React.useState<SettingsData | null>(null)
  const [form, setForm] = React.useState({ first_name: '', last_name: '', phone: '', postcode: '' })
  const [ready, setReady] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [referralCode, setReferralCode] = React.useState('')
  const [deleting, setDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!session?.user) return
    Promise.all([
      supabase.from('profiles').select('first_name,last_name,phone,postcode,stamp_code').eq('id', session.user.id).single(),
      supabase.from('user_settings').select('notify_offers,notify_rewards,notify_stamps').eq('user_id', session.user.id).single(),
    ]).then(([p, s]) => {
      if (p.data) {
        setProfile(p.data as ProfileData)
        setForm({
          first_name: p.data.first_name ?? '',
          last_name: p.data.last_name ?? '',
          phone: p.data.phone ?? '',
          postcode: p.data.postcode ?? '',
        })
      }
      if (s.data) setSettings(s.data as SettingsData)
      getReferralCode(session.user.id).then(setReferralCode).catch(() => undefined)
      setReady(true)
    })
  }, [session?.user])

  if (loading || !ready) return <PageSkeleton variant="detail" />
  if (!session) return <Navigate to="/login" replace />

  async function handleSaveProfile() {
    if (!session?.user) return
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update(form).eq('id', session.user.id)
      if (!error) {
        setProfile((prev) => (prev ? { ...prev, ...form } : prev))
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleSetting(key: keyof SettingsData) {
    if (!session?.user || !settings) return
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    await supabase.from('user_settings').update({ [key]: next[key] }).eq('user_id', session.user.id)
  }

  function handleCopyCode() {
    if (!profile) return
    navigator.clipboard.writeText(profile.stamp_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleCopyReferral() {
    if (!referralCode) return
    await navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${referralCode}`)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  async function handleDelete() {
    if (!window.confirm('Delete your account and personal data? This cannot be undone.')) return
    setDeleting(true)
    setDeleteError(null)
    try { await requestAccountDeletion(); await signOut() } catch { setDeleting(false); setDeleteError('We could not delete your account. Please contact support.') }
  }

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-display font-bold tracking-tight text-foreground mb-8 sm:text-4xl">Your account</h1>

      <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
        <div className="grid gap-5 lg:sticky lg:top-24">
          <section className="rounded-3xl bg-olive p-6 text-olive-ink sm:p-7">
            <h2 className="font-display text-xl font-semibold tracking-tight">Your loyalty card code</h2>
            <p className="mt-2 text-sm text-olive-ink/75">
              Show this QR code or manual code to staff at any shop if they can't scan it directly.
            </p>
            <div className="mt-5 inline-block rounded-2xl bg-white p-3">
              <QRCodeSVG value={`loyaltyloop:customer:${session.user.id}`} size={132} />
            </div>
            <p className="mt-5 text-sm text-olive-ink/75">Manual code</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-mono text-xl font-bold tracking-widest">{profile?.stamp_code}</p>
              <button data-press-feedback onClick={handleCopyCode} aria-label="Copy manual code" className="grid h-9 w-9 place-items-center rounded-full bg-olive-ink/10 transition-colors hover:bg-olive-ink/20">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </section>

          <section className="rounded-3xl bg-peach p-6 text-peach-ink sm:p-7">
            <h2 className="font-display text-xl font-semibold tracking-tight">Invite a friend</h2>
            <p className="mt-2 text-sm text-peach-ink/80">Share your personal link. When someone joins, you’ll see it in your inbox.</p>
            <p className="mt-4 font-mono text-lg font-bold tracking-widest">{referralCode || 'Loading…'}</p>
            <button data-press-feedback onClick={handleCopyReferral} disabled={!referralCode} className="mt-4 flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50">
              <Share2 className="h-4 w-4" />{copied ? 'Copied' : 'Copy invite link'}
            </button>
          </section>
        </div>

        <div className="grid gap-5">
          <SectionCard title="Personal details">
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="First name">
                <input className={inputClass} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} autoComplete="given-name" />
              </Field>
              <Field label="Last name">
                <input className={inputClass} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} autoComplete="family-name" />
              </Field>
              <Field label="Phone">
                <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
              </Field>
              <Field label="Postcode">
                <input className={inputClass} value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} autoComplete="postal-code" />
              </Field>
            </div>
            <button data-press-feedback
              onClick={handleSaveProfile}
              disabled={saving}
              className="mt-1 flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              <User className="h-4 w-4" /> {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
            </button>
          </SectionCard>

          {settings && (
            <SectionCard title="Notifications">
              <p className="-mt-2 mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Bell className="h-4 w-4" /> Choose what shops can notify you about.</p>
              {(
                [
                  ['notify_stamps', 'Progress', 'When a purchase counts towards a reward'],
                  ['notify_rewards', 'Rewards', 'When a reward is ready to redeem'],
                  ['notify_offers', 'Offers & promos', 'Occasional deals from shops you’ve joined'],
                ] as const
              ).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4 border-t border-border py-4 first:border-t-0">
                  <div>
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                  <button data-press-feedback
                    role="switch"
                    aria-checked={settings[key]}
                    aria-label={label}
                    onClick={() => handleToggleSetting(key)}
                    className={'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease-out ' + (settings[key] ? 'bg-primary' : 'bg-foreground/15')}
                  >
                    <span className={'absolute top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-transform duration-200 ease-out ' + (settings[key] ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </div>
              ))}
            </SectionCard>
          )}

          <ActivityFeed userId={session.user.id} />

          <SectionCard title="Account">
            <div className="flex flex-wrap items-center gap-3">
              <button data-press-feedback onClick={signOut} className="flex h-11 items-center gap-2 rounded-full px-5 font-semibold text-foreground ring-1 ring-foreground/15 transition-colors hover:bg-secondary">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
              <button data-press-feedback onClick={handleDelete} disabled={deleting} className="flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />{deleting ? 'Deleting account…' : 'Delete my account'}
              </button>
            </div>
            {deleteError && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{deleteError}</p>}
          </SectionCard>

          <RequestedShops/>
        </div>
      </div>
    </DashboardLayout>
  )
}

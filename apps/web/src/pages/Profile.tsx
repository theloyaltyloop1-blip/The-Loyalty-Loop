import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { User, Bell, LogOut, Copy, Check, Trash2, Share2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import { getReferralCode, requestAccountDeletion } from '@/lib/engagement'

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
  'h-12 w-full rounded-xl border border-black/10 bg-white/60 px-4 font-medium text-foreground placeholder:text-foreground/35 outline-none focus:border-primary'

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

  if (loading || !ready) return null
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
    try { await requestAccountDeletion(); await signOut() } catch { setDeleting(false); window.alert('We could not delete your account. Please contact support.') }
  }

  return (
    <DashboardLayout>
      <p className="text-xs font-extrabold uppercase tracking-wide text-foreground/40 mb-1">Profile</p>
      <h1 className="text-3xl font-display font-extrabold text-foreground mb-6">Your account</h1>

      <SectionCard title="Your stamp card code">
        <p className="text-sm text-foreground/50 mb-4">
          Show this QR code or manual code to staff at any shop if they can't scan it directly.
        </p>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <QRCodeSVG value={`loyaltyloop:customer:${session.user.id}`} size={110} />
          <div>
            <p className="text-[0.625rem] font-bold uppercase tracking-wide text-foreground/40 mb-1">Manual code</p>
            <div className="flex items-center gap-2">
              <p className="font-mono font-bold text-lg tracking-widest text-foreground">{profile?.stamp_code}</p>
              <button data-press-feedback onClick={handleCopyCode} className="text-foreground/40 hover:text-foreground">
                {copied ? <Check className="h-4 w-4 text-fun-green" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Personal details">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="First name">
            <input
              className={inputClass}
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </Field>
          <Field label="Last name">
            <input
              className={inputClass}
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Phone">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Postcode">
            <input
              className={inputClass}
              value={form.postcode}
              onChange={(e) => setForm({ ...form, postcode: e.target.value })}
            />
          </Field>
        </div>
        <button data-press-feedback
          onClick={handleSaveProfile}
          disabled={saving}
          className="flex items-center gap-2 rounded-full bg-primary text-white font-bold px-6 h-12 disabled:opacity-50"
        >
          <User className="h-4 w-4" /> {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </button>
      </SectionCard>

      {settings && (
        <SectionCard title="Notifications">
          <div className="flex items-center gap-2 mb-4 text-foreground/50">
            <Bell className="h-4 w-4" />
            <p className="text-sm">Choose what shops can notify you about.</p>
          </div>
          {(
            [
              ['notify_stamps', 'Stamps & progress', 'When you earn a stamp, point or visit'],
              ['notify_rewards', 'Rewards', 'When a reward is ready to redeem'],
              ['notify_offers', 'Offers & promos', 'Occasional deals from shops you’ve joined'],
            ] as const
          ).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between py-3 border-t border-black/5 first:border-t-0">
              <div>
                <p className="font-semibold text-foreground">{label}</p>
                <p className="text-xs text-foreground/50">{desc}</p>
              </div>
              <button data-press-feedback
                onClick={() => handleToggleSetting(key)}
                className={
                  'h-7 w-12 rounded-full transition-colors duration-150 ease-out relative shrink-0 ' +
                  (settings[key] ? 'bg-primary' : 'bg-black/10')
                }
              >
                <span
                  className={
                    'absolute top-1 h-5 w-5 rounded-full bg-white transition-transform duration-150 ease-out ' +
                    (settings[key] ? 'translate-x-6' : 'translate-x-1')
                  }
                />
              </button>
            </div>
          ))}
        </SectionCard>
      )}

      <SectionCard title="Invite a friend">
        <p className="text-sm text-foreground/55 mb-3">Share your personal link. When someone joins, you’ll see it in your inbox.</p>
        <div className="flex flex-wrap gap-3 items-center"><p className="font-mono font-bold tracking-widest">{referralCode || 'Loading…'}</p><button data-press-feedback onClick={handleCopyReferral} disabled={!referralCode} className="flex items-center gap-2 rounded-full bg-primary px-4 h-10 text-sm font-bold text-white"><Share2 className="h-4 w-4"/>{copied ? 'Copied!' : 'Copy invite link'}</button></div>
      </SectionCard>

      <button data-press-feedback
        onClick={signOut}
        className="flex items-center gap-2 rounded-full border border-black/15 px-6 h-12 font-semibold text-foreground"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
      <button data-press-feedback onClick={handleDelete} disabled={deleting} className="mt-4 flex items-center gap-2 text-sm font-semibold text-red-600 disabled:opacity-50"><Trash2 className="h-4 w-4" />{deleting ? 'Deleting account…' : 'Delete my account'}</button>
    </DashboardLayout>
  )
}

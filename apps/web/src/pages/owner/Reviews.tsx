import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { MessageCircle, Sparkles, Star } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { useOwner } from '@/lib/owner-context'
import {
  DEFAULT_REVIEW_AI_SETTINGS, dismissReviewDraft, fetchReviewAiSettings, fetchReviewDrafts, fetchShopReviews,
  postReviewReply, saveReviewAiSettings, writeReviewReplyWithAi,
  type ReviewAiSettings, type ReviewReplyDraft, type ShopReview,
} from '@/lib/businesses'

const message = (err: unknown, fallback: string) => typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' ? err.message : fallback

function StarRating({ rating }: { rating: number }) {
  return <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((item) => <Star key={item} className={'h-4 w-4 ' + (item <= rating ? 'fill-accent text-accent' : 'text-foreground/15')} />)}</div>
}

function Toggle({ checked, onChange, label, detail, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-2 text-left disabled:opacity-50"><span><span className="block text-sm font-bold text-foreground">{label}</span><span className="block text-xs text-foreground/55">{detail}</span></span><span className={'relative h-6 w-11 shrink-0 rounded-full transition-colors ' + (checked ? 'bg-primary' : 'bg-foreground/15')}><span className={'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ' + (checked ? 'translate-x-5' : 'translate-x-0.5')} /></span></button>
}

function AiSettingsCard({ businessId }: { businessId: string }) {
  const [settings, setSettings] = React.useState<ReviewAiSettings>(DEFAULT_REVIEW_AI_SETTINGS)
  const [saved, setSaved] = React.useState<ReviewAiSettings>(DEFAULT_REVIEW_AI_SETTINGS)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => { fetchReviewAiSettings(businessId).then((value) => { setSettings(value); setSaved(value) }).catch(() => {}) }, [businessId])
  const changed = JSON.stringify(settings) !== JSON.stringify(saved)
  async function save() { setSaving(true); setError(null); try { await saveReviewAiSettings(businessId, settings); setSaved(settings) } catch (err) { setError(message(err, 'Could not save these settings.')) } finally { setSaving(false) } }
  return <section className="mb-7 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><div className="flex items-center gap-3 mb-3"><div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center"><Sparkles className="h-5 w-5 text-primary" /></div><div><h2 className="font-display text-lg font-extrabold text-foreground">AI replies</h2><p className="text-sm text-foreground/60">Every review gets a thoughtful reply written from your shop’s details.</p></div></div><Toggle checked={settings.enabled} onChange={(enabled) => setSettings({ ...settings, enabled })} label="Write replies with AI" detail="Drafts a reply as soon as a customer leaves a review." /><Toggle checked={settings.auto_post_positive} disabled={!settings.enabled} onChange={(auto_post_positive) => setSettings({ ...settings, auto_post_positive })} label="Post 4★ and 5★ replies automatically" detail="Replies to 1–3★ reviews always wait for you to check them." /><label className="mt-3 block text-sm font-bold text-foreground">Sign-off <span className="font-normal text-foreground/50">(optional)</span></label><input value={settings.sign_off ?? ''} onChange={(e) => setSettings({ ...settings, sign_off: e.target.value })} maxLength={80} disabled={!settings.enabled} placeholder="— Sam and the team" className="mt-1 w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50" />{error && <p className="mt-2 text-sm text-red-600">{error}</p>}{changed && <button data-press-feedback onClick={save} disabled={saving} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save AI settings'}</button>}</section>
}

function ReviewCard({ review, draft, canRespond, onSaved }: { review: ShopReview; draft: ReviewReplyDraft | undefined; canRespond: boolean; onSaved: () => void }) {
  const suggestion = !review.reply && draft?.status === 'ready' ? draft.body : null
  const [reply, setReply] = React.useState(review.reply?.body ?? suggestion ?? '')
  const [editing, setEditing] = React.useState(!review.reply)
  const [saving, setSaving] = React.useState(false)
  const [writing, setWriting] = React.useState(false)
  const [aiText, setAiText] = React.useState<string | null>(suggestion)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => { if (suggestion && !review.reply) { setReply((current) => current.trim() ? current : suggestion); setAiText(suggestion) } }, [suggestion, review.reply])
  const generating = !review.reply && draft?.status === 'generating' && Date.now() - new Date(draft.updated_at).getTime() < 120_000
  async function save(e: React.FormEvent) { e.preventDefault(); if (!reply.trim()) return; setSaving(true); setError(null); try { await postReviewReply(review.id, reply); setEditing(false); onSaved() } catch (err) { setError(message(err, 'Could not save your reply.')) } finally { setSaving(false) } }
  async function writeWithAi() { setWriting(true); setError(null); try { const text = await writeReviewReplyWithAi(review.id); setReply(text); setAiText(text) } catch (err) { setError(message(err, 'The AI couldn’t write a reply.')) } finally { setWriting(false) } }
  async function dismiss() { setError(null); try { await dismissReviewDraft(review.id); setReply(''); setAiText(null); onSaved() } catch (err) { setError(message(err, 'Could not dismiss this draft.')) } }
  const showingAi = aiText !== null && reply === aiText
  return <article className="rounded-2xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><div className="flex justify-between gap-4"><div><p className="font-bold text-foreground">Customer review</p><StarRating rating={review.rating} /></div><p className="text-xs text-foreground/40">{new Date(review.created_at).toLocaleDateString()}</p></div>{review.body && <p className="mt-3 text-foreground/70 whitespace-pre-wrap">{review.body}</p>}{review.reply && !editing ? <div className="mt-5 border-l-2 border-primary pl-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold flex items-center gap-2">Reply from the shop{review.reply.ai_generated && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary"><Sparkles className="h-3 w-3" />Written by AI</span>}</p>{canRespond && <button data-press-feedback onClick={() => setEditing(true)} className="text-sm font-bold text-primary-hover">Edit</button>}</div><p className="mt-1 text-sm text-foreground/70 whitespace-pre-wrap">{review.reply.body}</p></div> : canRespond ? <form onSubmit={save} className="mt-5">{showingAi && !review.reply && <p className="mb-2 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-foreground/80"><Sparkles className="h-4 w-4 shrink-0 text-primary" />AI suggested this reply. Check it, edit it if you like, then post it.</p>}{generating && !showingAi && <p className="mb-2 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-foreground/70"><Sparkles className="h-4 w-4 shrink-0 animate-pulse text-primary" />AI is writing a reply…</p>}<label className="block text-sm font-bold text-foreground mb-2">{review.reply ? 'Edit your reply' : 'Reply publicly'}</label><textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} placeholder="Thank them, answer their question, or make things right…" className="w-full min-h-24 rounded-xl border border-black/10 bg-white/70 px-3 py-2 outline-none focus:border-primary" />{error && <p className="mt-2 text-sm text-red-600">{error}</p>}<div className="flex flex-wrap gap-2 mt-3"><button data-press-feedback disabled={saving || !reply.trim()} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : review.reply ? 'Save reply' : 'Post reply'}</button><button data-press-feedback type="button" onClick={writeWithAi} disabled={writing || saving} className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-bold text-primary disabled:opacity-60"><Sparkles className="h-4 w-4" />{writing ? 'Writing…' : aiText ? 'Rewrite with AI' : 'Write with AI'}</button>{suggestion && !review.reply && <button data-press-feedback type="button" onClick={dismiss} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-bold text-foreground/70">Dismiss</button>}{review.reply && <button data-press-feedback type="button" onClick={() => { setReply(review.reply?.body ?? ''); setEditing(false) }} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-bold">Cancel</button>}</div></form> : null}</article>
}

export function OwnerReviews() {
  const { session, loading: authLoading } = useAuth()
  const { business, staffBusinesses, loading: ownerLoading } = useOwner()
  const [reviews, setReviews] = React.useState<ShopReview[]>([])
  const [drafts, setDrafts] = React.useState<Record<string, ReviewReplyDraft>>({})
  const [error, setError] = React.useState<string | null>(null)
  const activeBusiness = business ?? staffBusinesses[0]?.business ?? null
  const canRespond = Boolean(business || staffBusinesses[0]?.can_respond_reviews)
  const reload = React.useCallback(() => {
    if (!activeBusiness) return
    fetchShopReviews(activeBusiness.id).then(setReviews).catch((err) => setError(message(err, 'Could not load reviews.')))
    if (canRespond) fetchReviewDrafts(activeBusiness.id).then(setDrafts).catch(() => {})
  }, [activeBusiness, canRespond])
  React.useEffect(() => { reload() }, [reload])
  // A reply that is still being written usually lands within a few seconds.
  const waiting = Object.values(drafts).some((draft) => draft.status === 'generating' && Date.now() - new Date(draft.updated_at).getTime() < 120_000)
  React.useEffect(() => { if (!waiting) return; const timer = window.setTimeout(reload, 4000); return () => window.clearTimeout(timer) }, [waiting, drafts, reload])
  if (authLoading || ownerLoading) return <BarePageSkeleton />
  if (!session) return <Navigate to="/login" replace />
  const average = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : '—'
  return <OwnerLayout><p className="text-xs font-extrabold uppercase tracking-wide text-foreground/40 mb-1">Customer feedback</p><h1 className="text-3xl font-display font-extrabold text-foreground">Reviews</h1>{!activeBusiness ? <div className="mt-7 rounded-2xl bg-card p-8 text-center text-foreground/55">You are not assigned to a shop yet.</div> : <>{!canRespond && <p className="mt-4 rounded-xl bg-[#FFF0CD] dark:bg-[#3a2f14] p-4 text-sm text-[#72520D] dark:text-[#f0c987]">You can view reviews, but your manager has not given you permission to reply.</p>}<div className="mt-6 mb-7 rounded-2xl bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex items-center gap-4"><div className="h-12 w-12 rounded-2xl bg-[#FFF0CD] dark:bg-[#3a2f14] flex items-center justify-center"><Star className="h-6 w-6 fill-accent text-accent" /></div><div><p className="font-display text-2xl font-extrabold">{average}</p><p className="text-sm text-foreground/50">from {reviews.length} review{reviews.length === 1 ? '' : 's'}</p></div></div>{business && <AiSettingsCard businessId={business.id} />}{error && <p className="mb-4 text-sm text-red-600">{error}</p>}{reviews.length === 0 ? <div className="rounded-2xl bg-card p-10 text-center text-foreground/55"><MessageCircle className="h-9 w-9 mx-auto mb-3 text-primary" />No customer reviews yet.</div> : <div className="grid gap-5">{reviews.map((review) => <ReviewCard key={review.id + (review.reply?.updated_at ?? '')} review={review} draft={drafts[review.id]} canRespond={canRespond} onSaved={reload} />)}</div>}</>}</OwnerLayout>
}

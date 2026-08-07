import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { MessageCircle, Star } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { useOwner } from '@/lib/owner-context'
import { fetchShopReviews, replyToReview, type ShopReview } from '@/lib/businesses'

function StarRating({ rating }: { rating: number }) {
  return <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((item) => <Star key={item} className={'h-4 w-4 ' + (item <= rating ? 'fill-[#F6AF23] text-[#F6AF23]' : 'text-black/15')} />)}</div>
}

function ReviewCard({ review, ownerId, canRespond, onSaved }: { review: ShopReview; ownerId: string; canRespond: boolean; onSaved: () => void }) {
  const [reply, setReply] = React.useState(review.reply?.body ?? '')
  const [editing, setEditing] = React.useState(!review.reply)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  async function save(e: React.FormEvent) { e.preventDefault(); if (!reply.trim()) return; setSaving(true); setError(null); try { await replyToReview(review, ownerId, reply); setEditing(false); onSaved() } catch (err) { setError(typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' ? err.message : 'Could not save your reply.') } finally { setSaving(false) } }
  return <article className="rounded-2xl bg-[#FBF6EC] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><div className="flex justify-between gap-4"><div><p className="font-bold text-[#1a1a1a]">Customer review</p><StarRating rating={review.rating} /></div><p className="text-xs text-[#1a1a1a]/40">{new Date(review.created_at).toLocaleDateString()}</p></div>{review.body && <p className="mt-3 text-[#1a1a1a]/70 whitespace-pre-wrap">{review.body}</p>}{review.reply && !editing ? <div className="mt-5 border-l-2 border-[#E8703B] pl-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">Reply from the shop</p>{canRespond && <button onClick={() => setEditing(true)} className="text-sm font-bold text-[#C9622E]">Edit</button>}</div><p className="mt-1 text-sm text-[#1a1a1a]/70 whitespace-pre-wrap">{review.reply.body}</p></div> : canRespond ? <form onSubmit={save} className="mt-5"><label className="block text-sm font-bold text-[#1a1a1a] mb-2">{review.reply ? 'Edit your reply' : 'Reply publicly'}</label><textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} placeholder="Thank them, answer their question, or make things right…" className="w-full min-h-24 rounded-xl border border-black/10 bg-white/70 px-3 py-2 outline-none focus:border-[#E8703B]" />{error && <p className="mt-2 text-sm text-red-600">{error}</p>}<div className="flex gap-2 mt-3"><button disabled={saving || !reply.trim()} className="rounded-xl bg-[#E8703B] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : review.reply ? 'Save reply' : 'Post reply'}</button>{review.reply && <button type="button" onClick={() => { setReply(review.reply?.body ?? ''); setEditing(false) }} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-bold">Cancel</button>}</div></form> : null}</article>
}

export function OwnerReviews() {
  const { session, loading: authLoading } = useAuth()
  const { business, staffBusinesses, loading: ownerLoading } = useOwner()
  const [reviews, setReviews] = React.useState<ShopReview[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const activeBusiness = business ?? staffBusinesses[0]?.business ?? null
  const canRespond = Boolean(business || staffBusinesses[0]?.can_respond_reviews)
  const reload = React.useCallback(() => { if (!activeBusiness) return; fetchShopReviews(activeBusiness.id).then(setReviews).catch((err) => setError(typeof err?.message === 'string' ? err.message : 'Could not load reviews.')) }, [activeBusiness])
  React.useEffect(() => { reload() }, [reload])
  if (authLoading || ownerLoading) return null
  if (!session) return <Navigate to="/login" replace />
  const average = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : '—'
  return <OwnerLayout><p className="text-xs font-extrabold uppercase tracking-wide text-[#1a1a1a]/40 mb-1">Customer feedback</p><h1 className="text-3xl font-display font-extrabold text-[#1a1a1a]">Reviews</h1>{!activeBusiness ? <div className="mt-7 rounded-2xl bg-[#FBF6EC] p-8 text-center text-[#1a1a1a]/55">You are not assigned to a shop yet.</div> : <>{!canRespond && <p className="mt-4 rounded-xl bg-[#FFF0CD] p-4 text-sm text-[#72520D]">You can view reviews, but your manager has not given you permission to reply.</p>}<div className="mt-6 mb-7 rounded-2xl bg-[#FBF6EC] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex items-center gap-4"><div className="h-12 w-12 rounded-2xl bg-[#FFF0CD] flex items-center justify-center"><Star className="h-6 w-6 fill-[#F6AF23] text-[#F6AF23]" /></div><div><p className="font-display text-2xl font-extrabold">{average}</p><p className="text-sm text-[#1a1a1a]/50">from {reviews.length} review{reviews.length === 1 ? '' : 's'}</p></div></div>{error && <p className="mb-4 text-sm text-red-600">{error}</p>}{reviews.length === 0 ? <div className="rounded-2xl bg-[#FBF6EC] p-10 text-center text-[#1a1a1a]/55"><MessageCircle className="h-9 w-9 mx-auto mb-3 text-[#E8703B]" />No customer reviews yet.</div> : <div className="grid gap-5">{reviews.map((review) => <ReviewCard key={review.id} review={review} ownerId={session.user.id} canRespond={canRespond} onSaved={reload} />)}</div>}</>}</OwnerLayout>
}

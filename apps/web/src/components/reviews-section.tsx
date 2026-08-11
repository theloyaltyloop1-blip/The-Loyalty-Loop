import * as React from 'react'
import { Star, Trash2 } from 'lucide-react'
import { deleteReview, fetchShopReviews, upsertReview, type ShopReview } from '@/lib/businesses'

function Stars({ rating, interactive, onChange }: { rating: number; interactive?: boolean; onChange?: (rating: number) => void }) {
  return <div className="flex gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" disabled={!interactive} onClick={() => onChange?.(value)} aria-label={`${value} star${value === 1 ? '' : 's'}`} className={interactive ? 'hover:scale-110 transition-transform' : 'cursor-default'}><Star className={'h-5 w-5 ' + (value <= rating ? 'fill-accent text-accent' : 'text-black/15')} /></button>)}</div>
}

export function ReviewsSection({ businessId, userId, canReview }: { businessId: string; userId: string; canReview: boolean }) {
  const [reviews, setReviews] = React.useState<ShopReview[]>([])
  const [rating, setRating] = React.useState(5)
  const [body, setBody] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(() => fetchShopReviews(businessId).then((items) => { setReviews(items); const mine = items.find((review) => review.user_id === userId); if (mine) { setRating(mine.rating); setBody(mine.body ?? '') } }).catch((err) => setError(typeof err?.message === 'string' ? err.message : 'Could not load reviews.')), [businessId, userId])
  React.useEffect(() => { reload() }, [reload])
  const mine = reviews.find((review) => review.user_id === userId)

  async function save(e: React.FormEvent) { e.preventDefault(); setSaving(true); setError(null); try { await upsertReview(businessId, userId, rating, body); await reload() } catch (err) { setError(typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' ? err.message : 'Could not save your review.') } finally { setSaving(false) } }
  async function remove() { if (!mine || !window.confirm('Delete your review?')) return; setSaving(true); try { await deleteReview(mine.id); setBody(''); setRating(5); await reload() } catch (err) { setError(typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' ? err.message : 'Could not delete your review.') } finally { setSaving(false) } }

  const average = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : null
  return <section className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 mb-6">
    <div className="flex items-start justify-between gap-4 mb-5"><div><h2 className="font-display text-xl font-bold text-foreground">Reviews</h2><p className="text-sm text-foreground/50 mt-1">{average ? `${average} out of 5 from ${reviews.length} review${reviews.length === 1 ? '' : 's'}` : 'No reviews yet'}</p></div>{average && <div className="flex items-center gap-1 font-display text-xl font-bold"><Star className="h-5 w-5 fill-accent text-accent" />{average}</div>}</div>
    {canReview && <form onSubmit={save} className="rounded-xl bg-white/60 border border-black/7 p-4 mb-6"><p className="font-bold text-sm text-foreground mb-3">{mine ? 'Update your review' : 'Share your experience'}</p><Stars rating={rating} interactive onChange={setRating} /><textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="What did you enjoy?" className="mt-3 min-h-24 w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-primary" />{error && <p className="mt-2 text-sm text-red-600">{error}</p>}<div className="flex gap-2 mt-3"><button disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : mine ? 'Update review' : 'Post review'}</button>{mine && <button type="button" onClick={remove} disabled={saving} className="rounded-xl border border-red-200 px-3 py-2 text-red-600"><Trash2 className="h-4 w-4" /></button>}</div></form>}
    {!canReview && <p className="rounded-xl bg-black/5 p-4 text-sm text-foreground/55 mb-5">Join this shop’s loyalty card to leave a review after your visit.</p>}
    <div className="space-y-5">{reviews.length === 0 ? <p className="text-sm text-foreground/50">Be the first to review this shop.</p> : reviews.map((review) => <article key={review.id} className="border-t border-black/8 pt-5"><div className="flex justify-between gap-3"><div><p className="font-bold text-foreground">{review.user_id === userId ? 'You' : 'Neighbour'}</p><Stars rating={review.rating} /><p className="mt-2 text-sm text-foreground/70 whitespace-pre-wrap">{review.body}</p></div><p className="shrink-0 text-xs text-foreground/40">{new Date(review.created_at).toLocaleDateString()}</p></div>{review.reply && <div className="ml-3 mt-4 border-l-2 border-primary pl-4"><p className="text-sm font-bold text-foreground">Reply from the shop</p><p className="mt-1 text-sm text-foreground/70 whitespace-pre-wrap">{review.reply.body}</p></div>}</article>)}</div>
  </section>
}

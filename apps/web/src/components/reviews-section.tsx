import * as React from 'react'
import { Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteReview, fetchShopReviews, upsertReview, type ShopReview } from '@/lib/businesses'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

function Stars({ rating, interactive, onChange }: { rating: number; interactive?: boolean; onChange?: (rating: number) => void }) {
  return <div className="flex gap-1" role={interactive ? 'radiogroup' : 'img'} aria-label={`${rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((value) => <button data-press-feedback key={value} type="button" disabled={!interactive} onClick={() => onChange?.(value)} aria-label={`${value} star${value === 1 ? '' : 's'}`} aria-checked={interactive ? value === rating : undefined} role={interactive ? 'radio' : undefined} className={interactive ? 'star-rating-button transition-transform duration-150 ease-out active:scale-[0.97]' : 'cursor-default'}><Star aria-hidden="true" className={'h-5 w-5 ' + (value <= rating ? 'fill-amber text-amber' : 'text-foreground/20')} /></button>)}</div>
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
  async function remove() { if (!mine) return; setSaving(true); try { await deleteReview(mine.id); setBody(''); setRating(5); await reload(); toast.success('Review deleted') } catch (err) { toast.error(typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' ? err.message : 'Could not delete your review.') } finally { setSaving(false) } }

  const average = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : null
  return <section className="rounded-3xl bg-card ring-1 ring-foreground/8 p-6 sm:p-7">
    <div className="flex items-start justify-between gap-4 mb-5"><div><h2 className="font-display text-xl font-semibold tracking-tight text-foreground">Reviews</h2><p className="text-sm text-muted-foreground mt-1">{average ? `${average} out of 5 from ${reviews.length} review${reviews.length === 1 ? '' : 's'}` : 'No reviews yet'}</p></div>{average && <div className="flex items-center gap-1 font-display text-xl font-semibold tracking-tight"><Star className="h-5 w-5 fill-amber text-amber" />{average}</div>}</div>
    {canReview && <form onSubmit={save} className="rounded-2xl bg-sage p-5 mb-6 text-sage-ink"><p className="font-semibold mb-3">{mine ? 'Update your review' : 'Share your experience'}</p><Stars rating={rating} interactive onChange={setRating} /><label className="sr-only" htmlFor="review-body">Your review</label><textarea id="review-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="What did you enjoy?" className="mt-3 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 outline-none focus:border-primary" />{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}<div className="flex gap-2 mt-3"><button data-press-feedback disabled={saving} className="rounded-full bg-primary hover:bg-primary-hover transition-colors px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? 'Saving…' : mine ? 'Update review' : 'Post review'}</button>{mine && <AlertDialog><Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><button data-press-feedback type="button" aria-label="Delete review" disabled={saving} className="rounded-full border border-destructive/30 px-3 py-2 text-destructive transition-colors hover:bg-destructive/10"><Trash2 aria-hidden="true" className="h-4 w-4" /></button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete your review</TooltipContent></Tooltip><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete your review?</AlertDialogTitle><AlertDialogDescription>This can't be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div></form>}
    {!canReview && <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground mb-5">Join this shop’s loyalty card to leave a review after your visit.</p>}
    <div className="space-y-5">{reviews.length === 0 ? <p className="text-sm text-muted-foreground">Be the first to review this shop.</p> : reviews.map((review) => <article key={review.id} className="border-t border-border pt-5"><div className="flex justify-between gap-3"><div><p className="font-bold text-foreground">{review.user_id === userId ? 'You' : 'Neighbour'}</p><Stars rating={review.rating} /><p className="mt-2 text-sm text-foreground/70 whitespace-pre-wrap">{review.body}</p></div><p className="shrink-0 text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</p></div>{review.reply && <div className="ml-3 mt-4 border-l-2 border-primary pl-4"><p className="text-sm font-bold text-foreground">Reply from the shop</p><p className="mt-1 text-sm text-foreground/70 whitespace-pre-wrap">{review.reply.body}</p></div>}</article>)}</div>
  </section>
}

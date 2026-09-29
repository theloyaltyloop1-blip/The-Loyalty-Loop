// What each review's reply box shows after a refresh. A box the owner has
// typed in keeps their text, so background polling while an AI reply is
// being written never erases an unsaved correction.
export function mergeReplyInputs(
  current: Record<string, string>,
  reviews: Array<{ id: string; reply?: Array<{ body: string }> | null }>,
  drafts: Record<string, { status: string; body: string | null } | undefined>,
  edited: ReadonlySet<string>,
): Record<string, string> {
  return Object.fromEntries(reviews.map((review) => {
    if (edited.has(review.id)) return [review.id, current[review.id] ?? ""];
    const reply = review.reply?.[0]?.body;
    const suggestion = !reply && drafts[review.id]?.status === "ready" ? drafts[review.id]?.body : null;
    return [review.id, reply || suggestion || ""];
  }));
}

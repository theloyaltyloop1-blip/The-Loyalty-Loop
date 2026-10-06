/** The business owner, or a staff member whose invite is active at this same shop. */
export async function canSendVisitThankYou(
  admin: any,
  userId: string,
  businessId: string,
  ownerId: string | null | undefined,
): Promise<boolean> {
  if (ownerId && ownerId === userId) return true;
  const { data, error } = await admin
    .from("staff_members")
    .select("id")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    console.error("visit thank-you staff lookup failed", error.code ?? "unknown");
    return false;
  }
  return Boolean(data);
}

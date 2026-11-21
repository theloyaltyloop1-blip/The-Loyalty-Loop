// Email codes (Supabase OTP) used instead of tapping a link in the email.
// The same file exists in apps/shopper/src and apps/web/src/lib: keep them in step.

/** Seconds before "Send a new code" can be tapped again. Supabase also refuses
 * a second email for the same address within 60 seconds. */
export const RESEND_SECONDS = 60;

/** Digits only. Supabase codes are 6 digits by default (up to 10 if the
 * project setting is raised), so anything pasted with spaces still works. */
export function cleanCode(text: string): string {
  return text.replace(/\D/g, "").slice(0, 10);
}

export function isCompleteCode(code: string): boolean {
  return code.length >= 6;
}

/** Plain words for the errors Supabase returns from verifyOtp and resend. */
export function codeErrorMessage(raw: string): string {
  if (/expired|invalid|otp|token/i.test(raw))
    return "That code didn't work. Check you typed it exactly, or send a new one. Codes stop working after a while.";
  if (/security purposes|rate limit|too many|after \d+ seconds/i.test(raw))
    return "We've only just sent a code. Please wait a minute before asking for another.";
  if (/fetch|network/i.test(raw)) return "We couldn't reach our servers. Check your connection and try again.";
  if (/password/i.test(raw)) return "Choose a stronger password: at least 8 characters, mixing letters and numbers.";
  return "Something went wrong. Please try again.";
}

/** Supabase hides whether an address is registered: signing up again with a
 * confirmed address "succeeds" with no identities and sends nothing. */
export function isExistingAccount(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}

/** Signing in before confirming the email. */
export function isUnconfirmedEmail(raw: string): boolean {
  return /not confirmed|confirm/i.test(raw);
}

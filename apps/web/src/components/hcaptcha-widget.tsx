import HCaptcha from '@hcaptcha/react-hcaptcha'

const SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY as string | undefined

/**
 * Renders nothing (and callers should treat the token as not required) when
 * VITE_HCAPTCHA_SITE_KEY isn't set — lets auth flows work in local dev before
 * a real hCaptcha site key + Supabase Auth captcha protection are configured.
 */
export function HCaptchaWidget({ onVerify }: { onVerify: (token: string | null) => void }) {
  if (!SITE_KEY) return null
  return <HCaptcha sitekey={SITE_KEY} onVerify={onVerify} onExpire={() => onVerify(null)} />
}

export const hcaptchaEnabled = Boolean(SITE_KEY)

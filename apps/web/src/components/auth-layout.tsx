import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import loyaltyLoopLogo from '@/assets/loyalty-loop-mark.png'

export function AuthLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-dvh bg-background p-3 sm:p-4 md:grid md:grid-cols-[minmax(320px,0.9fr)_1.1fr] md:gap-4">
      <aside className="relative hidden overflow-hidden rounded-[28px] bg-olive p-10 text-olive-ink md:flex md:flex-col md:justify-between">
        <Link to="/" className="flex items-center gap-3" aria-label="The Loyalty Loop home">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-olive-ink"><img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain" /></span>
          <span className="font-display text-lg font-semibold tracking-tight">The Loyalty Loop</span>
        </Link>
        <div aria-hidden="true" className="relative mx-auto my-10 h-56 w-full max-w-sm">
          <div className="absolute right-0 top-0 h-40 w-[78%] rotate-6 rounded-[20px] bg-amber" />
          <div className="absolute right-4 top-6 h-40 w-[78%] -rotate-3 rounded-[20px] bg-orange" />
          <div className="absolute bottom-0 left-0 w-[82%] rounded-[20px] bg-card p-5 text-foreground shadow-[0_20px_44px_rgb(10_16_8/0.28)]">
            <p className="font-display text-2xl font-bold tracking-tight">The usual, please.</p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={'aspect-square rounded-full ' + (i < 3 ? 'bg-primary' : 'border-[1.5px] border-dashed border-foreground/25')} />
              ))}
            </div>
          </div>
        </div>
        <p className="font-display text-3xl font-semibold leading-tight tracking-tight">A little loyalty goes a long way.</p>
      </aside>

      <main className="flex min-h-[calc(100dvh-1.5rem)] flex-col rounded-[28px] bg-card px-6 py-8 sm:px-10 md:min-h-0 md:px-14 md:py-12">
        <div className="flex items-center justify-between gap-4 text-sm font-semibold">
          <Link to="/" className="flex items-center gap-2 md:invisible" aria-label="The Loyalty Loop home">
            <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain" />
            <span className="font-display">The Loyalty Loop</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link to="/help" className="text-muted-foreground transition-colors hover:text-foreground">Help</Link>
            <button data-press-feedback onClick={() => navigate('/')} className="text-muted-foreground transition-colors hover:text-foreground">Back</button>
          </div>
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-10">
          <h1 className="mb-8 font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <div className="flex flex-col gap-4">{children}</div>
        </div>
      </main>
    </div>
  )
}

/** Text field with a visible label above it. Pages pass `placeholder` as before;
 * it becomes the label unless an explicit `label` is given, so no field relies
 * on a placeholder for its name. */
export function AuthInput({ label, className, placeholder, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const id = React.useId()
  const text = label ?? placeholder ?? (props['aria-label'] as string | undefined)
  return (
    <div className="flex flex-col gap-2">
      {text && <label htmlFor={id} className="text-sm font-semibold text-foreground">{text}</label>}
      <input
        {...props}
        id={id}
        className={'h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-200 ease-out focus:border-primary focus:ring-3 focus:ring-primary/20 ' + (className ?? '')}
      />
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14.1-5l-6.5-5.5C29.5 35.4 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.7 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.5 5.5C39.6 37 44 31 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  )
}

export function GoogleButton({ onClick, label = 'Continue with Google' }: { onClick: () => void; label?: string }) {
  return (
    <button
      data-press-feedback
      type="button"
      onClick={onClick}
      className="h-12 w-full rounded-full border border-input bg-card flex items-center justify-center gap-3 font-semibold text-foreground transition-colors duration-200 ease-out hover:bg-secondary"
    >
      <GoogleIcon />
      {label}
    </button>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="21.6" viewBox="0 0 384 512" aria-hidden="true">
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </svg>
  )
}

export function AppleButton({ onClick, label = 'Continue with Apple' }: { onClick: () => void; label?: string }) {
  return (
    <button
      data-press-feedback
      type="button"
      onClick={onClick}
      className="h-12 w-full rounded-full bg-[#111] flex items-center justify-center gap-3 font-semibold text-white transition-colors duration-200 ease-out hover:bg-[#2a2a2a] dark:bg-[#f5f5f2] dark:text-[#111] dark:hover:bg-white"
    >
      <AppleIcon />
      {label}
    </button>
  )
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      or
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

export function AuthLinks({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="mt-6 flex flex-col gap-2.5 border-t border-border pt-6 text-sm">{children}</div>
}

export function AuthLinkLine({
  prompt,
  linkText,
  to,
}: {
  prompt: string
  linkText: string
  to: string
}) {
  return (
    <p className="text-muted-foreground">
      <span>{prompt}</span>{' '}
      <Link to={to} className="font-semibold text-foreground underline decoration-primary/60 decoration-[1.5px] underline-offset-4 hover:decoration-primary">
        {linkText}
      </Link>
    </p>
  )
}

/** Deliberately quieter than AuthLinkLine: a secondary,
 * lower-priority action rather than one of the primary account switches. */
export function AuthMinorLink({ linkText, to }: { linkText: string; to: string }) {
  return (
    <Link to={to} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
      {linkText}
    </Link>
  )
}

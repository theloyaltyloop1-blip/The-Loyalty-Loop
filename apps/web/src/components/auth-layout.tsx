import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'

export function AuthLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-black/10 bg-card shadow-sticker-lifted grid md:grid-cols-[420px_1fr] overflow-hidden">
        <div className="bg-secondary flex items-center justify-center p-10">
          <img src={loyaltyLoopLogo} alt="The Loyalty Loop" className="w-full max-w-xs object-contain" />
        </div>

        <div className="bg-card p-8 md:p-12 flex flex-col relative">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-8">{title}</h1>
          <div className="flex flex-col gap-4 max-w-md">{children}</div>

          <button data-press-feedback
            onClick={() => navigate('/')}
            className="absolute bottom-6 right-8 text-sm font-semibold text-primary transition-colors duration-150 ease-out hover:text-primary-hover hover:underline"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}

export function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-14 w-full rounded-lg border-[1.5px] border-foreground/20 bg-white px-4 text-base font-bold text-foreground placeholder:text-foreground/50 placeholder:font-normal outline-none transition-colors duration-150 ease-out focus:border-primary"
    />
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
      className="h-14 w-full rounded-lg border-[1.5px] border-foreground/20 bg-white flex items-center justify-center gap-3 font-bold text-foreground transition-colors duration-150 ease-out hover:border-foreground/40"
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
        fill="#fff"
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
      className="h-14 w-full rounded-lg bg-black flex items-center justify-center gap-3 font-bold text-white transition-colors duration-150 ease-out hover:bg-black/85"
    >
      <AppleIcon />
      {label}
    </button>
  )
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-sm font-semibold text-foreground/40">
      <div className="h-px flex-1 bg-foreground/15" />
      or
      <div className="h-px flex-1 bg-foreground/15" />
    </div>
  )
}

export function AuthLinks({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="mt-4 flex flex-col gap-1.5 text-sm">{children}</div>
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
    <p className="text-foreground">
      <span className="font-semibold">{prompt}</span>{' '}
      <Link to={to} className="font-semibold text-primary-hover hover:underline">
        {linkText}
      </Link>
    </p>
  )
}

/** Deliberately smaller and quieter than AuthLinkLine — a secondary,
 * lower-priority action rather than one of the primary account switches. */
export function AuthMinorLink({ linkText, to }: { linkText: string; to: string }) {
  return (
    <Link to={to} className="text-xs text-foreground/50 hover:text-foreground/80 hover:underline">
      {linkText}
    </Link>
  )
}

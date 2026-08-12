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

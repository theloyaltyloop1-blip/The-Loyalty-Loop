import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'

export function AuthLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EAEAE5] p-4">
      <div className="w-full max-w-4xl rounded-md border border-[#d8d8d0] bg-white shadow-sm grid md:grid-cols-[420px_1fr] overflow-hidden">
        <div className="bg-[#F8E4C6] flex items-center justify-center p-10">
          <img src={loyaltyLoopLogo} alt="The Loyalty Loop" className="w-full max-w-xs object-contain" />
        </div>

        <div className="bg-[#E8ECE2] p-8 md:p-12 flex flex-col relative">
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] mb-8">{title}</h1>
          <div className="flex flex-col gap-4 max-w-md">{children}</div>

          <button
            onClick={() => navigate('/')}
            className="absolute bottom-6 right-8 text-sm font-semibold text-[#2F6FED] hover:underline"
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
      className="h-14 w-full rounded-lg border-[1.5px] border-[#1a1a1a] bg-white px-4 text-base font-bold text-[#1a1a1a] placeholder:text-[#1a1a1a] placeholder:font-bold outline-none focus:border-[#4B6142]"
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
    <p className="text-[#1a1a1a]">
      <span className="font-semibold">{prompt}</span>{' '}
      <Link to={to} className="font-semibold text-[#C9622E] hover:underline">
        {linkText}
      </Link>
    </p>
  )
}

/** Deliberately smaller and quieter than AuthLinkLine — a secondary,
 * lower-priority action rather than one of the primary account switches. */
export function AuthMinorLink({ linkText, to }: { linkText: string; to: string }) {
  return (
    <Link to={to} className="text-xs text-[#1a1a1a]/50 hover:text-[#1a1a1a]/80 hover:underline">
      {linkText}
    </Link>
  )
}

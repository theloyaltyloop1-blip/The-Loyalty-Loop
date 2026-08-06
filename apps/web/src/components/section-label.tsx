import * as React from 'react'

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-md border-2 border-[#2f6b3a] px-3 py-1 text-sm font-extrabold uppercase tracking-wide text-[#2f6b3a]">
      {children}
    </span>
  )
}

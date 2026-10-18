import * as React from 'react'
import { cn } from '@/lib/utils'

export function StatusText({ children = 'Loading…', className }: { children?: React.ReactNode; className?: string }) {
  return <p className={cn('text-sm text-[#1a1a1a]/40', className)}>{children}</p>
}

export function StatusCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl bg-[#FBF6EC] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center', className)}>
      {children}
    </div>
  )
}

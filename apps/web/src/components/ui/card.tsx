import * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[1.25rem] border-[3px] border-foreground bg-card shadow-sticker p-6',
        className
      )}
      {...props}
    />
  )
}

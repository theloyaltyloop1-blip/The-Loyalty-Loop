import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 border-[3px] border-foreground',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white shadow-sticker hover:shadow-sticker-lifted hover:-translate-y-0.5 active:translate-y-0 active:shadow-none',
        accent: 'bg-accent text-foreground shadow-sticker hover:shadow-sticker-lifted hover:-translate-y-0.5 active:translate-y-0 active:shadow-none',
        outline: 'bg-card text-foreground shadow-sticker hover:shadow-sticker-lifted hover:-translate-y-0.5 active:translate-y-0 active:shadow-none',
        ghost: 'border-transparent bg-transparent hover:bg-secondary',
      },
      size: {
        default: 'h-11 px-6 text-base',
        sm: 'h-9 px-4 text-sm',
        lg: 'h-14 px-8 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
}

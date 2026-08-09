import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-body font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 border border-transparent',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white shadow-sm hover:bg-[#a85422] hover:shadow-md',
        accent: 'bg-accent text-foreground shadow-sm hover:bg-[#c99743] hover:shadow-md',
        outline: 'bg-card text-foreground border-border hover:border-[#b8aa96] hover:bg-[#faf7f1]',
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

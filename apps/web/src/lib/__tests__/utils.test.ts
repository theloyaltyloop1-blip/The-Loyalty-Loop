import { describe, expect, it, vi } from 'vitest'
import { cn } from '../utils'

vi.mock('../supabase', () => ({ supabase: {} }))
const { pctChange } = await import('../analytics')

describe('cn', () => {
  it('merges conflicting tailwind classes', () => {
    expect(cn('p-2', false && 'hidden', 'p-4')).toBe('p-4')
  })
})

describe('pctChange', () => {
  it('rounds the percentage change', () => {
    expect(pctChange(15, 10)).toBe(50)
    expect(pctChange(5, 10)).toBe(-50)
  })
  it('handles a zero baseline', () => {
    expect(pctChange(0, 0)).toBe(0)
    expect(pctChange(3, 0)).toBeNull()
  })
})

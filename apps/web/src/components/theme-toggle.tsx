import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'loyalty-loop-theme'

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** A saved choice wins; otherwise follow the visitor's system setting. */
function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* storage blocked: fall through to the system setting */ }
  return systemTheme()
}

function hasSavedTheme(): boolean {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved === 'dark' || saved === 'light'
  } catch { return false }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(readTheme)

  React.useEffect(() => { applyTheme(theme) }, [theme])

  // Until the visitor picks a side, keep following the system setting live.
  React.useEffect(() => {
    if (!window.matchMedia) return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { if (!hasSavedTheme()) setThemeState(query.matches ? 'dark' : 'light') }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // Only an explicit choice is saved, so first-time visitors keep following the system.
  const setTheme = React.useCallback<React.Dispatch<React.SetStateAction<Theme>>>((value) => {
    setThemeState((current) => {
      const next = typeof value === 'function' ? value(current) : value
      try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
      return next
    })
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

const ThemeContext = React.createContext<{ theme: Theme; setTheme: React.Dispatch<React.SetStateAction<Theme>> } | null>(null)

/** The app's own light/dark state — not next-themes. Sonner's Toaster reads
 * this too, so the toast palette follows the same switch as everything else
 * instead of tracking a second, separate notion of theme. */
export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const context = React.useContext(ThemeContext)
  if (!context) return null

  const nextTheme = context.theme === 'dark' ? 'light' : 'dark'
  const Icon = context.theme === 'dark' ? Sun : Moon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          data-press-feedback
          type="button"
          onClick={() => context.setTheme(nextTheme)}
          className={className ?? (compact
            ? 'inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-foreground/5'
            : 'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-foreground/70 transition-colors hover:bg-foreground/5')}
          aria-label={`Switch to ${nextTheme} mode`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {!compact && <span>{context.theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Switch to {nextTheme} mode</TooltipContent>
    </Tooltip>
  )
}

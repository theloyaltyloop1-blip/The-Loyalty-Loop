import * as React from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'loyalty-loop-theme'

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>(readTheme)

  React.useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

const ThemeContext = React.createContext<{ theme: Theme; setTheme: React.Dispatch<React.SetStateAction<Theme>> } | null>(null)

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const context = React.useContext(ThemeContext)
  if (!context) return null

  const nextTheme = context.theme === 'dark' ? 'light' : 'dark'
  const Icon = context.theme === 'dark' ? Sun : Moon

  return (
    <button
      data-press-feedback
      type="button"
      onClick={() => context.setTheme(nextTheme)}
      className={compact
        ? 'inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-foreground/5'
        : 'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-foreground/70 transition-colors hover:bg-foreground/5'}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {!compact && <span>{context.theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}

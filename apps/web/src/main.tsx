import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

// Error monitoring. No-op unless VITE_SENTRY_DSN is set. No PII, tracing or replay.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  })
}

// Apply the saved preference (or, on a first visit, the system setting) before React
// renders, so nobody briefly sees the wrong colour scheme while the page starts up.
try {
  const saved = window.localStorage.getItem('loyalty-loop-theme')
  const dark = saved === 'dark' || (saved !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  if (dark) {
    document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = 'dark'
  }
} catch { /* storage blocked: stay on the default */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

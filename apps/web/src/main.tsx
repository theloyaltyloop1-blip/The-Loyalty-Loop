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

// Apply a saved preference before React renders, so returning visitors do not
// briefly see the opposite colour scheme while the page starts up.
if (window.localStorage.getItem('loyalty-loop-theme') === 'dark') {
  document.documentElement.classList.add('dark')
  document.documentElement.style.colorScheme = 'dark'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

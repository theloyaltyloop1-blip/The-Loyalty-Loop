import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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

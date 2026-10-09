import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../../apps/web/src/index.css'
import { AccessPanel } from '../../apps/web/src/pages/AccessPanel'
import { ThemeProvider } from '../../apps/web/src/components/theme-toggle'
createRoot(document.getElementById('root')!).render(<BrowserRouter><ThemeProvider><AccessPanel /></ThemeProvider></BrowserRouter>)

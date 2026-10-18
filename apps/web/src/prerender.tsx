import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { Landing } from '@/pages/Landing'
import { Help } from '@/pages/Help'

// Build-time only (see scripts/prerender.mjs): public marketing pages are
// rendered to static HTML so crawlers and link previews see real content
// without running JavaScript. The SPA replaces this markup when it boots.
export const pages = {
  '/': { element: <Landing />, meta: null },
  '/help': {
    element: <Help />,
    meta: {
      title: 'Help & FAQ | The Loyalty Loop',
      description:
        'Answers for shoppers and businesses using The Loyalty Loop: earning rewards, claiming them, setting up your shop, accounts, privacy and troubleshooting.',
    },
  },
} as const

export function render(path: keyof typeof pages) {
  return renderToString(<StaticRouter location={path}>{pages[path].element}</StaticRouter>)
}

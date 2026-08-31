import { useEffect } from 'react'

const SITE_URL = 'https://www.the-loyalty-loop.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/logo-for-emails.png`

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertStructuredData(data?: Record<string, unknown>) {
  const id = 'page-structured-data'
  const current = document.head.querySelector<HTMLScriptElement>(`script#${id}`)
  if (!data) {
    current?.remove()
    return
  }
  const script = current ?? document.createElement('script')
  script.id = id
  script.type = 'application/ld+json'
  script.text = JSON.stringify(data).replace(/</g, '\\u003c')
  if (!current) document.head.appendChild(script)
}

/**
 * Sets document title + meta description/OG tags/canonical for the current
 * page. This is a CSR-only SPA (no react-helmet dependency), so these are
 * applied client-side after mount — fine for browser tabs/sharing previews,
 * not a substitute for SSR if crawler-rendered previews ever matter more.
 */
export function usePageMeta({
  title,
  description,
  path,
  image,
  robots,
  structuredData,
  enabled = true,
}: {
  title: string
  description: string
  path: string
  image?: string
  robots?: string
  structuredData?: Record<string, unknown>
  enabled?: boolean
}) {
  useEffect(() => {
    if (!enabled) return
    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:image', image ?? DEFAULT_OG_IMAGE)
    upsertMeta('property', 'og:url', `${SITE_URL}${path}`)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', image ?? DEFAULT_OG_IMAGE)
    upsertMeta('name', 'robots', robots ?? 'index,follow')
    upsertCanonical(`${SITE_URL}${path}`)
    upsertStructuredData(structuredData)
  }, [title, description, path, image, robots, structuredData, enabled])
}

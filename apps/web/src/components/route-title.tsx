import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'The Loyalty Loop'

const TITLES: [RegExp, string][] = [
  [/^\/$/, `${SITE} – Rewards from your favourite local shops`],
  [/^\/login/, 'Log in'],
  [/^\/signup\/owner/, 'Register your business'],
  [/^\/signup/, 'Sign up'],
  [/^\/forgot-password/, 'Forgot password'],
  [/^\/reset-password/, 'Reset password'],
  [/^\/terms/, 'Terms of Service'],
  [/^\/privacy/, 'Privacy Policy'],
  [/^\/dashboard\/shop\//, 'Shop'],
  [/^\/dashboard\/rewards/, 'Rewards'],
  [/^\/dashboard\/news/, 'News'],
  [/^\/dashboard\/favourites/, 'Favourites'],
  [/^\/dashboard\/profile/, 'Profile'],
  [/^\/dashboard\/activity/, 'Activity'],
  [/^\/dashboard\/inbox/, 'Inbox'],
  [/^\/dashboard/, 'Home'],
  [/^\/owner/, 'Business dashboard'],
  [/^\/access/, 'Access panel'],
  [/^\/brand/, 'Brand workspace'],
]

export function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const match = TITLES.find(([re]) => re.test(pathname))?.[1]
    document.title = !match ? SITE : match.startsWith(SITE) ? match : `${match} | ${SITE}`
  }, [pathname])
  return null
}

// Outage banner. Keep this file identical in apps/shopper and apps/retailer.
//
// Two independent checks, every 30 seconds and whenever the app comes back to
// the front:
//  1. Can we reach Supabase? (its auth health endpoint)
//  2. What does our status file say? It lives on the website
//     (www.the-loyalty-loop.com/status.json, i.e. Vercel), not in Supabase, so
//     we can still tell people what is going on when the database is down.
//     Edit apps/web/public/status.json and push to change the message.
//
// A hidden "Simulate outage" switch (Settings: long-press the version line)
// fakes a Supabase failure on this phone so the whole thing can be tested.
import { useEffect, useRef, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import Storage from 'expo-sqlite/kv-store'

export const STATUS_URL = 'https://www.the-loyalty-loop.com/status.json'
const SIMULATE_KEY = 'loyalty-loop:simulate-outage'
const CHECK_EVERY_MS = 30_000
const TIMEOUT_MS = 6_000

export type ServiceLevel = 'ok' | 'degraded' | 'offline'
export type ServiceStatus = {
  level: ServiceLevel
  title: string
  message: string
  checkedAt: number | null
}

type StatusFile = { level?: string; title?: string; message?: string; apps?: string[] }

const OK: ServiceStatus = { level: 'ok', title: '', message: '', checkedAt: null }

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export function simulatedOutage(): boolean {
  try {
    return Storage.getItemSync(SIMULATE_KEY) === '1'
  } catch {
    return false
  }
}

export function setSimulatedOutage(on: boolean) {
  try {
    if (on) Storage.setItemSync(SIMULATE_KEY, '1')
    else Storage.removeItemSync(SIMULATE_KEY)
  } catch {
    // Storage unavailable: the switch just won't stick.
  }
  for (const listener of listeners) listener()
}

const listeners = new Set<() => void>()

async function supabaseReachable(): Promise<boolean> {
  if (simulatedOutage()) return false
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return true
  try {
    const res = await fetchWithTimeout(`${url}/auth/v1/health`, { headers: { apikey: key } })
    return res.status < 500
  } catch {
    return false
  }
}

async function readStatusFile(app: 'shopper' | 'business'): Promise<StatusFile | null> {
  try {
    const res = await fetchWithTimeout(`${STATUS_URL}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } })
    if (!res.ok) return null
    const file = (await res.json()) as StatusFile
    if (Array.isArray(file.apps) && !file.apps.includes(app)) return { level: 'ok' }
    return file
  } catch {
    return null
  }
}

export async function checkServiceStatus(app: 'shopper' | 'business'): Promise<ServiceStatus> {
  const [reachable, file] = await Promise.all([supabaseReachable(), readStatusFile(app)])
  const checkedAt = Date.now()
  const announced = file && (file.level === 'degraded' || file.level === 'down')
  if (!reachable && !file && !simulatedOutage()) {
    // Neither our servers nor the website answered: almost certainly this phone.
    return { level: 'offline', title: 'You’re offline', message: 'Showing what was saved on this phone. We’ll catch up when you’re back online.', checkedAt }
  }
  if (announced) {
    return {
      level: 'degraded',
      title: file.title?.trim() || 'We’re having problems',
      message: file.message?.trim() || 'Some things may not work for a while. Your cards and rewards are safe.',
      checkedAt,
    }
  }
  if (!reachable) {
    return {
      level: 'degraded',
      title: 'We’re having problems',
      message: 'Our servers aren’t answering. Your cards and rewards are safe, and we’ll reconnect by ourselves.',
      checkedAt,
    }
  }
  return { ...OK, checkedAt }
}

export function useServiceStatus(app: 'shopper' | 'business'): ServiceStatus & { recheck: () => void } {
  const [status, setStatus] = useState<ServiceStatus>(OK)
  const running = useRef(false)
  const recheck = () => {
    if (running.current) return
    running.current = true
    void checkServiceStatus(app)
      .then(setStatus)
      .finally(() => {
        running.current = false
      })
  }
  useEffect(() => {
    recheck()
    const timer = setInterval(recheck, CHECK_EVERY_MS)
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') recheck()
    })
    listeners.add(recheck)
    return () => {
      clearInterval(timer)
      foreground.remove()
      listeners.delete(recheck)
    }
  }, [app])
  return { ...status, recheck }
}

export function OutageBanner({ status, savedAt }: { status: ServiceStatus & { recheck: () => void }; savedAt?: number | null }) {
  const [open, setOpen] = useState(false)
  if (status.level === 'ok') return null
  const offline = status.level === 'offline'
  return (
    <Pressable onPress={() => setOpen((v) => !v)} style={[s.banner, offline ? s.offline : s.degraded]} accessibilityRole="button" accessibilityLabel={`${status.title}. ${status.message}`}>
      <View style={s.row}>
        <View style={[s.dot, offline ? s.dotOffline : s.dotDegraded]} />
        <Text style={s.title} numberOfLines={1}>{status.title}</Text>
        <Text style={s.more}>{open ? 'Less' : 'More'}</Text>
      </View>
      {open ? (
        <View style={s.body}>
          <Text style={s.message}>{status.message}</Text>
          {savedAt ? <Text style={s.small}>Showing what was saved {timeAgo(savedAt)}.</Text> : null}
          <Text style={s.small}>We check again every 30 seconds.</Text>
          <Pressable onPress={status.recheck} hitSlop={8}><Text style={s.retry}>Check now</Text></Pressable>
        </View>
      ) : null}
    </Pressable>
  )
}

function timeAgo(at: number): string {
  const mins = Math.round((Date.now() - at) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  return new Date(at).toLocaleDateString()
}

const s = StyleSheet.create({
  banner: { marginHorizontal: 12, marginTop: 6, marginBottom: 4, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  degraded: { backgroundColor: '#FFF1E0', borderWidth: 1, borderColor: '#F5C58F' },
  offline: { backgroundColor: '#EEF0F4', borderWidth: 1, borderColor: '#CBD1DB' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotDegraded: { backgroundColor: '#E8820C' },
  dotOffline: { backgroundColor: '#6B7280' },
  title: { flex: 1, color: '#2B2118', fontSize: 14, fontWeight: '700' },
  more: { color: '#8A5A1F', fontSize: 13, fontWeight: '600' },
  body: { marginTop: 8, gap: 4 },
  message: { color: '#3D3127', fontSize: 13, lineHeight: 18 },
  small: { color: '#6B5E52', fontSize: 12 },
  retry: { color: '#B45F06', fontSize: 13, fontWeight: '700', marginTop: 4 },
})

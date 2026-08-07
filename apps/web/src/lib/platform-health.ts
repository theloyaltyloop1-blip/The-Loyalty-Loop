import { supabase } from './supabase'

export interface PlatformHealthCheck { label: string; detail: string; ok: boolean }

export async function fetchPlatformHealth(): Promise<PlatformHealthCheck[]> {
  const { data, error } = await supabase.functions.invoke('platform-health', { body: {} })
  if (error) throw error
  if (!data?.checks || !Array.isArray(data.checks)) throw new Error('Invalid health response')
  return data.checks as PlatformHealthCheck[]
}

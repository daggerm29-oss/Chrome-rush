'use client'

import type { RunResult } from '@/lib/game/types'
import { getWebApp } from '@/lib/telegram/client'

const GUEST_KEY = 'chroma.guestId'
const NAME_KEY = 'chroma.guestName'

export function getGuestId() {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(GUEST_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(GUEST_KEY, id)
  }
  return id
}

export function getGuestName() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(NAME_KEY) ?? ''
}

export function setGuestName(name: string) {
  localStorage.setItem(NAME_KEY, name.slice(0, 20))
}

export function identityHeaders(): HeadersInit {
  const app = getWebApp()
  if (app?.initData) return { 'x-tg-init-data': app.initData, 'x-guest-id': getGuestId() }
  return { 'x-guest-id': getGuestId(), 'x-guest-name': encodeURIComponent(getGuestName()) }
}

export async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: identityHeaders() })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<T>
}

export interface PlayerStatsDto {
  displayName: string
  bestScore: number
  bestDistance: number
  bestTimeMs: number
  totalGames: number
  totalCrystals: number
  totalDistance: number
  rank: number | null
}

export interface LeaderboardDto {
  entries: { rank: number; name: string; score: number; distance: number; isMe: boolean }[]
  me: { rank: number; name: string; score: number; distance: number; isMe: boolean } | null
}

export interface SubmitResponse {
  accepted: boolean
  isNewBest: boolean
  stats: PlayerStatsDto | null
}

export async function submitRun(run: RunResult): Promise<SubmitResponse> {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...identityHeaders() },
    body: JSON.stringify(run),
  })
  if (!res.ok) throw new Error(`Submit failed: ${res.status}`)
  return res.json() as Promise<SubmitResponse>
}

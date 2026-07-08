/* ── Data access layer ───────────────────────────────────────────
   THE swap point. Today these functions resolve mock data from
   src/mocks/. When the Supabase backend lands, only this file
   changes — every component/page keeps calling the same API.    */

import type { Booking, CurrentUser, DashboardData } from './types'
import { mockBookings, mockDashboard } from '../mocks/seed'

/** Simulate a network round-trip so loading states stay honest. */
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))

export async function fetchDashboard(): Promise<DashboardData> {
  await delay()
  return mockDashboard
}

export async function fetchBookings(): Promise<Booking[]> {
  await delay()
  return mockBookings
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  await delay(20)
  return {
    name: 'Siddharth Singh',
    role: 'admin',
    roleLabel: 'Admin',
    avatarInitials: 'SS',
  }
}

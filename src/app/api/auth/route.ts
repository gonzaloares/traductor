import { NextRequest, NextResponse } from 'next/server'
import { createSessionCookie, isAuthorized, pinMatches, pinRequired } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return NextResponse.json({ required: pinRequired(), authorized: isAuthorized(request) }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null)
  const pin = body && typeof body === 'object' && 'pin' in body ? (body as { pin: unknown }).pin : null
  if (!pinRequired()) return NextResponse.json({ authorized: true })
  if (typeof pin !== 'string' || pin.length > 200 || !pinMatches(pin)) {
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
  }
  const result = NextResponse.json({ authorized: true })
  createSessionCookie(result)
  return result
}

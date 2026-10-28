import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'traductor_fr_session'
const DURATION = 30 * 24 * 60 * 60 * 1000

function getPin(): string { return process.env.APP_PIN || process.env.NEXT_PUBLIC_APP_PIN || '' }
function same(a: string, b: string): boolean {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}
function mac(expires: string): string {
  return createHmac('sha256', getPin()).update('traductor-fr:' + expires).digest('hex')
}
export function pinRequired(): boolean { return getPin().length > 0 }
export function pinMatches(candidate: string): boolean { return !!getPin() && same(candidate, getPin()) }
export function isAuthorized(request: NextRequest): boolean {
  if (!pinRequired()) return true
  const cookie = request.cookies.get(COOKIE)?.value ?? ''
  const [expires, signature] = cookie.split('.')
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) < Date.now()) return false
  return same(signature, mac(expires))
}
export function createSessionCookie(response: NextResponse): void {
  const expires = String(Date.now() + DURATION)
  response.cookies.set(COOKIE, expires + '.' + mac(expires), {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: DURATION / 1000
  })
}
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Introduce el PIN para continuar' }, { status: 401 })
}

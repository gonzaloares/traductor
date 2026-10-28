import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized, unauthorized } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { jsonError } from '@/lib/http'
import type { Sentence } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()
  try {
    const supabase = getSupabase()
    const sentences: Sentence[] = []
    const PAGE_SIZE = 500
    // PostgREST defaults to 1000 rows per request. Iterate so the bank remains complete.
    for (let start = 0; start < 100000; start += PAGE_SIZE) {
      const { data, error } = await supabase.from('sentences')
        .select('*').order('created_at', { ascending: true }).order('id', { ascending: true })
        .range(start, start + PAGE_SIZE - 1)
      if (error) throw error
      const batch = (data ?? []) as Sentence[]
      sentences.push(...batch)
      if (batch.length < PAGE_SIZE) break
    }
    return NextResponse.json({ sentences }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return jsonError(error)
  }
}

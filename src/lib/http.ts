import { NextResponse } from 'next/server'
export function jsonError(error: unknown) {
  console.error('[API]', error)
  const message = process.env.NODE_ENV === 'production'
    ? 'No se ha podido completar la operación. Revisa los logs.'
    : error instanceof Error ? error.message : 'Error de servidor'
  return NextResponse.json({ error: message }, { status: 500 })
}

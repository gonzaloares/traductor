import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Parole — Practica francés de verdad',
  description: 'Traduce del español al francés, recibe correcciones inteligentes y aprende con repetición espaciada.',
  applicationName: 'Parole',
}
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, themeColor: '#f7f8fc'
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>
}

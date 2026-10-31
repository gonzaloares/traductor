import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaRegistration from '@/components/PwaRegistration'

export const metadata: Metadata = {
  title: 'Parole — Practica francés e inglés',
  description: 'Traduce del español al francés o al inglés, recibe correcciones inteligentes y aprende con repetición espaciada.',
  applicationName: 'Parole',
  manifest: '/traductor/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Parole', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/traductor/favicon.png', type: 'image/png', sizes: '64x64' }],
    apple: [{ url: '/traductor/apple-touch-icon.png', sizes: '180x180' }],
  },
}
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, themeColor: '#4338ca'
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}<PwaRegistration /></body></html>
}

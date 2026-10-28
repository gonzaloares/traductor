'use client'

import { useEffect } from 'react'

const SW_URL = '/traductor/sw.js'
const SCOPE = '/traductor/'

export default function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    const register = () => {
      void navigator.serviceWorker.register(SW_URL, {
        scope: SCOPE,
        updateViaCache: 'none',
      }).then(registration => {
        // Check for new app versions when opening Parole again.
        void registration.update().catch(() => {})
      }).catch(() => {
        // Browsers that block service workers can still use the normal website.
      })
    }
    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register)
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}

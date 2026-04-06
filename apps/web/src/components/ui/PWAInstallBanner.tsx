'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const hidden = window.sessionStorage.getItem('pwa-install-dismissed') === '1'
    setDismissed(hidden)

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setDismissed(hidden)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice.catch(() => undefined)
    setDeferredPrompt(null)
    setDismissed(true)
    window.sessionStorage.setItem('pwa-install-dismissed', '1')
  }

  function dismiss() {
    setDismissed(true)
    window.sessionStorage.setItem('pwa-install-dismissed', '1')
  }

  if (dismissed || !deferredPrompt) return null

  return (
    <div className="border-b px-4 py-3 text-sm border-white/[0.05] bg-white/[0.03] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <span>Install CONFLICTRADAR for faster access, offline shell support, and app-like launch.</span>
        <div className="flex items-center gap-2">
          <button onClick={dismiss} className="rounded-md border px-3 py-1.5 border-white/[0.06] text-white">Dismiss</button>
          <button onClick={() => void install()} className="rounded-md px-3 py-1.5 bg-blue-500 text-white">Install App</button>
        </div>
      </div>
    </div>
  )
}

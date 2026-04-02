'use client'
import { useEffect, useState } from 'react'

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('cr_splash_shown')
    if (!hasSeenSplash) {
      setShowSplash(true)
      sessionStorage.setItem('cr_splash_shown', '1')
      const timer = setTimeout(() => {
        setShowSplash(false)
        setReady(true)
      }, 1500)
      return () => clearTimeout(timer)
    } else {
      setReady(true)
    }
  }, [])

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-[#060a10] flex flex-col items-center justify-center z-[9999]">
        <p className="text-xs tracking-[0.3em] text-gray-500 uppercase mb-3">
          CONFLICTRADAR // SECURE ACCESS
        </p>
        <h1 className="text-2xl font-bold tracking-widest text-blue-400 uppercase">
          ConflictRadar
        </h1>
        <p className="text-sm text-gray-500 mt-2">Geopolitical Intelligence Platform</p>
        <div className="mt-6 w-32 h-px bg-gray-800 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-blue-500" style={{ animation: 'cr-loading 1.4s ease-in-out forwards', width: '0%' }} />
        </div>
      </div>
    )
  }
  if (!ready) return null
  return <>{children}</>
}

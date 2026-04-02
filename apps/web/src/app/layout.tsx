import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { PWAInstallBanner } from '@/components/ui/PWAInstallBanner'
import { SplashScreen } from '@/components/ui/SplashScreen'

const inter = Inter({ subsets: ['latin'], variable: '--font-ui' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'ConflictRadar | Geopolitical Intelligence Platform',
  description: 'Real-time geopolitical intelligence, risk forecasting, and operator-grade analysis workflows.',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
  appleWebApp: { capable: true, title: 'ConflictRadar', statusBarStyle: 'black-translucent' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
          <script dangerouslySetInnerHTML={{ __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () { return undefined }) }) }` }} />
          <SplashScreen>
            <PWAInstallBanner />
            {children}
          </SplashScreen>
        </body>
      </html>
    </ClerkProvider>
  )
}

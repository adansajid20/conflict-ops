import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CONFLICT OPS | Geopolitical Intelligence Platform',
  description: 'Real-time geopolitical intelligence. Self-serve. Mission-ready.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="ops" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}

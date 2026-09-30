import type { Metadata } from 'next'
import './globals.css'
import OfflineSupport from '@/components/offline-support'

export const metadata: Metadata = {
  title: "Allied Universal · Washington University",
  description: 'Allied Universal Security Services Officer Portal',
  generator: 'next',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Allied Forms', statusBarStyle: 'default' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#1a4480" />
      </head>
      <body>
        <OfflineSupport />
        {children}
      </body>
    </html>
  )
}

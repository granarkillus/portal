import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "AUS Officer Portal",
  description: 'Allied Universal Security Services Officer Portal',
  generator: 'next',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

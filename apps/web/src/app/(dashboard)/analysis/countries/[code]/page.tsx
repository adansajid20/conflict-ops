import { CountryIntelClient } from '@/components/countries/CountryIntelClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: {
    code: string
  }
}

export async function generateMetadata({ params }: PageProps) {
  const code = params.code.toUpperCase()
  return {
    title: `${code} - Country Intelligence Dashboard`,
    description: `Comprehensive geopolitical intelligence analysis for ${code}.`,
  }
}

export default async function CountryPage({ params }: PageProps) {
  const countryCode = params.code.toUpperCase()

  // Don't fetch data server-side — let the client component fetch via relative URL
  // Server-to-server self-fetch deadlocks on Vercel
  return (
    <div className="min-h-screen bg-[#070B11]">
      <CountryIntelClient countryCode={countryCode} />
    </div>
  )
}

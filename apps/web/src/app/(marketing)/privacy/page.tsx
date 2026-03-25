export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0e14', color: '#c9d1d9', fontFamily: 'monospace' }}>
      <nav className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: '#21262d' }}>
        <a href="/landing" className="text-lg font-bold tracking-widest" style={{ color: '#58a6ff' }}>CONFLICT OPS</a>
        <a href="/sign-in" className="text-sm" style={{ color: '#8b949e' }}>Sign in →</a>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-xs tracking-widest mb-4" style={{ color: '#58a6ff' }}>LEGAL</div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#e6edf3' }}>Privacy Policy</h1>
        <p className="text-sm mb-12" style={{ color: '#484f58' }}>Last updated: March 2026</p>

        {[
          {
            title: '1. Information We Collect',
            body: `We collect information you provide directly to us when you create an account, including your name, email address, and payment information. We also collect information about how you use our services, including log data, device information, and usage statistics.

We collect the following categories of data:
• Account data: name, email, organization name
• Usage data: features accessed, queries made, alerts configured
• Payment data: processed by Stripe — we do not store card numbers
• Analytics: anonymized usage metrics for product improvement`,
          },
          {
            title: '2. How We Use Your Information',
            body: `We use your information to:
• Provide, maintain, and improve our services
• Process transactions and send related information
• Send technical notices, security alerts, and support messages
• Send email notifications you have configured (alerts, weekly briefs)
• Respond to your comments and questions
• Monitor and analyze usage patterns

We do not sell your personal information to third parties.`,
          },
          {
            title: '3. Data Sources and Attribution',
            body: `CONFLICT OPS aggregates data from publicly available sources including:
• ACLED (Armed Conflict Location & Event Data Project) — acleddata.com
• GDELT Project — gdeltproject.org
• NASA FIRMS — firms.modaps.eosdis.nasa.gov
• AISStream.io — vessel position data
• The OpenSky Network — opensky-network.org
• Metaculus — metaculus.com
• Polymarket — polymarket.com

All source data is attributed within the platform. We do not represent this data as our own original intelligence.`,
          },
          {
            title: '4. Data Retention',
            body: `We retain your data for as long as your account is active or as needed to provide services. Retention periods by plan:
• Individual: 7 days of event history
• Pro: 180 days
• Business: 365 days
• Enterprise: unlimited (configurable)

You may request deletion of your account and associated data at any time by contacting privacy@conflictradar.co.`,
          },
          {
            title: '5. Security',
            body: `We implement industry-standard security measures including encryption in transit (TLS 1.3), encryption at rest, API key hashing (SHA-256), and access controls. Enterprise customers have access to audit logs for all account activity.

However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.`,
          },
          {
            title: '6. Third-Party Services',
            body: `We use the following third-party services:
• Clerk — authentication and user management (clerk.com)
• Supabase — database hosting (supabase.com)
• Stripe — payment processing (stripe.com)
• Upstash — Redis caching (upstash.com)
• Vercel — hosting (vercel.com)
• Resend — transactional email (resend.com)
• Google Gemini — AI enrichment for event analysis (ai.google.dev)
• Inngest — background job processing (inngest.com)

Each third-party provider has their own privacy policy governing their data practices.`,
          },
          {
            title: '7. Your Rights',
            body: `Depending on your location, you may have the following rights:
• Access: request a copy of your personal data
• Correction: request correction of inaccurate data
• Deletion: request deletion of your account and data
• Portability: receive your data in a machine-readable format
• Objection: object to certain processing of your data

To exercise any of these rights, contact privacy@conflictradar.co.`,
          },
          {
            title: '8. Contact',
            body: `For privacy-related inquiries:
Email: privacy@conflictradar.co
Address: CONFLICT OPS / conflictradar.co`,
          },
        ].map(section => (
          <div key={section.title} className="mb-10">
            <h2 className="text-lg font-bold mb-3" style={{ color: '#e6edf3' }}>{section.title}</h2>
            <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#8b949e' }}>{section.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

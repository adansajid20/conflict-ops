export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0e14', color: '#c9d1d9', fontFamily: 'monospace' }}>
      <nav className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: '#21262d' }}>
        <a href="/landing" className="text-lg font-bold tracking-widest" style={{ color: '#58a6ff' }}>CONFLICTRADAR</a>
        <a href="/sign-in" className="text-sm" style={{ color: '#8b949e' }}>Sign in →</a>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-xs tracking-widest mb-4" style={{ color: '#58a6ff' }}>LEGAL</div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#e6edf3' }}>Terms of Service</h1>
        <p className="text-sm mb-12" style={{ color: '#484f58' }}>Last updated: March 2026</p>

        {[
          {
            title: '1. Acceptance of Terms',
            body: `By accessing or using CONFLICTRADAR ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.

The Service is operated by CONFLICTRADAR (conflictradar.co). These terms apply to all users, including free trial users, paid subscribers, and Enterprise customers.`,
          },
          {
            title: '2. Description of Service',
            body: `CONFLICTRADAR is a geopolitical intelligence aggregation and analysis platform. The Service aggregates publicly available data from third-party sources and provides tools for analysis, forecasting, and reporting.

THE SERVICE IS FOR INFORMATIONAL PURPOSES ONLY. Nothing on the platform constitutes professional security advice, military intelligence, or legal counsel. Users are solely responsible for decisions made based on information provided by the Service.`,
          },
          {
            title: '3. Prohibited Uses',
            body: `You may not use the Service:
• To plan, facilitate, or support any illegal activity
• To target, harass, or surveil individuals
• To produce or distribute disinformation
• To circumvent, disable, or interfere with security features
• To scrape or bulk-download data beyond your plan's API limits
• For any purpose that violates applicable laws or regulations
• To resell or redistribute raw data without explicit written permission

Violation of these terms will result in immediate account termination.`,
          },
          {
            title: '4. Data and Intelligence Disclaimer',
            body: `All data displayed on the Service is aggregated from publicly available third-party sources. CONFLICTRADAR:
• Makes no warranty regarding the accuracy, completeness, or timeliness of any data
• Does not verify the authenticity of source events
• Is not responsible for decisions made based on platform data
• Cannot guarantee continuous availability of third-party data feeds

Forecasts and probability estimates are computational outputs, not professional intelligence assessments. They should not be used as the sole basis for security or operational decisions.`,
          },
          {
            title: '5. Subscription and Billing',
            body: `Paid plans are billed monthly or annually. All payments are processed by Stripe.

• Free trials last 14 days with full feature access
• Cancellation takes effect at the end of the current billing period
• No refunds for partial months
• We reserve the right to modify pricing with 30 days notice
• Accounts past due for more than 14 days may be suspended`,
          },
          {
            title: '6. Intellectual Property',
            body: `The Service, including all software, design, and documentation, is owned by CONFLICTRADAR. You are granted a limited, non-exclusive, non-transferable license to use the Service for your internal business purposes.

You may not copy, modify, distribute, or create derivative works from the Service. Third-party data displayed on the platform remains the property of its respective owners and is subject to their licensing terms.`,
          },
          {
            title: '7. Limitation of Liability',
            body: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, CONFLICTRADAR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.

OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRIOR TO THE CLAIM.`,
          },
          {
            title: '8. Termination',
            body: `We may suspend or terminate your account at any time for violation of these Terms. You may cancel your account at any time from the billing settings page.

Upon termination, your access to the Service will cease and your data will be deleted according to our retention policy.`,
          },
          {
            title: '9. Changes to Terms',
            body: `We may update these Terms at any time. We will notify you of material changes via email. Continued use of the Service after changes constitutes acceptance of the new Terms.`,
          },
          {
            title: '10. Contact',
            body: `For questions about these Terms:
Email: legal@conflictradar.co`,
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

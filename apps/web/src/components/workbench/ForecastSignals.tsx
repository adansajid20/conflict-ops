type ForecastSignal = {
  id: string
  conflict_zone?: string | null
  country_code?: string | null
  signal_type?: string | null
  confidence?: number | null
  basis?: string | null
  valid_until?: string | null
}

type CountryRiskScore = {
  country_code: string
  risk_score: number
  trend: 'rising' | 'stable' | 'falling'
  event_count_7d: number
  severity_avg?: number | null
}

function trendArrow(trend: CountryRiskScore['trend']): string {
  if (trend === 'rising') return '↑'
  if (trend === 'falling') return '↓'
  return '→'
}

function riskColor(score: number): string {
  if (score > 70) return '#ef4444'
  if (score >= 40) return '#f97316'
  return '#22c55e'
}

function signalBadge(signalType?: string | null): string {
  if (!signalType) return 'Signal'
  return signalType.replace(/_/g, ' ')
}

export function ForecastSignals({ signals, countryRiskScores }: { signals: ForecastSignal[]; countryRiskScores: CountryRiskScore[] }) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/[0.05] bg-white/[0.015]">
        <div className="border-b border-white/[0.05] px-4 py-3 text-sm font-semibold text-white">Active Signals</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/30">
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">Signal</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Basis</th>
              <th className="px-4 py-3">Valid Until</th>
            </tr>
          </thead>
          <tbody>
            {signals.length === 0 ? (
              <tr><td className="px-4 py-4 text-white/30" colSpan={5}>No active forecast signals.</td></tr>
            ) : signals.map((signal) => (
              <tr key={signal.id} className="border-t border-white/[0.05]">
                <td className="px-4 py-3 text-white">{signal.conflict_zone ?? signal.country_code ?? 'Unknown'}</td>
                <td className="px-4 py-3"><span className="rounded px-2 py-1 text-xs bg-blue-500/10 text-blue-400">{signalBadge(signal.signal_type)}</span></td>
                <td className="px-4 py-3 text-white">{Math.round((signal.confidence ?? 0) * 100)}%</td>
                <td className="px-4 py-3 text-white/30">{signal.basis ?? '—'}</td>
                <td className="px-4 py-3 text-white/30">{signal.valid_until ? new Date(signal.valid_until).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-white/[0.05] bg-white/[0.015]">
        <div className="border-b border-white/[0.05] px-4 py-3 text-sm font-semibold text-white">Country Risk Map</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/30">
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Risk Score</th>
              <th className="px-4 py-3">Trend</th>
              <th className="px-4 py-3">Events 7d</th>
            </tr>
          </thead>
          <tbody>
            {countryRiskScores.length === 0 ? (
              <tr><td className="px-4 py-4 text-white/30" colSpan={4}>No country risk scores yet.</td></tr>
            ) : countryRiskScores.map((row) => (
              <tr key={row.country_code} className="border-t border-white/[0.05]">
                <td className="px-4 py-3 text-white">{row.country_code}</td>
                <td className="px-4 py-3"><span style={{ color: riskColor(row.risk_score), fontWeight: 700 }}>{row.risk_score}</span></td>
                <td className="px-4 py-3 text-white">{trendArrow(row.trend)} {row.trend}</td>
                <td className="px-4 py-3 text-white">{row.event_count_7d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

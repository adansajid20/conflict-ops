import { ESGReportBuilder } from '@/components/reports/ESGReportBuilder'

export default function ESGReportsPage() {
  return <div className="p-6"><div className="mb-6"><h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>ESG REPORTS</h1><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Conflict-linked disclosure narratives and XBRL-ready export.</p></div><ESGReportBuilder /></div>
}

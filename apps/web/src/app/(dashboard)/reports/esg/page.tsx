import { ESGReportBuilder } from '@/components/reports/ESGReportBuilder'

export default function ESGReportsPage() {
  return <div className="p-6"><div className="mb-6"><h1 className="text-xl font-bold text-white">ESG REPORTS</h1><p className="text-sm text-white/30">Conflict-linked disclosure narratives and XBRL-ready export.</p></div><ESGReportBuilder /></div>
}

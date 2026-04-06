import Link from 'next/link'
import { IntelReportBuilder } from '@/components/reports/IntelReportBuilder'

export default function ReportsPage() {
  return <div className="p-6"><div className="mb-6 flex items-start justify-between gap-4"><div><h1 className="text-xl font-bold tracking-widest uppercase mono text-white">REPORT BUILDER</h1><p className="text-xs mono mt-1 text-white/30">Assemble executive intel reports, link events, share public read-only links, and generate ESG narratives.</p></div><Link href="/reports/esg" className="rounded-lg bg-blue-500 px-3 py-2 text-sm text-white">ESG Reports</Link></div><IntelReportBuilder /></div>
}

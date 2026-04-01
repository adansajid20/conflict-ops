export type ReportSectionType = 'header' | 'text' | 'events' | 'ai_summary'

export type ReportSection = {
  type: ReportSectionType
  content: string
  event_ids?: string[]
}

export type IntelReport = {
  id: string
  org_id: string
  title: string
  classification_banner: 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' | string
  sections: ReportSection[]
  created_by: string | null
  shared_token: string | null
  created_at: string
  updated_at?: string
}

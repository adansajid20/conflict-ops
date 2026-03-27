'use client'

import { Activity, AlertTriangle, Globe2, ShieldAlert } from 'lucide-react'
import { DashboardStatCard } from '@/components/dashboard/StatCard'
import { StatCardsRow, StatCardWrapper } from '@/components/dashboard/StatCardsRow'

type Card = { label: string; value: string | number; icon: 'activity' | 'globe2' | 'alert-triangle' | 'shield-alert'; color: string; sparkData: readonly number[] }
const icons = { activity: Activity, globe2: Globe2, 'alert-triangle': AlertTriangle, 'shield-alert': ShieldAlert }

export function OverviewStatCards({ cards }: { cards: Card[] }) {
  return <StatCardsRow>{cards.map((card) => { const Icon = icons[card.icon] as any; return <StatCardWrapper key={card.label}><DashboardStatCard {...card} sparkData={[...card.sparkData]} icon={Icon} /></StatCardWrapper> })}</StatCardsRow>
}

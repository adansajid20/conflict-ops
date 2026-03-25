export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import nextDynamic from 'next/dynamic'

const MonteCarloEngine = nextDynamic(
  () => import('@/components/workbench/MonteCarloEngine').then(m => m.MonteCarloEngine),
  { ssr: false }
)

const ACHMatrix = nextDynamic(
  () => import('@/components/workbench/ACHMatrix').then(m => m.ACHMatrix),
  { ssr: false }
)

export default async function WorkbenchPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()

  const limits = user?.org_id ? await getOrgPlanLimits(user.org_id) : null

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>
          ANALYSIS WORKBENCH
        </h1>
        <p className="text-xs mt-1 mono" style={{ color: 'var(--text-muted)' }}>
          STRUCTURED ANALYTIC TECHNIQUES — PRO + BUSINESS PLANS
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <MonteCarloEngine planHasScenarios={limits?.scenarios ?? false} />
        <ACHMatrix planHasACH={limits?.achMatrix ?? false} />

        {/* SAT Suite placeholder */}
        <div
          className="rounded border p-6"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <div className="text-xs mono tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
            SAT SUITE
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {['KEY ASSUMPTIONS CHECK', 'RED TEAM MODE', "DEVIL'S ADVOCACY", 'ARGUMENT MAPPING', 'QOIC'].map(technique => (
              <div
                key={technique}
                className="rounded border p-3 text-center text-xs mono cursor-pointer hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                {technique}
              </div>
            ))}
          </div>
        </div>

        {/* Corkboard placeholder */}
        <div
          className="rounded border p-6"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <div className="text-xs mono tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
            CORKBOARD / LINK ANALYSIS
          </div>
          <div className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>
            REACT FLOW CANVAS — INITIALIZING...
          </div>
        </div>
      </div>
    </div>
  )
}

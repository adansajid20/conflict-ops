export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/* ================================================================== */
/*  Risk Scoring Methodology Documentation                            */
/*  Transparent methodology publication for external validation       */
/* ================================================================== */

const METHODOLOGY = {
  methodology_version: 'CR-RSM-v1.0',
  publication_date: '2026-04-08',
  title: 'ConflictRadar Explainable Risk Scoring Methodology',
  abstract: 'The ConflictRadar Risk Scoring Model (CR-RSM) is a transparent, data-driven framework for quantifying country and regional conflict risk. Inspired by ACLED methodology but extended to include broader instability indicators, this model synthesizes six complementary indicators into a unified 0-100 risk score with explainable reasoning for each component.',

  principles: [
    'Transparency: All calculations and thresholds are documented and reproducible',
    'Explainability: Each score includes human-readable reasoning for stakeholders',
    'Data-driven: Scoring is grounded in event-level data, not subjective assessments',
    'Comparative: Indicators are normalized to 0-100 scale for easy comparison',
    'Dynamic: Scores update as new events are ingested, reflecting real-time changes',
    'Context-aware: Trends compare current period to prior period, not absolute baselines',
  ],

  indicators: [
    {
      indicator: 'Conflict Intensity',
      code: 'CI',
      weight: '1/6 (16.7%)',
      scale: '0-100',
      definition: 'Measures the frequency and severity of conflict events in the last 30 days. Higher scores indicate more frequent and severe conflict.',
      calculation: [
        '1. Count events in current 30-day period',
        '2. Apply severity weighting: low=0.5x, medium=1x, high=2x, critical=3x, catastrophic=4x',
        '3. Sum weighted severity scores',
        '4. Normalize to 0-100 scale (divide by 10)',
        '5. Compare prior 30-day period to calculate trend',
      ],
      interpretation: {
        '0-33': 'Low: Few or minor events; stable baseline conditions',
        '34-66': 'Moderate: Ongoing incidents; localized tension but not widespread warfare',
        '67-100': 'High: Frequent severe events; active conflict or sustained violence',
      },
      example: '342 events in 30 days with 23% critical/high severity = CI ~78/100 (HIGH)',
      data_sources: ['events.occurred_at', 'events.severity'],
    },
    {
      indicator: 'Civilian Impact',
      code: 'CI',
      weight: '1/6 (16.7%)',
      scale: '0-100',
      definition: 'Quantifies human suffering through humanitarian events and casualty estimates. Reflects both scale (frequency of humanitarian events) and intensity (estimated deaths/injuries).',
      calculation: [
        '1. Count humanitarian-flagged events in current period (0-40 points)',
        '2. Sum casualty estimates across all events (0-60 points)',
        '3. Casualty scoring: 300+ casualties = 60 points (1 casualty = 0.2 points)',
        '4. Sum humanitarian + casualty scores (max 100)',
        '5. Compare prior period to calculate trend',
      ],
      interpretation: {
        '0-33': 'Low: Minimal humanitarian impact; few casualties',
        '34-66': 'Significant: Moderate humanitarian crisis; 100-300 estimated casualties',
        '67-100': 'Severe: Major humanitarian emergency; 300+ estimated casualties',
      },
      example: '15 humanitarian events + 156 estimated casualties = CI ~46/100 (SIGNIFICANT)',
      data_sources: ['events.is_humanitarian_report', 'events.casualty_estimate'],
      limitations: 'Casualty estimates are often incomplete or self-reported; humanitarian events capture only flagged reports.',
    },
    {
      indicator: 'Geographic Spread',
      code: 'GS',
      weight: '1/6 (16.7%)',
      scale: '0-100',
      definition: 'Measures geographic diffusion of conflict across sub-regions or cities. Indicates whether conflict is localized or systemic across territory.',
      calculation: [
        '1. Count distinct regions/sub-regions with ≥1 event (current period)',
        '2. Score: 0-5 regions=0-20 points, 6-20 regions=20-80 points, 20+ regions=80-100 points',
        '3. Logarithmic scaling for higher region counts',
      ],
      interpretation: {
        '0-33': 'Concentrated: Conflict limited to 1-3 regions; localized flashpoint',
        '34-66': 'Moderate: Conflict in 5-10 distinct regions; multi-regional instability',
        '67-100': 'Widespread: 10+ regions affected; systemic national instability',
      },
      example: 'Conflict in 14 distinct regions = GS ~66/100 (MODERATE SPREAD)',
      data_sources: ['events.region'],
      limitations: 'Region boundaries are administrative; actual geographic proximity may vary.',
    },
    {
      indicator: 'Escalation Trajectory',
      code: 'ET',
      weight: '1/6 (16.7%)',
      scale: '0-100',
      definition: 'Compares current 30-day period to prior 30-day period to determine if the situation is deteriorating, improving, or stable. Captures escalation indicators and severity trends.',
      calculation: [
        '1. Identify events with explicit escalation_indicator flag (0-40 points)',
        '2. Calculate % of high-severity+ events in current period (0-60 points)',
        '3. Compare high-severity% to prior period to derive trend',
        '4. Trend: >15% increase = up, <-15% decrease = down, else stable',
      ],
      interpretation: {
        'up': 'Situation deteriorating; conflict intensity increasing',
        'stable': 'Conditions unchanged; similar conflict levels to prior period',
        'down': 'Situation improving; conflict intensity decreasing',
      },
      example: 'Current period: 8 escalation events + 35% high-severity events vs prior 12% = ET ~62/100 (CONCERNING), Trend: UP',
      data_sources: ['events.escalation_indicator', 'events.severity'],
      limitations: 'Escalation indicators are event-level flags; some events may lack this metadata.',
    },
    {
      indicator: 'Actor Fragmentation',
      code: 'AF',
      weight: '1/6 (16.7%)',
      scale: '0-100',
      definition: 'Counts distinct actor groups (state, non-state) involved in conflict. More actors reduce predictability and complicate diplomatic resolution.',
      calculation: [
        '1. Collect all unique actor_ids from events in current period',
        '2. Score: 0-2 actors=0-20, 3-5 actors=20-50, 6-10 actors=50-80, 10+ actors=80-100',
        '3. Higher actor count = higher fragmentation score',
      ],
      interpretation: {
        '0-33': 'Low fragmentation: Bilateral or single-actor conflict; easier resolution pathway',
        '34-66': 'Moderate fragmentation: 3-6 key actors; negotiation complexity increases',
        '67-100': 'High fragmentation: 7+ distinct groups; very difficult coordination/resolution',
      },
      example: '12 distinct actor groups identified in current period = AF ~85/100 (HIGHLY FRAGMENTED)',
      data_sources: ['events.actor_ids'],
      limitations: 'Actor attribution relies on source reporting; some actors may be aggregated or misidentified.',
    },
    {
      indicator: 'International Attention',
      code: 'IA',
      weight: '1/6 (16.7%)',
      scale: '0-100',
      definition: 'Reflects media coverage density and reported significance. Higher scores indicate the situation receives attention from international news sources and analysts.',
      calculation: [
        '1. Average significance_score across all events (0-60 points)',
        '2. Apply density bonus for event frequency: log(event_count) / log(50) × 40 (0-40 points)',
        '3. Sum significance + density scores (max 100)',
      ],
      interpretation: {
        '0-33': 'Low attention: Regional news only; limited international coverage',
        '34-66': 'Moderate attention: International media presence; significant events reported',
        '67-100': 'High attention: Global news coverage; major international focus',
      },
      example: 'Average significance_score=62 + 18 events (density=15) = IA ~58/100 (MODERATE)',
      data_sources: ['events.significance_score'],
      limitations: 'Significance_score reflects ingest-time classification; media coverage may be biased toward certain regions or actors.',
    },
  ],

  overall_score_calculation: {
    formula: '(CI + CX + GS + ET + AF + IA) / 6',
    description: 'Each of the 6 indicators is weighted equally at 16.7%. The final score is the arithmetic mean.',
    result_range: '0-100',
    grade_mapping: {
      'A': '90-100: Very stable; minimal conflict risk',
      'B': '80-89: Stable; low to moderate risk',
      'C': '70-79: Mixed; moderate risk with some concerning factors',
      'D': '60-69: Concerning; multiple risk factors or deteriorating trends',
      'E': '50-59: Very concerning; high risk of escalation or sustained conflict',
      'F': '0-49: Critical; active conflict or severe humanitarian crisis',
    },
  },

  data_quality: {
    confidence_levels: {
      'high': 'Based on 20+ events in the period; robust sample',
      'medium': 'Based on 5-19 events; moderate reliability',
      'low': 'Based on 0-4 events; low confidence due to sparse data',
    },
    date_ranges: {
      current_period: 'Last 30 days (Day 0 to Day -30)',
      prior_period: 'Previous 30 days (Day -30 to Day -60)',
      explanation: 'Trend calculations compare current to prior period. Countries with <5 events per period may show high variance.',
    },
    event_count_note: 'The analysis includes all events meeting the source quality and relevance thresholds. Absence of events may indicate either true stability or underreporting.',
  },

  limitations: [
    'Data Completeness: Some regions may have lower reporting density due to limited news sources or access restrictions.',
    'Severity Attribution: Event severity is assigned at ingest time and may not reflect ground truth; high-severity events are more likely to be reported.',
    'Casualty Estimates: Casualty figures are often preliminary or incomplete; early estimates frequently change as reports are verified.',
    'Actor Attribution: Actor identification relies on source reporting; misattribution or aggregation errors may occur.',
    'Time Lag: Events are published with a lag (hours to days); real-time risk may differ from historical analysis.',
    'Geographic Boundaries: Region/sub-region boundaries are administrative and may not reflect operational areas.',
    'Escalation Indicators: Not all events include escalation flags; methodology assumes missing flags indicate stability.',
  ],

  use_cases: [
    'Risk monitoring dashboards for investors and humanitarian organizations',
    'Early warning signals for escalation or deterioration',
    'Comparative risk assessment across multiple countries or regions',
    'Accountability and transparency in risk-based decision-making',
    'Validation of subjective risk assessments against data-driven benchmarks',
  ],

  future_enhancements: [
    'Social media sentiment integration for public mood signals',
    'Satellite imagery analysis for cross-border mobilization',
    'Sanctions/economic pressure tracking as risk modifiers',
    'Civilian displacement rates as additional humanitarian indicator',
    'Diplomatic engagement tracking (peace talks, mediation) as de-escalation signal',
    'Supply chain disruption indices as secondary effect measures',
  ],

  contact_and_updates: {
    organization: 'ConflictRadar',
    methodology_version: 'CR-RSM-v1.0',
    last_updated: '2026-04-08',
    update_frequency: 'Quarterly review; significant method changes published with version bump',
    contact: 'methodology@conflictradar.io',
    feedback: 'We welcome feedback and validation studies. Contact research team with questions.',
  },
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: METHODOLOGY,
  })
}

/**
 * Prescriptive Actions Engine
 *
 * Transforms conflict risk assessments into actionable intelligence for 4 distinct user personas.
 * This is the core competitive differentiator: we tell you WHAT TO DO, not just WHAT the risk is.
 */

export type UserPersona =
  | 'corporate_risk_manager'
  | 'humanitarian_operator'
  | 'government_diplomatic'
  | 'investor_financial';

export type ActionTimeframe =
  | 'immediate' // 0-24 hours
  | 'short_term' // 1-7 days
  | 'medium_term' // 7-30 days
  | 'monitoring'; // ongoing

export type ActionPriority = 'critical' | 'high' | 'medium' | 'low';

export type ConflictPhase =
  | 'dormant'
  | 'emerging'
  | 'escalation'
  | 'crisis'
  | 'de-escalation';

export type TrendDirection = 'improving' | 'stable' | 'deteriorating';

export interface RiskContext {
  countryCode: string;
  countryName: string;
  region: string;
  warningLevel: number; // 1-5
  threatCategories: { category: string; score: number }[];
  conflictPhase: ConflictPhase;
  trendDirection: TrendDirection;
  activeThreats: { title: string; severity: number; event_type: string }[];
  casualtyEstimate30d: number;
  eventCount30d: number;
  topActors: string[];
}

export interface ActionItem {
  id: string;
  timeframe: ActionTimeframe;
  priority: ActionPriority;
  description: string;
  personas: UserPersona[];
  estimatedImpact: string; // What happens if not taken
  threatCategory: string;
  specificDetails?: {
    target?: string; // e.g., "supply chains", "staff", "assets"
    metric?: string; // measurable threshold
    escalationTrigger?: string; // condition that elevates priority
  };
}

export interface PrescriptiveReport {
  countryCode: string;
  countryName: string;
  reportDate: string;
  riskSummary: {
    warningLevel: number;
    conflictPhase: ConflictPhase;
    trend: TrendDirection;
    keyRiskFactors: string[];
  };
  actions: ActionItem[];
  personaBreakdown: {
    persona: UserPersona;
    actionCount: number;
    criticalCount: number;
    focusAreas: string[];
  }[];
  monitoringPriorities: {
    metric: string;
    threshold: string;
    checkFrequency: string;
    escalationCondition: string;
  }[];
  riskTrajectory: {
    current: number;
    projectedIn7Days: string; // improve/stable/worsen
    projectedIn30Days: string;
    confidenceLevel: 'high' | 'medium' | 'low';
  };
}

// ============================================================================
// RULE ENGINE: Maps risk context to actionable recommendations
// ============================================================================

const ACTION_RULES = {
  // CRITICAL THRESHOLD RULES (Warning Level 4-5)
  crisisActions: (context: RiskContext): ActionItem[] => {
    const actions: ActionItem[] = [];

    if (context.conflictPhase === 'crisis' || context.warningLevel === 5) {
      // Immediate evacuation for all personas
      actions.push({
        id: 'crisis-evacuation',
        timeframe: 'immediate',
        priority: 'critical',
        description: `IMMEDIATE: Activate emergency evacuation protocol for ${context.countryName}. All non-essential personnel must depart within 24 hours. Establish secure communications channel for remaining staff.`,
        personas: ['corporate_risk_manager', 'humanitarian_operator', 'government_diplomatic'],
        estimatedImpact: 'Staff casualties, loss of operational assets, reputational damage if evacuation delayed',
        threatCategory: 'security_threat',
        specificDetails: {
          target: 'personnel',
          metric: '100% evacuation completion',
          escalationTrigger: 'Government travel warnings, airport closure, armed group activity within 20km'
        }
      });

      // Financial lockdown
      actions.push({
        id: 'crisis-financial-lockdown',
        timeframe: 'immediate',
        priority: 'critical',
        description: `IMMEDIATE: Freeze all non-essential financial transfers to/from ${context.countryName}. Activate currency hedging for any remaining exposure. Notify banking partners of elevated risk status.`,
        personas: ['investor_financial', 'corporate_risk_manager'],
        estimatedImpact: 'Trapped capital, currency depreciation, inability to pay suppliers or repatriate funds',
        threatCategory: 'economic_disruption'
      });

      // Operational continuity
      actions.push({
        id: 'crisis-operations-failover',
        timeframe: 'immediate',
        priority: 'critical',
        description: `IMMEDIATE: Activate Business Continuity Plan. Redirect all critical operations to backup infrastructure outside ${context.countryName}. Document continuity costs for insurance claim.`,
        personas: ['corporate_risk_manager'],
        estimatedImpact: 'Total operational loss, customer SLA breaches, revenue collapse',
        threatCategory: 'critical_infrastructure'
      });
    }

    return actions;
  },

  // HIGH RISK ESCALATION RULES (Warning Level 3-4 + Escalation Phase)
  escalationActions: (context: RiskContext): ActionItem[] => {
    const actions: ActionItem[] = [];

    if (
      (context.warningLevel >= 3 && context.conflictPhase === 'escalation') ||
      (context.warningLevel === 4 && context.conflictPhase !== 'dormant')
    ) {
      // Supply chain diversification
      actions.push({
        id: 'supply-chain-diversification',
        timeframe: 'short_term',
        priority: 'high',
        description: `SHORT-TERM: Identify and contract with 2+ alternative suppliers outside ${context.countryName} and its immediate region. Target 60% supply transition within 7 days. Document supplier risk ratings.`,
        personas: ['corporate_risk_manager', 'investor_financial'],
        estimatedImpact: 'Critical supply interruption, production shutdown, customer contract defaults, 15-30% margin compression',
        threatCategory: 'supply_chain_disruption',
        specificDetails: {
          target: 'supply chains',
          metric: '60% of critical suppliers outside risk zone',
          escalationTrigger: 'Armed group control of logistics hubs or border crossings'
        }
      });

      // Personnel security
      actions.push({
        id: 'personnel-relocation-staging',
        timeframe: 'short_term',
        priority: 'high',
        description: `SHORT-TERM: Pre-position evacuation transport and arrange safe houses in adjacent country. Brief all personnel on evacuation procedures. Establish 24/7 crisis hotline. Increase security escorts to 3+ personnel per team.`,
        personas: ['corporate_risk_manager', 'humanitarian_operator', 'government_diplomatic'],
        estimatedImpact: 'Staff abduction, casualties, operational paralysis if evacuation infrastructure missing',
        threatCategory: 'security_threat',
        specificDetails: {
          target: 'staff',
          metric: '100% of personnel briefed and staged',
          escalationTrigger: 'Armed groups operating within 30km of facilities'
        }
      });

      // Insurance and liability
      actions.push({
        id: 'crisis-insurance-notification',
        timeframe: 'short_term',
        priority: 'high',
        description: `SHORT-TERM: Notify all insurance carriers of elevated risk status. Request premium adjustment review and coverage expansion. Document all exposure before policy amendments.`,
        personas: ['corporate_risk_manager', 'investor_financial'],
        estimatedImpact: 'Policy exclusions, coverage denial, uninsured loss exposure exceeding $10M+',
        threatCategory: 'economic_disruption'
      });

      // Diplomatic positioning
      actions.push({
        id: 'diplomatic-coordination',
        timeframe: 'short_term',
        priority: 'high',
        description: `SHORT-TERM: Establish direct coordination channel with relevant embassy/diplomatic mission. Provide situation updates weekly. Request expedited visa processing for staff dependents. Register with embassy's crisis alert system.`,
        personas: ['government_diplomatic', 'corporate_risk_manager', 'humanitarian_operator'],
        estimatedImpact: 'Missed evacuation windows, delayed consular assistance, inability to influence local security',
        threatCategory: 'security_threat'
      });
    }

    return actions;
  },

  // EMERGING THREAT RULES (Warning Level 2-3, Emerging Phase)
  emergingActions: (context: RiskContext): ActionItem[] => {
    const actions: ActionItem[] = [];

    if (context.warningLevel >= 2 && context.conflictPhase === 'emerging') {
      // Scenario planning
      actions.push({
        id: 'scenario-planning',
        timeframe: 'medium_term',
        priority: 'high',
        description: `MEDIUM-TERM: Develop 3 detailed contingency scenarios (supply disruption, partial evacuation, operations pause). Assign decision owners and approval authorities. Model financial impact for each scenario.`,
        personas: ['corporate_risk_manager', 'government_diplomatic', 'investor_financial'],
        estimatedImpact: 'Slow decision-making during crisis, suboptimal resource allocation, preventable losses',
        threatCategory: 'strategic_planning'
      });

      // Intelligence sharing
      actions.push({
        id: 'intelligence-network-buildup',
        timeframe: 'medium_term',
        priority: 'medium',
        description: `MEDIUM-TERM: Establish local intelligence sources (fixers, security partners, local staff networks). Schedule bi-weekly risk briefings with ConflictRadar. Build institutional knowledge of key actors and local dynamics.`,
        personas: ['corporate_risk_manager', 'humanitarian_operator', 'government_diplomatic'],
        estimatedImpact: 'Blind spots in situational awareness, reactive (not proactive) response posture',
        threatCategory: 'intelligence_gap'
      });

      // Financial hedging
      actions.push({
        id: 'financial-hedging-positioning',
        timeframe: 'medium_term',
        priority: 'medium',
        description: `MEDIUM-TERM: Initiate currency hedging for ${context.countryName} exposure. Review insurance deductibles. Establish credit facility with alternative banks. Target 40% of exposure hedged by day 15.`,
        personas: ['investor_financial', 'corporate_risk_manager'],
        estimatedImpact: 'Currency depreciation wiping out 10-20% of asset value; capital constraints during crisis',
        threatCategory: 'economic_disruption',
        specificDetails: {
          metric: '40% hedged ratio',
          escalationTrigger: 'Currency volatility exceeding 3% daily'
        }
      });
    }

    return actions;
  },

  // THREAT-SPECIFIC RULES
  threatSpecificActions: (context: RiskContext): ActionItem[] => {
    const actions: ActionItem[] = [];

    const threatScores = Object.fromEntries(
      context.threatCategories.map(t => [t.category, t.score])
    );

    // Armed Conflict escalation
    if (threatScores['armed_conflict'] && threatScores['armed_conflict'] > 0.6) {
      actions.push({
        id: 'armed-conflict-logistics-routing',
        timeframe: 'short_term',
        priority: 'high',
        description: `SHORT-TERM: Re-route all logistics through verified safe corridors. Establish armed convoy protocols for any essential deliveries. Implement real-time GPS tracking on all shipments. Require security clearance before movement.`,
        personas: ['corporate_risk_manager', 'humanitarian_operator'],
        estimatedImpact: 'Vehicle hijacking, cargo loss, personnel casualties, supply chain collapse',
        threatCategory: 'armed_conflict',
        specificDetails: {
          target: 'logistics',
          metric: '100% of shipments tracked and routed through secure corridors',
          escalationTrigger: 'Attacks on convoys, roadblocks by military/armed groups'
        }
      });

      actions.push({
        id: 'armed-conflict-facility-hardening',
        timeframe: 'medium_term',
        priority: 'high',
        description: `MEDIUM-TERM: Harden all facilities with ballistic protection (windows, doors, barriers). Establish controlled access points. Deploy perimeter surveillance (cameras, motion sensors). Conduct evacuation drills weekly.`,
        personas: ['corporate_risk_manager', 'humanitarian_operator'],
        estimatedImpact: 'Facility breach, staff casualties, asset destruction, operational compromise',
        threatCategory: 'armed_conflict'
      });
    }

    // Civil Unrest / Protests
    if (threatScores['civil_unrest'] && threatScores['civil_unrest'] > 0.5) {
      actions.push({
        id: 'unrest-mobility-restrictions',
        timeframe: 'short_term',
        priority: 'medium',
        description: `SHORT-TERM: Implement movement restrictions (no staff travel alone, avoid protest areas, night curfew). Establish safe houses near facilities. Deploy advance route scouts. Brief staff on de-escalation protocols.`,
        personas: ['corporate_risk_manager', 'humanitarian_operator', 'government_diplomatic'],
        estimatedImpact: 'Staff assault/kidnapping, operational disruption, loss of institutional knowledge if key staff detained',
        threatCategory: 'civil_unrest'
      });

      actions.push({
        id: 'unrest-community-relations',
        timeframe: 'medium_term',
        priority: 'medium',
        description: `MEDIUM-TERM: Expand community liaison programs. Partner with local NGOs to address grievances. Fund visible local development projects. Establish cultural/religious sensitivity training for all staff.`,
        personas: ['corporate_risk_manager', 'humanitarian_operator'],
        estimatedImpact: 'Facility targeted during unrest, staff seen as illegitimate/oppressive, community opposition to operations',
        threatCategory: 'civil_unrest',
        specificDetails: {
          target: 'community perception',
          metric: 'Positive mentions in local media, community endorsement'
        }
      });
    }

    // Economic Disruption
    if (threatScores['economic_disruption'] && threatScores['economic_disruption'] > 0.5) {
      actions.push({
        id: 'economic-currency-monitoring',
        timeframe: 'monitoring',
        priority: 'medium',
        description: `MONITORING: Track ${context.countryName} exchange rate daily. Set automated alerts at +/-3% and +/-5% thresholds. Monitor central bank policy announcements and forex reserves. Alert CFO if depreciation exceeds 5%.`,
        personas: ['investor_financial', 'corporate_risk_manager'],
        estimatedImpact: 'Sudden currency collapse, inability to repatriate funds, reduced asset valuations',
        threatCategory: 'economic_disruption',
        specificDetails: {
          metric: 'Exchange rate change %',
          escalationTrigger: 'Currency depreciation >5% OR forex reserves <3 months imports'
        }
      });

      actions.push({
        id: 'economic-payment-localization',
        timeframe: 'short_term',
        priority: 'medium',
        description: `SHORT-TERM: Shift payment settlement to local currency for suppliers/staff. Establish local bank accounts to reduce cross-border transfer risk. Diversify banking partners. Identify alternative payment methods (mobile money, barter).`,
        personas: ['corporate_risk_manager', 'investor_financial'],
        estimatedImpact: 'Blocked transfers, capital flight restrictions, inability to pay local obligations',
        threatCategory: 'economic_disruption'
      });
    }

    // Terrorism/Extremism
    if (threatScores['terrorism'] && threatScores['terrorism'] > 0.5) {
      actions.push({
        id: 'terrorism-threat-assessment',
        timeframe: 'immediate',
        priority: 'high',
        description: `IMMEDIATE: Conduct targeted threat assessment focused on [Top actors: ${context.topActors.join(', ')}]. Identify facilities at highest risk. Flag any staff with elevated threat profile. Adjust security protocols for terrorist targeting.`,
        personas: ['corporate_risk_manager', 'government_diplomatic', 'humanitarian_operator'],
        estimatedImpact: 'Unprotected high-value targets, staff casualty events, loss of critical institutional knowledge',
        threatCategory: 'terrorism',
        specificDetails: {
          target: 'facilities and personnel',
          metric: 'Threat assessment completion and security baseline update',
          escalationTrigger: 'Attack claims on social media, targeting statements, intelligence chatter'
        }
      });

      actions.push({
        id: 'terrorism-access-control',
        timeframe: 'short_term',
        priority: 'high',
        description: `SHORT-TERM: Implement multi-factor access control (badges, biometric, PIN). Conduct staff vetting against terrorist watchlists. Deploy counter-surveillance measures. Brief staff on suspicious activity reporting.`,
        personas: ['corporate_risk_manager', 'government_diplomatic'],
        estimatedImpact: 'Insider threat exploitation, facility penetration, coordinated attack execution',
        threatCategory: 'terrorism'
      });
    }

    return actions;
  },

  // MONITORING RULES (Dormant/Stable Conditions)
  monitoringActions: (context: RiskContext): ActionItem[] => {
    const actions: ActionItem[] = [];

    if (context.warningLevel <= 2 && context.conflictPhase === 'dormant') {
      actions.push({
        id: 'baseline-monitoring',
        timeframe: 'monitoring',
        priority: 'low',
        description: `MONITORING: Maintain weekly risk briefings. Track ConflictRadar early warning indicators. Document baseline security posture. Conduct quarterly contingency plan reviews.`,
        personas: ['corporate_risk_manager', 'humanitarian_operator', 'government_diplomatic', 'investor_financial'],
        estimatedImpact: 'Missed early warning signals, outdated contingency plans',
        threatCategory: 'strategic_intelligence'
      });
    }

    return actions;
  },

  // TREND-BASED ACTIONS
  trendActions: (context: RiskContext): ActionItem[] => {
    const actions: ActionItem[] = [];

    if (context.trendDirection === 'deteriorating' && context.warningLevel >= 2) {
      actions.push({
        id: 'escalation-watch-high-alert',
        timeframe: 'short_term',
        priority: 'high',
        description: `SHORT-TERM: Escalate monitoring to daily briefings. Identify specific escalation triggers that would mandate evacuation. Pre-position exit assets and standby personnel. Establish protocol for rapid response escalation.`,
        personas: ['corporate_risk_manager', 'humanitarian_operator', 'government_diplomatic'],
        estimatedImpact: 'Missed escalation window, delayed evacuation, loss of strategic advantage',
        threatCategory: 'escalation_dynamics'
      });
    }

    if (context.trendDirection === 'improving' && context.warningLevel <= 2) {
      actions.push({
        id: 'normalization-phased-reengagement',
        timeframe: 'medium_term',
        priority: 'medium',
        description: `MEDIUM-TERM: Develop phased re-engagement plan with clear decision gates. Phase 1: Restore advisory operations. Phase 2: Selective essential personnel return. Phase 3: Full operations resume. Each phase requires 48hr stability check.`,
        personas: ['corporate_risk_manager', 'investor_financial'],
        estimatedImpact: 'Premature re-engagement into residual risk, sunk costs on emergency measures',
        threatCategory: 'operational_recovery'
      });
    }

    return actions;
  }
};

// ============================================================================
// MAIN FUNCTION: Generate Prescriptive Report
// ============================================================================

export function generatePrescriptiveActions(context: RiskContext): PrescriptiveReport {
  // Collect all actions from rule engine
  const allActions: ActionItem[] = [
    ...ACTION_RULES.crisisActions(context),
    ...ACTION_RULES.escalationActions(context),
    ...ACTION_RULES.emergingActions(context),
    ...ACTION_RULES.threatSpecificActions(context),
    ...ACTION_RULES.monitoringActions(context),
    ...ACTION_RULES.trendActions(context)
  ];

  // Deduplicate by ID and sort by priority
  const uniqueActions = Array.from(
    new Map(allActions.map(a => [a.id, a])).values()
  ).sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Generate persona breakdown
  const personas: UserPersona[] = [
    'corporate_risk_manager',
    'humanitarian_operator',
    'government_diplomatic',
    'investor_financial'
  ];

  const personaBreakdown = personas.map(persona => {
    const personaActions = uniqueActions.filter(a => a.personas.includes(persona));
    return {
      persona,
      actionCount: personaActions.length,
      criticalCount: personaActions.filter(a => a.priority === 'critical').length,
      focusAreas: Array.from(
        new Set(personaActions.map(a => a.threatCategory))
      ).slice(0, 3)
    };
  });

  // Generate monitoring priorities based on top threats
  const monitoringPriorities = generateMonitoringPriorities(context);

  // Project risk trajectory
  const riskTrajectory = projectRiskTrajectory(context);

  return {
    countryCode: context.countryCode,
    countryName: context.countryName,
    reportDate: new Date().toISOString().split('T')[0] ?? new Date().toISOString(),
    riskSummary: {
      warningLevel: context.warningLevel,
      conflictPhase: context.conflictPhase,
      trend: context.trendDirection,
      keyRiskFactors: identifyKeyRiskFactors(context)
    },
    actions: uniqueActions,
    personaBreakdown,
    monitoringPriorities,
    riskTrajectory
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function identifyKeyRiskFactors(context: RiskContext): string[] {
  const factors: string[] = [];

  // Top threat categories
  const topThreats = context.threatCategories
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  factors.push(...topThreats.map(t => t.category));

  // Phase-specific factors
  if (context.conflictPhase === 'crisis') {
    factors.push('active_crisis_phase');
  }
  if (context.conflictPhase === 'escalation') {
    factors.push('rapid_escalation');
  }

  // Trend indicators
  if (context.trendDirection === 'deteriorating') {
    factors.push('deteriorating_conditions');
  }

  // Activity level
  if (context.eventCount30d > 50) {
    factors.push('high_event_frequency');
  }
  if (context.casualtyEstimate30d > 100) {
    factors.push('significant_casualties');
  }

  // Actor diversity
  if (context.topActors.length >= 3) {
    factors.push('multiple_armed_actors');
  }

  return factors.slice(0, 5);
}

function generateMonitoringPriorities(context: RiskContext): PrescriptiveReport['monitoringPriorities'] {
  const priorities: PrescriptiveReport['monitoringPriorities'] = [];

  // Armed conflict monitoring
  if (context.threatCategories.some(t => t.category === 'armed_conflict' && t.score > 0.5)) {
    priorities.push({
      metric: 'Armed group activity (incidents/week)',
      threshold: '>3 incidents OR within 50km of key facilities',
      checkFrequency: 'Daily',
      escalationCondition: 'Exceeds threshold → escalate to IMMEDIATE timeframe'
    });
  }

  // Casualty trends
  if (context.casualtyEstimate30d > 50) {
    priorities.push({
      metric: 'Estimated 30-day casualty rate',
      threshold: '>20% increase from prior period',
      checkFrequency: 'Every 3 days',
      escalationCondition: 'Exceeds threshold → elevate warning level'
    });
  }

  // Currency volatility
  if (context.threatCategories.some(t => t.category === 'economic_disruption' && t.score > 0.4)) {
    priorities.push({
      metric: `${context.countryCode} exchange rate volatility`,
      threshold: '+/-3% daily OR +/-10% weekly',
      checkFrequency: 'Daily (market hours)',
      escalationCondition: 'Exceeds threshold → review hedging strategy'
    });
  }

  // Event frequency
  if (context.eventCount30d > 30) {
    priorities.push({
      metric: 'Conflict events (incidents/day average)',
      threshold: '>2 events/day OR clustering in geographic area',
      checkFrequency: 'Every 12 hours',
      escalationCondition: 'Exceeds threshold OR geographic concentration → escalate to short-term actions'
    });
  }

  // Civil unrest
  if (context.threatCategories.some(t => t.category === 'civil_unrest' && t.score > 0.4)) {
    priorities.push({
      metric: 'Protest/demonstration frequency',
      threshold: 'Daily protests OR >5,000 participants',
      checkFrequency: 'Twice daily',
      escalationCondition: 'Exceeds threshold → implement movement restrictions'
    });
  }

  return priorities.slice(0, 5);
}

function projectRiskTrajectory(context: RiskContext): PrescriptiveReport['riskTrajectory'] {
  let projectedIn7Days = context.trendDirection === 'improving' ? 'improve' :
                        context.trendDirection === 'deteriorating' ? 'worsen' : 'stable';

  let projectedIn30Days = context.trendDirection === 'improving' ? 'improve' :
                         context.trendDirection === 'deteriorating' ? 'worsen' : 'stable';

  // Adjust based on phase
  if (context.conflictPhase === 'escalation') {
    projectedIn7Days = 'worsen';
  }
  if (context.conflictPhase === 'de-escalation') {
    projectedIn30Days = 'improve';
  }

  const confidence = context.eventCount30d > 30 ? 'high' :
                    context.eventCount30d > 10 ? 'medium' : 'low';

  return {
    current: context.warningLevel,
    projectedIn7Days,
    projectedIn30Days,
    confidenceLevel: confidence as 'high' | 'medium' | 'low'
  };
}

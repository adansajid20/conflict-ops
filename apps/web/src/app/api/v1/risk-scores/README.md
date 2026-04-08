# Risk Scoring API

Explainable risk scoring endpoints for country and regional conflict risk assessment.

## Endpoints

### GET `/api/v1/risk-scores/explain`

Returns a detailed risk score (0-100) with 6 indicators, letter grade, and human-readable reasoning.

#### Query Parameters

- `country_code` (string, required if region not provided): 2-letter ISO country code (e.g., `SY` for Syria)
- `region` (string, required if country_code not provided): Regional name (e.g., `Aleppo`)

#### Response

```json
{
  "success": true,
  "data": {
    "country_code": "SY",
    "overall_risk_score": 82.3,
    "risk_grade": "B",
    "conflict_intensity": {
      "name": "Conflict Intensity",
      "score": 78,
      "reasoning": "Conflict intensity is HIGH (78/100) because there were 342 events in the last 30 days, 23% classified as critical or high severity, up from 198 events in the prior period. Trend is upward (+72%).",
      "trend": "up",
      "trendPercent": 72
    },
    "civilian_impact": {
      "name": "Civilian Impact",
      "score": 85,
      "reasoning": "Civilian impact is SEVERE (85/100) due to 12 humanitarian events and an estimated 427 casualties in the current period, compared to 156 prior. The casualty toll indicates significant human suffering.",
      "trend": "up",
      "trendPercent": 174
    },
    "geographic_spread": {
      "name": "Geographic Spread",
      "score": 72,
      "reasoning": "Geographic spread is WIDESPREAD (72/100) with conflict affecting 16 distinct regions over the 30-day period. The wide geographic diffusion indicates systemic instability rather than localized conflict.",
      "trend": "stable",
      "trendPercent": 0
    },
    "escalation_trajectory": {
      "name": "Escalation Trajectory",
      "score": 68,
      "reasoning": "Escalation trajectory is CONCERNING (68/100). 8 events have explicit escalation indicators, 2% of all events. 45% of events are high severity or above, compared to 28% in the prior period. This suggests deteriorating conditions and rising risks.",
      "trend": "up",
      "trendPercent": 28
    },
    "actor_fragmentation": {
      "name": "Actor Fragmentation",
      "score": 91,
      "reasoning": "Actor fragmentation is HIGHLY FRAGMENTED (91/100) with 14 distinct actor groups identified. High actor fragmentation makes conflict resolution significantly more difficult and increases unpredictability.",
      "trend": "stable",
      "trendPercent": 0
    },
    "international_attention": {
      "name": "International Attention",
      "score": 88,
      "reasoning": "International attention is HIGH (88/100). The average significance score across 342 events is 76/100. 203 events have high significance scores (>70). The high event volume suggests sustained international media coverage.",
      "trend": "stable",
      "trendPercent": 0
    },
    "reasoning": "Overall risk score is 82/100 (Grade: B). High conflict intensity combined with severe civilian impact and deteriorating escalation trajectory indicate a generally stable situation with multiple risk factors. Geographic spread across 16 regions and 14 distinct actors shape the operational landscape.",
    "data_quality": {
      "event_count_analyzed": 540,
      "event_count_current_period": 342,
      "event_count_prior_period": 198,
      "date_range_start": "2026-03-09",
      "date_range_end": "2026-04-08",
      "confidence_level": "high"
    },
    "last_updated": "2026-04-08T16:42:00.000Z",
    "methodology_version": "CR-RSM-v1.0"
  }
}
```

#### Error Cases

- Missing both `country_code` and `region`: Returns 400 Bad Request
- Database error: Returns 500 Internal Server Error

#### Calculation Notes

- **Conflict Intensity**: Weighted event frequency (severity 1=0.5x, 5=4x)
- **Civilian Impact**: Humanitarian events (0-40 pts) + casualty estimates (0-60 pts)
- **Geographic Spread**: Distinct regions affected (0-5 regions=0-20, 5-20=20-80, 20+=80-100)
- **Escalation Trajectory**: Escalation indicators + high-severity trend vs prior 30 days
- **Actor Fragmentation**: Distinct actor groups (0-2=0-20, 3-5=20-50, 6-10=50-80, 10+=80-100)
- **International Attention**: Average significance_score (0-60) + event density (0-40)
- **Overall Score**: Simple average of 6 indicators
- **Risk Grade**: A (90-100) → F (0-49)

---

### GET `/api/v1/risk-scores/methodology`

Returns full methodology documentation for transparency and validation.

#### Response

Returns a comprehensive JSON object including:

- **Principles**: Core transparency, explainability, data-driven, comparative, dynamic, context-aware
- **Indicators**: Detailed documentation for each of 6 indicators including:
  - Definition
  - Calculation steps
  - Interpretation thresholds
  - Example calculations
  - Data sources
  - Limitations
- **Overall Score Calculation**: Formula, result range, grade mapping
- **Data Quality**: Confidence levels, date ranges, event count notes
- **Limitations**: Known issues with data completeness, casualty estimates, actor attribution, etc.
- **Use Cases**: Typical applications
- **Future Enhancements**: Planned improvements
- **Contact**: Methodology version and update information

#### Example Usage

```bash
# Get Syria risk score
curl "https://api.conflictradar.io/api/v1/risk-scores/explain?country_code=SY"

# Get Aleppo region risk score
curl "https://api.conflictradar.io/api/v1/risk-scores/explain?region=Aleppo"

# Get methodology documentation
curl "https://api.conflictradar.io/api/v1/risk-scores/methodology"
```

---

## Methodology Overview

The ConflictRadar Risk Scoring Model (CR-RSM v1.0) implements a 6-indicator framework inspired by ACLED methodology:

1. **Conflict Intensity** (16.7%): Event frequency and severity
2. **Civilian Impact** (16.7%): Humanitarian events and casualty estimates
3. **Geographic Spread** (16.7%): Regional diffusion of conflict
4. **Escalation Trajectory** (16.7%): Deterioration vs improvement trend
5. **Actor Fragmentation** (16.7%): Number of distinct groups involved
6. **International Attention** (16.7%): Media coverage and significance

Each indicator is scored 0-100 and equally weighted. The final score (0-100) is converted to a letter grade (A-F).

---

## Data Quality and Confidence

- **High Confidence**: 20+ events in the period
- **Medium Confidence**: 5-19 events
- **Low Confidence**: 0-4 events

Scores for countries/regions with <5 events per period should be interpreted with caution due to high variance.

---

## Implementation Details

- **Time Windows**: Current period (last 30 days) vs Prior period (30-60 days ago)
- **Trend Calculation**: Percentage change between periods; >10% = up, <-10% = down
- **Severity Weighting**: low=0.5x, medium=1x, high=2x, critical=3x, catastrophic=4x
- **Casualty Scoring**: 1 casualty = 0.2 points; 300+ = max 60 points
- **Normalization**: All indicators scaled to 0-100 for comparability

---

## Limitations

- **Data Completeness**: Some regions have lower reporting density
- **Severity Attribution**: Assigned at ingest; may not reflect ground truth
- **Casualty Estimates**: Often preliminary or incomplete; change as verified
- **Actor Attribution**: Depends on source reporting; misattribution possible
- **Time Lag**: Events published with hours-to-days delay
- **Geographic Boundaries**: Administrative regions may not reflect operational areas
- **Escalation Indicators**: Missing flags assumed to indicate stability

---

## Updates and Versioning

- **Current Version**: CR-RSM-v1.0
- **Last Updated**: 2026-04-08
- **Update Frequency**: Quarterly methodology review
- **Feedback**: methodology@conflictradar.io

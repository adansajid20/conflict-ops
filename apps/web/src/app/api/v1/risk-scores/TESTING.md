# Risk Scoring API Testing Guide

## Quick Start Testing

### 1. Methodology Endpoint (No Parameters Required)

```bash
curl http://localhost:3000/api/v1/risk-scores/methodology

# Expected: 200 OK with detailed methodology JSON
# Response includes: principles, indicators, formulas, limitations
```

### 2. Test with Country Code

```bash
# Test with a country known to have conflict events
curl "http://localhost:3000/api/v1/risk-scores/explain?country_code=SY"

# Expected: 200 OK with risk score 0-100, grade A-F, 6 indicators
```

### 3. Test with Region

```bash
curl "http://localhost:3000/api/v1/risk-scores/explain?region=Aleppo"

# Expected: 200 OK with risk data filtered by region
```

### 4. Test Error Handling

```bash
# Missing both country_code and region
curl "http://localhost:3000/api/v1/risk-scores/explain"

# Expected: 400 Bad Request
# Response: { "success": false, "error": "Either country_code or region query parameter is required" }
```

## Expected Responses by Scenario

### High-Risk Country (e.g., Syria - SY)

Expected response structure:
```json
{
  "success": true,
  "data": {
    "country_code": "SY",
    "overall_risk_score": 75.5,
    "risk_grade": "C",
    "conflict_intensity": {
      "score": 85,
      "trend": "up",
      "reasoning": "... detailed explanation ..."
    },
    "civilian_impact": {
      "score": 90,
      "trend": "up"
    },
    "geographic_spread": {
      "score": 70,
      "trend": "stable"
    },
    "escalation_trajectory": {
      "score": 75,
      "trend": "up"
    },
    "actor_fragmentation": {
      "score": 95,
      "trend": "stable"
    },
    "international_attention": {
      "score": 85,
      "trend": "stable"
    },
    "reasoning": "Overall risk score is 83.5/100 (Grade: B). High conflict intensity...",
    "data_quality": {
      "event_count_analyzed": 450,
      "event_count_current_period": 250,
      "event_count_prior_period": 200,
      "date_range_start": "2026-03-09",
      "date_range_end": "2026-04-08",
      "confidence_level": "high"
    },
    "last_updated": "2026-04-08T16:42:00.000Z",
    "methodology_version": "CR-RSM-v1.0"
  }
}
```

### Low-Risk Country (e.g., Canada - CA)

Expected response:
- overall_risk_score: 10-30
- risk_grade: A or B
- Most indicators: 5-25 score range
- confidence_level: "high" (if sufficient data) or "low" (if sparse)

### Zero-Event Country

Expected response:
- overall_risk_score: 0
- risk_grade: A (very safe)
- All indicators: 0 score
- confidence_level: "low"
- reasoning: "No conflict events recorded in the period"

## Validation Checklist

### Data Quality Tests

- [ ] Event counts are cumulative (current + prior in total)
- [ ] Date ranges are exactly 60 days apart (30 current + 30 prior)
- [ ] Confidence levels match event counts (high=20+, medium=5-19, low=0-4)
- [ ] Overall risk score is mean of 6 indicators

### Calculation Accuracy Tests

#### Conflict Intensity
- [ ] Severity 1 events contribute 0.5x weight
- [ ] Severity 5 events contribute 4x weight
- [ ] Sum is normalized to 0-100 range
- [ ] Critical/high percentage is correctly calculated

#### Civilian Impact
- [ ] Humanitarian events capped at 40 points (max 20 events × 2)
- [ ] Casualty estimates: 300 casualties = 60 points, 1 = 0.2
- [ ] Total never exceeds 100

#### Geographic Spread
- [ ] 1-5 regions = 0-20 point range
- [ ] 6-20 regions = 20-80 point range
- [ ] 20+ regions = 80-100 point range
- [ ] Score increases monotonically with region count

#### Escalation Trajectory
- [ ] Escalation indicators: each event = 5 points, capped at 40
- [ ] High-severity %: multiplied by 0.6, capped at 60
- [ ] Trend calculation: >15% change = "up", <-15% = "down"
- [ ] Prior period comparison is accurate

#### Actor Fragmentation
- [ ] 0-2 actors = 0-20 points
- [ ] 3-5 actors = 20-50 points
- [ ] 6-10 actors = 50-80 points
- [ ] 10+ actors = 80-100 points

#### International Attention
- [ ] Average significance_score / 100 × 60 = first component
- [ ] Density: log(event_count) / log(50) × 40 = second component
- [ ] Sum capped at 100

### Trend Detection Tests

- [ ] Trends correctly identify up/down/stable
- [ ] Threshold: >10% = up, <-10% = down
- [ ] trendPercent is accurate to nearest whole percent

### Reasoning Text Tests

- [ ] Each indicator has a complete English sentence explaining the score
- [ ] Executive summary references all 6 indicators
- [ ] Grade interpretation is correct (A="very stable", F="critical")
- [ ] No grammatical errors or incomplete sentences

## Load Testing

### Single Request Timing

```bash
time curl "http://localhost:3000/api/v1/risk-scores/explain?country_code=SY"

# Expected: <500ms for typical country with 100-500 events
# Expected: <100ms for countries with <10 events
```

### Parallel Requests

```bash
for cc in SY UY KE ET MW; do
  curl "http://localhost:3000/api/v1/risk-scores/explain?country_code=$cc" &
done
wait

# Expected: All requests complete successfully
# No timeout or connection errors
```

## Edge Cases to Test

### 1. Country with Exactly 0 Events

```bash
curl "http://localhost:3000/api/v1/risk-scores/explain?country_code=XX"
```

Expected:
- All indicators = 0
- confidence_level = "low"
- overall_risk_score = 0
- risk_grade = "A"

### 2. Country with Exactly 5 Events

Expected:
- confidence_level = "medium"
- Event counts = 5 current, 0 prior (or similar)

### 3. Country with 19 Events

Expected:
- confidence_level = "medium"

### 4. Country with 20+ Events

Expected:
- confidence_level = "high"

### 5. Mixed Severity Events

Test with events spanning all severity levels (1-5) to verify weighting.

### 6. High Casualty Estimates

Test with events totaling 500+ casualties to verify casualty_score capping.

### 7. Many Actor Groups

Test with events from 15+ distinct actors to verify actor_fragmentation scoring.

### 8. Geographic Concentration

Test with all events in same region vs. spread across 30+ regions.

## Integration Tests

### With Existing Event API

```bash
# Query events for a country
curl "http://localhost:3000/api/v1/events?country=SY&limit=100"

# Then query risk scores for same country
curl "http://localhost:3000/api/v1/risk-scores/explain?country_code=SY"

# Verify: event_count_current_period matches or is subset of events returned
```

### Methodology Consistency

```bash
curl "http://localhost:3000/api/v1/risk-scores/methodology" | jq '.data.indicators[0].calculation'

# Verify: Calculations in explain endpoint match methodology documentation
```

## Performance Benchmarks

| Scenario | Target Time | Actual Time |
|----------|------------|------------|
| High-activity country (500+ events) | <500ms | |
| Low-activity country (10-50 events) | <200ms | |
| Zero-event country | <100ms | |
| Methodology endpoint | <50ms | |
| 10 parallel requests | <2s | |

## Regression Tests

If calculations change, verify against these known values:

- Syria (SY) during Q1 2026: Expected risk_grade between B-E
- Myanmar (MM) during Q1 2026: Expected risk_grade between C-E
- Canada (CA): Expected risk_grade A-B
- Yemen (YE) if high activity: Expected risk_grade D-F

## Debugging Tips

### High Score Unexpected?

1. Check event_count_current_period - is it actually high?
2. Check severity distribution - many critical events?
3. Check casualty_estimate sum - any very high values?
4. Check actor_ids array length - fragmented situation?

### Low Score Unexpected?

1. Check if country has events at all
2. Check date range - events outside 60-day window?
3. Check status field - clustered/archived events excluded?

### Trend Wrong?

1. Verify prior_period event count
2. Calculate: (current - prior) / prior × 100
3. Check threshold: >10% for "up", <-10% for "down"

### Wrong Grade?

1. Calculate: (CI + CX + GS + ET + AF + IA) / 6
2. Round to 1 decimal
3. Check mapping: 90-100=A, 80-89=B, etc.

## Test Data Requirements

For complete testing, ensure the test database has:

- At least 3 high-conflict countries with 100+ events each
- At least 3 low-conflict countries with <10 events each
- Events spanning all severity levels (1-5)
- Events with casualty estimates ranging 0-500+
- Events from 5-15 distinct actors
- Events spread across 5-30 distinct regions
- Events with escalation_indicator flags
- Events with significance_score values 0-100
- Mix of humanitarian and non-humanitarian events
- Data covering last 90 days

## Continuous Integration

Suggested CI test workflow:

```yaml
test:
  stage: test
  script:
    - npm run test:risk-scores
    - curl -f http://localhost:3000/api/v1/risk-scores/methodology
    - curl -f http://localhost:3000/api/v1/risk-scores/explain?country_code=SY
    - npm run test:risk-scores:calculations
    - npm run test:risk-scores:load
```

## Support and Issues

If tests fail:

1. Check database connectivity and event table schema
2. Verify event data is recent (within 90 days)
3. Check for NULL values in severity, region, country_code fields
4. Ensure actor_ids are properly stored as arrays
5. Verify casualty_estimate is numeric type
6. Check that country_code values are exactly 2 characters

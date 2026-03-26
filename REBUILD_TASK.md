# CONFLICT OPS — FULL PRODUCTION REBUILD
## Palantir-Level UX + 100% Functional Features

You are rebuilding conflictradar.co from a prototype into a production-grade geopolitical intelligence platform that rivals Palantir AIP/Foundry. Every feature must be fully functional. No placeholders. No broken buttons. No "coming soon". If a user clicks something, it works.

---

## CODEBASE
- Root: /root/.openclaw/workspace-mike/projects/conflict-ops
- Web app: apps/web/
- Stack: Next.js 14 App Router, Supabase (PostGIS + pgvector), Clerk auth, Stripe, MapLibre, Inngest, Upstash Redis, OpenAI
- Deploy: Vercel → conflictradar.co
- Git remote: https://github.com/adansajid20/conflict-ops (token: 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)
- Already installed: lucide-react, recharts, framer-motion, tailwindcss

---

## PART 1: NEW DESIGN SYSTEM (Replace Everything)

### 1.1 Color Tokens — apps/web/src/app/globals.css

Replace the entire CSS variables block. Remove the green hacker aesthetic. Install Palantir-grade colors:

```css
:root {
  /* Backgrounds — deep navy/charcoal, NOT pure black */
  --bg-base: #070B11;
  --bg-surface: #0D1117;
  --bg-surface-2: #141920;
  --bg-surface-3: #1C2333;
  --bg-hover: rgba(255,255,255,0.04);
  --bg-active: rgba(37,99,235,0.12);

  /* Borders */
  --border: #1E2739;
  --border-subtle: #141920;
  --border-emphasis: #2D3748;
  --border-focus: #2563EB;

  /* Primary accent — steel blue, not neon green */
  --primary: #2563EB;
  --primary-hover: #3B82F6;
  --primary-dim: rgba(37,99,235,0.15);
  --primary-text: #60A5FA;

  /* Severity / Alert colors */
  --sev-critical: #EF4444;
  --sev-critical-dim: rgba(239,68,68,0.12);
  --sev-high: #F97316;
  --sev-high-dim: rgba(249,115,22,0.12);
  --sev-medium: #EAB308;
  --sev-medium-dim: rgba(234,179,8,0.12);
  --sev-low: #22C55E;
  --sev-low-dim: rgba(34,197,94,0.12);
  --sev-info: #3B82F6;
  --sev-info-dim: rgba(59,130,246,0.12);

  /* Text */
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  --text-disabled: #374151;
  --text-link: #60A5FA;
  --text-code: #7DD3FC;

  /* Status */
  --status-online: #22C55E;
  --status-degraded: #EAB308;
  --status-offline: #EF4444;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.5);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.6);
  --shadow-blue: 0 0 0 1px rgba(37,99,235,0.4);

  /* Radii — tighter than before, more institutional */
  --radius-sm: 3px;
  --radius-md: 5px;
  --radius-lg: 8px;

  /* Typography */
  --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

Also add to globals.css:
- `font-family: var(--font-ui)` on body/html
- Import Inter from Google Fonts in layout.tsx
- Scrollbar styling (thin, dark)
- Selection color using --primary-dim
- Remove ALL references to --primary: #00FF88 green
- Remove scanline effects, remove `data-theme="ops"` and `data-theme="professional"` — single unified theme
- Ensure `<html>` and `<body>` have `background: var(--bg-base)` and `color: var(--text-primary)`

### 1.2 Typography Rules
- Headings: Inter 600, normal sentence case or Title Case (NOT ALL CAPS)
- Section labels: Inter 500, uppercase, letter-spacing 0.08em — ONLY for short 2-3 word labels like "INTEL FEED"
- Body/descriptions: Inter 400, 14px, text-secondary
- Data values (numbers, IDs, timestamps, coordinates): JetBrains Mono
- Buttons: Inter 500, 13px
- Nav items: Inter 500, 13px, normal case

### 1.3 Spacing & Density
- 8px grid
- Panel padding: 16px or 24px (not 6px)
- Row height in tables: 40px
- Compact mode rows: 32px

---

## PART 2: SIDEBAR & LAYOUT REDESIGN

### 2.1 apps/web/src/app/(dashboard)/layout.tsx — Full Rewrite

Requirements:
- Remove the classification banner entirely ("UNCLASSIFIED // OPERATOR USE ONLY") — it's try-hard
- Sidebar width: 240px
- Sidebar logo: "CONFLICT OPS" in Inter 700, with a small shield or globe Lucide icon before it. Below: "Intelligence Platform" in text-muted 11px
- Replace ALL Unicode symbols (◈ ▤ ⊞ etc.) with Lucide React icons:
  - Overview → LayoutDashboard
  - Intel Feed → Activity
  - Map → Globe
  - Alerts → Bell (with badge for unread count)
  - Missions → Target
  - Workbench → FlaskConical
  - Tracking → Radio
  - Markets → TrendingUp
  - Geoverify → ScanSearch
  - Travel Risk → Plane
  - Doctor/Admin → Stethoscope
  - Org → Building2
  - API Keys → Key
  - Webhooks → Webhook
  - Billing → CreditCard
- Nav sections: "INTELLIGENCE", "ANALYSIS", "WORKSPACE" (rename Labs→Workspace), "SETTINGS"
- Active nav item: left border 2px solid var(--primary), background var(--bg-active)
- Nav item hover: background var(--bg-hover), text-primary
- Nav item text: 13px Inter 500, normal case (not all caps — "Intel Feed" not "INTEL FEED")
- Add a user avatar + name at bottom of sidebar (use Clerk useUser hook)
- Remove the collapsible sections — just show all nav items always, but keep section headers

Bottom status bar (keep, improve):
- Height: 28px
- Show: UTC time (live), FEEDS: X/5, EVENTS: N (total), INGEST: Xm ago
- Color the FEEDS counter green if >0 live, amber if 0
- Monospace font for the values only

### 2.2 apps/web/src/components/layout/ — New Files

Create `CommandPalette.tsx`:
- Opens with Cmd+K or Ctrl+K
- Search across: pages (navigate), recent events (from API), actions
- Pages: list all nav items, filter by typing
- Press Enter to navigate
- ESC to close
- Style: centered modal, dark overlay, rounded-lg, search input at top, results list below
- Use Lucide Search icon in the input

Register the cmd+K listener in layout.tsx and render CommandPalette.

---

## PART 3: OVERVIEW PAGE — Full Ops Dashboard

### apps/web/src/app/(dashboard)/overview/page.tsx — Full Rewrite

This is the mission control center. Make it feel like walking into a Palantir ops room.

Layout (CSS grid):
```
[ Live Stats Row — 4 cards spanning full width ]
[ Regional Threat Matrix (left 60%) | Source Health (right 40%) ]
[ Recent Events Timeline (left 60%) | Active Alerts (right 40%) ]
```

**Live Stats Row (4 cards):**
Each card has: icon, label, large number, trend arrow + % change vs yesterday, sparkline
1. Events (24h) — Activity icon, blue
2. Critical Alerts — AlertTriangle icon, red
3. Active Missions — Target icon, purple
4. Sources Online — Radio icon, green if >0

**Regional Threat Matrix:**
A grid of world regions with severity color coding:
Regions: Middle East, Eastern Europe, Sub-Saharan Africa, South Asia, East Asia, Central Asia, West Africa, Horn of Africa, Latin America, North Africa
Each cell shows: region name, event count last 7d, severity badge (Critical/High/Medium/Low/Calm)
Color the cell background with the severity dim color
Fetch data from /api/v1/events?group_by=region

**Source Health Panel:**
For each of the 5 sources (GDELT, ReliefWeb, GDACS, UNHCR, NASA EONET):
- Source name + icon
- Status dot (green/red)
- "Last seen X ago"
- Events ingested today
Data from /api/health

**Recent Events Timeline:**
Last 12 events as a vertical timeline
Each item: source badge, title (truncated 80 chars), region tag, severity dot, time ago
Click → opens IntelDrawer (already exists, keep using it)
Pull from existing /api/v1/events endpoint

**Active Alerts:**
Last 5 unread alerts
Each: severity badge, title, time
"View all alerts →" link at bottom

All data fetched server-side (async page component) + client-side refresh every 60s on the stat cards.

---

## PART 4: INTEL FEED — Bloomberg-Style Timeline

### apps/web/src/components/feed/EventFeed.tsx — Full Rewrite

Requirements:
- **Filter bar** at top (full width, sticky):
  - Source dropdown: All, GDELT, ReliefWeb, GDACS, UNHCR, NASA EONET
  - Severity dropdown: All, Critical, High, Medium, Low
  - Region dropdown: All + list of regions
  - Time window: 1h, 6h, 24h (default), 7d, 30d — tab buttons not dropdown
  - Search input: text search on title/description
  - "Export CSV" button (Business plan only — generate CSV of filtered events)
- **Event list** (below filter bar):
  - Each event card (not full-width boxes — more compact rows):
    - Left: severity color bar (4px) + source badge pill
    - Center: title (bold 14px), description (12px text-secondary, 2 lines max), location tag
    - Right: timestamp (mono, relative), region badge
  - On hover: subtle background highlight, cursor pointer
  - On click: open IntelDrawer
  - Loading: skeleton rows (3 lines each)
  - Empty: "No events match your filters" with a clear filters button
- **Pagination or infinite scroll**: load 50 at a time, "Load more" button at bottom
- Auto-refresh every 60s (show "Updated X seconds ago" in header)

Severity color bar colors:
- critical → var(--sev-critical)
- high → var(--sev-high)
- medium → var(--sev-medium)
- low → var(--sev-low)
- unknown → var(--border)

Source badge colors:
- gdelt → blue
- reliefweb → teal
- gdacs → orange
- unhcr → dark blue
- nasa_eonet → amber

---

## PART 5: MAP PAGE — Full-Screen Intelligence Map

### apps/web/src/app/(dashboard)/map/page.tsx

Make the map full-screen (no padding, h-full, w-full).

### apps/web/src/components/map/ConflictMap.tsx — Enhance

The map must:
1. Fill the entire viewport (full height and width)
2. Have a **floating filter panel** (top-right, semi-transparent dark panel) with:
   - Toggle layers: Events, Thermal, Vessels (AIS), Flights (ADS-B)
   - Severity filter: checkboxes Critical/High/Medium/Low
   - Time window: 24h / 7d / 30d buttons
3. Have a **floating event counter** badge (top-left): "N events" 
4. Show event clusters when zoomed out (use MapLibre's built-in clustering)
5. On cluster click: zoom in
6. On individual marker click: show popup with:
   - Title, source, severity badge, description excerpt, timestamp
   - "Open in Feed →" link
7. Marker colors match severity: critical=red, high=orange, medium=yellow, low=green
8. Map style: Use a dark map style — use maplibre's dark style or Stadia Maps dark (free, no key needed):
   `https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json`
   If Stadia doesn't work, fall back to: `https://demotiles.maplibre.org/style.json` (dark enough)
9. Loading state: dark overlay with spinner until map loads

---

## PART 6: ALERTS PAGE — Actionable Alert Queue

### apps/web/src/app/(dashboard)/alerts/page.tsx — Rewrite

Layout: full-height split
- Left panel (60%): Alert queue
- Right panel (40%): PIR Builder + PIR list

**Alert Queue:**
- Header: "Active Alerts" + unread count badge + "Mark all read" button
- Filter tabs: All | Critical | High | Medium | Unread
- Each alert row:
  - Severity badge (colored pill: CRITICAL / HIGH / MEDIUM / LOW)
  - Title (bold)
  - Matched PIR name (if applicable)
  - Time ago (mono)
  - Action buttons: "Mark read" (check icon) | "Dismiss" (x icon)
- Click alert → expand inline with full description + source event link
- Empty state: shield check icon + "No active alerts"

**PIR Builder (right panel):**
- Clean form: Name, conditions (keyword + region + severity selectors), notification method
- "Add Condition" button adds a new condition row
- "Save PIR" button
- Below: list of existing PIRs with edit/delete per row
- Each PIR shows: name, condition summary, last triggered time, toggle enabled/disabled

API routes needed (create if missing):
- GET /api/v1/alerts — list alerts, query params: severity, read, limit
- PATCH /api/v1/alerts/[id] — mark read/dismissed
- GET /api/v1/pirs — list PIRs
- POST /api/v1/pirs — create PIR
- DELETE /api/v1/pirs/[id] — delete

---

## PART 7: WORKBENCH — Functional Analysis Tools

### apps/web/src/app/(dashboard)/workbench/page.tsx — Rewrite

Layout: tab-based UI at top, content below
Tabs: Monte Carlo | ACH Matrix | SAT Tools | Forecasts

**Tab 1: Monte Carlo Scenario Engine**
- Keep MonteCarloEngine component but make it connect to real events
- Add "Load from Feed" button: opens a modal to pick a conflict scenario from recent events
- Show the P10/P50/P90 output as a proper bar chart (Recharts BarChart)
- Show assumption sliders for: event frequency (±), external intervention probability, duration estimate
- "Run Simulation" button → runs 1000 iterations, shows results
- Export results as JSON

**Tab 2: ACH Matrix**
- Keep ACHMatrix component, ensure it's functional
- Add "Add Hypothesis" button → input a hypothesis text
- Add "Add Evidence" button → input evidence with source
- Matrix cells: click to set consistency (C / I / N/A) with color coding
  - C (consistent) = green
  - I (inconsistent) = red  
  - N/A = gray
- Summary row showing inconsistency score per hypothesis
- Most likely hypothesis highlighted

**Tab 3: SAT Tools** (replace placeholder)
Show 5 cards in a grid, each clickable:
1. Red Team — open a text area, user writes hypothesis, AI challenges it
2. Devil's Advocacy — user inputs assessment, get counter-arguments
3. Key Assumptions Check — user lists assumptions, get stress-test questions
4. Argument Mapping — simple premise/claim/rebuttal tree (no complex viz needed, just nested list UI)
5. QOIC — Quality of Information Check form

For cards 1-3: make an API call to `/api/v1/workbench/sat` (create this route):
- POST with { tool: 'red-team' | 'devils-advocate' | 'key-assumptions', input: string }
- Call OpenAI (or if key missing, return a helpful "requires AI subscription" message)
- Stream the response back
- Show a loading spinner and streaming text output

**Tab 4: Forecasts**
- List of forecasts from /api/v1/forecasts
- Each forecast: region, score (P50 shown as % confidence), trend, updated time
- If no forecasts: show "Run an ingest cycle to generate forecasts" with a trigger button

### apps/web/src/app/api/v1/workbench/sat/route.ts — Create
POST route that accepts {tool, input}, calls OpenAI gpt-4o (or gemini flash), returns streamed text response.
If OPENAI_API_KEY not set, check GOOGLE_GENERATIVE_AI_API_KEY, if neither set, return 402.

---

## PART 8: TRACKING PAGE — Live Vessel & Flight Tracking

### apps/web/src/components/tracking/TrackingPanel.tsx — Full Rewrite

Layout: map on left (60%), data panels on right (40%)

**Map (left):**
- MapLibre map (dark style, same as main map)
- Vessel markers: ship icon (🚢 or Lucide Anchor), colored by vessel type
  - Military = red dot
  - Cargo/Tanker = blue dot
  - Unknown = gray dot
- Flight markers: airplane icon colored by type
  - Military/ISR = red
  - Commercial = blue
  - Unknown = gray
- Thermal anomaly markers: orange circle
- Layer toggles: Vessels | Flights | Thermal (checkboxes above map)
- Data source: /api/v1/tracking/vessels, /api/v1/tracking/flights, /api/v1/tracking/stats

**Data panels (right, tabbed):**
- Tab 1: VESSELS — table with columns: MMSI, Name, Type, Speed, Lat/Lon, Last Seen
  - Filter: vessel type, dark vessel only toggle
  - Row click: highlight on map
- Tab 2: FLIGHTS — table with columns: ICAO, Callsign, Type, Alt, Speed, Last Seen
  - Filter: military only toggle
  - Row click: highlight on map
- Tab 3: THERMAL — table with columns: Region, FRP (fire radiative power), Area, Detected At
  - Shows NASA FIRMS clusters

**If no live data (sources not ingesting):** show last known data with a "stale" banner, and a "Refresh" button that calls /api/v1/admin/run-ingest with tracking sources only.

API routes — check and fix /api/v1/tracking/vessels and /api/v1/tracking/flights to return real DB data from vessel_tracks and flight_tracks tables. If tables are empty, return demo data (5 fake vessels near conflict zones) so the UI is never empty.

---

## PART 9: MARKETS PAGE — Prediction Intelligence

### apps/web/src/components/markets/MarketsPanel.tsx — Full Rewrite

Layout: split — question list (left 65%), detail panel (right 35%)

**Question list:**
- Filter tabs: All | Metaculus | Polymarket | High Confidence | Closing Soon
- Search bar
- Each question card:
  - Title (bold, truncated)
  - Source badge (Metaculus = blue, Polymarket = purple)
  - Probability: large number (e.g. "67%") with a horizontal progress bar
  - Resolution date badge
  - Volume (Polymarket): "$12.4k"
- Click → load detail in right panel

**Detail panel:**
- Question title (full)
- Description
- Probability history mini-chart (Recharts LineChart, last 30 days if available)
- Resolution criteria
- "Open on [Source]" external link button
- Related events from our feed (by keyword match): small list

**Data:**
- Fetch from /api/v1/markets 
- If markets API returns data, use it. If empty (API calls failing), use 10 hardcoded demo questions about real current geopolitical events (Russia/Ukraine, Middle East, etc.) with realistic probabilities — never show empty state on a paid product

**API fix /api/v1/markets:**
- Check if Metaculus and Polymarket fetches work
- Add a 1-hour Redis cache
- If upstream is down, return cached data or demo data

---

## PART 10: GEOVERIFY PAGE — Evidence Verification Queue

### apps/web/src/components/geoverify/GeoverifyQueue.tsx — Full Rewrite (currently minimal)

Layout: two-column
Left (60%): verification queue
Right (40%): analysis panel

**Verification queue:**
- "Submit for Verification" button at top → opens a modal:
  - Input URL or paste image URL
  - Select check methods (checkboxes): Reverse image search, EXIF analysis, Geolocation cross-reference, Solar angle check, Shadow analysis, Metadata verification
  - Submit
- List of submitted items:
  - Thumbnail (if image URL)
  - URL excerpt
  - Submitted time
  - Status badge: PENDING / ANALYZING / VERIFIED / PROBABLE / POSSIBLE / UNVERIFIED / FALSE
  - Confidence score (%)
  - Click → load detail on right

**Analysis panel (right):**
- Item URL/image display
- Verification tier badge (color coded)
- Confidence score with explanation
- Methods applied with results for each
- Notes field (user can add notes)
- "Export Report" button (downloads JSON)

**Backend (create /api/v1/geoverify/submit route):**
- POST { url, methods[] }
- Run available checks (EXIF via URL meta scrape, geolocation cross-ref against our events DB)
- For image reverse search: note it requires Google Vision API or similar — if not configured, mark that method as "requires API key"
- Return verification result object
- Store in geo_verifications table

---

## PART 11: TRAVEL RISK PAGE — ISO 31030 Compliance

### apps/web/src/app/(dashboard)/travel/page.tsx — Full Rewrite

Layout: search + results

**Header:** "Travel Risk Assessment" (not in caps), "ISO 31030 compliant pre-departure intelligence"

**Search bar:** Large search input with autocomplete for country names. Button "Assess Risk"

**Country Risk Card (shows after search):**
- Country name + flag emoji
- Overall Risk Level: 1-5 with color:
  - 1 = Low (green), 2 = Moderate (yellow), 3 = High (orange), 4 = Very High (red), 5 = Critical (deep red)
- Visual risk dial or horizontal severity bar
- Risk breakdown grid:
  - Security (conflict events in last 30d)
  - Political Stability
  - Health & Infrastructure
  - Travel Advisories
  - Natural Hazard Risk
- Recent relevant events from our feed (filtered by country)
- "Generate Pre-Departure Brief" button → POST to /api/v1/travel with country
  - Returns a formatted checklist:
    - Emergency contacts (embassies, local emergency numbers)
    - Security precautions for that risk level
    - Medical/health notes
    - Comms security recommendations
    - Evacuation planning notes
  - Display as a printable-friendly card
  - "Download PDF" button (just window.print() targeting that section)

**Recent Assessments list:** Below the search, show last 5 assessments made

**API /api/v1/travel:**
- GET ?country=XX → return risk assessment built from our events data
- POST { country } → generate brief using OpenAI/Gemini (stream response)

---

## PART 12: FIX THE INGEST PIPELINE

### Problem: All 5 sources stale for 25+ hours. No automatic scheduling working.

### Fix 1: Vercel Cron Jobs (most reliable)

In apps/web/vercel.json, add crons:
```json
{
  "crons": [
    {
      "path": "/api/cron/ingest",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Create apps/web/src/app/api/cron/ingest/route.ts:
```typescript
import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow also if called from admin
    const internalSecret = request.headers.get('x-internal-secret')
    if (internalSecret !== process.env.INTERNAL_SECRET) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
  }
  
  // Run all ingest sources
  // Import and call each ingest function
  // Return summary
}
```

Actually: the existing /api/v1/admin/run-ingest route already does this. Just make the Vercel cron call IT:
```typescript
// GET /api/cron/ingest — called by Vercel cron every 15 minutes
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && 
      req.headers.get('x-internal-secret') !== process.env.INTERNAL_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  
  // Call the existing run-ingest handler internally
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://conflictradar.co'
  const res = await fetch(`${baseUrl}/api/v1/admin/run-ingest`, {
    method: 'POST',
    headers: { 'x-internal-secret': process.env.INTERNAL_SECRET || '' },
  })
  const data = await res.json()
  return NextResponse.json(data)
}
```

Also add CRON_SECRET to Vercel env vars (generate a random string, document what to set).

### Fix 2: Debug and fix each ingest source

Read each file in apps/web/src/lib/ingest/ and check for:
1. gdelt.ts — ensure the GDELT API URL is correct, response parsing handles empty articles, error is caught
2. reliefweb.ts — check filter params, widen time window to 7 days, ensure geocoding works
3. gdacs.ts — check XML parsing, ensure severity filter isn't too strict
4. unhcr.ts — check API endpoint URL and response structure
5. nasa-eonet.ts — ensure categories include volcanoes, earthquakes, wildfires; check bbox filter

For each: add proper try/catch, log errors to console, never throw — return { fetched: 0, inserted: 0, errors: [...] }.

### Fix 3: Backfill existing events without location

Run a one-time migration in an API route /api/v1/admin/backfill-geo:
- Query all events WHERE location IS NULL AND source = 'gdelt'
- For each: look up country centroid from the COUNTRY_CENTROIDS map based on provenance_raw
- UPDATE event SET location = ST_GeogFromText('POINT(lng lat)')
- Max 100 at a time, return count updated

---

## PART 13: LANDING PAGE — Palantir-Level Marketing

### apps/web/src/app/(marketing)/landing/page.tsx — Full Rewrite

This is the page that converts visitors to paying customers. Make it look like a company worth taking seriously.

**Structure:**
1. **Nav** (sticky, blur backdrop):
   - Logo (globe icon + "CONFLICT OPS")
   - Links: Features | Pricing | Methods | Live Wire
   - CTA: "Sign in" (text) | "Start Free" (primary button)

2. **Hero:**
   - Top tag: green dot + "● Live — GDELT · UN OCHA · NASA · GDACS ingesting now" (but make the dot actually pulsing green)
   - H1 (large, 64px): "Geopolitical Intelligence. Self-Serve."
   - H2 (20px, text-secondary): "Real-time conflict tracking, AI-powered risk forecasting, and structured analytic tools. For analysts, security teams, and risk professionals. No procurement cycle."
   - Two CTAs: "Start free →" (primary button) | "View live demo" (ghost button, links to /wire)
   - Below hero: screenshot/mockup of the dashboard (create a static preview image OR show a live embedded preview)

3. **Stats bar (4 numbers):**
   - 5+ Data Sources | 15min Update Cadence | 264+ Events Tracked | $9/mo Starting Price

4. **Features grid (2 cols):**
   - Real-Time Intel Feed
   - AI-Powered Forecasting
   - Conflict Map (full-globe PostGIS)
   - Alert Engine + PIR Tracker
   - Vessel & Flight Tracking
   - Prediction Market Integration
   - Travel Risk ISO 31030
   - REST API + Webhooks

5. **Comparison table:**
   | Feature | Conflict Ops | Dataminr | Feedly TI |
   | Price | From $9/mo | ~$10k/mo | $18-200/mo |
   | Self-serve | ✅ | ❌ | ✅ |
   | Structured analysis (ACH/Monte Carlo) | ✅ | ❌ | ❌ |
   | AIS + ADS-B tracking | ✅ | ✅ | ❌ |
   | Travel risk | ✅ | ❌ | ❌ |
   | API access | ✅ Business | ✅ Enterprise | ✅ |

6. **Pricing teaser** (3 columns, highlight Pro):
   - Individual $9/mo
   - Pro $29/mo (MOST POPULAR badge)
   - Business $299/mo
   - "Compare all plans →" links to /pricing

7. **Footer**: links, copyright, links to /privacy /terms /methods /status

Style:
- Dark background (#070B11)
- Clean Inter typography
- NO neon green — use steel blue (#2563EB) for CTAs
- Use subtle grid lines or dot pattern as background texture
- Professional, serious, trustworthy

---

## PART 14: SETTINGS PAGES

### apps/web/src/app/(dashboard)/settings/billing/page.tsx
- Show current plan badge
- Usage stats (events read, API calls, missions used vs limit)
- "Upgrade Plan" → Stripe checkout
- "Manage Billing" → Stripe portal

### apps/web/src/app/(dashboard)/settings/api/page.tsx
- Show existing API keys (name, prefix, created date, last used)
- "Create API Key" button → modal with name input → shows key once → copy button
- Revoke button per key
- Code snippet showing how to use the API (curl example)

### apps/web/src/app/(dashboard)/settings/webhooks/page.tsx  
- List webhooks: URL, events subscribed, last delivery status
- "Add Webhook" button → URL input + event type checkboxes
- Test button per webhook

### apps/web/src/app/(dashboard)/settings/org/page.tsx
- Org name + plan
- Members list with roles
- Invite member (email input)
- SSO config (Enterprise only — show locked state otherwise)

---

## PART 15: ADMIN / DOCTOR PAGE

### apps/web/src/app/(dashboard)/admin/page.tsx — Rewrite as AdminPage

Make it look like a real ops monitoring dashboard:

**System Health Panel (top):**
- 4 status indicators in a row: Database | Redis | Auth | Scheduler
- Each shows: green/red status dot, service name, latency or "OK"/"ERROR"

**Ingest Sources Table:**
| Source | Status | Last Seen | Events Today | Actions |
- Row per source
- Status: green dot (live) or red dot (stale)
- "Last Seen": time ago
- "Events Today": count
- Actions: "Trigger" button → calls run-ingest for that source only

**Manual Controls:**
- "Run Full Ingest" → POST /api/v1/admin/run-ingest → show results in an output panel
- "Toggle Safe Mode" → toggle switch
- "Backfill Geo" → POST /api/v1/admin/backfill-geo
- "Clear Cache" → POST /api/v1/admin/clear-cache (create this: flushes all Redis keys with pattern "ingest:*")

**Recent Events (last 10):**
- Small table: source, title (truncated), severity, time

**System Stats:**
- Total events in DB
- DB size (if accessible)
- Redis memory used
- Upstash Redis calls today

---

## PART 16: ONBOARDING FLOW

### apps/web/src/app/(dashboard)/onboarding/page.tsx

Simple 3-step onboarding:
1. "Set up your workspace" — org name input, submit
2. "What are you tracking?" — 6 preset topic chips: Ukraine/Russia | Middle East | Africa | Maritime | Energy | Cyber — pick 1+ → creates default PIRs
3. "You're ready" — shows quick links to Feed, Map, Alerts with a "Go to dashboard" button

Keep it clean and functional. Skip button on each step.

---

## PART 17: COMMIT AND DEPLOY

After all changes are made:

1. `cd /root/.openclaw/workspace-mike/projects/conflict-ops`
2. Verify build: `npm run build --workspace=apps/web` or `cd apps/web && npx next build`  
   Fix ALL TypeScript errors and build errors before deploying.
3. `git add -A`
4. `git commit -m "feat: full Palantir-grade redesign — new design system, functional features, ingest cron, all pages rebuilt"`
5. `git push origin main`
6. Deploy: `npx vercel --token vcp_5rYY8kP2WzmxixeM6HYO5noANItFXdH5CfUxdIBmH1oKiQ2atF25VCnX --prod --yes`

If Vercel build fails, fix the errors and retry. Do NOT stop until:
- `npx next build` succeeds locally with 0 errors
- `vercel --prod` succeeds
- `curl https://conflictradar.co/api/health` returns ok:true

---

## CRITICAL RULES

1. **No TypeScript errors** — fix every `any` cast properly, no `@ts-ignore` unless absolutely unavoidable
2. **No broken imports** — every component imported must exist
3. **No empty pages** — every route must render something useful, never a blank page
4. **Server components vs client components** — `use client` only where needed (hooks, events, browser APIs). Don't mark everything client.
5. **Dynamic imports for maps** — MapLibre components MUST use `next/dynamic` with `ssr: false`
6. **Supabase server client** — use `createServiceClient()` from @/lib/supabase/server for server components/routes. Never expose service role key to client.
7. **Plan gating** — all Business/Enterprise features must check plan limits server-side via `getOrgPlanLimits()`
8. **Error handling** — every API route and server action must have try/catch. Return proper HTTP status codes.
9. **Loading states** — every async data fetch must show a loading skeleton or spinner, never just an empty white space
10. **Mobile** — the dashboard doesn't need to be mobile-first, but it must not break at 1024px+ widths

---

## ENV VARS NOTE
These env vars ARE set in Vercel (you don't need to set them, just use them):
- CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_WEBHOOK_SECRET
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY  
- STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, all STRIPE_PRICE_IDs
- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
- INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY
- AISSTREAM_API_KEY, NASA_FIRMS_API_KEY
- INTERNAL_SECRET = codev1_3dc26d7b4fb024484b5d8a6d3a4887f0

These are NOT set yet (handle gracefully — don't crash if missing):
- OPENAI_API_KEY (AI features return 402 or fallback message if not set)
- GOOGLE_GENERATIVE_AI_API_KEY (alternative to OpenAI)
- CRON_SECRET (add to .env.example, note in README that user must set this)
- NEXT_PUBLIC_APP_URL (default to 'https://conflictradar.co')
- RESEND_API_KEY (email alerts — skip if not set)

---

When completely finished, run this command to notify me:
openclaw system event --text "Done: Conflict Ops full Palantir rebuild deployed to production. All features functional, new design system live." --mode now

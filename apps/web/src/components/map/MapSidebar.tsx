'use client';

import { useState } from 'react';
import Link from 'next/link';

// ═══════════════════════════════════════
// PROPS
// ═══════════════════════════════════════
export interface MapSidebarProps {
  eventCount: number;
  flightCount: number;
  vesselCount: number;
  acledCount: number;
  showEvents: boolean; onToggleEvents: () => void;
  showFlights: boolean; onToggleFlights: () => void;
  showVessels: boolean; onToggleVessels: () => void;
  showISS: boolean; onToggleISS: () => void;
  showACLED: boolean; onToggleACLED: () => void;
  timeWindow: string; onTimeWindowChange: (v: string) => void;
  severity: string; onSeverityChange: (v: string) => void;
  category: string; onCategoryChange: (v: string) => void;
  region: string; onRegionChange: (v: string) => void;
  acledEventType: string; onAcledEventTypeChange: (v: string) => void;
  acledDisorderType: string; onAcledDisorderTypeChange: (v: string) => void;
  acledCountry: string; onAcledCountryChange: (v: string) => void;
  acledRegion: string; onAcledRegionChange: (v: string) => void;
  acledActor: string; onAcledActorChange: (v: string) => void;
  acledFatalities: string; onAcledFatalitiesChange: (v: string) => void;
  acledCivilianOnly: boolean; onAcledCivilianOnlyChange: () => void;
  viewMode: 'globe' | 'map'; onViewModeChange: (v: 'globe' | 'map') => void;
  selectedEvent: Record<string, unknown> | null;
  selectedFlight: Record<string, unknown> | null;
  selectedVessel: Record<string, unknown> | null;
}

// ═══════════════════════════════════════
// TOGGLE SWITCH
// ═══════════════════════════════════════
function Toggle({ on, onChange, color = 'bg-blue-500' }: { on: boolean; onChange: () => void; color?: string }) {
  return (
    <button onClick={onChange}
      className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${on ? color : 'bg-white/[0.08]'}`}
      style={on ? { boxShadow: '0 0 8px rgba(255,255,255,0.08)' } : undefined}>
      <div className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${on ? 'translate-x-[18px]' : ''}`} />
    </button>
  );
}

// ═══════════════════════════════════════
// COLLAPSIBLE SECTION
// ═══════════════════════════════════════
function Section({ title, badge, children, defaultOpen = true, accentColor }: {
  title: string; badge?: string | number; children: React.ReactNode; defaultOpen?: boolean; accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mx-3 mb-2">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition">
        <div className="flex items-center gap-2">
          {accentColor && <span className="w-1 h-3.5 rounded-full" style={{ background: accentColor }} />}
          <span className="text-[10px] font-bold tracking-[0.15em] text-white/40 uppercase">{title}</span>
          {badge !== undefined && (
            <span className="text-[9px] font-semibold bg-white/[0.06] text-white/50 px-1.5 py-0.5 rounded-md min-w-[20px] text-center tabular-nums">
              {badge}
            </span>
          )}
        </div>
        <svg className={`w-3 h-3 text-white/30 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-1 pb-2 pt-1">{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════
// CHEVRON DOWN SVG
// ═══════════════════════════════════════
function ChevronDown() {
  return (
    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ═══════════════════════════════════════
// MAIN SIDEBAR
// ═══════════════════════════════════════
export default function MapSidebar({
  eventCount, flightCount, vesselCount, acledCount,
  showEvents, onToggleEvents,
  showFlights, onToggleFlights,
  showVessels, onToggleVessels,
  showISS, onToggleISS,
  showACLED, onToggleACLED,
  timeWindow, onTimeWindowChange,
  severity, onSeverityChange,
  category, onCategoryChange,
  region, onRegionChange,
  acledEventType, onAcledEventTypeChange,
  acledDisorderType, onAcledDisorderTypeChange,
  acledCountry, onAcledCountryChange,
  acledRegion, onAcledRegionChange,
  acledActor, onAcledActorChange,
  acledFatalities, onAcledFatalitiesChange,
  acledCivilianOnly, onAcledCivilianOnlyChange,
  selectedEvent, selectedFlight, selectedVessel,
}: MapSidebarProps) {

  const activeLayers = [showEvents, showFlights, showVessels, showISS, showACLED].filter(Boolean).length;

  return (
    <div className="w-[300px] flex-shrink-0 h-full flex flex-col bg-[#060A10] border-l border-white/[0.06]">

      {/* ═══ HEADER ═══ */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-bold tracking-wide text-white">Map Controls</h2>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider">Live</span>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl px-3 py-2.5 border transition-colors"
            style={{
              background: showEvents ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.015)',
              borderColor: showEvents ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
            }}>
            <p className="text-[8px] font-semibold uppercase tracking-wider"
              style={{ color: showEvents ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.3)' }}>Events</p>
            <p className="text-[15px] font-bold font-mono mt-0.5"
              style={{ color: showEvents ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>
              {eventCount.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl px-3 py-2.5 border transition-colors"
            style={{
              background: showFlights ? 'rgba(6,182,212,0.06)' : 'rgba(255,255,255,0.015)',
              borderColor: showFlights ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.05)',
            }}>
            <p className="text-[8px] font-semibold uppercase tracking-wider"
              style={{ color: showFlights ? 'rgba(6,182,212,0.7)' : 'rgba(255,255,255,0.3)' }}>Flights</p>
            <p className="text-[15px] font-bold font-mono mt-0.5"
              style={{ color: showFlights ? '#06b6d4' : 'rgba(255,255,255,0.3)' }}>
              {showFlights ? flightCount.toLocaleString() : 'OFF'}
            </p>
          </div>
          <div className="rounded-xl px-3 py-2.5 border transition-colors"
            style={{
              background: showVessels ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.015)',
              borderColor: showVessels ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
            }}>
            <p className="text-[8px] font-semibold uppercase tracking-wider"
              style={{ color: showVessels ? 'rgba(16,185,129,0.7)' : 'rgba(255,255,255,0.3)' }}>Vessels</p>
            <p className="text-[15px] font-bold font-mono mt-0.5"
              style={{ color: showVessels ? '#10b981' : 'rgba(255,255,255,0.3)' }}>
              {showVessels ? vesselCount.toLocaleString() : 'OFF'}
            </p>
          </div>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto cr-scrollbar pt-2">

        {/* ── DATA LAYERS ── */}
        <Section title="Data Layers" badge={activeLayers} accentColor="#3b82f6">
          <div className="flex flex-col gap-1">

            <div className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
              style={showEvents ? { background: 'rgba(239,68,68,0.04)' } : undefined}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(239,68,68,0.12)' }}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"
                    style={showEvents ? { boxShadow: '0 0 8px rgba(239,68,68,0.6)' } : undefined} />
                </div>
                <div>
                  <p className="text-[11px] text-white font-medium">Conflict Events</p>
                  <p className="text-[9px] text-white/40">{eventCount.toLocaleString()} tracked</p>
                </div>
              </div>
              <Toggle on={showEvents} onChange={onToggleEvents} color="bg-red-500" />
            </div>

            <div className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
              style={showFlights ? { background: 'rgba(6,182,212,0.04)' } : undefined}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-sm">✈️</div>
                <div>
                  <p className="text-[11px] text-white font-medium">Live Flights</p>
                  <p className="text-[9px] text-white/40">
                    {showFlights ? <><span className="text-cyan-400 font-medium">{flightCount.toLocaleString()}</span> airborne</> : 'Disabled'}
                  </p>
                </div>
              </div>
              <Toggle on={showFlights} onChange={onToggleFlights} color="bg-cyan-500" />
            </div>

            <div className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
              style={showVessels ? { background: 'rgba(16,185,129,0.04)' } : undefined}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-sm">🚢</div>
                <div>
                  <p className="text-[11px] text-white font-medium">Vessel Tracking</p>
                  <p className="text-[9px] text-white/40">
                    {showVessels ? <><span className="text-emerald-400 font-medium">{vesselCount.toLocaleString()}</span> tracked</> : 'Disabled'}
                  </p>
                </div>
              </div>
              <Toggle on={showVessels} onChange={onToggleVessels} color="bg-emerald-500" />
            </div>

            <div className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
              style={showISS ? { background: 'rgba(139,92,246,0.04)' } : undefined}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-sm">🛰️</div>
                <div>
                  <p className="text-[11px] text-white font-medium">ISS Tracker</p>
                  <p className="text-[9px] text-white/40">
                    {showISS ? <><span className="text-purple-400 font-medium">Live</span> · every 5s</> : 'Disabled'}
                  </p>
                </div>
              </div>
              <Toggle on={showISS} onChange={onToggleISS} color="bg-purple-500" />
            </div>

            <div className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
              style={showACLED ? { background: 'rgba(249,115,22,0.04)' } : undefined}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-sm">🔥</div>
                <div>
                  <p className="text-[11px] text-white font-medium">Global Incidents</p>
                  <p className="text-[9px] text-white/40">
                    {showACLED ? <><span className="text-orange-400 font-medium">{acledCount.toLocaleString()}</span> incidents</> : 'Disabled'}
                  </p>
                </div>
              </div>
              <Toggle on={showACLED} onChange={onToggleACLED} color="bg-orange-500" />
            </div>

          </div>
        </Section>

        {/* ── FILTERS ── */}
        <Section title="Filters" accentColor="#8b5cf6">
          <div className="flex flex-col gap-4 px-2">

            <div>
              <p className="text-[9px] text-white/35 uppercase tracking-wider mb-2 font-semibold">Time window</p>
              <div className="flex gap-1.5">
                {['24h', '7d', '30d', 'all'].map(t => (
                  <button key={t} onClick={() => onTimeWindowChange(t)}
                    className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border transition-all duration-200
                      ${timeWindow === t
                        ? 'bg-blue-500/15 border-blue-500/25 text-blue-400 shadow-sm shadow-blue-500/10'
                        : 'bg-white/[0.02] border-white/[0.05] text-white/35 hover:border-white/[0.1] hover:text-white/50'
                      }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[9px] text-white/35 uppercase tracking-wider mb-2 font-semibold">Severity</p>
              <div className="flex gap-1.5">
                {[
                  { v: 'all', l: 'All', active: 'bg-blue-500/15 border-blue-500/25 text-blue-400 shadow-sm shadow-blue-500/10' },
                  { v: 'high', l: 'High+', active: 'bg-orange-500/15 border-orange-500/25 text-orange-400 shadow-sm shadow-orange-500/10' },
                  { v: 'critical', l: 'Critical', active: 'bg-red-500/15 border-red-500/25 text-red-400 shadow-sm shadow-red-500/10' },
                ].map(s => (
                  <button key={s.v} onClick={() => onSeverityChange(s.v)}
                    className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border transition-all duration-200
                      ${severity === s.v ? s.active : 'bg-white/[0.02] border-white/[0.05] text-white/35 hover:border-white/[0.1] hover:text-white/50'}`}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[9px] text-white/35 uppercase tracking-wider mb-2 font-semibold">Category</p>
              <div className="relative">
                <select value={category} onChange={(e) => onCategoryChange(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[11px] text-white/80
                    appearance-none cursor-pointer hover:border-white/[0.1] focus:border-blue-500/30 focus:outline-none transition">
                  <option value="all">All categories</option>
                  <option value="armed_conflict">Armed Conflict</option>
                  <option value="terrorism">Terrorism</option>
                  <option value="political_violence">Political Violence</option>
                  <option value="protests">Protests</option>
                  <option value="natural_disaster">Natural Disaster</option>
                  <option value="cyber">Cyber</option>
                  <option value="humanitarian">Humanitarian</option>
                </select>
                <ChevronDown />
              </div>
            </div>

            <div>
              <p className="text-[9px] text-white/35 uppercase tracking-wider mb-2 font-semibold">Country / Region</p>
              <input type="text" value={region} onChange={(e) => onRegionChange(e.target.value)}
                placeholder="e.g. Ukraine, Syria, Sahel..."
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[11px] text-white/80
                  placeholder:text-white/20 hover:border-white/[0.1] focus:border-blue-500/30 focus:outline-none transition" />
            </div>

          </div>
        </Section>

        {/* ── ACLED FILTERS ── */}
        {showACLED && (
          <Section title="Incident Filters" badge={acledCount} defaultOpen accentColor="#f97316">
            <div className="flex flex-col gap-4 px-2">

              <div className="rounded-lg border border-orange-500/15 bg-orange-500/[0.04] px-3 py-2.5">
                <p className="text-[9px] text-orange-400/70 leading-relaxed">
                  Global incident data aggregated from multiple open sources. Time window controls span relative to latest data.
                </p>
              </div>

              <div>
                <p className="text-[9px] text-white/35 uppercase tracking-wider mb-2 font-semibold">Event Type</p>
                <div className="relative">
                  <select value={acledEventType} onChange={(e) => onAcledEventTypeChange(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[11px] text-white/80
                      appearance-none cursor-pointer hover:border-white/[0.1] focus:border-orange-500/30 focus:outline-none transition">
                    <option value="all">All event types</option>
                    <option value="Battles">Battles</option>
                    <option value="Violence against civilians">Violence against civilians</option>
                    <option value="Explosions/Remote violence">Explosions / Remote violence</option>
                    <option value="Riots">Riots</option>
                    <option value="Protests">Protests</option>
                    <option value="Strategic developments">Strategic developments</option>
                  </select>
                  <ChevronDown />
                </div>
              </div>

              <div>
                <p className="text-[9px] text-white/35 uppercase tracking-wider mb-2 font-semibold">Disorder Type</p>
                <div className="relative">
                  <select value={acledDisorderType} onChange={(e) => onAcledDisorderTypeChange(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[11px] text-white/80
                      appearance-none cursor-pointer hover:border-white/[0.1] focus:border-orange-500/30 focus:outline-none transition">
                    <option value="all">All disorder types</option>
                    <option value="Political violence">Political violence</option>
                    <option value="Political violence; Demonstrations">Political violence &amp; Demonstrations</option>
                    <option value="Demonstrations">Demonstrations</option>
                    <option value="Strategic developments">Strategic developments</option>
                  </select>
                  <ChevronDown />
                </div>
              </div>

              <div>
                <p className="text-[9px] text-white/35 uppercase tracking-wider mb-2 font-semibold">Region</p>
                <div className="relative">
                  <select value={acledRegion} onChange={(e) => onAcledRegionChange(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[11px] text-white/80
                      appearance-none cursor-pointer hover:border-white/[0.1] focus:border-orange-500/30 focus:outline-none transition">
                    <option value="all">All regions</option>
                    <option value="10">Middle East</option>
                    <option value="11">Europe</option>
                    <option value="3">Eastern Africa</option>
                    <option value="1">Western Africa</option>
                    <option value="5">Northern Africa</option>
                    <option value="2">Middle Africa</option>
                    <option value="4">Southern Africa</option>
                    <option value="7">South Asia</option>
                    <option value="9">Southeast Asia</option>
                    <option value="16">East Asia</option>
                    <option value="12">Caucasus &amp; Central Asia</option>
                    <option value="14">South America</option>
                    <option value="13">Central America</option>
                    <option value="15">Caribbean</option>
                    <option value="17">North America</option>
                    <option value="18">Oceania</option>
                  </select>
                  <ChevronDown />
                </div>
              </div>

              <div>
                <p className="text-[9px] text-white/35 uppercase tracking-wider mb-2 font-semibold">Country</p>
                <input type="text" value={acledCountry} onChange={(e) => onAcledCountryChange(e.target.value)}
                  placeholder="e.g. Ukraine, Syria, Sudan..."
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[11px] text-white/80
                    placeholder:text-white/20 hover:border-white/[0.1] focus:border-orange-500/30 focus:outline-none transition" />
              </div>

              <div>
                <p className="text-[9px] text-white/35 uppercase tracking-wider mb-2 font-semibold">Actor (search)</p>
                <input type="text" value={acledActor} onChange={(e) => onAcledActorChange(e.target.value)}
                  placeholder="e.g. Wagner, Houthis, ISIS..."
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[11px] text-white/80
                    placeholder:text-white/20 hover:border-white/[0.1] focus:border-orange-500/30 focus:outline-none transition" />
              </div>

              <div>
                <p className="text-[9px] text-white/35 uppercase tracking-wider mb-2 font-semibold">Min. Fatalities</p>
                <div className="flex gap-1.5">
                  {[
                    { v: '0', l: 'Any' },
                    { v: '1', l: '1+' },
                    { v: '5', l: '5+' },
                    { v: '10', l: '10+' },
                    { v: '50', l: '50+' },
                  ].map(f => (
                    <button key={f.v} onClick={() => onAcledFatalitiesChange(f.v)}
                      className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border transition-all duration-200
                        ${acledFatalities === f.v
                          ? 'bg-red-500/15 border-red-500/25 text-red-400 shadow-sm shadow-red-500/10'
                          : 'bg-white/[0.02] border-white/[0.05] text-white/35 hover:border-white/[0.1] hover:text-white/50'
                        }`}>
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-red-500/[0.04] border border-red-500/10 px-3 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-[11px]">⚠️</div>
                  <div>
                    <p className="text-[11px] text-white font-medium">Civilian targeting</p>
                    <p className="text-[9px] text-white/35">Show only civilian events</p>
                  </div>
                </div>
                <Toggle on={acledCivilianOnly} onChange={onAcledCivilianOnlyChange} color="bg-red-500" />
              </div>

            </div>
          </Section>
        )}

        {/* ── SELECTED ITEM ── */}
        {(selectedEvent ?? selectedFlight ?? selectedVessel) && (
          <Section title="Selected" defaultOpen accentColor="#06b6d4">
            <div className="px-2">
              {selectedEvent && (() => {
                const ev = selectedEvent as Record<string, string>;
                const sevColor = ev.severity === 'critical' ? '#ef4444' : ev.severity === 'high' ? '#f97316' : '#eab308';
                const sevBg = ev.severity === 'critical' ? 'rgba(239,68,68,0.08)' : ev.severity === 'high' ? 'rgba(249,115,22,0.08)' : 'rgba(234,179,8,0.08)';
                return (
                <div className="rounded-xl p-3.5 border"
                  style={{ background: sevBg, borderColor: `${sevColor}20` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                      style={{ color: sevColor, backgroundColor: `${sevColor}15`, borderColor: `${sevColor}25` }}>
                      {ev.severity ?? 'unknown'}
                    </span>
                    <span className="text-[9px] text-white/40">{ev.category ?? ''}</span>
                  </div>
                  <p className="text-[12px] text-white font-semibold leading-snug line-clamp-2">{ev.title ?? ''}</p>
                  <p className="text-[10px] text-white/50 mt-2 leading-relaxed line-clamp-3">{ev.summary ?? ev.description ?? ''}</p>
                  {ev.country_region && (
                    <p className="text-[9px] text-white/30 mt-2 flex items-center gap-1">📍 {ev.country_region}</p>
                  )}
                </div>
                );
              })()}
              {selectedFlight && (() => {
                const f = selectedFlight as Record<string, string | number>;
                return (
                <div className="rounded-xl p-3.5 border border-cyan-500/15 bg-cyan-500/[0.04]">
                  <p className="text-[12px] text-white font-semibold">✈️ {String(f.callsign ?? f.icao24 ?? '')}</p>
                  <p className="text-[10px] text-white/50 mt-1.5">{String(f.originCountry ?? '')} · {Math.round(Number(f.altitude ?? 0)).toLocaleString()}m · {Math.round(Number(f.velocity ?? 0) * 3.6)}km/h</p>
                </div>
                );
              })()}
              {selectedVessel && (() => {
                const v = selectedVessel as Record<string, string | number>;
                return (
                <div className="rounded-xl p-3.5 border border-emerald-500/15 bg-emerald-500/[0.04]">
                  <p className="text-[12px] text-white font-semibold">🚢 {String(v.name ?? '')}</p>
                  <p className="text-[10px] text-white/50 mt-1.5">{Number(v.speed ?? 0).toFixed(1)}kn → {String(v.destination ?? 'Unknown')}</p>
                </div>
                );
              })()}
            </div>
          </Section>
        )}

        {/* ── INTEL CO-PILOT ── */}
        <div className="px-4 pt-2 pb-5">
          <Link href="/analyst"
            className="w-full py-3 rounded-xl text-[11px] font-bold tracking-wider uppercase
              bg-gradient-to-r from-blue-600 to-indigo-600 text-white
              hover:from-blue-500 hover:to-indigo-500 transition-all duration-200
              shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2
              border border-blue-500/20">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Intel Co-pilot
          </Link>
        </div>

      </div>
    </div>
  );
}

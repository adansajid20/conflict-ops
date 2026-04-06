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
  showEvents: boolean; onToggleEvents: () => void;
  showFlights: boolean; onToggleFlights: () => void;
  showVessels: boolean; onToggleVessels: () => void;
  showISS: boolean; onToggleISS: () => void;
  timeWindow: string; onTimeWindowChange: (v: string) => void;
  severity: string; onSeverityChange: (v: string) => void;
  category: string; onCategoryChange: (v: string) => void;
  region: string; onRegionChange: (v: string) => void;
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
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${on ? color : 'bg-gray-700'}`}>
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${on ? 'translate-x-4' : ''}`} />
    </button>
  );
}

// ═══════════════════════════════════════
// COLLAPSIBLE SECTION
// ═══════════════════════════════════════
function Section({ title, badge, children, defaultOpen = true }: {
  title: string; badge?: string | number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-800/60 last:border-b-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase">{title}</span>
          {badge !== undefined && (
            <span className="text-[9px] font-medium bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {badge}
            </span>
          )}
        </div>
        <svg className={`w-3 h-3 text-gray-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN SIDEBAR
// ═══════════════════════════════════════
export default function MapSidebar({
  eventCount, flightCount, vesselCount,
  showEvents, onToggleEvents,
  showFlights, onToggleFlights,
  showVessels, onToggleVessels,
  showISS, onToggleISS,
  timeWindow, onTimeWindowChange,
  severity, onSeverityChange,
  category, onCategoryChange,
  region, onRegionChange,
  selectedEvent, selectedFlight, selectedVessel,
}: MapSidebarProps) {

  const activeLayers = [showEvents, showFlights, showVessels, showISS].filter(Boolean).length;

  return (
    <div className="absolute top-0 right-0 z-10 w-[300px] h-full flex flex-col
      bg-[#0a0e17]/92 backdrop-blur-2xl border-l border-gray-800/50">

      {/* ═══ HEADER ═══ */}
      <div className="px-4 py-4 border-b border-gray-800/60">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold tracking-[0.15em] text-white uppercase">Control Panel</h2>
            <p className="text-[9px] text-gray-500 mt-0.5">{activeLayers} layer{activeLayers !== 1 ? 's' : ''} active</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-emerald-400 font-medium uppercase tracking-wider">Live</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-2 mt-3">
          <div className="flex-1 bg-[#111827]/60 rounded-lg px-2 py-1.5 border border-gray-800/40">
            <p className="text-[8px] text-gray-500 uppercase tracking-wider">Events</p>
            <p className="text-sm font-bold text-white font-mono">{eventCount.toLocaleString()}</p>
          </div>
          <div className="flex-1 bg-[#111827]/60 rounded-lg px-2 py-1.5 border border-gray-800/40">
            <p className="text-[8px] text-cyan-500/70 uppercase tracking-wider">Flights</p>
            <p className="text-sm font-bold text-cyan-400 font-mono">{showFlights ? flightCount.toLocaleString() : 'OFF'}</p>
          </div>
          <div className="flex-1 bg-[#111827]/60 rounded-lg px-2 py-1.5 border border-gray-800/40">
            <p className="text-[8px] text-emerald-500/70 uppercase tracking-wider">Vessels</p>
            <p className="text-sm font-bold text-emerald-400 font-mono">{showVessels ? vesselCount.toLocaleString() : 'OFF'}</p>
          </div>
        </div>
      </div>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto cr-scrollbar">

        {/* ── DATA LAYERS ── */}
        <Section title="Data Layers" badge={activeLayers}>
          <div className="flex flex-col gap-3">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 6px rgba(255,45,45,0.5)' }} />
                </div>
                <div>
                  <p className="text-[11px] text-white font-medium">Conflict Events</p>
                  <p className="text-[9px] text-gray-500">{eventCount.toLocaleString()} tracked</p>
                </div>
              </div>
              <Toggle on={showEvents} onChange={onToggleEvents} color="bg-red-500" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-sm">✈️</div>
                <div>
                  <p className="text-[11px] text-white font-medium">Live Flights</p>
                  <p className="text-[9px] text-gray-500">
                    {showFlights ? <><span className="text-cyan-400">{flightCount.toLocaleString()}</span> airborne</> : 'OpenSky Network'}
                  </p>
                </div>
              </div>
              <Toggle on={showFlights} onChange={onToggleFlights} color="bg-cyan-500" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-sm">🚢</div>
                <div>
                  <p className="text-[11px] text-white font-medium">Vessel Tracking</p>
                  <p className="text-[9px] text-gray-500">
                    {showVessels ? <><span className="text-emerald-400">{vesselCount.toLocaleString()}</span> tracked</> : 'AIS Stream'}
                  </p>
                </div>
              </div>
              <Toggle on={showVessels} onChange={onToggleVessels} color="bg-emerald-500" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-sm">🛰️</div>
                <div>
                  <p className="text-[11px] text-white font-medium">ISS Tracker</p>
                  <p className="text-[9px] text-gray-500">
                    {showISS ? <><span className="text-purple-400">Live</span> · every 5s</> : 'Disabled'}
                  </p>
                </div>
              </div>
              <Toggle on={showISS} onChange={onToggleISS} color="bg-purple-500" />
            </div>

          </div>
        </Section>

        {/* ── FILTERS ── */}
        <Section title="Filters">
          <div className="flex flex-col gap-4">

            <div>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 font-medium">Time window</p>
              <div className="flex gap-1.5">
                {['24h', '7d', '30d', 'all'].map(t => (
                  <button key={t} onClick={() => onTimeWindowChange(t)}
                    className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider rounded-lg border transition
                      ${timeWindow === t
                        ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                        : 'bg-transparent border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-400'
                      }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 font-medium">Severity</p>
              <div className="flex gap-1.5">
                {[
                  { v: 'all', l: 'All', active: 'bg-blue-500/15 border-blue-500/30 text-blue-400' },
                  { v: 'high', l: 'High+', active: 'bg-orange-500/15 border-orange-500/30 text-orange-400' },
                  { v: 'critical', l: 'Crit', active: 'bg-red-500/15 border-red-500/30 text-red-400' },
                ].map(s => (
                  <button key={s.v} onClick={() => onSeverityChange(s.v)}
                    className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider rounded-lg border transition
                      ${severity === s.v ? s.active : 'bg-transparent border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-400'}`}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 font-medium">Category</p>
              <div className="relative">
                <select value={category} onChange={(e) => onCategoryChange(e.target.value)}
                  className="w-full bg-[#111827] border border-gray-800 rounded-lg px-3 py-2 text-[11px] text-gray-300
                    appearance-none cursor-pointer hover:border-gray-700 focus:border-blue-500/40 focus:outline-none transition">
                  <option value="all">All categories</option>
                  <option value="armed_conflict">Armed Conflict</option>
                  <option value="terrorism">Terrorism</option>
                  <option value="political_violence">Political Violence</option>
                  <option value="protests">Protests</option>
                  <option value="natural_disaster">Natural Disaster</option>
                  <option value="cyber">Cyber</option>
                  <option value="humanitarian">Humanitarian</option>
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 font-medium">Country / Region</p>
              <input type="text" value={region} onChange={(e) => onRegionChange(e.target.value)}
                placeholder="e.g. Ukraine, Syria, Sahel..."
                className="w-full bg-[#111827] border border-gray-800 rounded-lg px-3 py-2 text-[11px] text-gray-300
                  placeholder:text-gray-600 hover:border-gray-700 focus:border-blue-500/40 focus:outline-none transition" />
            </div>

          </div>
        </Section>

        {/* ── SELECTED ITEM ── */}
        {(selectedEvent ?? selectedFlight ?? selectedVessel) && (
          <Section title="Selected" defaultOpen>
            {selectedEvent && (() => {
              const ev = selectedEvent as Record<string, string>;
              const sevColor = ev.severity === 'critical' ? '#ff2d2d' : ev.severity === 'high' ? '#ff8c00' : '#ffd700';
              const sevBg = ev.severity === 'critical' ? 'rgba(255,45,45,0.1)' : 'rgba(255,140,0,0.1)';
              return (
              <div className="bg-[#111827]/60 rounded-xl p-3 border border-gray-800/40">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                    style={{ color: sevColor, backgroundColor: sevBg }}>
                    {ev.severity ?? 'unknown'}
                  </span>
                  <span className="text-[9px] text-gray-500">{ev.category ?? ''}</span>
                </div>
                <p className="text-[11px] text-white font-medium leading-snug line-clamp-2">{ev.title ?? ''}</p>
                <p className="text-[10px] text-gray-500 mt-1.5 line-clamp-3">{ev.summary ?? ev.description ?? ''}</p>
                {ev.country_region && (
                  <p className="text-[9px] text-gray-600 mt-2">📍 {ev.country_region}</p>
                )}
              </div>
              );
            })()}
            {selectedFlight && (() => {
              const f = selectedFlight as Record<string, string | number>;
              return (
              <div className="bg-[#111827]/60 rounded-xl p-3 border border-cyan-800/20">
                <p className="text-[11px] text-white font-medium">✈️ {String(f.callsign ?? f.icao24 ?? '')}</p>
                <p className="text-[9px] text-gray-500 mt-1">{String(f.originCountry ?? '')} · {Math.round(Number(f.altitude ?? 0)).toLocaleString()}m · {Math.round(Number(f.velocity ?? 0) * 3.6)}km/h</p>
              </div>
              );
            })()}
            {selectedVessel && (() => {
              const v = selectedVessel as Record<string, string | number>;
              return (
              <div className="bg-[#111827]/60 rounded-xl p-3 border border-emerald-800/20">
                <p className="text-[11px] text-white font-medium">🚢 {String(v.name ?? '')}</p>
                <p className="text-[9px] text-gray-500 mt-1">{Number(v.speed ?? 0).toFixed(1)}kn → {String(v.destination ?? 'Unknown')}</p>
              </div>
              );
            })()}
          </Section>
        )}

        {/* ── INTEL CO-PILOT ── */}
        <div className="px-4 py-4">
          <Link href="/analyst"
            className="w-full py-2.5 rounded-xl text-[11px] font-semibold tracking-wider uppercase
              bg-gradient-to-r from-blue-600 to-indigo-600 text-white
              hover:from-blue-500 hover:to-indigo-500 transition-all duration-200
              shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Intel Co-pilot
          </Link>
        </div>

      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="px-4 py-2.5 border-t border-gray-800/60 flex items-center justify-between">
        <p className="text-[8px] text-gray-600 uppercase tracking-wider">ConflictRadar v3.0</p>
        <div className="flex items-center gap-1">
          <div className="w-1 h-1 rounded-full bg-emerald-500" />
          <p className="text-[8px] text-gray-600">Systems operational</p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface MapSidebarProps {
  eventCount: number;
  flightCount: number;
  vesselCount: number;
  acledCount: number;
  showEvents: boolean;
  onToggleEvents: () => void;
  showFlights: boolean;
  onToggleFlights: () => void;
  showVessels: boolean;
  onToggleVessels: () => void;
  showISS: boolean;
  onToggleISS: () => void;
  showACLED: boolean;
  onToggleACLED: () => void;
  timeWindow: string;
  onTimeWindowChange: (v: string) => void;
  severity: string;
  onSeverityChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  region: string;
  onRegionChange: (v: string) => void;
  acledEventType: string;
  onAcledEventTypeChange: (v: string) => void;
  acledDisorderType: string;
  onAcledDisorderTypeChange: (v: string) => void;
  acledCountry: string;
  onAcledCountryChange: (v: string) => void;
  acledRegion: string;
  onAcledRegionChange: (v: string) => void;
  acledActor: string;
  onAcledActorChange: (v: string) => void;
  acledFatalities: string;
  onAcledFatalitiesChange: (v: string) => void;
  acledCivilianOnly: boolean;
  onAcledCivilianOnlyChange: () => void;
  viewMode: 'globe' | 'map';
  onViewModeChange: (v: 'globe' | 'map') => void;
  selectedEvent: Record<string, unknown> | null;
  selectedFlight: Record<string, unknown> | null;
  selectedVessel: Record<string, unknown> | null;
}

function Toggle({ on, onChange, color = 'bg-blue-500' }: { on: boolean; onChange: () => void; color?: string }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-10 h-[22px] rounded-full transition-all duration-200 ${on ? color : 'bg-white/[0.08]'}`}
      style={on ? { boxShadow: '0 0 8px rgba(255,255,255,0.08)' } : undefined}
    >
      <div
        className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          on ? 'translate-x-[18px]' : ''
        }`}
      />
    </button>
  );
}

function ChevronDown() {
  return (
    <svg
      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function MapSidebar({
  eventCount,
  flightCount,
  vesselCount,
  acledCount,
  showEvents,
  onToggleEvents,
  showFlights,
  onToggleFlights,
  showVessels,
  onToggleVessels,
  showISS,
  onToggleISS,
  showACLED,
  onToggleACLED,
  timeWindow,
  onTimeWindowChange,
  severity,
  onSeverityChange,
  category,
  onCategoryChange,
  region,
  onRegionChange,
  acledEventType,
  onAcledEventTypeChange,
  acledDisorderType,
  onAcledDisorderTypeChange,
  acledCountry,
  onAcledCountryChange,
  acledRegion,
  onAcledRegionChange,
  acledActor,
  onAcledActorChange,
  acledFatalities,
  onAcledFatalitiesChange,
  acledCivilianOnly,
  onAcledCivilianOnlyChange,
  selectedEvent,
  selectedFlight,
  selectedVessel,
}: MapSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const activeLayers = [showEvents, showFlights, showVessels, showISS, showACLED].filter(Boolean).length;

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed left-4 top-20 z-40 p-3 rounded-lg bg-blue-600/20 border border-blue-500/30 hover:border-blue-500/50 backdrop-blur-md text-white transition-all duration-200 hover:bg-blue-600/30"
          title="Open controls"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Floating Glass Panel */}
      <div
        className={`fixed left-4 top-20 z-50 w-[320px] max-h-[calc(100vh-140px)] overflow-y-auto cr-scrollbar rounded-2xl border border-white/[0.06] transition-all duration-300 ${
          isOpen
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 -translate-x-full pointer-events-none'
        }`}
        style={{
          background: 'rgba(7, 11, 17, 0.85)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 p-4 border-b border-white/[0.06]" style={{ background: 'rgba(7, 11, 17, 0.95)' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold tracking-wide text-white">Intelligence Map</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1 w-fit">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider">Live</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* LAYER TOGGLES */}
          <div>
            <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-3">Data Layers</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.02] transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.12)' }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" style={showEvents ? { boxShadow: '0 0 8px rgba(239,68,68,0.6)' } : undefined} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-white font-medium">Conflict Events</p>
                    <p className="text-[9px] text-white/40">{eventCount.toLocaleString()}</p>
                  </div>
                </div>
                <Toggle on={showEvents} onChange={onToggleEvents} color="bg-red-500" />
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.02] transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-sm flex-shrink-0">✈️</div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-white font-medium">Live Flights</p>
                    <p className="text-[9px] text-white/40">{showFlights ? flightCount.toLocaleString() : 'Off'}</p>
                  </div>
                </div>
                <Toggle on={showFlights} onChange={onToggleFlights} color="bg-cyan-500" />
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.02] transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-sm flex-shrink-0">🚢</div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-white font-medium">Vessel Tracking</p>
                    <p className="text-[9px] text-white/40">{showVessels ? vesselCount.toLocaleString() : 'Off'}</p>
                  </div>
                </div>
                <Toggle on={showVessels} onChange={onToggleVessels} color="bg-emerald-500" />
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.02] transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-sm flex-shrink-0">🛰️</div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-white font-medium">ISS Tracker</p>
                    <p className="text-[9px] text-white/40">{showISS ? 'Live' : 'Off'}</p>
                  </div>
                </div>
                <Toggle on={showISS} onChange={onToggleISS} color="bg-purple-500" />
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.02] transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-sm flex-shrink-0">🔥</div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-white font-medium">Global Incidents</p>
                    <p className="text-[9px] text-white/40">{showACLED ? acledCount.toLocaleString() : 'Off'}</p>
                  </div>
                </div>
                <Toggle on={showACLED} onChange={onToggleACLED} color="bg-orange-500" />
              </div>
            </div>
          </div>

          {/* TIME WINDOW FILTER */}
          <div>
            <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">Time Window</p>
            <div className="flex gap-1.5">
              {['1h', '6h', '24h', '7d', '30d'].map((t) => (
                <button
                  key={t}
                  onClick={() => onTimeWindowChange(t)}
                  className={`flex-1 py-1.5 text-[9px] font-semibold uppercase tracking-wider rounded-lg border transition-all duration-200 ${
                    timeWindow === t
                      ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:border-white/[0.15] hover:text-white/60'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* SEVERITY FILTER */}
          <div>
            <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">Severity</p>
            <div className="flex gap-1.5">
              {[
                { v: 'all', l: 'All', c: '#3b82f6' },
                { v: 'high', l: 'High+', c: '#f97316' },
                { v: 'critical', l: 'Critical', c: '#ef4444' },
              ].map((s) => (
                <button
                  key={s.v}
                  onClick={() => onSeverityChange(s.v)}
                  className={`flex-1 py-1.5 text-[9px] font-semibold uppercase tracking-wider rounded-lg border transition-all duration-200`}
                  style={
                    severity === s.v
                      ? {
                          background: `${s.c}20`,
                          borderColor: `${s.c}40`,
                          color: s.c,
                        }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          borderColor: 'rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.4)',
                        }
                  }
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>

          {/* CATEGORY FILTER */}
          <div>
            <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">Category</p>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[11px] text-white/80 appearance-none cursor-pointer hover:border-white/[0.15] focus:border-blue-500/40 focus:outline-none transition"
              >
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

          {/* LOCATION SEARCH */}
          <div>
            <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">Location</p>
            <input
              type="text"
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
              placeholder="Search region..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[11px] text-white/80 placeholder:text-white/20 hover:border-white/[0.15] focus:border-blue-500/40 focus:outline-none transition"
            />
          </div>

          {/* ACLED FILTERS */}
          {showACLED && (
            <div className="pt-2 border-t border-white/[0.06] space-y-4">
              <p className="text-[9px] text-orange-400/70 uppercase tracking-wider font-bold">Global Incident Filters</p>

              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">Event Type</p>
                <div className="relative">
                  <select
                    value={acledEventType}
                    onChange={(e) => onAcledEventTypeChange(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[11px] text-white/80 appearance-none cursor-pointer hover:border-white/[0.15] focus:border-orange-500/40 focus:outline-none transition"
                  >
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
                <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">Region</p>
                <div className="relative">
                  <select
                    value={acledRegion}
                    onChange={(e) => onAcledRegionChange(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[11px] text-white/80 appearance-none cursor-pointer hover:border-white/[0.15] focus:border-orange-500/40 focus:outline-none transition"
                  >
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
                <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">Country</p>
                <input
                  type="text"
                  value={acledCountry}
                  onChange={(e) => onAcledCountryChange(e.target.value)}
                  placeholder="e.g. Ukraine, Syria..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[11px] text-white/80 placeholder:text-white/20 hover:border-white/[0.15] focus:border-orange-500/40 focus:outline-none transition"
                />
              </div>

              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">Actor</p>
                <input
                  type="text"
                  value={acledActor}
                  onChange={(e) => onAcledActorChange(e.target.value)}
                  placeholder="e.g. Wagner, Houthis..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[11px] text-white/80 placeholder:text-white/20 hover:border-white/[0.15] focus:border-orange-500/40 focus:outline-none transition"
                />
              </div>

              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">Min. Fatalities</p>
                <div className="flex gap-1.5">
                  {[
                    { v: '0', l: 'Any' },
                    { v: '1', l: '1+' },
                    { v: '5', l: '5+' },
                    { v: '10', l: '10+' },
                  ].map((f) => (
                    <button
                      key={f.v}
                      onClick={() => onAcledFatalitiesChange(f.v)}
                      className={`flex-1 py-1.5 text-[9px] font-semibold uppercase tracking-wider rounded-lg border transition-all duration-200 ${
                        acledFatalities === f.v
                          ? 'bg-red-500/20 border-red-500/30 text-red-300'
                          : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:border-white/[0.15] hover:text-white/60'
                      }`}
                    >
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-red-500/[0.08] border border-red-500/[0.15] px-3 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-sm flex-shrink-0">⚠️</div>
                  <p className="text-[11px] text-white font-medium">Civilian targeting</p>
                </div>
                <Toggle on={acledCivilianOnly} onChange={onAcledCivilianOnlyChange} color="bg-red-500" />
              </div>
            </div>
          )}

          {/* INTEL CO-PILOT BUTTON */}
          <div className="pt-2 border-t border-white/[0.06]">
            <Link
              href="/analyst"
              className="w-full py-3 rounded-lg text-[11px] font-bold tracking-wider uppercase bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 border border-blue-500/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Analyst AI
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

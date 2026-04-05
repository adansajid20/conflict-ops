'use client';

import type { MapEvent, LayerState, FilterState, TrackingState } from './OperationalMap';

interface Props {
  layers: LayerState;
  setLayers: React.Dispatch<React.SetStateAction<LayerState>>;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  tracking: TrackingState;
  setTracking: React.Dispatch<React.SetStateAction<TrackingState>>;
  selectedEvent: MapEvent | null;
  eventCount: number;
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className={`relative w-9 h-[22px] rounded-full transition-colors duration-200 flex-shrink-0 ${on ? 'bg-blue-600' : 'bg-gray-700'}`}>
      <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${on ? 'left-[18px]' : 'left-[3px]'}`} />
    </button>
  );
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function MapSidebar({ layers, setLayers, filters, setFilters, tracking, setTracking, selectedEvent, eventCount }: Props) {

  const toggleLayer = (key: keyof LayerState) => setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  const setFilter = (key: keyof FilterState, val: string) => setFilters(prev => ({ ...prev, [key]: val }));

  const FilterBtn = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button onClick={onClick}
      className={`flex-1 px-2 py-2 text-[12px] font-medium rounded-lg border transition-all duration-150 ${
        active
          ? 'bg-blue-500/15 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
          : 'bg-gray-800/50 border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600/60'
      }`}>
      {label}
    </button>
  );

  const LayerCheck = ({ checked, label, onChange, badge, count }: {
    checked: boolean; label: string; onChange: () => void; badge?: 'threat' | 'live'; count?: number;
  }) => (
    <label className="flex items-center justify-between py-1.5 cursor-pointer group">
      <div className="flex items-center gap-2.5">
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
          checked ? 'bg-blue-600 border-blue-500' : 'bg-gray-800/60 border-gray-600/60 group-hover:border-gray-500'
        }`} onClick={onChange}>
          {checked && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-[13px] text-gray-300 group-hover:text-white transition-colors select-none">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {count !== undefined && <span className="text-[11px] font-mono font-semibold text-red-400">{count}</span>}
        {badge === 'threat' && (
          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">threat</span>
        )}
        {badge === 'live' && (
          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-green-500/15 text-green-400 border border-green-500/30">live</span>
        )}
      </div>
    </label>
  );

  return (
    <div className="absolute top-0 right-0 bottom-0 w-[285px] z-10">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-l from-[#0a0e1a]/90 via-[#0a0e1a]/75 to-transparent pointer-events-none" />

      {/* Scrollable content */}
      <div className="relative h-full overflow-y-auto overflow-x-hidden px-3 pt-4 pb-6 space-y-3
        [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:bg-gray-700/50 [&::-webkit-scrollbar-thumb]:rounded-full">

        {/* ═══ LAYERS ═══ */}
        <div className="bg-[#111827]/80 backdrop-blur-xl border border-gray-700/40 rounded-2xl p-4 shadow-lg shadow-black/20">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3">Layers</h3>
          <div className="space-y-0.5">
            <LayerCheck checked={layers.conflictEvents} label="Conflict Events" onChange={() => toggleLayer('conflictEvents')} count={eventCount} />
            <LayerCheck checked={layers.heatmap} label="Heatmap View" onChange={() => toggleLayer('heatmap')} />
            <LayerCheck checked={layers.riskOverlay} label="Risk Overlay" onChange={() => toggleLayer('riskOverlay')} badge="threat" />
            <LayerCheck checked={layers.attackVectors} label="Attack Vectors" onChange={() => toggleLayer('attackVectors')} badge="live" />
            <LayerCheck checked={layers.shippingLanes} label="Shipping Lanes" onChange={() => toggleLayer('shippingLanes')} />
          </div>
        </div>

        {/* ═══ FILTERS ═══ */}
        <div className="bg-[#111827]/80 backdrop-blur-xl border border-gray-700/40 rounded-2xl p-4 shadow-lg shadow-black/20">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3">Filters</h3>

          <div className="mb-3">
            <div className="text-[10px] text-gray-500 mb-1.5 font-medium">Time window</div>
            <div className="flex gap-1.5">
              <FilterBtn active={filters.timeWindow === '24h'} label="24h" onClick={() => setFilter('timeWindow', '24h')} />
              <FilterBtn active={filters.timeWindow === '7d'} label="7d" onClick={() => setFilter('timeWindow', '7d')} />
              <FilterBtn active={filters.timeWindow === '30d'} label="30d" onClick={() => setFilter('timeWindow', '30d')} />
            </div>
          </div>

          <div className="mb-3">
            <div className="text-[10px] text-gray-500 mb-1.5 font-medium">Severity</div>
            <div className="flex gap-1.5">
              <FilterBtn active={filters.severity === 'all'} label="All" onClick={() => setFilter('severity', 'all')} />
              <FilterBtn active={filters.severity === 'high'} label="High+" onClick={() => setFilter('severity', 'high')} />
              <FilterBtn active={filters.severity === 'critical'} label="Crit" onClick={() => setFilter('severity', 'critical')} />
            </div>
          </div>

          <div className="mb-3">
            <div className="text-[10px] text-gray-500 mb-1.5 font-medium">Category</div>
            <div className="relative">
              <select value={filters.category} onChange={(e) => setFilter('category', e.target.value)}
                className="w-full px-3 py-2 text-[12px] rounded-lg border border-gray-700/40 bg-gray-800/50 text-gray-300 appearance-none cursor-pointer focus:outline-none focus:border-blue-500/50 transition-colors">
                <option value="all">All categories</option>
                <option value="conflict">Conflict</option>
                <option value="political">Political</option>
                <option value="humanitarian">Humanitarian</option>
                <option value="military">Military</option>
                <option value="terrorism">Terrorism</option>
                <option value="cyber">Cyber</option>
                <option value="maritime">Maritime</option>
                <option value="nuclear">Nuclear</option>
                <option value="economic">Economic</option>
                <option value="diplomatic">Diplomatic</option>
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-gray-500 mb-1.5 font-medium">Country / Region</div>
            <input type="text" value={filters.region}
              onChange={(e) => setFilter('region', e.target.value)}
              placeholder="e.g. UA, Syria, Sahel..."
              className="w-full px-3 py-2 text-[12px] rounded-lg border border-gray-700/40 bg-gray-800/50 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors" />
          </div>
        </div>

        {/* ═══ TRACKING LAYERS ═══ */}
        <div className="bg-[#111827]/80 backdrop-blur-xl border border-gray-700/40 rounded-2xl p-4 shadow-lg shadow-black/20">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3">Tracking Layers</h3>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-sm flex-shrink-0">🛸</span>
              <div className="min-w-0">
                <div className="text-[13px] text-gray-300 font-medium">ISS Tracker</div>
                {tracking.iss && (
                  <div className="text-[10px] text-purple-400 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />
                    Live · every 5s
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-700/60 text-gray-400">free</span>
              <Toggle on={tracking.iss} onChange={() => setTracking(p => ({ ...p, iss: !p.iss }))} />
            </div>
          </div>

          <div className="border-t border-gray-700/20 my-1" />

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <span className="text-sm">✈️</span>
              <div>
                <div className="text-[13px] text-gray-300 font-medium">Live Flights</div>
                <div className="text-[10px] text-gray-500">Powered by <span className="text-blue-400/70">OpenSky Network</span></div>
              </div>
            </div>
            <Toggle on={tracking.flights} onChange={() => setTracking(p => ({ ...p, flights: !p.flights }))} />
          </div>

          <div className="border-t border-gray-700/20 my-1" />

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <span className="text-sm">🚢</span>
              <div className="text-[13px] text-gray-300 font-medium">Vessel Tracking</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-0.5 text-[10px] rounded-md border border-gray-700/40 text-gray-500 hover:text-white hover:border-gray-600 transition-colors">Setup</button>
              <Toggle on={tracking.vessels} onChange={() => setTracking(p => ({ ...p, vessels: !p.vessels }))} />
            </div>
          </div>

          <div className="border-t border-gray-700/20 my-1" />

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <span className="text-sm">🔥</span>
              <div className="text-[13px] text-gray-300 font-medium">Thermal Anomalies</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-0.5 text-[10px] rounded-md border border-gray-700/40 text-gray-500 hover:text-white hover:border-gray-600 transition-colors">Setup</button>
              <Toggle on={tracking.thermal} onChange={() => setTracking(p => ({ ...p, thermal: !p.thermal }))} />
            </div>
          </div>
        </div>

        {/* ═══ SELECTED EVENT ═══ */}
        <div className="bg-[#111827]/80 backdrop-blur-xl border border-gray-700/40 rounded-2xl p-4 shadow-lg shadow-black/20">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3">Selected Event</h3>

          {selectedEvent ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase border ${
                  selectedEvent.severity === 'critical' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                  selectedEvent.severity === 'high' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
                  selectedEvent.severity === 'medium' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
                  'bg-gray-500/15 text-gray-400 border-gray-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    selectedEvent.severity === 'critical' ? 'bg-red-400 animate-pulse' :
                    selectedEvent.severity === 'high' ? 'bg-orange-400' :
                    selectedEvent.severity === 'medium' ? 'bg-yellow-400' : 'bg-gray-400'
                  }`} />
                  {selectedEvent.severity}
                </span>
                {selectedEvent.category && (
                  <span className="text-[10px] text-gray-500 capitalize">{selectedEvent.category}</span>
                )}
                <span className="text-[10px] text-gray-600 ml-auto">{timeAgo(selectedEvent.created_at)}</span>
              </div>
              <p className="text-[13px] text-white font-medium leading-snug mb-2">{selectedEvent.title}</p>
              {selectedEvent.summary && (
                <p className="text-[11px] text-gray-400 leading-relaxed mb-2.5 line-clamp-3">{selectedEvent.summary}</p>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 pt-2 border-t border-gray-700/20">
                <span className="text-gray-400">{selectedEvent.country_region}</span>
                {selectedEvent.source_name && (
                  <>
                    <span className="text-gray-700">·</span>
                    <span>{selectedEvent.source_name}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-5 text-gray-600">
              <div className="w-11 h-11 rounded-full bg-gray-800/40 border border-gray-700/30 flex items-center justify-center mb-2.5">
                <span className="text-xl opacity-50">🌐</span>
              </div>
              <p className="text-[12px]">Click a marker to</p>
              <p className="text-[12px]">view event details</p>
            </div>
          )}
        </div>

        {/* ═══ INTEL CO-PILOT ═══ */}
        <button className="w-full flex items-center justify-center gap-2.5 px-4 py-3
          bg-gradient-to-r from-blue-600/15 to-purple-600/15
          border border-blue-500/25 rounded-2xl
          text-white text-[13px] font-semibold
          hover:from-blue-600/25 hover:to-purple-600/25
          hover:border-blue-500/40 transition-all duration-200
          shadow-[0_0_20px_rgba(59,130,246,0.08)]
          active:scale-[0.98]">
          <span className="text-base">🤖</span>
          Intel Co-pilot
        </button>

      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';

const SEV: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', label: 'CRITICAL' },
  high: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)', label: 'HIGH' },
  medium: { color: '#eab308', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.2)', label: 'MEDIUM' },
  low: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', label: 'LOW' },
};

function timeAgo(d: string): string {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

interface EventData {
  id?: string;
  title?: string;
  description?: string;
  summary?: string;
  severity?: string;
  category?: string;
  country?: string;
  country_region?: string;
  region?: string;
  created_at?: string;
  timestamp?: string;
  publishedAt?: string;
  source_url?: string;
  sourceUrl?: string;
  _lat?: number;
  _lon?: number;
}

export function EventCardModal({ event, onClose }: { event: EventData; onClose: () => void }) {
  const sev = (event.severity ?? 'low').toLowerCase();
  const s = SEV[sev] ?? SEV['low']!;

  const location = event.country ?? event.country_region ?? event.region ?? '';
  const timestamp = event.created_at ?? event.timestamp ?? (event as Record<string, string>).publishedAt ?? '';
  const description = event.description ?? event.summary ?? 'No description available.';
  const sourceUrl = event.source_url ?? (event as Record<string, string>).sourceUrl;
  const latitude = event._lat ?? 0;
  const longitude = event._lon ?? 0;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      />

      {/* Slide-in Panel from Right */}
      <div
        className="fixed right-0 top-0 h-screen z-50 w-[420px] max-w-[90vw] flex flex-col overflow-hidden transition-transform duration-300"
        style={{
          background: 'rgba(7, 11, 17, 0.95)',
          backdropFilter: 'blur(16px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
          animation: 'slideInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Header with Severity Stripe */}
        <div className="flex-shrink-0">
          <div className="h-1 w-full" style={{ backgroundColor: s.color }} />
          <div className="px-6 py-5 border-b border-white/[0.06]">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span
                    className="text-[9px] font-bold tracking-wider uppercase px-3 py-1 rounded-full border flex-shrink-0"
                    style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}
                  >
                    {s.label}
                  </span>
                  {event.category && <span className="text-[10px] text-gray-400">{event.category}</span>}
                </div>
                <h3 className="text-white text-lg font-bold leading-tight">{event.title ?? 'Unknown event'}</h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-white transition text-lg flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            {/* Timestamp */}
            {timestamp && (
              <p className="text-[10px] text-gray-500">
                <span className="text-gray-600">·</span> {timeAgo(timestamp)}
              </p>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto cr-scrollbar">
          <div className="px-6 py-5 space-y-5">
            {/* Description */}
            <div>
              <p className="text-[12px] text-gray-300 leading-relaxed">{description}</p>
            </div>

            {/* Location Card */}
            {location && (
              <div
                className="p-4 rounded-xl border"
                style={{
                  background: `${s.color}08`,
                  borderColor: `${s.color}20`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📍</span>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Location</p>
                </div>
                <p className="text-[13px] text-white font-semibold">{location}</p>
                <p className="text-[10px] text-gray-500 mt-1">
                  {latitude.toFixed(2)}°N · {longitude.toFixed(2)}°E
                </p>
              </div>
            )}

            {/* Timeline Info */}
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3">Timeline</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400">Reported</p>
                    <p className="text-[11px] text-white font-medium">{timestamp ? new Date(timestamp).toLocaleDateString() : 'Unknown'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Source */}
            {sourceUrl && (
              <div className="pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Source</p>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition group"
                >
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0 group-hover:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-4-6l6-6m0 0l-6 6m6-6v10" />
                  </svg>
                  <span className="text-[10px] text-blue-400 font-medium group-hover:text-blue-300 truncate">View original source</span>
                </a>
              </div>
            )}

            {/* Additional Meta */}
            <div className="pt-3 border-t border-white/[0.06]">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3">Details</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">Event ID</span>
                  <span className="text-[10px] text-gray-300 font-mono">{String(event.id ?? '—').slice(0, 12)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">Severity Level</span>
                  <span className="text-[10px] font-semibold" style={{ color: s.color }}>
                    {s.label}
                  </span>
                </div>
                {event.category && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Category</span>
                    <span className="text-[10px] text-gray-300">{event.category}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-white/[0.06] bg-black/30">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition"
          >
            Close Panel
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}

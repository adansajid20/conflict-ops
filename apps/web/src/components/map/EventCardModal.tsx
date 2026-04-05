'use client';

import { useEffect } from 'react';

const SEV: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#ff2d2d', bg: 'rgba(255,45,45,0.1)', border: 'rgba(255,45,45,0.2)', label: 'CRITICAL' },
  high:     { color: '#ff8c00', bg: 'rgba(255,140,0,0.1)', border: 'rgba(255,140,0,0.2)', label: 'HIGH' },
  medium:   { color: '#ffd700', bg: 'rgba(255,215,0,0.1)', border: 'rgba(255,215,0,0.2)', label: 'MEDIUM' },
  low:      { color: '#3b9dff', bg: 'rgba(59,157,255,0.1)', border: 'rgba(59,157,255,0.2)', label: 'LOW' },
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
}

export function EventCardModal({ event, onClose }: { event: EventData; onClose: () => void }) {
  const sev = (event.severity ?? 'low').toLowerCase();
  const s: { color: string; bg: string; border: string; label: string } = SEV[sev] ?? SEV['low'] ?? { color: '#3b9dff', bg: 'rgba(59,157,255,0.1)', border: 'rgba(59,157,255,0.2)', label: 'LOW' };

  const location = event.country ?? event.country_region ?? event.region ?? '';
  const timestamp = event.created_at ?? event.timestamp ?? (event as Record<string, string>).publishedAt ?? '';
  const description = event.description ?? event.summary ?? 'No description available.';
  const sourceUrl = event.source_url ?? (event as Record<string, string>).sourceUrl;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-30 bg-black/30" onClick={onClose} />

      {/* Card */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 w-[440px] max-w-[92vw]
        bg-[#0d1117]/96 backdrop-blur-2xl border border-gray-700/40 rounded-2xl
        shadow-2xl shadow-black/60 overflow-hidden animate-slide-up">

        {/* Severity stripe */}
        <div className="h-1 w-full" style={{ backgroundColor: s.color }} />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border"
                  style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}>
                  {s.label}
                </span>
                {event.category && (
                  <span className="text-[10px] text-gray-500">{event.category}</span>
                )}
                {timestamp && (
                  <>
                    <span className="text-[10px] text-gray-600">·</span>
                    <span className="text-[10px] text-gray-500">{timeAgo(timestamp)}</span>
                  </>
                )}
              </div>
              <h3 className="text-white text-sm font-semibold leading-snug">{event.title ?? 'Unknown event'}</h3>
            </div>
            <button onClick={onClose}
              className="text-gray-500 hover:text-white transition text-sm flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/5">
              ✕
            </button>
          </div>

          {/* Description */}
          <p className="text-[12px] text-gray-400 leading-relaxed mb-4">{description}</p>

          {/* Meta */}
          <div className="flex items-center gap-4 text-[10px] text-gray-500">
            {location && <span>📍 {location}</span>}
            {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                className="text-blue-400/80 hover:text-blue-400 transition ml-auto">
                View source →
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

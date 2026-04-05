'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapSidebar from './MapSidebar';

// ═══════════════════════════════════════════════════════
// TYPES (exported — MapSidebar imports these)
// ═══════════════════════════════════════════════════════

export interface MapEvent {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  country_region: string;
  latitude: number;
  longitude: number;
  summary?: string;
  created_at: string;
  source_name?: string;
}

export interface LayerState {
  conflictEvents: boolean;
  heatmap: boolean;
  riskOverlay: boolean;
  attackVectors: boolean;
  shippingLanes: boolean;
}

export interface FilterState {
  timeWindow: string;
  severity: string;
  category: string;
  region: string;
}

export interface TrackingState {
  iss: boolean;
  flights: boolean;
  vessels: boolean;
  thermal: boolean;
}

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff2d2d',
  high:     '#ff8c00',
  medium:   '#ffd700',
  low:      '#4a9eff',
};

const SEVERITY_NUM: Record<string, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

// ═══════════════════════════════════════════════════════
// MAP STYLE — dark Esri base + NASA city lights
// NOTE: no 'sky' property — it breaks style.load in MapLibre
// ═══════════════════════════════════════════════════════

const MAP_STYLE = {
  version: 8,
  name: 'ConflictRadar Dark Globe',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'satellite-base': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© Esri',
      maxzoom: 18,
    },
    'city-lights': {
      type: 'raster',
      tiles: ['https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/2012-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg'],
      tileSize: 256,
      attribution: '© NASA',
      maxzoom: 8,
    },
  },
  layers: [
    { id: 'space-bg', type: 'background', paint: { 'background-color': '#000000' } },
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite-base',
      paint: {
        'raster-brightness-max': 0.25,
        'raster-brightness-min': 0.0,
        'raster-saturation': -0.6,
        'raster-contrast': 0.3,
        'raster-opacity': 0.75,
      },
    },
    {
      id: 'city-lights-layer',
      type: 'raster',
      source: 'city-lights',
      paint: {
        'raster-brightness-max': 1.0,
        'raster-brightness-min': 0.0,
        'raster-saturation': -0.1,
        'raster-contrast': 0.5,
        'raster-opacity': 0.9,
      },
    },
  ],
} as unknown as maplibregl.StyleSpecification;

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export default function OperationalMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const issMarkerRef = useRef<maplibregl.Marker | null>(null);
  const issIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotationRef = useRef<number | null>(null);
  const pulseRafRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [mapMode, setMapMode] = useState<'globe' | 'map'>('globe');
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [eventCount, setEventCount] = useState(0);

  const [layers, setLayers] = useState<LayerState>({
    conflictEvents: true,
    heatmap: false,
    riskOverlay: true,
    attackVectors: true,
    shippingLanes: false,
  });

  const [filters, setFilters] = useState<FilterState>({
    timeWindow: '7d',
    severity: 'all',
    category: 'all',
    region: '',
  });

  const [tracking, setTracking] = useState<TrackingState>({
    iss: true,
    flights: false,
    vessels: false,
    thermal: false,
  });

  // ── FETCH EVENTS ─────────────────────────────────────────────────
  const fetchAndDisplay = useCallback(async (f: FilterState) => {
    try {
      const timeMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 };
      const hours = timeMap[f.timeWindow] ?? 168;
      let url = `/api/v1/map/events?hours=${hours}&limit=500`;
      if (f.severity !== 'all') url += `&severity=${f.severity}`;
      if (f.category !== 'all') url += `&category=${f.category}`;
      if (f.region) url += `&region=${encodeURIComponent(f.region)}`;

      const res = await fetch(url);
      const geojson = await res.json() as GeoJSON.FeatureCollection & { meta?: { total: number } };
      setEventCount(geojson.meta?.total ?? geojson.features?.length ?? 0);

      const map = mapRef.current;
      if (!map) return;
      const src = map.getSource('events-src') as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData(geojson);
    } catch (err) {
      console.error('[MAP] fetch error:', err);
    }
  }, []);

  useEffect(() => {
    if (mapRef.current) void fetchAndDisplay(filters);
  }, [filters, fetchAndDisplay]);

  // ── LAYER VISIBILITY ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const vis = (id: string, show: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none');
    };
    vis('events-dots', layers.conflictEvents);
    vis('events-risk-glow', layers.riskOverlay);
    vis('events-heatmap', layers.heatmap);
    vis('events-critical-pulse', layers.conflictEvents);
  }, [layers]);

  // ── ISS TRACKER ──────────────────────────────────────────────────
  useEffect(() => {
    if (!tracking.iss) {
      issMarkerRef.current?.remove();
      issMarkerRef.current = null;
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
      return;
    }

    async function updateISS() {
      if (!mapRef.current) return;
      try {
        const d = await fetch('https://api.wheretheiss.at/v1/satellites/25544').then(r => r.json()) as { longitude: number; latitude: number };
        if (!issMarkerRef.current && mapRef.current) {
          const el = document.createElement('div');
          el.innerHTML = `<div style="width:16px;height:16px;background:#a855f7;border-radius:50%;border:2px solid rgba(168,85,247,0.4);animation:iss-glow 2s ease-in-out infinite;"></div>`;
          issMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([d.longitude, d.latitude])
            .addTo(mapRef.current);
        } else {
          issMarkerRef.current?.setLngLat([d.longitude, d.latitude]);
        }
      } catch { /* silent */ }
    }

    void updateISS();
    issIntervalRef.current = setInterval(() => void updateISS(), 5000);
    return () => { if (issIntervalRef.current) clearInterval(issIntervalRef.current); };
  }, [tracking.iss]);

  // ── GLOBE/MAP TOGGLE ─────────────────────────────────────────────
  function handleToggleMode(mode: 'globe' | 'map') {
    const map = mapRef.current;
    if (!map || mode === mapMode) return;
    try {
      (map as unknown as { setProjection: (p: { type: string }) => void }).setProjection({
        type: mode === 'globe' ? 'globe' : 'mercator',
      });
    } catch { /* ignore */ }
    map.easeTo({ zoom: mode === 'globe' ? 1.8 : 2, pitch: 0, duration: 800 });
    setMapMode(mode);
  }

  // ── INIT MAP ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [30, 20],
      zoom: 1.8,
      minZoom: 1.2,
      maxZoom: 16,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-left');

    // CRITICAL: style.load — more reliable than 'load'; fires once style tiles are parsed
    map.on('style.load', () => {
      // Globe projection
      try {
        (map as unknown as { setProjection: (p: unknown) => void }).setProjection({ type: 'globe' });
      } catch { /* flat fallback */ }

      // Deep space atmosphere — setFog must be inside style.load (not before)
      try {
        (map as unknown as { setFog: (f: unknown) => void }).setFog({
          'color': '#000000',
          'high-color': '#000030',
          'horizon-blend': 0.03,
          'space-color': '#000000',
          'star-intensity': 0.6,
        });
      } catch { /* ignore */ }

      mapRef.current = map;
      setIsLoading(false);

      // ── Sources ──────────────────────────────────────────────
      const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
      map.addSource('events-src', { type: 'geojson', data: empty });

      // ── Heatmap ──────────────────────────────────────────────
      map.addLayer({
        id: 'events-heatmap',
        type: 'heatmap',
        source: 'events-src',
        maxzoom: 8,
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'severityNum'], 1, 0.2, 4, 1.0],
          'heatmap-intensity': 1.2,
          'heatmap-radius': 25,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.15, 'rgba(0,50,200,0.3)',
            0.3, 'rgba(0,100,255,0.5)',
            0.5, 'rgba(255,200,0,0.6)',
            0.7, 'rgba(255,120,0,0.7)',
            1.0, 'rgba(255,0,0,1)',
          ],
          'heatmap-opacity': 0.7,
        },
      });

      // ── Risk glow halos ───────────────────────────────────────
      map.addLayer({
        id: 'events-risk-glow',
        type: 'circle',
        source: 'events-src',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'severityNum'], 1, 12, 2, 18, 3, 25, 4, 35],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.08,
          'circle-blur': 1.0,
        },
      });

      // ── Event dots ────────────────────────────────────────────
      map.addLayer({
        id: 'events-dots',
        type: 'circle',
        source: 'events-src',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'severityNum'], 1, 3.5, 2, 5, 3, 6.5, 4, 8],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.15)',
        },
      });

      // ── Critical pulse ring ───────────────────────────────────
      map.addLayer({
        id: 'events-critical-pulse',
        type: 'circle',
        source: 'events-src',
        filter: ['==', ['get', 'severity'], 'critical'],
        paint: {
          'circle-radius': 16,
          'circle-color': '#ff2d2d',
          'circle-opacity': 0.2,
          'circle-blur': 0.8,
        },
      });

      // ── Animated pulse for critical rings ─────────────────────
      let pulsePhase = 0;
      function animatePulse() {
        pulsePhase = (pulsePhase + 0.02) % 1;
        const r = 12 + Math.sin(pulsePhase * Math.PI * 2) * 8;
        const o = 0.15 + Math.sin(pulsePhase * Math.PI * 2) * 0.1;
        try {
          if (map.getLayer('events-critical-pulse')) {
            map.setPaintProperty('events-critical-pulse', 'circle-radius', r);
            map.setPaintProperty('events-critical-pulse', 'circle-opacity', o);
          }
        } catch { /* ignore */ }
        pulseRafRef.current = requestAnimationFrame(animatePulse);
      }
      animatePulse();

      // ── Click handler ─────────────────────────────────────────
      map.on('click', 'events-dots', (e) => {
        const f = (e.features as maplibregl.MapGeoJSONFeature[] | undefined)?.[0];
        if (!f?.properties) return;
        const p = f.properties;
        const geom = f.geometry as GeoJSON.Point;
        setSelectedEvent({
          id: p.id as string,
          title: p.title as string,
          severity: p.severity as MapEvent['severity'],
          category: (p.category ?? '') as string,
          country_region: (p.region ?? p.country_region ?? '') as string,
          latitude: (geom.coordinates[1] ?? 0) as number,
          longitude: (geom.coordinates[0] ?? 0) as number,
          summary: (p.summary ?? '') as string,
          created_at: (p.publishedAt ?? p.created_at ?? '') as string,
          source_name: (p.source ?? '') as string,
        });
      });

      map.on('mouseenter', 'events-dots', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'events-dots', () => { map.getCanvas().style.cursor = ''; });

      // ── Auto-rotation — slow, cinematic ──────────────────────
      let userInteracting = false;
      const ROTATION_SPEED = 0.012;

      function rotate() {
        if (!userInteracting && mapRef.current) {
          const c = mapRef.current.getCenter();
          c.lng += ROTATION_SPEED;
          mapRef.current.setCenter(c);
        }
        rotationRef.current = requestAnimationFrame(rotate);
      }
      rotate();

      const stopRotate = () => {
        userInteracting = true;
        setTimeout(() => { userInteracting = false; }, 3000);
      };
      map.on('mousedown', () => { userInteracting = true; });
      map.on('touchstart', () => { userInteracting = true; });
      map.on('mouseup', stopRotate);
      map.on('touchend', stopRotate);
      map.on('wheel', stopRotate);

      // Initial data load
      void fetchAndDisplay(filters);
    });

    return () => {
      if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
      if (pulseRafRef.current) cancelAnimationFrame(pulseRafRef.current);
      issMarkerRef.current?.remove();
      issMarkerRef.current = null;
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild GeoJSON when events need severity color enrichment ──
  // (our API already returns correct GeoJSON but needs color + severityNum props)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Wait for source to exist
    const src = map.getSource('events-src') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    // Re-fetch to get fresh data with current filters
    void fetchAndDisplay(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">

      {/* Star field */}
      <div className="absolute inset-0 z-0 star-field" />

      {/* Map canvas */}
      <div ref={containerRef} className="absolute inset-0 z-[1]" />

      {/* HEADER */}
      <div className="absolute top-4 left-14 z-10">
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-sm font-bold tracking-[0.2em] text-white/90 uppercase">Operational Map</h1>
          <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">β</span>
        </div>
        <p className="text-[10px] text-gray-500 tracking-wide">Real-time conflict intelligence overlay</p>

        {/* Map / Chokepoints tabs */}
        <div className="flex gap-1 mt-3 bg-[#111827]/60 backdrop-blur-sm rounded-lg p-0.5 border border-white/5 w-fit">
          <button className="px-3 py-1 text-[10px] font-medium tracking-wider uppercase bg-blue-500/20 text-blue-400 rounded-md">
            Map
          </button>
          <button className="px-3 py-1 text-[10px] font-medium tracking-wider uppercase text-gray-500 hover:text-gray-300 rounded-md transition">
            Chokepoints
          </button>
        </div>
      </div>

      {/* Event count */}
      <div className="absolute top-[72px] left-14 z-10 text-[10px] text-gray-500 mt-1">
        <span className="text-white font-semibold">{eventCount}</span> events tracked
      </div>

      {/* GLOBE/MAP TOGGLE */}
      <div className="absolute top-4 right-[300px] z-10">
        <div className="flex bg-[#111827]/60 backdrop-blur-sm border border-white/5 rounded-lg p-0.5">
          <button onClick={() => handleToggleMode('globe')}
            className={`px-3 py-1.5 text-[10px] font-medium tracking-wider uppercase rounded-md transition ${mapMode === 'globe' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
            🌐 Globe
          </button>
          <button onClick={() => handleToggleMode('map')}
            className={`px-3 py-1.5 text-[10px] font-medium tracking-wider uppercase rounded-md transition ${mapMode === 'map' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
            🗺️ Map
          </button>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <MapSidebar
        layers={layers}
        setLayers={setLayers}
        filters={filters}
        setFilters={setFilters}
        tracking={tracking}
        setTracking={setTracking}
        selectedEvent={selectedEvent}
        eventCount={eventCount}
      />

      {/* SEVERITY LEGEND */}
      <div className="absolute bottom-12 left-4 z-10">
        <div className="bg-[#0d1117]/80 backdrop-blur-xl border border-gray-700/30 rounded-xl p-3 shadow-lg shadow-black/30">
          <p className="text-[9px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">Severity</p>
          <div className="space-y-1.5">
            {[
              { color: '#ff2d2d', label: 'Critical — pulse rings', glow: true },
              { color: '#ff8c00', label: 'High' },
              { color: '#ffd700', label: 'Medium' },
              { color: '#4a9eff', label: 'Low' },
            ].map(i => (
              <div key={i.label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: i.color, boxShadow: i.glow ? `0 0 6px ${i.color}` : 'none' }} />
                <span className="text-[10px] text-gray-400">{i.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700/30 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-500/60 rounded flex-shrink-0" />
              <span className="text-[10px] text-gray-500">Attack vectors</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-orange-500/20 border border-orange-500/30 flex-shrink-0" />
              <span className="text-[10px] text-gray-500">Risk overlay</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0"
                style={{ boxShadow: '0 0 6px #a855f7' }} />
              <span className="text-[10px] text-gray-500">ISS (live)</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM HINT */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <p className="text-[10px] text-gray-600 tracking-wide">Click marker · Drag to rotate · Scroll to zoom</p>
      </div>

      {/* LOADING */}
      {isLoading && (
        <div className="absolute inset-0 bg-black z-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-xs text-gray-600 tracking-wider uppercase">Initializing globe…</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── GeoJSON feature enrichment — adds color + severityNum props ──────────
// Called in /api/v1/map/events — but we ensure properties exist for paint expressions
export function enrichFeature(feature: GeoJSON.Feature): GeoJSON.Feature {
  const sev = ((feature.properties?.severity as string) ?? 'low').toLowerCase();
  return {
    ...feature,
    properties: {
      ...feature.properties,
      color: SEVERITY_COLORS[sev] ?? '#4a9eff',
      severityNum: SEVERITY_NUM[sev] ?? 1,
    },
  };
}

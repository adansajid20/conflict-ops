'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapSidebar from './MapSidebar';

// ═══════════════════════════════════════════════════════
// TYPES
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
// MAP STYLE — Esri satellite, dark globe, space background
// ═══════════════════════════════════════════════════════

const MAP_STYLE = {
  version: 8,
  name: 'ConflictRadar',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri',
      maxzoom: 18,
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#000000' } },
    {
      id: 'satellite',
      type: 'raster',
      source: 'esri-satellite',
      paint: {
        'raster-brightness-min': 0.0,
        'raster-brightness-max': 0.85,
        'raster-contrast': 0.15,
        'raster-saturation': -0.2,
        'raster-fade-duration': 300,
      },
    },
  ],
} as unknown as maplibregl.StyleSpecification;

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export default function OperationalMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const animationRef = useRef<number | null>(null);
  const issMarkerRef = useRef<maplibregl.Marker | null>(null);
  const issIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mapMode, setMapMode] = useState<'globe' | 'map'>('globe');
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  // ── FETCH EVENTS — /api/v1/map/events returns GeoJSON FeatureCollection ──
  const fetchAndDisplayEvents = useCallback(async (f: FilterState) => {
    try {
      const timeMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 };
      const hours = timeMap[f.timeWindow] ?? 168;
      let url = `/api/v1/map/events?hours=${hours}&limit=500`;
      if (f.severity !== 'all') url += `&severity=${f.severity}`;
      if (f.category !== 'all') url += `&category=${f.category}`;
      if (f.region) url += `&region=${encodeURIComponent(f.region)}`;

      const res = await fetch(url);
      // API returns GeoJSON FeatureCollection with meta.total
      const geojson = await res.json() as GeoJSON.FeatureCollection & { meta?: { total: number } };

      setEventCount(geojson.meta?.total ?? geojson.features?.length ?? 0);

      const map = mapRef.current;
      if (!map) return;
      const src = map.getSource('events-src') as maplibregl.GeoJSONSource | undefined;
      if (!src) return;

      // Pass GeoJSON directly — MapLibre consumes it natively
      src.setData(geojson);
    } catch (err) {
      console.error('[MAP] Failed to fetch events:', err);
    }
  }, []);

  // Refetch when filters change
  useEffect(() => {
    if (mapRef.current) void fetchAndDisplayEvents(filters);
  }, [filters, fetchAndDisplayEvents]);

  // ── LAYER VISIBILITY ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const vis = (id: string, show: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none');
    };
    vis('events-circles', layers.conflictEvents);
    vis('events-pulse', layers.conflictEvents);
    vis('events-heatmap', layers.heatmap);
  }, [layers]);

  // ── ISS TRACKER ───────────────────────────────────────────────────────────
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
        const d = await fetch('https://api.wheretheiss.at/v1/satellites/25544').then(r => r.json()) as { longitude: number; latitude: number; altitude: number; velocity: number };
        if (!issMarkerRef.current && mapRef.current) {
          const el = document.createElement('div');
          el.innerHTML = `<div style="position:relative">
            <div style="width:10px;height:10px;background:#a855f7;border-radius:50%;border:2px solid #c084fc;box-shadow:0 0 10px #a855f7"></div>
            <span style="position:absolute;left:16px;top:-2px;color:#c084fc;font-size:10px;font-family:monospace;white-space:nowrap">ISS</span>
          </div>`;
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

  // ── GLOBE/MAP TOGGLE ──────────────────────────────────────────────────────
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

  // ── INIT MAP ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [30, 20],
      zoom: 1.8,
      minZoom: 1,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-left');

    // style.load is more reliable than load — fires once style is parsed + tiles requested
    map.on('style.load', () => {
      // Globe projection
      try {
        (map as unknown as { setProjection: (p: unknown) => void }).setProjection({ type: 'globe' });
      } catch { /* flat fallback */ }

      // Deep space atmosphere
      try {
        (map as unknown as { setFog: (f: unknown) => void }).setFog({
          'color': 'rgb(5, 8, 15)',
          'high-color': 'rgb(10, 20, 50)',
          'horizon-blend': 0.06,
          'space-color': 'rgb(2, 3, 12)',
          'star-intensity': 1.0,
        });
      } catch { /* ignore */ }

      mapRef.current = map;
      setIsLoading(false);

      // ── Sources ────────────────────────────────────────────────────────
      const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
      map.addSource('events-src', { type: 'geojson', data: empty });
      map.addSource('attack-vectors-src', { type: 'geojson', data: empty });
      map.addSource('risk-overlay-src', { type: 'geojson', data: empty });

      // ── Layers ─────────────────────────────────────────────────────────
      map.addLayer({
        id: 'events-heatmap',
        type: 'heatmap',
        source: 'events-src',
        maxzoom: 8,
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['match', ['get', 'severity'], 'critical', 1, 'high', 0.7, 'medium', 0.4, 'low', 0.2, 0.3],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 8, 2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 8, 30],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)', 0.2, 'rgba(103,169,207,0.4)',
            0.4, 'rgba(209,229,143,0.5)', 0.6, 'rgba(253,219,93,0.6)',
            0.8, 'rgba(239,138,98,0.8)', 1.0, 'rgba(178,24,43,0.9)',
          ],
        },
      });

      map.addLayer({
        id: 'events-pulse',
        type: 'circle',
        source: 'events-src',
        filter: ['==', ['get', 'severity'], 'critical'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 14, 5, 22, 10, 35],
          'circle-color': '#ef4444',
          'circle-opacity': 0.12,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ef4444',
          'circle-stroke-opacity': 0.25,
        },
      });

      map.addLayer({
        id: 'events-circles',
        type: 'circle',
        source: 'events-src',
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 'critical', 7, 'high', 5.5, 'medium', 4.5, 'low', 3.5, 4],
          'circle-color': ['match', ['get', 'severity'], 'critical', '#ef4444', 'high', '#f97316', 'medium', '#eab308', 'low', '#6b7280', '#6b7280'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['match', ['get', 'severity'], 'critical', '#fca5a5', 'high', '#fdba74', 'medium', '#fde047', 'low', '#9ca3af', '#9ca3af'],
          'circle-opacity': 0.9,
        },
      });

      // ── Click handler ──────────────────────────────────────────────────
      map.on('click', 'events-circles', (e) => {
        const f = (e.features as maplibregl.MapGeoJSONFeature[] | undefined)?.[0];
        if (!f?.properties) return;
        const p = f.properties;
        // Geometry gives us the real coordinates
        const geom = f.geometry as GeoJSON.Point;
        setSelectedEvent({
          id: p.id as string,
          title: p.title as string,
          severity: p.severity as MapEvent['severity'],
          category: p.category as string,
          country_region: (p.region ?? p.country_region ?? '') as string,
          latitude: (geom.coordinates[1] ?? 0) as number,
          longitude: (geom.coordinates[0] ?? 0) as number,
          summary: p.summary as string | undefined,
          created_at: (p.publishedAt ?? p.created_at ?? '') as string,
          source_name: (p.source ?? p.source_name ?? '') as string | undefined,
        });
      });

      map.on('mouseenter', 'events-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'events-circles', () => { map.getCanvas().style.cursor = ''; });

      // ── Auto-rotation ──────────────────────────────────────────────────
      let userInteracting = false;
      map.on('mousedown', () => { userInteracting = true; });
      map.on('mouseup', () => { userInteracting = false; });
      map.on('dragend', () => { userInteracting = false; });
      map.on('touchstart', () => { userInteracting = true; });
      map.on('touchend', () => { userInteracting = false; });

      function spin() {
        if (!mapRef.current) return;
        if (!userInteracting && mapRef.current.getZoom() < 4) {
          const c = mapRef.current.getCenter();
          c.lng += 0.25;
          mapRef.current.easeTo({ center: c, duration: 1000, easing: (t) => t });
        }
        animationRef.current = requestAnimationFrame(spin);
      }
      spin();

      void fetchAndDisplayEvents(filters);
    });

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      issMarkerRef.current?.remove();
      issMarkerRef.current = null;
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">

      {/* MAP */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* HEADER — top-left */}
      <div className="absolute top-4 left-14 z-10">
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-white font-mono text-sm font-bold tracking-[0.2em]">OPERATIONAL MAP</h1>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-600 text-white leading-none">β</span>
        </div>
        <p className="text-gray-500 text-[11px]">Real-time conflict intelligence overlay</p>
        <div className="flex gap-2 mt-3">
          <button className="px-4 py-1.5 text-[12px] font-medium rounded-lg bg-gray-800/80 border border-gray-600/50 text-white backdrop-blur-md">Map</button>
          <button className="px-4 py-1.5 text-[12px] font-medium rounded-lg bg-gray-800/40 border border-gray-700/30 text-gray-500 hover:text-gray-300 backdrop-blur-md transition-colors">Chokepoints</button>
        </div>
      </div>

      {/* GLOBE/MAP TOGGLE — top-right */}
      <div className="absolute top-4 right-[300px] z-10">
        <div className="flex bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-xl overflow-hidden">
          <button onClick={() => handleToggleMode('globe')}
            className={`px-4 py-2 text-[12px] font-medium flex items-center gap-1.5 transition-all ${mapMode === 'globe' ? 'bg-gray-700/60 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            🌐 Globe
          </button>
          <div className="w-px bg-gray-700/50" />
          <button onClick={() => handleToggleMode('map')}
            className={`px-4 py-2 text-[12px] font-medium flex items-center gap-1.5 transition-all ${mapMode === 'map' ? 'bg-gray-700/60 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
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

      {/* SEVERITY LEGEND — bottom-left */}
      <div className="absolute bottom-12 left-4 z-10">
        <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-xl p-3">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Severity</h3>
          <div className="space-y-1">
            {[
              { color: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]', label: 'Critical — pulse rings' },
              { color: 'bg-orange-500', label: 'High' },
              { color: 'bg-yellow-500', label: 'Medium' },
              { color: 'bg-gray-500', label: 'Low' },
            ].map(i => (
              <div key={i.label} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${i.color}`} />
                <span className="text-[10px] text-gray-400">{i.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700/30 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0 border-t border-dashed border-red-500" />
              <span className="text-[10px] text-gray-400">Attack vectors</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-red-500/30 border border-red-500/50" />
              <span className="text-[10px] text-gray-400">Risk overlay</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_4px_rgba(168,85,247,0.6)]" />
              <span className="text-[10px] text-gray-400">ISS (live)</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM HINT */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-gray-900/60 backdrop-blur border border-gray-700/30 rounded-lg px-3 py-1.5 text-[10px] text-gray-500">
          Click marker · Drag to rotate · Scroll to zoom
        </div>
      </div>

      {/* LOADING */}
      {isLoading && (
        <div className="absolute inset-0 bg-black z-20 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-400 text-xs font-mono">INITIALIZING OPERATIONAL MAP...</p>
          </div>
        </div>
      )}
    </div>
  );
}

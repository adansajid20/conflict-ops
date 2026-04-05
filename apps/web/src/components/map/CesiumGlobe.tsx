'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Script from 'next/script';
import MapSidebar from './MapSidebar';
import type { LayerState, FilterState, TrackingState, MapEvent } from './OperationalMap';

const CESIUM_VERSION = '1.140.0';
const CESIUM_CDN = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium`;

declare global {
  interface Window {
    Cesium: typeof import('cesium');
    CESIUM_BASE_URL: string;
  }
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff3333', high: '#ff8800', medium: '#ffdd00', low: '#44aaff',
};
const SEVERITY_SIZE: Record<string, number> = {
  critical: 16, high: 12, medium: 9, low: 7,
};

// ── helpers ──────────────────────────────────────────────────────────────────
function getVal(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  if (!v) return '';
  if (typeof v === 'object' && typeof (v as { getValue?: () => unknown }).getValue === 'function') {
    return String((v as { getValue: () => unknown }).getValue() ?? '');
  }
  return String(v);
}

export default function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const issIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cesiumReady, setCesiumReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [mapMode, setMapMode] = useState<'globe' | 'map'>('globe');

  const [layers, setLayers] = useState<LayerState>({
    conflictEvents: true, heatmap: false, riskOverlay: true,
    attackVectors: true, shippingLanes: false,
  });
  const [filters, setFilters] = useState<FilterState>({
    timeWindow: '7d', severity: 'all', category: 'all', region: '',
  });
  const [tracking, setTracking] = useState<TrackingState>({
    iss: true, flights: false, vessels: false, thermal: false,
  });

  // ── FETCH + PLOT EVENTS ───────────────────────────────────────────
  const plotEvents = useCallback(async (f: FilterState) => {
    const Ce = window.Cesium;
    const viewer = viewerRef.current as {
      entities: { values: unknown[]; getById: (id: string) => unknown; removeAll: () => void; add: (e: unknown) => void };
      camera: { flyTo: (o: unknown) => void };
      scene: { pick: (pos: unknown) => unknown };
    } | null;
    if (!Ce || !viewer) return;

    try {
      const timeMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 };
      const hours = timeMap[f.timeWindow] ?? 168;
      let url = `/api/v1/map/events?hours=${hours}&limit=500`;
      if (f.severity !== 'all') url += `&severity=${f.severity}`;
      if (f.category !== 'all') url += `&category=${f.category}`;
      if (f.region) url += `&region=${encodeURIComponent(f.region)}`;

      const res = await fetch(url);
      const geojson = await res.json() as {
        features: Array<{ geometry: { coordinates: [number, number] }; properties: Record<string, unknown> }>;
        meta?: { total: number };
      };

      setEventCount(geojson.meta?.total ?? geojson.features?.length ?? 0);

      // Remove only event entities (keep ISS)
      const toRemove = (viewer.entities.values as Array<{ id: string }>).filter(e => e.id !== 'iss');
      for (const e of toRemove) {
        const entity = viewer.entities.getById(e.id);
        if (entity) (viewer.entities as unknown as { remove: (e: unknown) => void }).remove(entity);
      }

      for (const feature of (geojson.features ?? [])) {
        const p = feature.properties;
        const sev = ((p.severity as string) ?? 'low').toLowerCase();
        const color = Ce.Color.fromCssColorString(SEVERITY_COLORS[sev] ?? '#44aaff');
        const size = SEVERITY_SIZE[sev] ?? 7;
        const [lon, lat] = feature.geometry.coordinates;

        viewer.entities.add({
          id: `evt-${String(p.id ?? Math.random())}`,
          position: Ce.Cartesian3.fromDegrees(lon, lat, 0),
          name: String(p.title ?? 'Event'),
          description: `<div style="background:#111827;padding:12px;color:#e5e7eb;font-family:sans-serif;border-radius:8px">
            <p style="color:${SEVERITY_COLORS[sev]};font-weight:700;text-transform:uppercase;font-size:11px;margin:0 0 6px">${sev} · ${String(p.category ?? 'general')}</p>
            <p style="font-size:14px;font-weight:600;margin:0 0 8px">${String(p.title ?? '')}</p>
            <p style="font-size:12px;color:#9ca3af;margin:0 0 8px">${String(p.summary ?? '').slice(0, 400)}</p>
            <p style="font-size:10px;color:#6b7280">${String(p.region ?? '')} · ${String(p.publishedAt ?? '')}</p>
          </div>`,
          point: {
            pixelSize: size,
            color,
            outlineColor: Ce.Color.WHITE.withAlpha(0.6),
            outlineWidth: sev === 'critical' ? 3 : 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY, // always on top
            scaleByDistance: new Ce.NearFarScalar(1e5, 2.0, 2e7, 0.6),
          },
          properties: new Ce.PropertyBag(p as Record<string, never>),
        } as never);
      }
    } catch (err) {
      console.error('[CESIUM] plotEvents error:', err);
    }
  }, []);

  // Replot on filter change
  useEffect(() => {
    if (cesiumReady) void plotEvents(filters);
  }, [filters, cesiumReady, plotEvents]);

  // ── ISS ───────────────────────────────────────────────────────────
  const updateISS = useCallback(async () => {
    const Ce = window.Cesium;
    const viewer = viewerRef.current as { entities: { getById: (id: string) => unknown; add: (e: unknown) => void } } | null;
    if (!Ce || !viewer) return;
    try {
      const d = await fetch('https://api.wheretheiss.at/v1/satellites/25544').then(r => r.json()) as { longitude: number; latitude: number };
      const existing = viewer.entities.getById('iss') as { position: unknown } | undefined;
      if (existing) {
        existing.position = new Ce.ConstantPositionProperty(Ce.Cartesian3.fromDegrees(d.longitude, d.latitude, 408_000)) as never;
      } else {
        viewer.entities.add({
          id: 'iss',
          position: Ce.Cartesian3.fromDegrees(d.longitude, d.latitude, 408_000),
          name: 'ISS — International Space Station',
          description: '<div style="background:#111827;padding:12px;color:#a855f7;font-family:sans-serif"><b>International Space Station</b><br>Tracking live · ~408km altitude · 27,600 km/h</div>',
          point: {
            pixelSize: 14,
            color: Ce.Color.fromCssColorString('#a855f7'),
            outlineColor: Ce.Color.fromCssColorString('#c084fc'),
            outlineWidth: 4,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        } as never);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!cesiumReady) return;
    if (!tracking.iss) {
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
      const viewer = viewerRef.current as { entities: { getById: (id: string) => unknown; remove: (e: unknown) => void } } | null;
      if (viewer) { const e = viewer.entities.getById('iss'); if (e) viewer.entities.remove(e); }
      return;
    }
    void updateISS();
    issIntervalRef.current = setInterval(() => void updateISS(), 5000);
    return () => { if (issIntervalRef.current) clearInterval(issIntervalRef.current); };
  }, [tracking.iss, cesiumReady, updateISS]);

  // ── GLOBE/MAP TOGGLE ─────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current as { scene: { morphTo2D: (d: number) => void; morphTo3D: (d: number) => void } } | null;
    if (!viewer || !cesiumReady) return;
    if (mapMode === 'globe') viewer.scene.morphTo3D(1.0);
    else viewer.scene.morphTo2D(1.0);
  }, [mapMode, cesiumReady]);

  // ── INIT ─────────────────────────────────────────────────────────
  const initCesium = useCallback(() => {
    if (!containerRef.current || viewerRef.current || !window.Cesium) return;
    const Ce = window.Cesium;
    Ce.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? '';

    try {
      const viewer = new Ce.Viewer(containerRef.current, {
        timeline: false, animation: false, homeButton: false,
        sceneModePicker: false, projectionPicker: false,
        baseLayerPicker: false, navigationHelpButton: false,
        geocoder: false, fullscreenButton: false,
        selectionIndicator: false,  // use custom sidebar instead
        infoBox: true,
        scene3DOnly: false,
        creditContainer: document.createElement('div'),
      });

      // ── Bing Maps WITH labels (city names, country names, borders) ──
      void Ce.createWorldImageryAsync({
        style: (Ce as { IonWorldImageryStyle?: { AERIAL_WITH_LABELS?: unknown } }).IonWorldImageryStyle?.AERIAL_WITH_LABELS as never ?? 2,
      }).then(provider => {
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(provider);
      }).catch(() => {
        // Fall back: plain Bing aerial
        void Ce.IonImageryProvider.fromAssetId(2).then(p => {
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.addImageryProvider(p);
        }).catch(() => null);
      });

      // ── Terrain ──
      void Ce.createWorldTerrainAsync().then(t => { viewer.terrainProvider = t; }).catch(() => null);

      // ── NO lighting — globe is uniformly bright, no dark side ──
      viewer.scene.globe.enableLighting = false;

      // ── Atmosphere is real but don't darken the globe ──
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.brightnessShift = 0.0;
      }

      // ── Initial position — tilt toward conflict zones ──
      viewer.camera.setView({
        destination: Ce.Cartesian3.fromDegrees(35, 20, 20_000_000),
        orientation: { heading: 0, pitch: Ce.Math.toRadians(-90), roll: 0 },
      });

      // ── Click handler ─────────────────────────────────────────────
      const handler = new Ce.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: { position: { x: number; y: number } }) => {
        const picked = viewer.scene.pick(movement.position as never);
        if (!picked?.id) return;

        const entity = picked.id as {
          id: string; name: string;
          position?: { getValue: (t: unknown) => unknown };
          properties?: Record<string, unknown>;
        };

        // Get coordinates from entity position
        let lat = 0, lng = 0;
        if (entity.position) {
          const pos3d = entity.position.getValue(Ce.JulianDate.now());
          if (pos3d) {
            const carto = Ce.Cartographic.fromCartesian(pos3d as never);
            lat = Ce.Math.toDegrees(carto.latitude);
            lng = Ce.Math.toDegrees(carto.longitude);
          }
        }

        // Fly to event — zoom to 600km altitude
        if (lng !== 0 || lat !== 0) {
          viewer.camera.flyTo({
            destination: Ce.Cartesian3.fromDegrees(lng, lat, 600_000),
            duration: 1.8,
            orientation: { heading: 0, pitch: Ce.Math.toRadians(-45), roll: 0 },
          });
        }

        // Update sidebar
        if (entity.properties && entity.name !== 'ISS — International Space Station') {
          const p = entity.properties;
          setSelectedEvent({
            id: entity.id,
            title: getVal(p, 'title'),
            severity: getVal(p, 'severity') as MapEvent['severity'],
            category: getVal(p, 'category'),
            country_region: getVal(p, 'region'),
            latitude: lat, longitude: lng,
            summary: getVal(p, 'summary'),
            created_at: getVal(p, 'publishedAt'),
            source_name: getVal(p, 'source'),
          });
        }
      }, Ce.ScreenSpaceEventType.LEFT_CLICK);

      // ── Hover cursor ──────────────────────────────────────────────
      handler.setInputAction((movement: { endPosition: { x: number; y: number } }) => {
        const picked = viewer.scene.pick(movement.endPosition as never);
        viewer.scene.canvas.style.cursor = picked?.id ? 'pointer' : 'default';
      }, Ce.ScreenSpaceEventType.MOUSE_MOVE);

      // ── Slow cinematic rotation ───────────────────────────────────
      let userInteracting = false;
      const pause = () => { userInteracting = true; setTimeout(() => { userInteracting = false; }, 4000); };
      viewer.scene.canvas.addEventListener('mousedown', () => { userInteracting = true; });
      viewer.scene.canvas.addEventListener('mouseup', pause);
      viewer.scene.canvas.addEventListener('wheel', pause);
      viewer.scene.canvas.addEventListener('touchstart', () => { userInteracting = true; });
      viewer.scene.canvas.addEventListener('touchend', pause);

      rotationRef.current = setInterval(() => {
        if (!userInteracting) viewer.camera.rotate(Ce.Cartesian3.UNIT_Z, -0.00015);
      }, 16);

      viewerRef.current = viewer;
      setIsLoading(false);
      setCesiumReady(true);
    } catch (err) {
      console.error('[CESIUM] init failed:', err);
      setIsLoading(false);
      setLoadError(true);
    }
  }, []);

  // Safety timeout
  useEffect(() => {
    const t = setTimeout(() => {
      if (isLoading) { setIsLoading(false); setLoadError(true); }
    }, 25000);
    return () => clearTimeout(t);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (rotationRef.current) clearInterval(rotationRef.current);
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
      const v = viewerRef.current as { destroy: () => void; isDestroyed: () => boolean } | null;
      if (v && !v.isDestroyed()) v.destroy();
      viewerRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <link rel="stylesheet" href={`${CESIUM_CDN}/Widgets/widgets.css`} />
      <Script
        src={`${CESIUM_CDN}/Cesium.js`}
        strategy="afterInteractive"
        onLoad={() => {
          window.CESIUM_BASE_URL = `${CESIUM_CDN}/`;
          setTimeout(() => initCesium(), 150);
        }}
        onError={() => { setIsLoading(false); setLoadError(true); }}
      />

      {/* Cesium canvas */}
      <div ref={containerRef} className="absolute inset-0 z-[1] cesium-viewer-dark" />

      {/* Header */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-sm font-bold tracking-[0.2em] text-white/90 uppercase">Operational Map</h1>
          <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">β</span>
        </div>
        <p className="text-[10px] text-gray-500">Real-time conflict intelligence overlay</p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          <span className="text-white font-semibold">{eventCount}</span> events tracked
        </p>
      </div>

      {/* Tabs */}
      <div className="absolute top-4 left-60 z-10 flex gap-1 bg-[#111827]/60 backdrop-blur-sm rounded-lg p-0.5 border border-white/5 pointer-events-auto">
        <button className="px-3 py-1 text-[10px] font-medium tracking-wider uppercase bg-blue-500/20 text-blue-400 rounded-md">Map</button>
        <button className="px-3 py-1 text-[10px] font-medium tracking-wider uppercase text-gray-500 hover:text-gray-300 rounded-md transition">Chokepoints</button>
      </div>

      {/* Globe/2D toggle */}
      <div className="absolute top-4 right-[300px] z-10 flex bg-[#111827]/60 backdrop-blur-sm rounded-lg p-0.5 border border-white/5 pointer-events-auto">
        <button onClick={() => setMapMode('globe')}
          className={`px-3 py-1.5 text-[10px] font-medium tracking-wider uppercase rounded-md transition ${mapMode === 'globe' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
          🌐 Globe
        </button>
        <button onClick={() => setMapMode('map')}
          className={`px-3 py-1.5 text-[10px] font-medium tracking-wider uppercase rounded-md transition ${mapMode === 'map' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
          🗺️ 2D Map
        </button>
      </div>

      {/* Sidebar */}
      <MapSidebar
        layers={layers} setLayers={setLayers}
        filters={filters} setFilters={setFilters}
        tracking={tracking} setTracking={setTracking}
        selectedEvent={selectedEvent} eventCount={eventCount}
      />

      {/* Legend */}
      <div className="absolute bottom-12 left-4 z-10 pointer-events-none">
        <div className="bg-[#0d1117]/80 backdrop-blur-xl border border-gray-700/30 rounded-xl p-3">
          <p className="text-[9px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">Severity</p>
          <div className="space-y-1.5">
            {[
              { color: '#ff3333', label: 'Critical' },
              { color: '#ff8800', label: 'High' },
              { color: '#ffdd00', label: 'Medium' },
              { color: '#44aaff', label: 'Low' },
            ].map(i => (
              <div key={i.label} className="flex items-center gap-2">
                <div className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: i.color, boxShadow: `0 0 4px ${i.color}` }} />
                <span className="text-[10px] text-gray-400">{i.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-gray-700/30">
              <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" style={{ boxShadow: '0 0 6px #a855f7' }} />
              <span className="text-[10px] text-gray-500">ISS (live)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <p className="text-[10px] text-gray-600 tracking-wide">Click event to zoom · Drag to rotate · Scroll to zoom · Right-drag to tilt</p>
      </div>

      {/* Loading */}
      {isLoading && !loadError && (
        <div className="absolute inset-0 bg-black z-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-xs text-gray-600 tracking-wider uppercase">Loading Cesium 3D Globe…</p>
          </div>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 bg-black z-20 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 text-sm font-semibold mb-2">Globe failed to load</p>
            <p className="text-gray-600 text-xs mb-4">Check browser console for details</p>
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-500">Retry</button>
          </div>
        </div>
      )}
    </div>
  );
}

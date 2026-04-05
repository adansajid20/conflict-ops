'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import MapSidebar from './MapSidebar';
import type { LayerState, FilterState, TrackingState, MapEvent } from './OperationalMap';

// ═══════════════════════════════════════════════════════
// CESIUM BASE URL — must be set before any Cesium import
// ═══════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  // Use CDN — avoids needing public/cesium assets in the deploy
  (window as unknown as Record<string, unknown>).CESIUM_BASE_URL =
    'https://cdn.jsdelivr.net/npm/cesium@1.140.0/Build/Cesium/';
}

// ═══════════════════════════════════════════════════════
// REGION GEOCODER
// ═══════════════════════════════════════════════════════
const REGION_COORDS: Record<string, [number, number]> = {
  ukraine: [48.5, 31.5], russia: [55.75, 37.62], syria: [34.8, 38.9],
  iraq: [33.3, 44.4], iran: [35.7, 51.4], israel: [31.5, 34.8],
  palestine: [31.9, 35.2], gaza: [31.5, 34.47], lebanon: [33.9, 35.5],
  yemen: [15.4, 44.2], somalia: [2.0, 45.3], ethiopia: [9.0, 38.7],
  sudan: [15.6, 32.5], 'south sudan': [4.85, 31.6], libya: [32.9, 13.1],
  mali: [12.6, -8.0], niger: [13.5, 2.1], nigeria: [9.06, 7.49],
  'burkina faso': [12.3, -1.5], chad: [12.1, 15.0],
  'democratic republic of congo': [-4.3, 15.3], drc: [-4.3, 15.3],
  congo: [-4.3, 15.3], mozambique: [-15.4, 40.7],
  myanmar: [19.8, 96.2], afghanistan: [34.5, 69.2], pakistan: [33.7, 73.0],
  india: [20.6, 78.9], china: [39.9, 116.4], taiwan: [25.0, 121.5],
  'north korea': [39.0, 125.8], 'south korea': [37.6, 127.0], japan: [35.7, 139.7],
  philippines: [14.6, 121.0], indonesia: [-6.2, 106.8],
  mexico: [19.4, -99.1], colombia: [4.7, -74.1], venezuela: [10.5, -66.9],
  brazil: [-15.8, -47.9], 'united states': [38.9, -77.0], usa: [38.9, -77.0],
  turkey: [39.9, 32.9], egypt: [30.0, 31.2], 'saudi arabia': [24.7, 46.7],
  uae: [24.5, 54.4], jordan: [31.95, 35.93], europe: [50.1, 14.4],
  africa: [0.0, 25.0], asia: [34.0, 100.0], 'middle east': [29.0, 41.0],
  sahel: [14.0, 0.0], 'horn of africa': [8.0, 46.0], caucasus: [42.3, 43.4],
  'central asia': [41.0, 65.0], 'southeast asia': [10.0, 106.0],
  'east africa': [-1.3, 36.8], 'west africa': [7.5, -3.0],
  'north africa': [32.0, 10.0], 'south asia': [23.0, 80.0],
  'latin america': [-10.0, -55.0], caribbean: [18.0, -72.0],
  'eastern europe': [50.0, 30.0], 'western europe': [48.9, 2.3],
  balkans: [43.0, 21.0], baltic: [57.0, 24.0],
  'south china sea': [12.0, 114.0], 'black sea': [43.5, 34.0],
  mediterranean: [35.5, 18.0], 'red sea': [20.0, 38.5],
  'persian gulf': [26.0, 52.0], 'gulf of aden': [12.5, 47.0],
};

interface GeocodedEvent {
  id: string;
  title: string;
  severity: string;
  category: string;
  region: string;
  summary?: string;
  created_at?: string;
  source?: string;
  lat: number;
  lng: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff3333',
  high: '#ff8c00',
  medium: '#ffd700',
  low: '#3b9dff',
};
const SEVERITY_SIZE: Record<string, number> = {
  critical: 14, high: 10, medium: 8, low: 6,
};

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function CesiumGlobe() {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);
  const issIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [eventCount, setEventCount] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [mapMode, setMapMode] = useState<'globe' | 'map'>('globe');

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

  // ── FETCH EVENTS ─────────────────────────────────────
  const fetchAndDisplay = useCallback(async (f: FilterState) => {
    try {
      const timeMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 };
      const hours = timeMap[f.timeWindow] ?? 168;
      let url = `/api/v1/map/events?hours=${hours}&limit=500`;
      if (f.severity !== 'all') url += `&severity=${f.severity}`;
      if (f.category !== 'all') url += `&category=${f.category}`;
      if (f.region) url += `&region=${encodeURIComponent(f.region)}`;

      const res = await fetch(url);
      const geojson = await res.json() as {
        type: string;
        features: Array<{
          type: string;
          geometry: { type: string; coordinates: [number, number] };
          properties: Record<string, unknown>;
        }>;
        meta?: { total: number };
      };

      const total = geojson.meta?.total ?? geojson.features?.length ?? 0;
      setEventCount(total);

      const viewer = viewerRef.current as {
        entities: {
          removeAll: () => void;
          add: (e: unknown) => unknown;
        };
        camera: {
          flyTo: (o: unknown) => void;
        };
      } | null;
      if (!viewer) return;

      // Cesium modules (dynamically loaded)
      const Ce = await import('cesium');

      viewer.entities.removeAll();

      for (const feature of (geojson.features ?? [])) {
        const p = feature.properties;
        const sev = ((p.severity as string) ?? 'low').toLowerCase();
        const color = Ce.Color.fromCssColorString(SEVERITY_COLORS[sev] ?? '#3b9dff');
        const size = SEVERITY_SIZE[sev] ?? 6;
        const coords = feature.geometry.coordinates; // [lon, lat]

        viewer.entities.add({
          position: Ce.Cartesian3.fromDegrees(coords[0], coords[1]),
          name: (p.title as string) ?? 'Event',
          description: `
            <div style="font-family:sans-serif;color:#e5e7eb;padding:8px">
              <p style="color:${SEVERITY_COLORS[sev]};font-weight:bold;text-transform:uppercase;font-size:11px;margin:0 0 6px">${sev} · ${(p.category as string) ?? 'general'}</p>
              <p style="font-size:13px;margin:0 0 8px">${((p.summary as string) ?? '').slice(0, 300)}</p>
              <p style="font-size:10px;color:#9ca3af">${(p.region as string) ?? ''} · ${(p.publishedAt as string) ?? ''}</p>
            </div>
          `,
          point: {
            pixelSize: size,
            color,
            outlineColor: Ce.Color.WHITE.withAlpha(0.25),
            outlineWidth: sev === 'critical' ? 3 : 1.5,
            scaleByDistance: new Ce.NearFarScalar(1e6, 1.5, 1e8, 0.4),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          // Store props for click handler
          properties: p,
        });
      }

      // ISS marker
      if (tracking.iss) void updateISS();
    } catch (err) {
      console.error('[CESIUM] fetch error:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchAndDisplay(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // ── ISS TRACKER ─────────────────────────────────────
  const updateISS = useCallback(async () => {
    if (!tracking.iss) return;
    try {
      const Ce = await import('cesium');
      const d = await fetch('https://api.wheretheiss.at/v1/satellites/25544').then(r => r.json()) as { longitude: number; latitude: number };
      const viewer = viewerRef.current as { entities: { getById: (id: string) => unknown; add: (e: unknown) => unknown } } | null;
      if (!viewer) return;

      const existing = viewer.entities.getById('iss-tracker');
      if (existing) {
        const e = existing as { position: unknown };
        e.position = new Ce.ConstantPositionProperty(Ce.Cartesian3.fromDegrees(d.longitude, d.latitude, 408000)) as unknown as typeof e.position;
      } else {
        viewer.entities.add({
          id: 'iss-tracker',
          position: Ce.Cartesian3.fromDegrees(d.longitude, d.latitude, 408000),
          name: 'ISS — International Space Station',
          point: {
            pixelSize: 12,
            color: Ce.Color.fromCssColorString('#a855f7'),
            outlineColor: Ce.Color.fromCssColorString('rgba(168,85,247,0.5)'),
            outlineWidth: 4,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }
    } catch { /* silent */ }
  }, [tracking.iss]);

  useEffect(() => {
    if (!tracking.iss) {
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
      // Remove ISS entity
      const viewer = viewerRef.current as { entities: { getById: (id: string) => unknown; remove: (e: unknown) => void } } | null;
      if (viewer) {
        const e = viewer.entities.getById('iss-tracker');
        if (e) viewer.entities.remove(e);
      }
      return;
    }
    void updateISS();
    issIntervalRef.current = setInterval(() => void updateISS(), 5000);
    return () => { if (issIntervalRef.current) clearInterval(issIntervalRef.current); };
  }, [tracking.iss, updateISS]);

  // ── GLOBE/MAP TOGGLE ────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current as { scene: { mode: number; morphTo2D: (d: number) => void; morphTo3D: (d: number) => void } } | null;
    if (!viewer) return;
    import('cesium').then(Ce => {
      if (mapMode === 'globe') {
        viewer.scene.morphTo3D(1.0);
      } else {
        viewer.scene.morphTo2D(1.0);
      }
    }).catch(() => null);
  }, [mapMode]);

  // ── INIT CESIUM ─────────────────────────────────────
  useEffect(() => {
    if (!cesiumContainerRef.current || viewerRef.current) return;

    async function initCesium() {
      const Ce = await import('cesium');

      Ce.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? '';

      const viewer = new Ce.Viewer(cesiumContainerRef.current!, {
        timeline: false,
        animation: false,
        homeButton: false,
        sceneModePicker: false,
        projectionPicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        geocoder: false,
        fullscreenButton: false,
        selectionIndicator: true,
        infoBox: true,
        scene3DOnly: false,
        creditContainer: document.createElement('div'), // hides credit bar
      });

      // Bing satellite imagery
      try {
        const imagery = await Ce.IonImageryProvider.fromAssetId(2);
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(imagery);
      } catch {
        // Fall back to default Ion imagery (still satellite)
      }

      // Terrain
      try {
        viewer.terrainProvider = await Ce.createWorldTerrainAsync();
      } catch { /* optional */ }

      // Atmosphere + lighting
      viewer.scene.globe.enableLighting = true;
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.brightnessShift = -0.3;
        viewer.scene.skyAtmosphere.saturationShift = -0.2;
      }
      // skyBox is always visible by default

      // Initial camera position — view Middle East / Africa
      viewer.camera.flyTo({
        destination: Ce.Cartesian3.fromDegrees(35, 15, 18_000_000),
        duration: 0,
      });

      // Click handler
      const handler = new Ce.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: { position: unknown }) => {
        const picked = viewer.scene.pick(movement.position as never);
        if (picked?.id && picked.id.properties) {
          const p = picked.id.properties;
          const pos = picked.id.position?.getValue(Ce.JulianDate.now()) as { x: number; y: number; z: number } | undefined;
          let lat = 0, lng = 0;
          if (pos) {
            const carto = Ce.Cartographic.fromCartesian(pos as never);
            lat = Ce.Math.toDegrees(carto.latitude);
            lng = Ce.Math.toDegrees(carto.longitude);
          }
          setSelectedEvent({
            id: String(picked.id.id ?? ''),
            title: String(p.title?.getValue ? p.title.getValue() : (p.title ?? 'Unknown')),
            severity: String(p.severity?.getValue ? p.severity.getValue() : (p.severity ?? 'low')) as MapEvent['severity'],
            category: String(p.category?.getValue ? p.category.getValue() : (p.category ?? '')),
            country_region: String(p.region?.getValue ? p.region.getValue() : (p.region ?? '')),
            latitude: lat,
            longitude: lng,
            summary: String(p.summary?.getValue ? p.summary.getValue() : (p.summary ?? '')),
            created_at: String(p.publishedAt?.getValue ? p.publishedAt.getValue() : (p.publishedAt ?? '')),
            source_name: String(p.source?.getValue ? p.source.getValue() : (p.source ?? '')),
          });
        }
      }, Ce.ScreenSpaceEventType.LEFT_CLICK);

      // Auto-rotation — slow, cinematic
      let userInteracting = false;
      const canvasEl = viewer.scene.canvas;
      const pauseRotation = () => {
        userInteracting = true;
        setTimeout(() => { userInteracting = false; }, 3000);
      };
      canvasEl.addEventListener('mousedown', () => { userInteracting = true; });
      canvasEl.addEventListener('mouseup', pauseRotation);
      canvasEl.addEventListener('wheel', pauseRotation);
      canvasEl.addEventListener('touchstart', () => { userInteracting = true; });
      canvasEl.addEventListener('touchend', pauseRotation);

      rotationIntervalRef.current = setInterval(() => {
        if (!userInteracting) {
          viewer.camera.rotate(Ce.Cartesian3.UNIT_Z, -0.0002);
        }
      }, 16);

      viewerRef.current = viewer;
      setIsLoading(false);
      void fetchAndDisplay(filters);
    }

    void initCesium();

    return () => {
      if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
      const v = viewerRef.current as { destroy: () => void; isDestroyed: () => boolean } | null;
      if (v && !v.isDestroyed()) v.destroy();
      viewerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">

      {/* Cesium canvas */}
      <div ref={cesiumContainerRef} className="absolute inset-0 z-[1] cesium-viewer-dark" />

      {/* HEADER */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-sm font-bold tracking-[0.2em] text-white/90 uppercase">Operational Map</h1>
          <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">β</span>
        </div>
        <p className="text-[10px] text-gray-500 tracking-wide">Real-time conflict intelligence overlay</p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          <span className="text-white font-semibold">{eventCount}</span> events tracked
        </p>
      </div>

      {/* Map / Chokepoints tabs */}
      <div className="absolute top-4 left-60 z-10 flex gap-1 bg-[#111827]/60 backdrop-blur-sm rounded-lg p-0.5 border border-white/5 pointer-events-auto">
        <button className="px-3 py-1 text-[10px] font-medium tracking-wider uppercase bg-blue-500/20 text-blue-400 rounded-md">Map</button>
        <button className="px-3 py-1 text-[10px] font-medium tracking-wider uppercase text-gray-500 hover:text-gray-300 rounded-md transition">Chokepoints</button>
      </div>

      {/* Globe / 2D toggle */}
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
      <div className="absolute bottom-12 left-4 z-10 pointer-events-none">
        <div className="bg-[#0d1117]/80 backdrop-blur-xl border border-gray-700/30 rounded-xl p-3 shadow-lg shadow-black/30">
          <p className="text-[9px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">Severity</p>
          <div className="space-y-1.5">
            {[
              { color: '#ff3333', label: 'Critical', big: true },
              { color: '#ff8c00', label: 'High' },
              { color: '#ffd700', label: 'Medium' },
              { color: '#3b9dff', label: 'Low' },
            ].map(i => (
              <div key={i.label} className="flex items-center gap-2">
                <div className="rounded-full flex-shrink-0"
                  style={{ width: i.big ? 10 : 8, height: i.big ? 10 : 8, backgroundColor: i.color, boxShadow: i.big ? `0 0 6px ${i.color}` : 'none' }} />
                <span className="text-[10px] text-gray-400">{i.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700/30">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0" style={{ boxShadow: '0 0 6px #a855f7' }} />
              <span className="text-[10px] text-gray-500">ISS (live)</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM HINT */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <p className="text-[10px] text-gray-600 tracking-wide">Click event · Drag to rotate · Scroll to zoom · Right-drag to tilt</p>
      </div>

      {/* LOADING */}
      {isLoading && (
        <div className="absolute inset-0 bg-black z-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-xs text-gray-600 tracking-wider uppercase">Loading 3D globe…</p>
          </div>
        </div>
      )}
    </div>
  );
}

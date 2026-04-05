'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Script from 'next/script';
import MapSidebar from './MapSidebar';
import type { LayerState, FilterState, TrackingState, MapEvent } from './OperationalMap';

// ─── Cesium loaded as CDN global — NOT bundled via webpack ───────────────────
const CESIUM_VERSION = '1.140.0';
const CESIUM_CDN = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium`;

declare global {
  interface Window {
    Cesium: typeof import('cesium');
    CESIUM_BASE_URL: string;
  }
}

// ─── Region geocoder ─────────────────────────────────────────────────────────
const REGION_COORDS: Record<string, [number, number]> = {
  ukraine: [48.5, 31.5], russia: [55.75, 37.62], syria: [34.8, 38.9],
  iraq: [33.3, 44.4], iran: [35.7, 51.4], israel: [31.5, 34.8],
  palestine: [31.9, 35.2], gaza: [31.5, 34.47], lebanon: [33.9, 35.5],
  yemen: [15.4, 44.2], somalia: [2.0, 45.3], ethiopia: [9.0, 38.7],
  sudan: [15.6, 32.5], 'south sudan': [4.85, 31.6], libya: [32.9, 13.1],
  mali: [12.6, -8.0], niger: [13.5, 2.1], nigeria: [9.06, 7.49],
  'burkina faso': [12.3, -1.5], chad: [12.1, 15.0],
  'democratic republic of congo': [-4.3, 15.3], drc: [-4.3, 15.3],
  myanmar: [19.8, 96.2], afghanistan: [34.5, 69.2], pakistan: [33.7, 73.0],
  india: [20.6, 78.9], china: [39.9, 116.4], taiwan: [25.0, 121.5],
  'north korea': [39.0, 125.8], japan: [35.7, 139.7], philippines: [14.6, 121.0],
  mexico: [19.4, -99.1], brazil: [-15.8, -47.9], usa: [38.9, -77.0],
  turkey: [39.9, 32.9], egypt: [30.0, 31.2], 'saudi arabia': [24.7, 46.7],
  uae: [24.5, 54.4], 'middle east': [29.0, 41.0], europe: [50.1, 14.4],
  africa: [0.0, 25.0], sahel: [14.0, 0.0], caucasus: [42.3, 43.4],
  'eastern europe': [50.0, 30.0], balkans: [43.0, 21.0],
  'south china sea': [12.0, 114.0], mediterranean: [35.5, 18.0],
  'red sea': [20.0, 38.5], 'persian gulf': [26.0, 52.0],
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff3333', high: '#ff8c00', medium: '#ffd700', low: '#3b9dff',
};
const SEVERITY_SIZE: Record<string, number> = {
  critical: 14, high: 10, medium: 8, low: 6,
};

export default function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const issIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cesiumReady, setCesiumReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
  const fetchAndDisplay = useCallback(async (f: FilterState) => {
    const Ce = window.Cesium;
    const viewer = viewerRef.current as { entities: { removeAll: () => void; add: (e: unknown) => void } } | null;
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
        features: Array<{
          geometry: { coordinates: [number, number] };
          properties: Record<string, unknown>;
        }>;
        meta?: { total: number };
      };

      setEventCount(geojson.meta?.total ?? geojson.features?.length ?? 0);
      viewer.entities.removeAll();

      for (const feature of (geojson.features ?? [])) {
        const p = feature.properties;
        const sev = ((p.severity as string) ?? 'low').toLowerCase();
        const color = Ce.Color.fromCssColorString(SEVERITY_COLORS[sev] ?? '#3b9dff');
        const size = SEVERITY_SIZE[sev] ?? 6;
        const [lon, lat] = feature.geometry.coordinates;

        viewer.entities.add({
          position: Ce.Cartesian3.fromDegrees(lon, lat),
          name: String(p.title ?? 'Event'),
          description: `<div style="font-family:sans-serif;color:#e5e7eb;padding:8px">
            <p style="color:${SEVERITY_COLORS[sev]};font-weight:bold;text-transform:uppercase;font-size:11px;margin:0 0 6px">${sev} · ${String(p.category ?? 'general')}</p>
            <p style="font-size:13px;margin:0 0 8px">${String(p.summary ?? '').slice(0, 300)}</p>
            <p style="font-size:10px;color:#9ca3af">${String(p.region ?? '')} · ${String(p.publishedAt ?? '')}</p>
          </div>`,
          point: {
            pixelSize: size,
            color,
            outlineColor: Ce.Color.WHITE.withAlpha(0.25),
            outlineWidth: sev === 'critical' ? 3 : 1.5,
            scaleByDistance: new Ce.NearFarScalar(1e6, 1.5, 1e8, 0.4),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          properties: p,
        } as never);
      }

      // Re-add ISS after entity reset
      if (tracking.iss) void updateISS();
    } catch (err) {
      console.error('[CESIUM] fetch error:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking.iss]);

  useEffect(() => {
    if (cesiumReady && viewerRef.current) void fetchAndDisplay(filters);
  }, [filters, cesiumReady, fetchAndDisplay]);

  // ── ISS ───────────────────────────────────────────────────────────
  const updateISS = useCallback(async () => {
    const Ce = window.Cesium;
    const viewer = viewerRef.current as { entities: { getById: (id: string) => unknown; add: (e: unknown) => void } } | null;
    if (!Ce || !viewer || !tracking.iss) return;
    try {
      const d = await fetch('https://api.wheretheiss.at/v1/satellites/25544').then(r => r.json()) as { longitude: number; latitude: number };
      const existing = viewer.entities.getById('iss');
      if (existing) {
        (existing as { position: unknown }).position = new Ce.ConstantPositionProperty(
          Ce.Cartesian3.fromDegrees(d.longitude, d.latitude, 408_000)
        ) as never;
      } else {
        viewer.entities.add({
          id: 'iss',
          position: Ce.Cartesian3.fromDegrees(d.longitude, d.latitude, 408_000),
          name: 'ISS — International Space Station',
          point: {
            pixelSize: 12,
            color: Ce.Color.fromCssColorString('#a855f7'),
            outlineColor: Ce.Color.fromCssColorString('#c084fc'),
            outlineWidth: 4,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        } as never);
      }
    } catch { /* silent */ }
  }, [tracking.iss]);

  useEffect(() => {
    if (!tracking.iss || !cesiumReady) {
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
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

  // ── INIT — fires once Cesium CDN script is loaded ────────────────
  const initCesium = useCallback(() => {
    if (!containerRef.current || viewerRef.current || !window.Cesium) return;

    const Ce = window.Cesium;
    Ce.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? '';

    try {
      const viewer = new Ce.Viewer(containerRef.current, {
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

      // Bing satellite (async)
      void Ce.IonImageryProvider.fromAssetId(2).then(provider => {
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(provider);
      }).catch(() => null);

      // Terrain (async)
      void Ce.createWorldTerrainAsync().then(terrain => {
        viewer.terrainProvider = terrain;
      }).catch(() => null);

      // Atmosphere
      viewer.scene.globe.enableLighting = true;
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.brightnessShift = -0.3;
        viewer.scene.skyAtmosphere.saturationShift = -0.2;
      }

      // Initial camera
      viewer.camera.flyTo({
        destination: Ce.Cartesian3.fromDegrees(35, 15, 18_000_000),
        duration: 0,
      });

      // Click handler
      const handler = new Ce.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: { position: { x: number; y: number } }) => {
        const picked = viewer.scene.pick(movement.position as never);
        if (picked?.id?.properties && picked.id.name !== 'ISS — International Space Station') {
          const p = picked.id.properties as Record<string, { getValue: () => unknown } | unknown>;
          const getVal = (key: string) => {
            const v = p[key];
            if (v && typeof (v as { getValue?: () => unknown }).getValue === 'function') {
              return String((v as { getValue: () => unknown }).getValue() ?? '');
            }
            return String(v ?? '');
          };
          const pos3d = picked.id.position?.getValue?.(Ce.JulianDate.now()) as { x?: number; y?: number; z?: number } | undefined;
          let lat = 0, lng = 0;
          if (pos3d) {
            const carto = Ce.Cartographic.fromCartesian(pos3d as never);
            lat = Ce.Math.toDegrees(carto.latitude);
            lng = Ce.Math.toDegrees(carto.longitude);
          }
          setSelectedEvent({
            id: String(picked.id.id ?? ''),
            title: getVal('title'),
            severity: getVal('severity') as MapEvent['severity'],
            category: getVal('category'),
            country_region: getVal('region'),
            latitude: lat, longitude: lng,
            summary: getVal('summary'),
            created_at: getVal('publishedAt'),
            source_name: getVal('source'),
          });
          // Fly to event
          viewer.camera.flyTo({
            destination: Ce.Cartesian3.fromDegrees(lng, lat, 2_500_000),
            duration: 1.5,
          });
        }
      }, Ce.ScreenSpaceEventType.LEFT_CLICK);

      // Slow cinematic rotation
      let userInteracting = false;
      const pause = () => { userInteracting = true; setTimeout(() => { userInteracting = false; }, 3000); };
      viewer.scene.canvas.addEventListener('mousedown', () => { userInteracting = true; });
      viewer.scene.canvas.addEventListener('mouseup', pause);
      viewer.scene.canvas.addEventListener('wheel', pause);
      viewer.scene.canvas.addEventListener('touchstart', () => { userInteracting = true; });
      viewer.scene.canvas.addEventListener('touchend', pause);

      rotationRef.current = setInterval(() => {
        if (!userInteracting) viewer.camera.rotate(Ce.Cartesian3.UNIT_Z, -0.0002);
      }, 16);

      viewerRef.current = viewer;
      setIsLoading(false);
      setCesiumReady(true);
    } catch (err) {
      console.error('[CESIUM] init error:', err);
      setIsLoading(false);
    }
  }, []);

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

      {/* Load Cesium CSS from CDN */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={`${CESIUM_CDN}/Widgets/widgets.css`} />

      {/* Load Cesium JS from CDN — onLoad fires initCesium */}
      <Script
        src={`${CESIUM_CDN}/Cesium.js`}
        strategy="afterInteractive"
        onLoad={() => {
          window.CESIUM_BASE_URL = `${CESIUM_CDN}/`;
          initCesium();
        }}
      />

      {/* Cesium canvas */}
      <div ref={containerRef} className="absolute inset-0 z-[1] cesium-viewer-dark" />

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

      {/* Tabs */}
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

      {/* Sidebar */}
      <MapSidebar
        layers={layers} setLayers={setLayers}
        filters={filters} setFilters={setFilters}
        tracking={tracking} setTracking={setTracking}
        selectedEvent={selectedEvent} eventCount={eventCount}
      />

      {/* Severity legend */}
      <div className="absolute bottom-12 left-4 z-10 pointer-events-none">
        <div className="bg-[#0d1117]/80 backdrop-blur-xl border border-gray-700/30 rounded-xl p-3">
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
                  style={{ width: i.big ? 10 : 7, height: i.big ? 10 : 7, backgroundColor: i.color, boxShadow: i.big ? `0 0 6px ${i.color}` : 'none' }} />
                <span className="text-[10px] text-gray-400">{i.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-gray-700/30">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0" style={{ boxShadow: '0 0 6px #a855f7' }} />
              <span className="text-[10px] text-gray-500">ISS (live)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <p className="text-[10px] text-gray-600 tracking-wide">Click event · Drag to rotate · Scroll to zoom · Right-drag to tilt</p>
      </div>

      {/* Loading */}
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

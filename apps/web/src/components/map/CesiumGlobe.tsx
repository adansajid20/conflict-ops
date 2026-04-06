// ConflictRadar – CesiumGlobe (managed via Cowork)
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Script from 'next/script';
import MapSidebar from './MapSidebar';
import { EventCardModal } from './EventCardModal';

// ─── Cesium CDN — loaded as global, NOT bundled via webpack ──────────────────
const CESIUM_VERSION = '1.140.0';
const CESIUM_CDN = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium`;

declare global {
  interface Window {
    Cesium: typeof import('cesium');
    CESIUM_BASE_URL: string;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Flight {
  icao24: string; callsign: string; originCountry: string;
  latitude: number; longitude: number; altitude: number;
  onGround: boolean; velocity: number; heading: number;
  verticalRate: number; squawk?: string;
}
interface Vessel {
  mmsi: string; name: string; latitude: number; longitude: number;
  speed: number; course: number; type: number; destination: string;
}
interface EventData {
  id?: string; title?: string; description?: string; summary?: string;
  severity?: string; category?: string; country_region?: string;
  created_at?: string; source_url?: string; publishedAt?: string;
}

// ─── Severity config ──────────────────────────────────────────────────────────
const SEV_COLORS: Record<string, string> = {
  critical: '#ff1744', high: '#ff6d00', medium: '#ffc400', low: '#448aff',
};
const SEV_GLOW: Record<string, string> = {
  critical: 'rgba(255,23,68,0.45)', high: 'rgba(255,109,0,0.3)', medium: 'rgba(255,196,0,0.2)', low: 'rgba(68,138,255,0.15)',
};
const SEV_SIZE: Record<string, number> = {
  critical: 16, high: 12, medium: 9, low: 7,
};
const SEV_OUTLINE: Record<string, number> = {
  critical: 3, high: 2, medium: 1.5, low: 1,
};

// ─── Helper ───────────────────────────────────────────────────────────────────
type CesiumImageryLayer = {
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
  alpha: number;
};
type CesiumViewer = {
  entities: {
    values: Array<{ id: string }>;
    getById: (id: string) => unknown;
    add: (e: unknown) => unknown;
    remove: (e: unknown) => void;
    removeAll: () => void;
  };
  camera: {
    flyTo: (o: unknown) => void;
    setView: (o: unknown) => void;
    rotate: (axis: unknown, angle: number) => void;
    positionCartographic: { height: number; latitude: number; longitude: number } | undefined;
  };
  scene: {
    canvas: HTMLCanvasElement;
    pick: (pos: unknown) => unknown;
    globe: {
      enableLighting: boolean;
      showGroundAtmosphere: boolean;
      atmosphereBrightnessShift: number;
      atmosphereSaturationShift: number;
    };
    skyAtmosphere: {
      brightnessShift: number;
      saturationShift: number;
      hueShift: number;
    } | undefined;
    skyBox: { show: boolean } | undefined;
    backgroundColor: unknown;
    morphTo2D: (d: number) => void;
    morphTo3D: (d: number) => void;
    postRender: {
      addEventListener: (fn: () => void) => void;
      removeEventListener: (fn: () => void) => void;
    };
  };
  imageryLayers: {
    removeAll: () => void;
    addImageryProvider: (p: unknown) => unknown;
    get: (index: number) => CesiumImageryLayer | undefined;
    length: number;
  };
  terrainProvider: unknown;
  bottomContainer: HTMLElement;
  destroy: () => void;
  isDestroyed: () => boolean;
};

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const issIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flightIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // State
  const [cesiumReady, setCesiumReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mapMode, setMapMode] = useState<'globe' | 'map'>('globe');

  // Counts
  const [eventCount, setEventCount] = useState(0);
  const [flightCount, setFlightCount] = useState(0);
  const [vesselCount, setVesselCount] = useState(0);

  // Layers
  const [showEvents, setShowEvents] = useState(true);
  const [showFlights, setShowFlights] = useState(false);
  const [showVessels, setShowVessels] = useState(false);
  const [showISS, setShowISS] = useState(true);

  // Filters
  const [timeWindow, setTimeWindow] = useState('7d');
  const [severity, setSeverity] = useState('all');
  const [category, setCategory] = useState('all');
  const [region, setRegion] = useState('');

  // Selected items
  const [selectedEvent, setSelectedEvent] = useState<Record<string, unknown> | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<Record<string, unknown> | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<Record<string, unknown> | null>(null);
  const [showModal, setShowModal] = useState(false);

  // ── HELPERS ───────────────────────────────────────────────────────
  const getViewer = () => viewerRef.current;
  const getCe = () => (typeof window !== 'undefined' ? window.Cesium : null);

  function flyTo(lng: number, lat: number, alt: number, tilt = -60) {
    const v = getViewer(); const Ce = getCe();
    if (!v || !Ce) return;
    v.camera.flyTo({
      destination: Ce.Cartesian3.fromDegrees(lng, lat, alt),
      duration: 1.5,
      orientation: { heading: 0, pitch: Ce.Math.toRadians(tilt), roll: 0 },
    });
  }

  function removeEntitiesByPrefix(prefix: string) {
    const v = getViewer();
    if (!v) return;
    const toRemove = v.entities.values.filter(e => e.id.startsWith(prefix));
    for (const e of toRemove) {
      const entity = v.entities.getById(e.id);
      if (entity) v.entities.remove(entity);
    }
  }

  // ── FETCH EVENTS ──────────────────────────────────────────────────
  const plotEvents = useCallback(async (tw: string, sev: string, cat: string, reg: string) => {
    const Ce = getCe(); const v = getViewer();
    if (!Ce || !v) return;

    // Map time window to API param (route reads `window`, not `hours`)
    const windowParam = tw === 'all' ? '30d' : tw; // API max is 30d
    let url = `/api/v1/map/events?window=${windowParam}`;
    if (sev !== 'all') url += `&severity=${sev}`;

    try {
      const res = await fetch(url);
      const geojson = await res.json() as {
        features: Array<{
          geometry: { coordinates: [number, number] };
          properties: Record<string, unknown>;
        }>;
        meta?: { total: number };
      };

      const features = geojson.features ?? [];
      setEventCount(geojson.meta?.total ?? features.length ?? 0);

      // Remove old event entities
      removeEntitiesByPrefix('evt-');

      // ── Client-side micro-jitter to separate overlapping pins ──
      // Group by rounded coordinates (0.3° grid) and offset duplicates
      const gridMap = new Map<string, number>();
      function spreadPin(lon: number, lat: number): [number, number] {
        const key = `${Math.round(lon * 3)}:${Math.round(lat * 3)}`;
        const count = gridMap.get(key) ?? 0;
        gridMap.set(key, count + 1);
        if (count === 0) return [lon, lat];
        // Spiral offset — each subsequent pin in same cell moves outward
        const angle = (count * 137.5) * (Math.PI / 180); // golden angle
        const radius = 0.15 + count * 0.08; // degrees
        return [lon + Math.cos(angle) * radius, lat + Math.sin(angle) * radius];
      }

      for (const feature of features) {
        const p = feature.properties;
        const sevStr = ((p.severity as string) ?? 'low').toLowerCase();
        const color = Ce.Color.fromCssColorString(SEV_COLORS[sevStr] ?? '#448aff');
        const glowColor = Ce.Color.fromCssColorString(SEV_GLOW[sevStr] ?? 'rgba(68,138,255,0.2)');
        const size = SEV_SIZE[sevStr] ?? 7;
        const outline = SEV_OUTLINE[sevStr] ?? 1;
        const rawLon = feature.geometry.coordinates[0];
        const rawLat = feature.geometry.coordinates[1];
        const [lon, lat] = spreadPin(rawLon, rawLat);

        const evtId = String(p.id ?? Math.random().toString(36).slice(2));

        // Outer glow ring — all events get subtle glow, critical gets double ring
        v.entities.add({
          id: `evt-glow-${evtId}`,
          position: Ce.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: size * 2.8,
            color: glowColor,
            outlineWidth: 0,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        } as never);
        // Critical: extra outer pulse ring
        if (sevStr === 'critical') {
          v.entities.add({
            id: `evt-pulse-${evtId}`,
            position: Ce.Cartesian3.fromDegrees(lon, lat, 0),
            point: {
              pixelSize: size * 4.5,
              color: Ce.Color.fromCssColorString('rgba(255,23,68,0.12)'),
              outlineWidth: 0,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          } as never);
        }

        // Main pin
        v.entities.add({
          id: `evt-${evtId}`,
          position: Ce.Cartesian3.fromDegrees(lon, lat, 0),
          name: String(p.title ?? 'Event'),
          properties: {
            _type: 'event',
            severity: sevStr,
            title: String(p.title ?? ''),
            summary: String(p.summary ?? ''),
            description: String(p.summary ?? ''),
            category: String(p.category ?? p.event_type ?? 'general'),
            country_region: String(p.region ?? ''),
            created_at: String(p.publishedAt ?? ''),
            source_url: String(p.sourceUrl ?? ''),
            _lat: lat, _lon: lon,
          },
          point: {
            pixelSize: size,
            color,
            outlineColor: Ce.Color.WHITE.withAlpha(0.6),
            outlineWidth: outline,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        } as never);
      }
    } catch (err) {
      console.error('[CESIUM] plotEvents error:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cesiumReady) {
      if (showEvents) void plotEvents(timeWindow, severity, category, region);
      else removeEntitiesByPrefix('evt-');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cesiumReady, showEvents, timeWindow, severity, category, region]);

  // ── FLIGHTS ───────────────────────────────────────────────────────
  const fetchFlights = useCallback(async () => {
    const Ce = getCe(); const v = getViewer();
    if (!Ce || !v) return;
    try {
      const res = await fetch('/api/flights', { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) { console.warn('[CESIUM] flights API returned', res.status); return; }
      const d = await res.json() as { flights: Flight[]; error?: string };
      if (d.error) { console.warn('[CESIUM] flights:', d.error); return; }
      const airborne = (d.flights ?? []).filter(f => !f.onGround);
      setFlightCount(airborne.length);

      removeEntitiesByPrefix('flt-');
      for (const f of airborne.slice(0, 3000)) {
        v.entities.add({
          id: `flt-${f.icao24}`,
          position: Ce.Cartesian3.fromDegrees(f.longitude, f.latitude, f.altitude || 10000),
          properties: { _type: 'flight', ...f },
          point: {
            pixelSize: 4,
            color: Ce.Color.fromCssColorString('#00e5ff'),
            outlineColor: Ce.Color.fromCssColorString('rgba(0,229,255,0.3)'),
            outlineWidth: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            // No scaleByDistance — fixed pins stay put
          },
        } as never);
      }
    } catch (err) {
      console.error('[CESIUM] fetchFlights error:', err);
    }
  }, []);

  useEffect(() => {
    if (!cesiumReady) return;
    if (!showFlights) {
      removeEntitiesByPrefix('flt-');
      setFlightCount(0);
      if (flightIntervalRef.current) clearInterval(flightIntervalRef.current);
      return;
    }
    void fetchFlights();
    flightIntervalRef.current = setInterval(() => void fetchFlights(), 15000);
    return () => { if (flightIntervalRef.current) clearInterval(flightIntervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cesiumReady, showFlights]);

  // ── VESSELS (AIS WebSocket) ────────────────────────────────────────
  useEffect(() => {
    if (!cesiumReady) return;
    if (!showVessels) {
      wsRef.current?.close();
      wsRef.current = null;
      removeEntitiesByPrefix('vsl-');
      setVesselCount(0);
      return;
    }
    const key = process.env.NEXT_PUBLIC_AISSTREAM_API_KEY;
    if (!key) return;

    const Ce = getCe(); const v = getViewer();
    if (!Ce || !v) return;

    const vesselMap = new Map<string, Vessel>();
    try {
      const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({
          Apikey: key,
          BoundingBoxes: [[[-90, -180], [90, 180]]],
          FilterMessageTypes: ['PositionReport'],
        }));
      };
      ws.onmessage = (msg) => {
        try {
          const d = JSON.parse(String(msg.data)) as {
            MessageType: string;
            Message?: { PositionReport?: { Latitude: number; Longitude: number; Sog: number; Cog: number } };
            MetaData?: { MMSI: number; ShipName: string; ShipType: number; Destination: string };
          };
          if (d.MessageType === 'PositionReport' && d.Message?.PositionReport && d.MetaData) {
            const p = d.Message.PositionReport;
            const m = d.MetaData;
            vesselMap.set(String(m.MMSI), {
              mmsi: String(m.MMSI), name: (m.ShipName ?? '').trim() || 'Unknown',
              latitude: p.Latitude, longitude: p.Longitude,
              speed: p.Sog ?? 0, course: p.Cog ?? 0,
              type: m.ShipType ?? 0, destination: (m.Destination ?? '').trim(),
            });
          }
        } catch { /* ignore */ }
      };

      // Replot vessels every 5s
      const plotInterval = setInterval(() => {
        const vessels = Array.from(vesselMap.values()).slice(0, 2000);
        setVesselCount(vessels.length);
        removeEntitiesByPrefix('vsl-');
        for (const vsl of vessels) {
          v.entities.add({
            id: `vsl-${vsl.mmsi}`,
            position: Ce.Cartesian3.fromDegrees(vsl.longitude, vsl.latitude, 0),
            properties: { _type: 'vessel', ...vsl },
            point: {
              pixelSize: 5,
              color: Ce.Color.fromCssColorString('#34d399'),
              outlineColor: Ce.Color.fromCssColorString('rgba(52,211,153,0.3)'),
              outlineWidth: 1,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              // No scaleByDistance — fixed pins stay put
            },
          } as never);
        }
      }, 5000);

      return () => {
        clearInterval(plotInterval);
        ws.close();
        wsRef.current = null;
        removeEntitiesByPrefix('vsl-');
      };
    } catch { /* silent */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cesiumReady, showVessels]);

  // ── ISS ───────────────────────────────────────────────────────────
  const updateISS = useCallback(async () => {
    const Ce = getCe(); const v = getViewer();
    if (!Ce || !v) return;
    try {
      const d = await fetch('https://api.wheretheiss.at/v1/satellites/25544').then(r => r.json()) as { longitude: number; latitude: number };
      const existing = v.entities.getById('iss') as { position: unknown } | undefined;
      if (existing) {
        existing.position = new Ce.ConstantPositionProperty(Ce.Cartesian3.fromDegrees(d.longitude, d.latitude, 408_000)) as never;
      } else {
        v.entities.add({
          id: 'iss',
          position: Ce.Cartesian3.fromDegrees(d.longitude, d.latitude, 408_000),
          name: 'ISS — International Space Station',
          properties: { _type: 'iss' },
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
  }, []);

  useEffect(() => {
    if (!cesiumReady) return;
    if (!showISS) {
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
      const v = getViewer();
      if (v) { const e = v.entities.getById('iss'); if (e) v.entities.remove(e); }
      return;
    }
    void updateISS();
    issIntervalRef.current = setInterval(() => void updateISS(), 5000);
    return () => { if (issIntervalRef.current) clearInterval(issIntervalRef.current); };
  }, [cesiumReady, showISS, updateISS]);

  // ── GLOBE/MAP TOGGLE ─────────────────────────────────────────────
  useEffect(() => {
    const v = getViewer();
    if (!v || !cesiumReady) return;
    if (mapMode === 'globe') v.scene.morphTo3D(1.0);
    else v.scene.morphTo2D(1.0);
  }, [mapMode, cesiumReady]);

  // ── INIT CESIUM ───────────────────────────────────────────────────
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
        selectionIndicator: false, infoBox: false,
        scene3DOnly: false,
        creditContainer: document.createElement('div'),
      }) as unknown as CesiumViewer;

      // ── IMAGERY: CartoDB Dark Matter — sharp vector-style dark tiles ──
      // Clean, crisp borders + city names + dark aesthetic. No API key.
      try {
        viewer.imageryLayers.removeAll();
        const cartoDark = new (Ce as unknown as {
          UrlTemplateImageryProvider: new (o: unknown) => unknown
        }).UrlTemplateImageryProvider({
          url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          credit: 'CartoDB',
          maximumLevel: 18,
          minimumLevel: 0,
        });
        viewer.imageryLayers.addImageryProvider(cartoDark);
      } catch { /* keep default */ }

      // No terrain — flat is cleaner with vector tiles

      // ═══════════════════════════════════════
      // DARK INTELLIGENCE GLOBE THEME
      // ═══════════════════════════════════════

      // ── 1. Tile layer tweaks — boost contrast on already-dark tiles ──
      const baseLayer = viewer.imageryLayers.get(0);
      if (baseLayer) {
        baseLayer.brightness = 1.05;   // tiles are already dark, tiny lift
        baseLayer.contrast = 1.15;     // sharpen borders and text
        baseLayer.saturation = 0.3;    // slight desaturation for intel feel
        baseLayer.gamma = 1.0;
      }

      // ── 2. No day/night — always fully visible ──
      viewer.scene.globe.enableLighting = false;

      // ── 3. Atmosphere — cool blue limb glow ──
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.brightnessShift = -0.3;
        viewer.scene.skyAtmosphere.saturationShift = 0.1;
        viewer.scene.skyAtmosphere.hueShift = -0.03;
      }
      viewer.scene.globe.atmosphereBrightnessShift = -0.15;
      viewer.scene.globe.atmosphereSaturationShift = 0.0;

      // ── 4. Stars + deep space ──
      if (viewer.scene.skyBox) viewer.scene.skyBox.show = true;
      viewer.scene.backgroundColor = Ce.Color.fromCssColorString('#05080f');

      // ── 5. Atmosphere glow on globe edge ──
      viewer.scene.globe.showGroundAtmosphere = true;

      // ── 5. Hide Cesium default bottom bar ──
      if (viewer.bottomContainer) viewer.bottomContainer.style.display = 'none';

      // Initial view — center on Middle East / Africa / Europe hotspot corridor
      viewer.camera.setView({
        destination: Ce.Cartesian3.fromDegrees(38, 25, 18_000_000),
        orientation: { heading: Ce.Math.toRadians(-5), pitch: Ce.Math.toRadians(-85), roll: 0 },
      });

      // ── CLICK HANDLER ─────────────────────────────────────────────
      const handler = new Ce.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: { position: { x: number; y: number } }) => {
        const picked = viewer.scene.pick(movement.position as never) as { id?: unknown } | undefined;
        if (!picked?.id) return;

        const entity = picked.id as {
          id: string;
          position?: { getValue: (t: unknown) => { x: number; y: number; z: number } | undefined };
          properties?: Record<string, unknown>;
        };

        // Get lat/lng from entity position
        let lat = 0, lng = 0;
        if (entity.position) {
          const pos3d = entity.position.getValue(Ce.JulianDate.now());
          if (pos3d) {
            const carto = Ce.Cartographic.fromCartesian(pos3d as never);
            lat = Ce.Math.toDegrees(carto.latitude);
            lng = Ce.Math.toDegrees(carto.longitude);
          }
        }

        // Read properties (Cesium wraps them in PropertyBag getters)
        const rawProps = entity.properties;
        if (!rawProps) return;

        const getP = (key: string): unknown => {
          const v = rawProps[key];
          if (v && typeof (v as { getValue?: () => unknown }).getValue === 'function') {
            return (v as { getValue: () => unknown }).getValue();
          }
          return v;
        };

        const type = String(getP('_type') ?? '');

        if (type === 'event') {
          const ev: Record<string, unknown> = {
            id: entity.id,
            title: getP('title'), summary: getP('summary'),
            severity: getP('severity'), category: getP('category'),
            country_region: getP('country_region'),
            created_at: getP('created_at'), source_url: getP('source_url'),
          };
          setSelectedEvent(ev);
          setSelectedFlight(null);
          setSelectedVessel(null);
          setShowModal(true);
          flyTo(lng, lat, 800_000, -50);
        } else if (type === 'flight') {
          const f: Record<string, unknown> = {
            icao24: getP('icao24'), callsign: getP('callsign'),
            originCountry: getP('originCountry'), altitude: getP('altitude'),
            velocity: getP('velocity'), heading: getP('heading'), squawk: getP('squawk'),
          };
          setSelectedFlight(f);
          setSelectedEvent(null);
          setSelectedVessel(null);
          setShowModal(false);
          flyTo(lng, lat, 500_000, -45);
        } else if (type === 'vessel') {
          const vsl: Record<string, unknown> = {
            mmsi: getP('mmsi'), name: getP('name'),
            speed: getP('speed'), course: getP('course'), destination: getP('destination'),
          };
          setSelectedVessel(vsl);
          setSelectedEvent(null);
          setSelectedFlight(null);
          setShowModal(false);
          flyTo(lng, lat, 300_000, -45);
        }
      }, Ce.ScreenSpaceEventType.LEFT_CLICK);

      // Hover cursor (throttled to ~15fps to reduce expensive pick() calls)
      let lastHoverTime = 0;
      handler.setInputAction((movement: { endPosition: { x: number; y: number } }) => {
        const now = Date.now();
        if (now - lastHoverTime < 66) return; // ~15fps
        lastHoverTime = now;
        const picked = viewer.scene.pick(movement.endPosition as never);
        viewer.scene.canvas.style.cursor = (picked as { id?: unknown } | undefined)?.id ? 'pointer' : 'default';
      }, Ce.ScreenSpaceEventType.MOUSE_MOVE);

      // Auto-rotation removed — globe stays still until user interacts

      viewerRef.current = viewer;
      setIsLoading(false);
      setCesiumReady(true);
    } catch (err) {
      console.error('[CESIUM] init error:', err);
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

  // Cleanup
  useEffect(() => {
    return () => {
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
      if (flightIntervalRef.current) clearInterval(flightIntervalRef.current);
      wsRef.current?.close();
      const v = viewerRef.current;
      if (v && !v.isDestroyed()) v.destroy();
      viewerRef.current = null;
    };
  }, []);

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">

      {/* Cesium CSS */}
      <link rel="stylesheet" href={`${CESIUM_CDN}/Widgets/widgets.css`} />

      {/* Cesium JS from CDN */}
      <Script
        src={`${CESIUM_CDN}/Cesium.js`}
        strategy="afterInteractive"
        onLoad={() => {
          window.CESIUM_BASE_URL = `${CESIUM_CDN}/`;
          setTimeout(() => initCesium(), 150);
        }}
        onError={() => { setIsLoading(false); setLoadError(true); }}
      />

      {/* Globe canvas */}
      <div ref={containerRef} className="absolute inset-0 z-[1] cr-viewer" />

      {/* HEADER */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-sm font-bold tracking-[0.2em] text-white/90 uppercase">Operational Map</h1>
          <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">β</span>
        </div>
        <p className="text-[10px] text-gray-500 tracking-wide">Real-time conflict intelligence overlay</p>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
          <span><span className="text-white font-semibold">{eventCount.toLocaleString()}</span> events</span>
          {showFlights && <span><span className="text-cyan-400 font-semibold">{flightCount.toLocaleString()}</span> flights</span>}
          {showVessels && <span><span className="text-emerald-400 font-semibold">{vesselCount.toLocaleString()}</span> vessels</span>}
        </div>
      </div>

      {/* Globe / 2D toggle */}
      <div className="absolute top-4 right-[310px] z-10 flex bg-[#111827]/70 backdrop-blur-sm rounded-lg p-0.5 border border-white/5 pointer-events-auto">
        {(['globe', 'map'] as const).map(m => (
          <button key={m} onClick={() => setMapMode(m)}
            className={`px-3 py-1.5 text-[10px] font-medium tracking-wider uppercase rounded-md transition
              ${mapMode === m ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
            {m === 'globe' ? '🌐 Globe' : '🗺️ 2D'}
          </button>
        ))}
      </div>

      {/* Sidebar */}
      <MapSidebar
        eventCount={eventCount} flightCount={flightCount} vesselCount={vesselCount}
        showEvents={showEvents} onToggleEvents={() => setShowEvents(p => !p)}
        showFlights={showFlights} onToggleFlights={() => setShowFlights(p => !p)}
        showVessels={showVessels} onToggleVessels={() => setShowVessels(p => !p)}
        showISS={showISS} onToggleISS={() => setShowISS(p => !p)}
        timeWindow={timeWindow} onTimeWindowChange={setTimeWindow}
        severity={severity} onSeverityChange={setSeverity}
        category={category} onCategoryChange={setCategory}
        region={region} onRegionChange={setRegion}
        viewMode={mapMode} onViewModeChange={setMapMode}
        selectedEvent={selectedEvent} selectedFlight={selectedFlight} selectedVessel={selectedVessel}
      />

      {/* Legend */}
      <div className="absolute bottom-16 left-4 z-10 pointer-events-none">
        <div className="bg-[#0d1117]/80 backdrop-blur-xl border border-gray-700/30 rounded-xl p-3">
          <p className="text-[9px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">Legend</p>
          <div className="flex flex-col gap-1.5">
            {[
              { c: '#ff1744', l: 'Critical', sz: 12 }, { c: '#ff6d00', l: 'High', sz: 9 },
              { c: '#ffc400', l: 'Medium', sz: 7 }, { c: '#448aff', l: 'Low', sz: 6 },
            ].map(i => (
              <div key={i.l} className="flex items-center gap-2">
                <div className="rounded-full flex-shrink-0"
                  style={{ width: i.sz, height: i.sz, backgroundColor: i.c, boxShadow: `0 0 4px ${i.c}` }} />
                <span className="text-[10px] text-gray-400">{i.l}</span>
              </div>
            ))}
            <div className="mt-1 pt-1 border-t border-gray-700/30 flex flex-col gap-1.5">
              {showFlights && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 4px #00e5ff' }} /><span className="text-[10px] text-gray-500">Flights</span></div>}
              {showVessels && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 4px #34d399' }} /><span className="text-[10px] text-gray-500">Vessels</span></div>}
              {showISS && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500" style={{ boxShadow: '0 0 4px #a855f7' }} /><span className="text-[10px] text-gray-500">ISS</span></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Flight info card */}
      {selectedFlight && !showModal && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 bg-[#111827]/95 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-4 shadow-2xl shadow-black/40 w-80 animate-slide-up pointer-events-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">✈️</span>
              <div>
                <p className="text-white font-bold text-sm tracking-wider">{String(selectedFlight.callsign ?? selectedFlight.icao24 ?? '')}</p>
                <p className="text-[9px] text-gray-500">{String(selectedFlight.originCountry ?? '')}</p>
              </div>
            </div>
            <button onClick={() => setSelectedFlight(null)} className="text-gray-500 hover:text-white text-xs w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/5">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-black/30 rounded-lg p-2 text-center">
              <p className="text-gray-500 text-[8px] uppercase tracking-wider mb-0.5">Alt</p>
              <p className="text-white font-mono text-xs">{Math.round(Number(selectedFlight.altitude ?? 0)).toLocaleString()}m</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2 text-center">
              <p className="text-gray-500 text-[8px] uppercase tracking-wider mb-0.5">Speed</p>
              <p className="text-white font-mono text-xs">{Math.round(Number(selectedFlight.velocity ?? 0) * 3.6)}km/h</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2 text-center">
              <p className="text-gray-500 text-[8px] uppercase tracking-wider mb-0.5">Heading</p>
              <p className="text-white font-mono text-xs">{Math.round(Number(selectedFlight.heading ?? 0))}°</p>
            </div>
          </div>
          <p className="text-[9px] text-gray-600 mt-2 font-mono">ICAO {String(selectedFlight.icao24 ?? '')} · SQK {String(selectedFlight.squawk ?? '—')}</p>
        </div>
      )}

      {/* Vessel info card */}
      {selectedVessel && !showModal && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 bg-[#111827]/95 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-4 shadow-2xl shadow-black/40 w-80 animate-slide-up pointer-events-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🚢</span>
              <div>
                <p className="text-white font-bold text-sm tracking-wider">{String(selectedVessel.name ?? '')}</p>
                <p className="text-[9px] text-gray-500">MMSI {String(selectedVessel.mmsi ?? '')}</p>
              </div>
            </div>
            <button onClick={() => setSelectedVessel(null)} className="text-gray-500 hover:text-white text-xs w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/5">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-black/30 rounded-lg p-2 text-center">
              <p className="text-gray-500 text-[8px] uppercase tracking-wider mb-0.5">Speed</p>
              <p className="text-white font-mono text-xs">{Number(selectedVessel.speed ?? 0).toFixed(1)}kn</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2 text-center">
              <p className="text-gray-500 text-[8px] uppercase tracking-wider mb-0.5">Course</p>
              <p className="text-white font-mono text-xs">{Math.round(Number(selectedVessel.course ?? 0))}°</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2 text-center">
              <p className="text-gray-500 text-[8px] uppercase tracking-wider mb-0.5">Dest</p>
              <p className="text-white font-mono text-xs truncate">{String(selectedVessel.destination ?? '—')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Event modal */}
      {showModal && selectedEvent && (
        <EventCardModal
          event={selectedEvent as EventData}
          onClose={() => { setShowModal(false); setSelectedEvent(null); }}
        />
      )}

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <p className="text-[10px] text-gray-600 tracking-wide">Click pin · Drag to rotate · Scroll to zoom · Right-drag to tilt</p>
      </div>

      {/* Loading */}
      {isLoading && !loadError && (
        <div className="absolute inset-0 bg-black z-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-xs text-gray-600 tracking-wider uppercase">Loading 3D Globe…</p>
          </div>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 bg-black z-20 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 text-sm font-semibold mb-2">Globe failed to load</p>
            <p className="text-gray-600 text-xs mb-4">Check browser console for details</p>
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-500 pointer-events-auto">
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

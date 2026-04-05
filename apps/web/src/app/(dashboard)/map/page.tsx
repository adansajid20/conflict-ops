import dynamic from 'next/dynamic';

const CesiumGlobe = dynamic(() => import('@/components/map/CesiumGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-64px)] bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-xs text-gray-600 tracking-wider uppercase">Initializing globe…</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  return (
    <div className="w-full h-[calc(100vh-64px)]">
      <CesiumGlobe />
    </div>
  );
}

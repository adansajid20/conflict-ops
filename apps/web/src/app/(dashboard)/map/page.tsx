import dynamic from 'next/dynamic';

const OperationalMap = dynamic(() => import('@/components/map/OperationalMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-gray-400 text-xs font-mono">INITIALIZING OPERATIONAL MAP...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  return (
    <div className="w-full h-[calc(100vh-64px)]">
      <OperationalMap />
    </div>
  );
}

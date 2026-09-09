import { Navigation, MapPin, Ambulance, Maximize2 } from "lucide-react";

interface MapViewProps {
  variant?: "enroute" | "tohospital";
  height?: number | string;
  onClick?: () => void;
  showExpandHint?: boolean;
}

export function MapView({ variant = "enroute", height = 280, onClick, showExpandHint }: MapViewProps) {
  const isEnroute = variant === "enroute";
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      className={`relative w-full overflow-hidden rounded-2xl border border-[#E4E9F2] ${
        clickable ? "cursor-pointer active:scale-[0.995] transition-transform" : ""
      }`}
      style={{ height, background: "#F1F5F9" }}
    >
      {/* Soft grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`grid-${variant}`} width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#E4E9F2" strokeWidth="1" />
          </pattern>
          <linearGradient id={`bg-${variant}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F5F8FC" />
            <stop offset="100%" stopColor="#EAF1F8" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill={`url(#bg-${variant})`} />
        <rect width="100%" height="100%" fill={`url(#grid-${variant})`} />

        {/* Roads */}
        <path d="M -20 200 Q 120 160 220 220 T 500 180" stroke="#FFFFFF" strokeWidth="18" fill="none" strokeLinecap="round" />
        <path d="M 60 -20 Q 90 120 180 200 T 260 420" stroke="#FFFFFF" strokeWidth="14" fill="none" strokeLinecap="round" />
        <path d="M -20 80 L 400 110" stroke="#FFFFFF" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M 300 -20 L 270 400" stroke="#FFFFFF" strokeWidth="10" fill="none" strokeLinecap="round" />

        {/* Park / block tints */}
        <rect x="20" y="30" width="70" height="40" rx="6" fill="#DCEBD8" opacity="0.8" />
        <rect x="220" y="40" width="80" height="50" rx="6" fill="#E3E9F5" opacity="0.9" />
        <rect x="40" y="240" width="90" height="60" rx="6" fill="#E3E9F5" opacity="0.9" />

        {/* Route */}
        <path
          d={
            isEnroute
              ? "M 50 250 Q 130 220 170 180 T 280 90"
              : "M 60 230 Q 140 200 200 160 T 310 70"
          }
          stroke="#1F6FEB"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="2 8"
        />
        <path
          d={
            isEnroute
              ? "M 50 250 Q 130 220 170 180 T 280 90"
              : "M 60 230 Q 140 200 200 160 T 310 70"
          }
          stroke="#1F6FEB"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity="0.35"
        />
      </svg>

      {/* Ambulance marker */}
      <div
        className="absolute"
        style={{ left: 32, top: 232 }}
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#1F6FEB] opacity-20 animate-ping" style={{ width: 44, height: 44, left: -8, top: -8 }} />
          <div className="w-7 h-7 rounded-full bg-[#1F6FEB] border-[3px] border-white shadow-md flex items-center justify-center">
            <Ambulance className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* Destination marker */}
      <div className="absolute" style={{ right: 32, top: 60 }}>
        <div className="flex flex-col items-center">
          <div
            className={`w-9 h-9 rounded-full border-[3px] border-white shadow-md flex items-center justify-center ${
              isEnroute ? "bg-[#E5484D]" : "bg-[#0E9F6E]"
            }`}
          >
            <MapPin className="w-4 h-4 text-white" strokeWidth={2.5} fill="white" />
          </div>
        </div>
      </div>

      {/* Compass */}
      <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow-sm border border-[#E4E9F2] flex items-center justify-center">
        <Navigation className="w-4 h-4 text-[#1F6FEB]" strokeWidth={2.5} />
      </div>

      {/* Expand / tap-to-navigate hint */}
      {showExpandHint && (
        <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-full bg-white shadow-sm border border-[#E4E9F2] flex items-center gap-1.5">
          <Maximize2 className="w-3.5 h-3.5 text-[#1F6FEB]" strokeWidth={2.5} />
          <span style={{ fontSize: 10.5, color: "#0B2545", fontWeight: 700, letterSpacing: 0.3 }}>
            TAP TO NAVIGATE
          </span>
        </div>
      )}

      {/* Distance pill */}
      <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-white shadow-sm border border-[#E4E9F2] flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1F6FEB]" />
        <span style={{ fontSize: 11, color: "#0B2545", fontWeight: 600 }}>
          {isEnroute ? "1.8 km · Fastest route" : "3.2 km · To St. Mary Hospital"}
        </span>
      </div>
    </div>
  );
}

import { ArrowLeft, Navigation2, MapPin, Route, Clock, Plus, Minus, Crosshair } from "lucide-react";
import { MapView } from "./MapView";

interface FullScreenNavProps {
  variant: "enroute" | "tohospital";
  onBack: () => void;
}

export function FullScreenNav({ variant, onBack }: FullScreenNavProps) {
  const isEnroute = variant === "enroute";

  const title = isEnroute ? "Patient Location" : "Hospital Location";
  const placeName = isEnroute ? "MG Road, Sector 12" : "St. Mary Hospital";
  const placeSub = isEnroute ? "Rajeev Sharma · 58, Male" : "Emergency & Trauma Unit";
  const distance = isEnroute ? "1.8 km" : "3.2 km";
  const eta = isEnroute ? "4 MIN" : "8 MIN";
  const accent = isEnroute ? "#E5484D" : "#0E9F6E";

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-3 border-b border-[#E4E9F2] bg-white">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#F4F7FB] border border-[#E4E9F2] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4 text-[#0B2545]" strokeWidth={2.6} />
        </button>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 16, color: "#0B2545", fontWeight: 800, lineHeight: 1.1 }}>
            {title}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" strokeWidth={2.6} style={{ color: accent }} fill={accent} />
            <span style={{ fontSize: 11, color: "#6B7A90", fontWeight: 600 }}>{placeName}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#EAF1FB] border border-[#C8DAF5] flex-shrink-0">
          <Navigation2 className="w-3.5 h-3.5 text-[#1F6FEB]" strokeWidth={2.5} fill="#1F6FEB" />
          <span style={{ fontSize: 10.5, color: "#1456C2", fontWeight: 800, letterSpacing: 0.4 }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Full-size map */}
      <div className="relative flex-1 min-h-0">
        <MapView variant={variant} height="100%" />

        {/* Zoom / recenter controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <div className="rounded-2xl bg-white shadow-sm border border-[#E4E9F2] overflow-hidden">
            <button className="w-9 h-9 flex items-center justify-center active:bg-[#F4F7FB]">
              <Plus className="w-4 h-4 text-[#0B2545]" strokeWidth={2.6} />
            </button>
            <div className="h-px bg-[#E4E9F2]" />
            <button className="w-9 h-9 flex items-center justify-center active:bg-[#F4F7FB]">
              <Minus className="w-4 h-4 text-[#0B2545]" strokeWidth={2.6} />
            </button>
          </div>
          <button className="w-9 h-9 rounded-2xl bg-white shadow-sm border border-[#E4E9F2] flex items-center justify-center active:bg-[#F4F7FB]">
            <Crosshair className="w-4 h-4 text-[#1F6FEB]" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Bottom detail panel */}
      <div className="px-4 pt-3 pb-4 bg-white border-t border-[#E4E9F2]">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-[#F4F7FB] border border-[#E4E9F2] p-3">
            <div className="flex items-center gap-1.5">
              <Route className="w-3.5 h-3.5 text-[#1F6FEB]" strokeWidth={2.6} />
              <span style={{ fontSize: 10, color: "#6B7A90", letterSpacing: 1, fontWeight: 700 }}>
                DISTANCE
              </span>
            </div>
            <div style={{ fontSize: 18, color: "#0B2545", fontWeight: 800, marginTop: 2 }}>
              {distance}
            </div>
            <div style={{ fontSize: 11, color: "#0E9F6E", fontWeight: 700, marginTop: 1 }}>
              Fastest route
            </div>
          </div>
          <div className="rounded-2xl bg-[#F4F7FB] border border-[#E4E9F2] p-3">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#1F6FEB]" strokeWidth={2.6} />
              <span style={{ fontSize: 10, color: "#6B7A90", letterSpacing: 1, fontWeight: 700 }}>
                ETA
              </span>
            </div>
            <div style={{ fontSize: 18, color: "#0B2545", fontWeight: 800, marginTop: 2 }}>
              {eta}
            </div>
            <div style={{ fontSize: 11, color: "#6B7A90", fontWeight: 600, marginTop: 1 }}>
              {placeSub}
            </div>
          </div>
        </div>

        <button
          onClick={onBack}
          className="mt-3 w-full rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
          style={{
            background: "linear-gradient(180deg, #1F6FEB 0%, #1456C2 100%)",
            padding: "14px",
            boxShadow: "0 10px 22px -10px rgba(31,111,235,0.55)",
          }}
        >
          <ArrowLeft className="w-4 h-4 text-white" strokeWidth={2.6} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "white", letterSpacing: 0.3 }}>
            Back to Emergency
          </span>
        </button>
      </div>
    </div>
  );
}

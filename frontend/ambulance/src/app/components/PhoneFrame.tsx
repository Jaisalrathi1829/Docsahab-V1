import { ReactNode } from "react";
import { Signal, Wifi, BatteryMedium } from "lucide-react";

interface PhoneFrameProps {
  children: ReactNode;
  label: string;
  caption: string;
}

export function PhoneFrame({ children, label, caption }: PhoneFrameProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <div className="text-[#6B7A90]" style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: 600 }}>
          {label}
        </div>
        <div className="text-[#0B2545]" style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
          {caption}
        </div>
      </div>
      <div
        className="relative bg-black rounded-[48px] p-[10px] shadow-2xl"
        style={{ width: 380 }}
      >
        <div
          className="relative bg-white rounded-[40px] overflow-hidden"
          style={{ width: 360, height: 780 }}
        >
          {/* Status bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-7 pt-3 pb-1">
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0B2545" }}>9:41</span>
            <div className="flex items-center gap-1.5 text-[#0B2545]">
              <Signal className="w-3.5 h-3.5" strokeWidth={2.5} />
              <Wifi className="w-3.5 h-3.5" strokeWidth={2.5} />
              <BatteryMedium className="w-4 h-4" strokeWidth={2.5} />
            </div>
          </div>
          {/* Dynamic island */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-30" />

          {/* Content */}
          <div className="pt-10 h-full flex flex-col">{children}</div>

          {/* Home indicator */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 rounded-full bg-black/80 z-30" />
        </div>
      </div>
    </div>
  );
}

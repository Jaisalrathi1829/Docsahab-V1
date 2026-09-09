import { ReactNode } from "react";
import { Signal, Wifi, BatteryFull } from "lucide-react";

export function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-[380px] h-[800px] bg-black rounded-[48px] p-[10px] shadow-[0_30px_80px_-20px_rgba(15,42,76,0.25)]">
        <div className="relative w-full h-full bg-white rounded-[40px] overflow-hidden flex flex-col">
          {/* Status bar */}
          <div className="flex items-center justify-between px-7 pt-3 pb-1 text-[13px] text-slate-900 shrink-0">
            <span className="tracking-tight">9:41</span>
            <div className="absolute left-1/2 -translate-x-1/2 top-[10px] h-[26px] w-[110px] bg-black rounded-full" />
            <div className="flex items-center gap-1.5">
              <Signal className="w-3.5 h-3.5" strokeWidth={2.5} />
              <Wifi className="w-3.5 h-3.5" strokeWidth={2.5} />
              <BatteryFull className="w-4 h-4" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
    </div>
  );
}

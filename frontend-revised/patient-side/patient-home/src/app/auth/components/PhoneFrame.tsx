import type { ReactNode } from "react";
import { CrossIcon } from "./icons";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-2xl bg-brand-600 text-white shadow-[0_8px_20px_-6px_rgba(28,100,232,0.6)]">
        <CrossIcon className="size-5" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-[17px] font-extrabold tracking-tight text-ink">
            Docsahab
          </p>
          <p className="text-[11px] font-medium text-slate-soft">
            Emergency medical assistance
          </p>
        </div>
      )}
    </div>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(120%_120%_at_50%_0%,#eef5ff_0%,#e2edfb_45%,#d7e6fa_100%)] p-4 sm:p-8">
      <div className="relative w-full max-w-[400px]">
        <div className="relative overflow-hidden rounded-[44px] border border-white/70 bg-white shadow-[0_40px_80px_-30px_rgba(23,80,196,0.45)] ring-1 ring-brand-100">
          {/* Notch */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-30 h-7 w-40 -translate-x-1/2 rounded-b-2xl bg-white">
            <div className="mx-auto mt-2.5 h-1.5 w-16 rounded-full bg-brand-100" />
          </div>
          <div className="no-scrollbar relative h-[812px] overflow-y-auto bg-brand-50/40">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusBar({ dark = false }: { dark?: boolean }) {
  const tone = dark ? "text-white/90" : "text-ink/80";
  return (
    <div className={`flex items-center justify-between px-7 pb-1 pt-4 text-xs font-semibold ${tone}`}>
      <span className="tracking-tight">9:41</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px]">•••</span>
        <span className="text-[10px]">Wi‑Fi</span>
        <span className="ml-0.5 inline-block h-3 w-6 rounded-[4px] border border-current px-[2px] py-[2px]">
          <span className="block h-full w-4/5 rounded-[1px] bg-current" />
        </span>
      </div>
    </div>
  );
}

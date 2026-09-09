import {
  Stethoscope,
  ShieldCheck,
  Check,
  Ambulance,
  ArrowRight,
} from "lucide-react";
import type { SosState } from "../App";
import type { EmergencyView } from "../api";

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-[#1f6feb] flex items-center justify-center">
        <Stethoscope className="w-5 h-5 text-white" strokeWidth={2.5} />
      </div>
      <div className="leading-tight">
        <div className="text-[17px] text-slate-900 tracking-tight">Docsahab</div>
        <div className="text-[11px] text-slate-500">
          Emergency medical assistance
        </div>
      </div>
    </div>
  );
}

function ProfileAvatar({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2c7cf5] to-[#1d5fd6] text-white flex items-center justify-center text-[13px] shadow-[0_6px_16px_-8px_rgba(31,111,235,0.7)] active:scale-95 transition-transform"
      aria-label="Open medical profile"
    >
      AR
    </button>
  );
}

function SosButton({
  sos,
  count,
  onStart,
  onCancel,
}: {
  sos: SosState;
  count: number;
  onStart?: () => void;
  onCancel?: () => void;
}) {
  // STATE C — SOS SENT / ambulance assigned
  if (sos === "sent" || sos === "assigned") {
    return (
      <div className="relative flex items-center justify-center">
        <div className="absolute w-[300px] h-[300px] rounded-full bg-[#1f7a44]/[0.04]" />
        <div className="absolute w-[240px] h-[240px] rounded-full bg-[#1f7a44]/[0.07]" />
        <div className="relative w-[200px] h-[200px] rounded-full bg-[#1f7a44] flex flex-col items-center justify-center text-white shadow-[0_20px_44px_-14px_rgba(31,122,68,0.5)]">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Check className="w-7 h-7" strokeWidth={3} />
          </div>
          <span className="mt-2.5 text-[20px] tracking-[0.14em] leading-none">
            SOS SENT
          </span>
          <span className="mt-2 text-[12px] opacity-90 px-6 text-center leading-tight">
            {sos === "sent"
              ? "Finding the nearest ambulance…"
              : "Ambulance assigned"}
          </span>
        </div>
      </div>
    );
  }

  // STATE B — COUNTDOWN
  if (sos === "countdown") {
    return (
      <div className="relative flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-[300px] h-[300px] rounded-full bg-[#1f6feb]/[0.05]" />
          <div className="absolute w-[240px] h-[240px] rounded-full bg-[#1f6feb]/[0.09] animate-pulse" />
          <div className="relative w-[200px] h-[200px] rounded-full bg-gradient-to-b from-[#2c7cf5] to-[#1d5fd6] text-white flex flex-col items-center justify-center shadow-[0_20px_44px_-14px_rgba(31,111,235,0.5)]">
            <span className="text-[11px] tracking-[0.22em] uppercase opacity-80">
              Emergency request
            </span>
            <span className="mt-1 text-[13px] opacity-90">Sending SOS in</span>
            <span
              key={count}
              className="mt-1 text-[64px] leading-none tabular-nums"
            >
              {count}
            </span>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="mt-6 w-[220px] py-3.5 rounded-2xl border-2 border-[#1f6feb] text-[#1f6feb] text-[15px] tracking-wide bg-white active:bg-[#eef4ff] transition-colors"
        >
          CANCEL SOS
        </button>
      </div>
    );
  }

  // STATE A — NORMAL
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute w-[300px] h-[300px] rounded-full bg-[#1f6feb]/[0.04]" />
      <div className="absolute w-[240px] h-[240px] rounded-full bg-[#1f6feb]/[0.07]" />
      <button
        onClick={onStart}
        className="relative w-[200px] h-[200px] rounded-full bg-gradient-to-b from-[#2c7cf5] to-[#1d5fd6] text-white flex flex-col items-center justify-center shadow-[0_20px_44px_-14px_rgba(31,111,235,0.5)] active:scale-[0.98] transition-transform"
      >
        <span className="text-[11px] tracking-[0.22em] uppercase opacity-80">
          Tap for
        </span>
        <span className="mt-1.5 text-[44px] tracking-[0.18em] leading-none">
          SOS
        </span>
        <span className="mt-2.5 text-[12px] opacity-90">
          Connects you to a medic
        </span>
      </button>
    </div>
  );
}

function ActiveEmergencyCard({
  sos,
  emergency,
  onViewDetails,
}: {
  sos: SosState;
  emergency: EmergencyView | null;
  onViewDetails?: () => void;
}) {
  // "Assigned" is a fact about the backend emergency, not a local timer.
  const assigned = Boolean(emergency?.ambulance);
  const etaMinutes =
    emergency?.navigation.toPatient?.etaMinutes ?? emergency?.etaMinutes ?? null;
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_10px_30px_-20px_rgba(15,42,76,0.3)]">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[#1f7a44]">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-[#1f7a44] animate-ping opacity-60" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-[#1f7a44]" />
          </span>
          Active emergency
        </div>
        <span className="text-[11px] text-slate-400">SOS #4521</span>
      </div>

      <div className="px-4 py-3.5 space-y-2.5">
        <div className="flex items-center gap-2 text-[13px] text-slate-700">
          <span className="w-5 h-5 rounded-full bg-[#e8f6ee] text-[#1f7a44] flex items-center justify-center">
            <Check className="w-3 h-3" strokeWidth={3} />
          </span>
          SOS sent
        </div>
        <div className="flex items-center gap-2 text-[13px] text-slate-700">
          {assigned ? (
            <span className="w-5 h-5 rounded-full bg-[#e8f6ee] text-[#1f7a44] flex items-center justify-center">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
          ) : (
            <span className="w-5 h-5 rounded-full bg-[#eef4ff] flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1f6feb] animate-pulse" />
            </span>
          )}
          {assigned ? "Ambulance assigned" : "Assigning ambulance…"}
        </div>
      </div>

      {assigned && (
        <div className="mx-4 mb-3 rounded-xl bg-[#f7faff] border border-slate-100 p-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#eef4ff] flex items-center justify-center shrink-0">
              <Ambulance className="w-5 h-5 text-[#1f6feb]" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] text-slate-900 tracking-tight leading-tight">
                {emergency?.ambulance?.vehicleNo ?? "—"}
              </div>
              <div className="text-[12px] text-slate-500 mt-0.5">
                {emergency?.ambulance?.type ?? "Ambulance"} unit
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                ETA
              </div>
              <div className="text-[18px] text-[#1f6feb] tracking-tight leading-tight">
                {etaMinutes !== null ? `${etaMinutes} min` : "—"}
              </div>
            </div>
          </div>
          <div className="mt-3 text-[13px] text-slate-600">
            Your ambulance is on the way.
          </div>
        </div>
      )}

      <button
        onClick={onViewDetails}
        className="w-full px-4 py-3 border-t border-slate-100 flex items-center justify-between text-[13px] text-[#1f6feb] active:bg-slate-50 transition-colors"
      >
        View emergency details
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export function HomeScreen({
  sos,
  count,
  emergency,
  busy,
  onStartSos,
  onCancelSos,
  onOpenProfile,
  onViewDetails,
}: {
  sos: SosState;
  count: number;
  emergency: EmergencyView | null;
  busy?: boolean;
  onStartSos?: () => void;
  onCancelSos?: () => void;
  onOpenProfile?: () => void;
  onViewDetails?: () => void;
}) {
  const active = sos === "sent" || sos === "assigned";

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <Logo />
        <ProfileAvatar onClick={onOpenProfile} />
      </div>

      <div className="px-6 pt-4">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e8f6ee] text-[#1f7a44]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1f7a44]" />
          <span className="text-[11px]">Location active · Delhi NCR</span>
        </div>
        <h1 className="mt-3 text-[26px] leading-[1.15] tracking-tight text-slate-900">
          Hello, Arjun.
          <br />
          <span className="text-slate-500">
            {active
              ? "Help is on the way. Stay calm."
              : "Professional help is one tap away."}
          </span>
        </h1>
      </div>

      <div className="mt-6 mb-5 flex items-center justify-center">
        <SosButton
          sos={sos}
          count={count}
          onStart={onStartSos}
          onCancel={onCancelSos}
        />
      </div>

      {sos !== "countdown" && (
        <div className="px-6 flex items-center justify-center gap-2 text-[12px] text-slate-500 mb-6">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1f7a44]" />
          Verified ambulances · 24×7 medical team
        </div>
      )}

      {active && (
        <div className="px-5 pb-6 mt-auto">
          <ActiveEmergencyCard sos={sos} emergency={emergency} onViewDetails={onViewDetails} />
        </div>
      )}
    </div>
  );
}

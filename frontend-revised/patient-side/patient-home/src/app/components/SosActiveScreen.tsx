import { useEffect, useState } from "react";
import {
  Check,
  Ambulance,
  BellRing,
  ChevronLeft,
  Stethoscope,
  Volume2,
  MicOff,
  Clock,
} from "lucide-react";
import type { SosState } from "../App";
import { ambulance } from "../App";

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

type StepStatus = "done" | "active";

function Step({
  status,
  title,
  meta,
  isLast,
}: {
  status: StepStatus;
  title: string;
  meta?: string;
  isLast?: boolean;
}) {
  const dot =
    status === "done"
      ? "bg-[#1f7a44] text-white"
      : "bg-[#1f6feb] text-white ring-4 ring-[#1f6feb]/15";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center ${dot}`}
        >
          {status === "done" ? (
            <Check className="w-4 h-4" strokeWidth={3} />
          ) : (
            <span className="w-2 h-2 rounded-full bg-white" />
          )}
        </div>
        {!isLast && (
          <div
            className={`w-px flex-1 my-1 ${
              status === "done" ? "bg-[#1f7a44]/40" : "bg-slate-200"
            }`}
          />
        )}
      </div>
      <div className="pb-5">
        <div className="text-[15px] leading-tight text-slate-900">{title}</div>
        {meta && (
          <div className="text-[12px] text-slate-500 mt-0.5">{meta}</div>
        )}
      </div>
    </div>
  );
}

export function SosActiveScreen({
  sos,
  onBack,
  onOpenProfile,
}: {
  sos: SosState;
  onBack?: () => void;
  onOpenProfile?: () => void;
}) {
  const assigned = sos === "assigned";

  // Simulated responder call auto-connects (on speaker) once the ambulance
  // is assigned — the patient never presses a call button.
  const [callSecs, setCallSecs] = useState(0);
  useEffect(() => {
    if (!assigned) return;
    setCallSecs(0);
    const id = window.setInterval(() => setCallSecs((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [assigned]);

  return (
    <div className="flex flex-col h-full bg-[#f7faff]">
      <div className="px-5 pt-4 pb-6 bg-white">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="-ml-1 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          <button
            onClick={onOpenProfile}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2c7cf5] to-[#1d5fd6] text-white flex items-center justify-center text-[12px] active:scale-95 transition-transform"
          >
            AR
          </button>
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e8f6ee] text-[#1f7a44]">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-[#1f7a44] animate-ping opacity-60" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-[#1f7a44]" />
          </span>
          <span className="text-[11px]">Active emergency · SOS #4521</span>
        </div>
        <h1 className="mt-3 text-[30px] leading-[1.1] tracking-tight text-slate-900">
          Help is on
          <br />
          the way.
        </h1>
        <p className="mt-2 text-[14px] text-slate-500 leading-snug">
          Stay calm.{" "}
          {assigned
            ? "A verified ambulance has been assigned and is moving toward your location."
            : "We're finding the nearest verified ambulance for you."}
        </p>
      </div>

      <div className="px-5 -mt-3 space-y-3">
        {/* Live medical responder call card — auto-connects on speaker once
            the ambulance is assigned (simulated demo call). */}
        {assigned && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_8px_24px_-16px_rgba(15,42,76,0.18)]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[#1f7a44]/15 animate-ping" />
                <div className="relative w-11 h-11 rounded-full bg-[#e8f6ee] flex items-center justify-center">
                  <Stethoscope
                    className="w-5 h-5 text-[#1f7a44]"
                    strokeWidth={2.2}
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-[#1f7a44]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1f7a44]" />
                  Connected · on speaker
                </div>
                <div className="text-[14px] text-slate-900 leading-tight mt-0.5">
                  Dr. Mehta · Emergency medic
                </div>
                <div className="text-[12px] text-slate-500 mt-0.5">
                  "Stay with me. You don't need to do anything."
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-[#1f6feb]" /> Speaker on
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MicOff className="w-3.5 h-3.5" /> Tap to mute
              </span>
              <span className="tracking-tight text-slate-700 tabular-nums">
                {formatDuration(callSecs)}
              </span>
            </div>
          </div>
        )}

        {/* Emergency contacts notified prompt */}
        <div className="flex items-start gap-3 bg-[#e8f6ee] border border-[#1f7a44]/15 rounded-2xl px-4 py-3.5">
          <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4 text-[#1f7a44]" strokeWidth={2.2} />
          </div>
          <div className="flex-1">
            <div className="text-[14px] text-[#14572f] leading-tight">
              Emergency contacts notified
            </div>
            <div className="text-[12px] text-[#1f7a44] mt-0.5 leading-snug">
              Meera Raghavan and 2 others received your live location.
            </div>
          </div>
        </div>

        {/* Ambulance assignment card */}
        {assigned && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#eef4ff] flex items-center justify-center shrink-0">
                <Ambulance
                  className="w-5 h-5 text-[#1f6feb]"
                  strokeWidth={2.2}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
                  Ambulance assigned
                </div>
                <div className="text-[15px] text-slate-900 tracking-tight leading-tight mt-0.5">
                  {ambulance.vehicle} · {ambulance.unit}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                  ETA
                </div>
                <div className="text-[18px] text-[#1f6feb] tracking-tight leading-tight">
                  {ambulance.eta}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Simplified, patient-facing progress: SOS sent + Ambulance assigned only */}
      <div className="px-6 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
            Emergency progress
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Clock className="w-3 h-3" /> Live
          </div>
        </div>
        <div>
          <Step status="done" title="SOS sent" meta="9:41 AM" />
          {assigned ? (
            <Step
              status="done"
              title="Ambulance assigned"
              meta={`${ambulance.vehicle} · ${ambulance.unit}`}
              isLast
            />
          ) : (
            <Step status="active" title="Assigning ambulance…" isLast />
          )}
        </div>
      </div>

      <div className="h-6" />
    </div>
  );
}

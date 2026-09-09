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
  Building2,
  Lock,
  AlertTriangle,
} from "lucide-react";
import type { EmergencyView, EmergencyStatus } from "../api";

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

type StepStatus = "done" | "active" | "pending";

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
      : status === "active"
        ? "bg-[#1f6feb] text-white ring-4 ring-[#1f6feb]/15"
        : "bg-slate-200 text-slate-400";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${dot}`}>
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
        <div
          className={`text-[15px] leading-tight ${
            status === "pending" ? "text-slate-400" : "text-slate-900"
          }`}
        >
          {title}
        </div>
        {meta && <div className="text-[12px] text-slate-500 mt-0.5">{meta}</div>}
      </div>
    </div>
  );
}

/**
 * Patient-facing progress. Each step's state is derived from the emergency's
 * immutable timeline, so it can never disagree with the ambulance app or
 * regress after a refresh.
 */
const PROGRESS: Array<{ status: EmergencyStatus; title: string }> = [
  { status: "SOS_TRIGGERED", title: "SOS sent" },
  { status: "AMBULANCE_ASSIGNED", title: "Ambulance assigned" },
  { status: "AMBULANCE_EN_ROUTE", title: "Ambulance on the way" },
  { status: "PATIENT_PICKED_UP", title: "Picked up" },
  { status: "HOSPITAL_NOTIFIED", title: "Hospital ready" },
  { status: "ARRIVED", title: "Arrived at hospital" },
];

export function SosActiveScreen({
  emergency,
  busy,
  onBack,
  onOpenProfile,
  onCancelEmergency,
}: {
  emergency: EmergencyView | null;
  busy?: boolean;
  onBack?: () => void;
  onOpenProfile?: () => void;
  onCancelEmergency?: () => void;
}) {
  const assigned = Boolean(emergency?.ambulance);
  const callActive = Boolean(emergency?.call.active);
  const hospital = emergency?.hospital ?? null;
  const eta =
    emergency?.navigation.toPatient?.etaMinutes ?? emergency?.etaMinutes ?? null;

  // The call timer runs off the backend's callStartedAt, so it shows the true
  // elapsed time even if this screen was opened late or refreshed.
  const [callSecs, setCallSecs] = useState(0);
  useEffect(() => {
    if (!callActive || !emergency?.call.startedAt) return;
    const started = new Date(emergency.call.startedAt).getTime();
    const tick = () => setCallSecs(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [callActive, emergency?.call.startedAt]);

  const reached = new Set((emergency?.timeline ?? []).map((t) => t.status));
  const timeOf = (s: EmergencyStatus) =>
    emergency?.timeline.find((t) => t.status === s)?.createdAt;

  const cancellable =
    emergency !== null &&
    !reached.has("PATIENT_PICKED_UP") &&
    emergency.status !== "CANCELLED";

  return (
    <div className="flex flex-col h-full bg-[#f7faff] overflow-y-auto">
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
            {(emergency?.patient.name ?? "  ")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "ME"}
          </button>
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e8f6ee] text-[#1f7a44]">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-[#1f7a44] animate-ping opacity-60" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-[#1f7a44]" />
          </span>
          <span className="text-[11px]">
            Active emergency · {emergency?.status.replace(/_/g, " ") ?? "…"}
          </span>
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
            : "We're finding the nearest available ambulance for you."}
        </p>
      </div>

      <div className="px-5 -mt-3 space-y-3">
        {/* Medic call — appears automatically when the medic starts it.
            The patient never presses anything to answer. */}
        {callActive && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_8px_24px_-16px_rgba(15,42,76,0.18)]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[#1f7a44]/15 animate-ping" />
                <div className="relative w-11 h-11 rounded-full bg-[#e8f6ee] flex items-center justify-center">
                  <Stethoscope className="w-5 h-5 text-[#1f7a44]" strokeWidth={2.2} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-[#1f7a44]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1f7a44]" />
                  Connected · on speaker
                </div>
                <div className="text-[14px] text-slate-900 leading-tight mt-0.5">
                  {emergency?.ambulance?.driverName
                    ? `${emergency.ambulance.driverName} · Emergency medic`
                    : "Emergency medic"}
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
            <div className="mt-2 text-[10px] text-slate-400">
              Simulated call — no audio connection exists in this build.
            </div>
          </div>
        )}

        {/* Critical alert, derived from the patient's allergies. */}
        {emergency?.criticalAlert && (
          <div className="flex items-start gap-3 bg-[#fff4e5] border border-[#e89b2b]/30 rounded-2xl px-4 py-3.5">
            <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#b8860b]" strokeWidth={2.2} />
            </div>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.12em] text-[#8a5a12]">
                Critical alert shared with responders
              </div>
              <div className="text-[14px] text-[#4a2e07] mt-0.5">
                {emergency.criticalAlert}
              </div>
            </div>
          </div>
        )}

        {emergency?.patient.emergencyContactName && (
          <div className="flex items-start gap-3 bg-[#e8f6ee] border border-[#1f7a44]/15 rounded-2xl px-4 py-3.5">
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4 text-[#1f7a44]" strokeWidth={2.2} />
            </div>
            <div className="flex-1">
              <div className="text-[14px] text-[#14572f] leading-tight">
                Emergency contact on file
              </div>
              <div className="text-[12px] text-[#1f7a44] mt-0.5 leading-snug">
                {emergency.patient.emergencyContactName}
                {emergency.patient.emergencyContactPhone
                  ? ` · +91 ${emergency.patient.emergencyContactPhone}`
                  : ""}
              </div>
            </div>
          </div>
        )}

        {/* Assigned ambulance */}
        {assigned && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#eef4ff] flex items-center justify-center shrink-0">
                <Ambulance className="w-5 h-5 text-[#1f6feb]" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
                  Ambulance assigned
                </div>
                <div className="text-[15px] text-slate-900 tracking-tight leading-tight mt-0.5">
                  {emergency!.ambulance!.vehicleNo}
                  {emergency!.ambulance!.type ? ` · ${emergency!.ambulance!.type}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                  {emergency?.patientOnboard ? "To hospital" : "ETA"}
                </div>
                <div className="text-[18px] text-[#1f6feb] tracking-tight leading-tight">
                  {emergency?.patientOnboard
                    ? emergency.navigation.toHospital
                      ? `${emergency.navigation.toHospital.etaMinutes} min`
                      : "—"
                    : eta !== null
                      ? `${eta} min`
                      : "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hospital — shows temporary vs locked, both owned by the backend. */}
        {hospital && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#e8f6ee] flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-[#1f7a44]" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
                  {hospital.locked ? "Destination confirmed" : "Hospital being arranged"}
                </div>
                <div className="text-[15px] text-slate-900 tracking-tight leading-tight mt-0.5">
                  {hospital.name}
                </div>
              </div>
              {hospital.locked ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#1f7a44]">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              ) : (
                <span className="text-[11px] text-amber-600">Provisional</span>
              )}
            </div>
          </div>
        )}
      </div>

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
          {PROGRESS.map((step, i) => {
            const done = reached.has(step.status);
            const isNext =
              !done && PROGRESS.slice(0, i).every((s) => reached.has(s.status));
            const at = timeOf(step.status);
            return (
              <Step
                key={step.status}
                status={done ? "done" : isNext ? "active" : "pending"}
                title={step.title}
                meta={at ? formatTime(at) : undefined}
                isLast={i === PROGRESS.length - 1}
              />
            );
          })}
        </div>
      </div>

      {cancellable && (
        <div className="px-6 pb-6 mt-2">
          <button
            onClick={onCancelEmergency}
            disabled={busy}
            className="w-full py-3 rounded-2xl border border-slate-300 text-[14px] text-slate-600 bg-white active:bg-slate-50 disabled:opacity-60"
          >
            {busy ? "Cancelling…" : "Cancel emergency"}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Cancelling is only possible before the ambulance picks you up.
          </p>
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}

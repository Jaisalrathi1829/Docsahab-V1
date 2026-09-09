import {
  Check,
  Ambulance,
  Phone,
  BellRing,
  ChevronLeft,
  Stethoscope,
  Clock,
  Volume2,
  MicOff,
} from "lucide-react";
import type { Emergency, EmergencyStatus } from "../api";

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
      : "bg-slate-100 text-slate-400";
  const titleClass =
    status === "pending" ? "text-slate-400" : "text-slate-900";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center ${dot}`}
        >
          {status === "done" ? (
            <Check className="w-4 h-4" strokeWidth={3} />
          ) : status === "active" ? (
            <span className="w-2 h-2 rounded-full bg-white" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
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
      <div className={`pb-5 ${isLast ? "" : ""}`}>
        <div className={`text-[15px] leading-tight ${titleClass}`}>{title}</div>
        {meta && (
          <div className="text-[12px] text-slate-500 mt-0.5">{meta}</div>
        )}
      </div>
    </div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-10 h-10 rounded-xl bg-[#eef4ff] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#1f6feb]" strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
          {label}
        </div>
        <div className="text-[14px] text-slate-900 truncate">{value}</div>
      </div>
      {accent && (
        <div className="text-[15px] tracking-tight text-[#1f6feb]">{accent}</div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  primary,
}: {
  icon: any;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border ${
        primary
          ? "bg-[#1f6feb] border-[#1f6feb] text-white shadow-[0_8px_20px_-8px_rgba(31,111,235,0.5)]"
          : "bg-white border-slate-200 text-slate-700"
      }`}
    >
      <Icon className="w-5 h-5" strokeWidth={2.2} />
      <span className="text-[12px]">{label}</span>
    </button>
  );
}

/**
 * Journey shown to the patient, mapped to real backend statuses.
 * Completion is derived from the TIMELINE (which statuses actually happened),
 * not from the current status's position in a list — the lifecycle can legally
 * skip ahead (e.g. a hospital accepting while the ambulance is still en route),
 * and an index-based stepper would wrongly reset every earlier step.
 */
const JOURNEY: { status: EmergencyStatus; title: string }[] = [
  { status: "SOS_TRIGGERED", title: "SOS sent" },
  { status: "AMBULANCE_ASSIGNED", title: "Ambulance assigned" },
  { status: "AMBULANCE_EN_ROUTE", title: "Ambulance en route" },
  { status: "PATIENT_PICKED_UP", title: "Patient picked up" },
  { status: "ARRIVED", title: "Arrived at hospital" },
];

export function SosActiveScreen({
  emergency,
  onBack,
}: {
  emergency?: Emergency | null;
  onBack?: () => void;
}) {
  const reached = new Set((emergency?.timelineEvents ?? []).map((t) => t.status));
  const lastReachedIdx = JOURNEY.reduce(
    (acc, step, i) => (reached.has(step.status) ? i : acc),
    -1
  );

  const stepState = (i: number): StepStatus => {
    if (i < lastReachedIdx) return "done";
    if (i === lastReachedIdx) return emergency?.status === "ARRIVED" ? "done" : "active";
    return "pending";
  };

  const timeOf = (status: EmergencyStatus): string | undefined => {
    const ev = (emergency?.timelineEvents ?? []).find((t) => t.status === status);
    if (!ev) return undefined;
    return new Date(ev.createdAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const vehicle =
    emergency?.assignedAmbulance?.vehicleNo ??
    emergency?.assignedAmbulanceId ??
    "Awaiting assignment";
  const eta = emergency?.etaMinutes;

  return (
    <div className="flex flex-col h-full bg-[#f7faff]">
      <div className="px-6 pt-4 pb-6 bg-white">
        <button
          onClick={onBack}
          className="mb-3 -ml-1 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e8f6ee] text-[#1f7a44]">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-[#1f7a44] animate-ping opacity-60" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-[#1f7a44]" />
          </span>
          <span className="text-[11px]">
            {emergency
              ? `SOS active · ${emergency.status.replace(/_/g, " ")}`
              : "SOS active"}
          </span>
        </div>
        <h1 className="mt-3 text-[30px] leading-[1.1] tracking-tight text-slate-900">
          Help is on
          <br />
          the way.
        </h1>
        <p className="mt-2 text-[14px] text-slate-500 leading-snug">
          Stay calm. A verified ambulance has been assigned and is moving
          toward your location.
        </p>
      </div>

      <div className="px-5 -mt-3 space-y-3">
        {/* Live medical team call card */}
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
            <span className="tracking-tight text-slate-700">00:38</span>
          </div>
        </div>

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
              Priya Sharma and 2 others received your live location.
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl px-4 py-1 divide-y divide-slate-100">
          <StatusRow
            icon={Ambulance}
            label="Ambulance assigned"
            value={vehicle}
            accent={eta != null ? `${eta} min` : undefined}
          />
          <StatusRow
            icon={Stethoscope}
            label="Medical team"
            value="Connected · audio live"
          />
        </div>
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
          {JOURNEY.map((step, i) => {
            const state = stepState(i);
            let meta = timeOf(step.status);
            if (step.status === "AMBULANCE_ASSIGNED" && state !== "pending") {
              meta = vehicle;
            }
            if (
              step.status === "AMBULANCE_EN_ROUTE" &&
              state === "active" &&
              eta != null
            ) {
              meta = `Arriving in approx. ${eta} minutes`;
            }
            return (
              <Step
                key={step.status}
                status={state}
                title={step.title}
                meta={meta}
                isLast={i === JOURNEY.length - 1}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-auto px-5 pt-3 pb-6 bg-white border-t border-slate-100">
        <div className="flex gap-2.5">
          <ActionButton icon={Phone} label="Call ambulance" primary />
        </div>
      </div>
    </div>
  );
}

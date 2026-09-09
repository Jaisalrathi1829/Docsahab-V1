import { useState } from "react";
import {
  Check,
  Clock,
  Building2,
  BellRing,
  ChevronRight,
  UserRound,
} from "lucide-react";
import { DocsahabLogo } from "./DocsahabLogo";
import { MapView } from "./MapView";
import { FullScreenNav } from "./FullScreenNav";

function WorkflowStep({
  index,
  label,
  state,
}: {
  index: number;
  label: string;
  state: "done" | "active" | "pending";
}) {
  const isActive = state === "active";
  return (
    <div
      className="flex items-center gap-1.5 flex-1 min-w-0 rounded-xl"
      style={{
        background: isActive ? "#EAF1FB" : "transparent",
        padding: isActive ? "4px 6px" : "4px 2px",
        border: isActive ? "1px solid #C8DAF5" : "1px solid transparent",
      }}
    >
      <div
        className="rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          width: isActive ? 24 : 22,
          height: isActive ? 24 : 22,
          background:
            state === "done" ? "#0E9F6E" : isActive ? "#1F6FEB" : "#E4E9F2",
          color: state === "pending" ? "#6B7A90" : "white",
          boxShadow: isActive ? "0 0 0 3px rgba(31,111,235,0.18)" : "none",
        }}
      >
        {state === "done" ? (
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        ) : (
          <span style={{ fontSize: 11, fontWeight: 800 }}>{index}</span>
        )}
      </div>
      <span
        className="truncate"
        style={{
          fontSize: isActive ? 12 : 11,
          fontWeight: isActive ? 800 : 600,
          color:
            isActive
              ? "#0B2545"
              : state === "done"
              ? "#0B2545"
              : "#6B7A90",
        }}
      >
        {label}
      </span>
    </div>
  );
}

type Severity = "red" | "yellow" | "green" | null;

export function ScreenPickedUp() {
  const [notified, setNotified] = useState(false);
  const [severity, setSeverity] = useState<Severity>("red");
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="flex flex-col h-full px-4 pb-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between pt-1 pb-3">
        <DocsahabLogo />
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#E6F4EF] border border-[#B6E0CE]">
          <span className="w-2 h-2 rounded-full bg-[#0E9F6E]" />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#066547", letterSpacing: 0.5 }}>
            ONBOARD
          </span>
        </div>
      </div>

      {/* Workflow bar — active step emphasized */}
      <div className="rounded-2xl border border-[#E4E9F2] bg-white p-2 mb-3 flex items-center gap-1">
        <WorkflowStep index={1} label="Picked Up" state="done" />
        <div className="h-px flex-shrink-0 w-2 bg-[#E4E9F2]" />
        <WorkflowStep index={2} label="Severity" state="active" />
        <div className="h-px flex-shrink-0 w-2 bg-[#E4E9F2]" />
        <WorkflowStep index={3} label="Notify" state="pending" />
      </div>

      {/* Patient status card — restructured hierarchy */}
      <div className="rounded-2xl bg-white border border-[#E4E9F2] p-3 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#E6F4EF] flex items-center justify-center">
              <UserRound className="w-5 h-5 text-[#0E9F6E]" strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#066547", letterSpacing: 1.2, fontWeight: 800 }}>
                PATIENT ONBOARD
              </div>
              <div style={{ fontSize: 14, color: "#0B2545", fontWeight: 700, lineHeight: 1.1 }}>
                Rajeev Sharma, 58
              </div>
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 9.5, color: "#6B7A90", letterSpacing: 1, fontWeight: 700 }}>
              ETA TO HOSPITAL
            </div>
            <div className="flex items-baseline gap-1 justify-end">
              <Clock className="w-3.5 h-3.5 text-[#1F6FEB]" strokeWidth={2.5} />
              <span style={{ fontSize: 18, fontWeight: 800, color: "#1F6FEB", lineHeight: 1 }}>
                8 MIN
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Severity section — dominant */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0B2545", letterSpacing: -0.2 }}>
            Select Severity
          </span>
          <span style={{ fontSize: 11, color: "#6B7A90", fontWeight: 600 }}>Required</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {/* Red */}
          <button
            onClick={() => setSeverity("red")}
            className="rounded-2xl p-3 text-left relative overflow-hidden transition-all duration-150"
            style={
              severity === "red"
                ? {
                    background: "linear-gradient(180deg, #E5484D 0%, #C8363B 100%)",
                    border: "2.5px solid #B42318",
                    boxShadow: "0 10px 22px -8px rgba(229,72,77,0.55), 0 0 0 4px rgba(229,72,77,0.15)",
                    transform: "translateY(-2px)",
                  }
                : {
                    background: "white",
                    border: "2px solid #E4E9F2",
                    opacity: 0.7,
                  }
            }
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center mb-2"
              style={{
                background: severity === "red" ? "rgba(255,255,255,0.20)" : "#FDECEA",
                border: severity === "red" ? "1px solid rgba(255,255,255,0.3)" : "none",
              }}
            >
              <span
                className="w-3.5 h-3.5 rounded-full"
                style={{ background: severity === "red" ? "white" : "#E5484D" }}
              />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: severity === "red" ? "white" : "#0B2545", letterSpacing: 0.5 }}>
              RED
            </div>
            <div style={{ fontSize: 11, color: severity === "red" ? "rgba(255,255,255,0.92)" : "#6B7A90", lineHeight: 1.3, fontWeight: 600 }}>
              Critical
            </div>
            {severity === "red" && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3 text-[#E5484D]" strokeWidth={4} />
              </div>
            )}
          </button>

          {/* Yellow */}
          <button
            onClick={() => setSeverity("yellow")}
            className="rounded-2xl p-3 text-left relative overflow-hidden transition-all duration-150"
            style={
              severity === "yellow"
                ? {
                    background: "linear-gradient(180deg, #F4B400 0%, #D69E00 100%)",
                    border: "2.5px solid #B8860B",
                    boxShadow: "0 10px 22px -8px rgba(244,180,0,0.55), 0 0 0 4px rgba(244,180,0,0.15)",
                    transform: "translateY(-2px)",
                  }
                : {
                    background: "white",
                    border: "2px solid #E4E9F2",
                    opacity: 0.7,
                  }
            }
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center mb-2"
              style={{
                background: severity === "yellow" ? "rgba(255,255,255,0.20)" : "#FEF6D8",
                border: severity === "yellow" ? "1px solid rgba(255,255,255,0.3)" : "none",
              }}
            >
              <span
                className="w-3.5 h-3.5 rounded-full"
                style={{ background: severity === "yellow" ? "white" : "#F4B400" }}
              />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: severity === "yellow" ? "white" : "#0B2545" }}>
              YELLOW
            </div>
            <div style={{ fontSize: 11, color: severity === "yellow" ? "rgba(255,255,255,0.92)" : "#6B7A90", lineHeight: 1.3, fontWeight: 600 }}>
              Moderate
            </div>
            {severity === "yellow" && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3 text-[#F4B400]" strokeWidth={4} />
              </div>
            )}
          </button>

          {/* Green */}
          <button
            onClick={() => setSeverity("green")}
            className="rounded-2xl p-3 text-left relative overflow-hidden transition-all duration-150"
            style={
              severity === "green"
                ? {
                    background: "linear-gradient(180deg, #0E9F6E 0%, #088557 100%)",
                    border: "2.5px solid #066547",
                    boxShadow: "0 10px 22px -8px rgba(14,159,110,0.55), 0 0 0 4px rgba(14,159,110,0.15)",
                    transform: "translateY(-2px)",
                  }
                : {
                    background: "white",
                    border: "2px solid #E4E9F2",
                    opacity: 0.7,
                  }
            }
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center mb-2"
              style={{
                background: severity === "green" ? "rgba(255,255,255,0.20)" : "#E6F4EF",
                border: severity === "green" ? "1px solid rgba(255,255,255,0.3)" : "none",
              }}
            >
              <span
                className="w-3.5 h-3.5 rounded-full"
                style={{ background: severity === "green" ? "white" : "#0E9F6E" }}
              />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: severity === "green" ? "white" : "#0B2545" }}>
              GREEN
            </div>
            <div style={{ fontSize: 11, color: severity === "green" ? "rgba(255,255,255,0.92)" : "#6B7A90", lineHeight: 1.3, fontWeight: 600 }}>
              Stable
            </div>
            {severity === "green" && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3 text-[#0E9F6E]" strokeWidth={4} />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Hospital readiness — primary message dominates */}
      <div
        className="rounded-2xl p-3 mb-3"
        style={{
          background: "linear-gradient(180deg, #E6F4EF 0%, #D5ECE0 100%)",
          border: "1.5px solid #9CD3B8",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center border border-[#B6E0CE] shadow-sm">
            <Building2 className="w-6 h-6 text-[#0E9F6E]" strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0E9F6E]" />
              <span style={{ fontSize: 18, fontWeight: 800, color: "#066547", letterSpacing: -0.2, lineHeight: 1 }}>
                HOSPITAL READY
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#066547", fontWeight: 600, marginTop: 2 }}>
              St. Mary Hospital
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 pl-1">
          {["Accepted"].map((t) => (
            <div
              key={t}
              className="flex items-center gap-1 transition-all duration-300"
            >
              <Check className="w-3 h-3 text-[#0E9F6E]" strokeWidth={3.5} />
              <span style={{ fontSize: 10.5, color: "#066547", fontWeight: 600, opacity: 0.85 }}>
                {t}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Map - smallest, now clickable */}
      <MapView
        variant="tohospital"
        height={92}
        onClick={() => setMapOpen(true)}
        showExpandHint
      />

      {/* Primary CTA / success state */}
      {!notified ? (
        <button
          onClick={() => setNotified(true)}
          className="mt-3 w-full rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
          style={{
            background: "linear-gradient(180deg, #1F6FEB 0%, #1456C2 100%)",
            padding: "16px",
            boxShadow: "0 10px 22px -10px rgba(31,111,235,0.55)",
          }}
        >
          <BellRing className="w-5 h-5 text-white" strokeWidth={2.5} />
          <span style={{ fontSize: 16, fontWeight: 800, color: "white", letterSpacing: 0.5 }}>
            NOTIFY HOSPITAL
          </span>
          <ChevronRight className="w-5 h-5 text-white" strokeWidth={2.8} />
        </button>
      ) : (
        <div
          className="mt-3 w-full rounded-2xl p-3"
          style={{
            background: "linear-gradient(180deg, #E6F4EF 0%, #D5ECE0 100%)",
            border: "1.5px solid #0E9F6E",
            boxShadow: "0 10px 22px -10px rgba(14,159,110,0.45)",
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-[#0E9F6E] flex items-center justify-center">
              <Check className="w-4 h-4 text-white" strokeWidth={3.5} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#066547", letterSpacing: 0.2 }}>
              HOSPITAL NOTIFIED
            </span>
          </div>
          <div className="flex items-center gap-3 pl-1">
            {["Severity Shared", "ETA Shared", "Resources"].map((t) => (
              <div key={t} className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-[#0E9F6E]" strokeWidth={3.5} />
                <span style={{ fontSize: 11.5, color: "#066547", fontWeight: 700 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full-screen hospital navigation / location view */}
      {mapOpen && <FullScreenNav variant="tohospital" onBack={() => setMapOpen(false)} />}
    </div>
  );
}

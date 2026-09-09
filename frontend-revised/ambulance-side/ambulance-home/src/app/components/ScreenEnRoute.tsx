import { useState } from "react";
import { Phone, PhoneCall, UserRound, HeartPulse, AlertTriangle, ChevronRight, Siren, X } from "lucide-react";
import { DocsahabLogo } from "./DocsahabLogo";
import { MapView } from "./MapView";
import { FullScreenNav } from "./FullScreenNav";

export function ScreenEnRoute({ onPickedUp }: { onPickedUp?: () => void }) {
  const [onCall, setOnCall] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="flex flex-col h-full px-4 pb-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between pt-1 pb-3">
        <DocsahabLogo />
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#FDECEC] border border-[#F8C9CB]">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#E5484D] opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E5484D]" />
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#B42318", letterSpacing: 0.5 }}>
            LIVE EMERGENCY
          </span>
        </div>
      </div>

      {/* Primary ETA Card */}
      <div
        className="rounded-2xl p-4 mb-3"
        style={{
          background: "linear-gradient(135deg, #1F6FEB 0%, #2E7BF0 100%)",
          boxShadow: "0 8px 20px -8px rgba(31,111,235,0.45)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", letterSpacing: 1.5, fontWeight: 600 }}>
              ETA TO PATIENT
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span style={{ fontSize: 44, fontWeight: 700, color: "white", lineHeight: 1 }}>4</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: "white" }}>MIN</span>
            </div>
          </div>
          <div className="text-right">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-1 ml-auto">
              <Siren className="w-6 h-6 text-white" strokeWidth={2.2} />
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", letterSpacing: 1 }}>UNIT AMB-204</div>
          </div>
        </div>
        <div className="h-px bg-white/20 my-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-white" strokeWidth={2.5} />
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", letterSpacing: 1 }}>PROBABLE EMERGENCY SITUATION</div>
              <div style={{ fontSize: 15, color: "white", fontWeight: 600 }}>Cardiac Emergency</div>
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-white/15">
            <span style={{ fontSize: 10, color: "white", fontWeight: 700, letterSpacing: 0.5 }}>PRIORITY 1</span>
          </div>
        </div>
      </div>

      {/* Critical Alert — elevated emphasis */}
      <div
        className="rounded-2xl p-3.5 mb-3 flex items-center gap-3 relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #FFF4E0 0%, #FFE9C7 100%)",
          border: "1.5px solid #E89B2B",
          boxShadow: "0 6px 16px -10px rgba(232,155,43,0.55)",
        }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5"
          style={{ background: "#E89B2B" }}
        />
        <div className="w-12 h-12 rounded-2xl bg-[#E89B2B] flex items-center justify-center flex-shrink-0 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-white" strokeWidth={2.6} fill="rgba(255,255,255,0.15)" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="px-1.5 py-0.5 rounded"
              style={{ background: "#E89B2B", fontSize: 9.5, color: "white", letterSpacing: 1, fontWeight: 800 }}
            >
              CRITICAL ALERT
            </span>
          </div>
          <div style={{ fontSize: 17, color: "#4A2E07", fontWeight: 700, lineHeight: 1.15, marginTop: 3 }}>
            Penicillin Allergy
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#8A5A12]" />
      </div>

      {/* Map — slightly reduced, now clickable */}
      <MapView variant="enroute" height={210} onClick={() => setMapOpen(true)} showExpandHint />

      {/* Patient info row — simplified */}
      <div className="mt-3 mb-3 flex items-center gap-3 rounded-2xl bg-[#F4F7FB] p-3 border border-[#E4E9F2]">
        <div className="w-10 h-10 rounded-full bg-[#DCE7F8] flex items-center justify-center flex-shrink-0">
          <UserRound className="w-5 h-5 text-[#1F6FEB]" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 15, color: "#0B2545", fontWeight: 700, lineHeight: 1.1 }}>
            Rajeev Sharma
          </div>
          <div style={{ fontSize: 11, color: "#6B7A90", marginTop: 1 }}>58 years · Male</div>
        </div>
      </div>

      {/* Patient on Call — single full-width connect card */}
      {!onCall ? (
        <button
          onClick={() => setOnCall(true)}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-white border border-[#D6DEEA] active:bg-[#F4F7FB] active:scale-[0.99] transition-transform mb-3"
        >
          <Phone className="w-[18px] h-[18px] text-[#1F6FEB]" strokeWidth={2.5} />
          <span style={{ fontSize: 15, color: "#0B2545", fontWeight: 700 }}>Patient on Call</span>
        </button>
      ) : (
        <div
          className="w-full rounded-2xl p-3.5 mb-3 flex items-center gap-3 relative overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #E6F4EF 0%, #D5ECE0 100%)",
            border: "1.5px solid #0E9F6E",
            boxShadow: "0 6px 16px -10px rgba(14,159,110,0.55)",
          }}
        >
          <div className="relative w-11 h-11 rounded-2xl bg-[#0E9F6E] flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="absolute inset-0 rounded-2xl bg-[#0E9F6E] opacity-30 animate-ping" />
            <PhoneCall className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 10, color: "#066547", letterSpacing: 1.2, fontWeight: 800 }}>
              CONNECTED
            </div>
            <div style={{ fontSize: 15, color: "#0B2545", fontWeight: 700, lineHeight: 1.15 }}>
              Patient on Call
            </div>
            <div style={{ fontSize: 11, color: "#066547", fontWeight: 600, marginTop: 1 }}>
              Responder connected with patient
            </div>
          </div>
          <button
            onClick={() => setOnCall(false)}
            className="w-9 h-9 rounded-full bg-[#E5484D] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform shadow-sm"
          >
            <X className="w-4 h-4 text-white" strokeWidth={2.8} />
          </button>
        </div>
      )}

      {/* Primary CTA */}
      <button
        onClick={onPickedUp}
        className="w-full rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
        style={{
          background: "linear-gradient(180deg, #0E9F6E 0%, #088557 100%)",
          padding: "16px",
          boxShadow: "0 10px 22px -10px rgba(14,159,110,0.55)",
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, color: "white", letterSpacing: 0.5 }}>
          PATIENT PICKED UP
        </span>
        <ChevronRight className="w-5 h-5 text-white" strokeWidth={2.8} />
      </button>

      {/* Full-screen patient location / navigation view */}
      {mapOpen && <FullScreenNav variant="enroute" onBack={() => setMapOpen(false)} />}
    </div>
  );
}

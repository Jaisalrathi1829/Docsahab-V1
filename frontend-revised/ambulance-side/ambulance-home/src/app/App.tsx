import { useState } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { ScreenEnRoute } from "./components/ScreenEnRoute";
import { ScreenPickedUp } from "./components/ScreenPickedUp";

export default function App() {
  const [screen, setScreen] = useState<"enroute" | "pickedup">("enroute");

  return (
    <div
      className="min-h-screen w-full py-12 px-6 flex flex-col items-center"
      style={{
        background:
          "radial-gradient(1200px 600px at 20% 0%, #EAF1FB 0%, transparent 60%), radial-gradient(1000px 500px at 90% 100%, #E6F4EF 0%, transparent 60%), #F7F9FC",
      }}
    >
      <div className="text-center mb-10">
        <div
          className="inline-block px-3 py-1 rounded-full bg-white border border-[#E4E9F2] mb-3"
          style={{ fontSize: 11, letterSpacing: 1.5, color: "#1F6FEB", fontWeight: 700 }}
        >
          DOCSAHAB · AMBULANCE WORKFLOW
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#0B2545",
            lineHeight: 1.15,
            letterSpacing: -0.5,
          }}
        >
          One mission. Two stages.
        </h1>
        <p
          className="mt-2 max-w-xl mx-auto"
          style={{ fontSize: 15, color: "#6B7A90", lineHeight: 1.5 }}
        >
          A calm, focused emergency coordination interface designed for responders
          working under pressure. Each screen surfaces one critical decision.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => setScreen("enroute")}
          className="flex items-center gap-2 px-4 py-2 rounded-full transition-all"
          style={{
            background: screen === "enroute" ? "#1F6FEB" : "white",
            border: screen === "enroute" ? "1.5px solid #1456C2" : "1.5px solid #D6DEEA",
            boxShadow: screen === "enroute" ? "0 4px 14px -6px rgba(31,111,235,0.5)" : "none",
          }}
        >
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{
              background: screen === "enroute" ? "rgba(255,255,255,0.25)" : "#EAF1FB",
              fontSize: 11,
              fontWeight: 800,
              color: screen === "enroute" ? "white" : "#1F6FEB",
            }}
          >
            1
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: screen === "enroute" ? "white" : "#6B7A90",
              letterSpacing: 0.3,
            }}
          >
            En Route
          </span>
        </button>

        <div
          className="h-px w-8"
          style={{ background: screen === "pickedup" ? "#0E9F6E" : "#D6DEEA" }}
        />

        <button
          onClick={() => setScreen("pickedup")}
          className="flex items-center gap-2 px-4 py-2 rounded-full transition-all"
          style={{
            background: screen === "pickedup" ? "#0E9F6E" : "white",
            border: screen === "pickedup" ? "1.5px solid #088557" : "1.5px solid #D6DEEA",
            boxShadow: screen === "pickedup" ? "0 4px 14px -6px rgba(14,159,110,0.5)" : "none",
          }}
        >
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{
              background: screen === "pickedup" ? "rgba(255,255,255,0.25)" : "#E6F4EF",
              fontSize: 11,
              fontWeight: 800,
              color: screen === "pickedup" ? "white" : "#0E9F6E",
            }}
          >
            2
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: screen === "pickedup" ? "white" : "#6B7A90",
              letterSpacing: 0.3,
            }}
          >
            Patient Onboard
          </span>
        </button>
      </div>

      <PhoneFrame
        label={screen === "enroute" ? "SCREEN 01" : "SCREEN 02"}
        caption={screen === "enroute" ? "Ambulance En Route to Patient" : "Patient Picked Up"}
      >
        {screen === "enroute" ? (
          <ScreenEnRoute onPickedUp={() => setScreen("pickedup")} />
        ) : (
          <ScreenPickedUp />
        )}
      </PhoneFrame>
    </div>
  );
}

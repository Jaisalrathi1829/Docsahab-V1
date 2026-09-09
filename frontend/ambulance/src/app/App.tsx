import { useState, useEffect, useCallback, useRef } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { ScreenEnRoute } from "./components/ScreenEnRoute";
import { ScreenPickedUp } from "./components/ScreenPickedUp";
import {
  getActiveEmergency,
  getEmergency,
  updateStatus,
  notifyHospital,
  severityToBackend,
  type Emergency,
  type AmbulanceSeverity,
} from "./api";

const POLL_MS = 3000;

/** Statuses at which the patient is already onboard. */
const ONBOARD: ReadonlySet<string> = new Set([
  "PATIENT_PICKED_UP",
  "SEVERITY_SELECTED",
  "HOSPITAL_SEARCHING",
  "HOSPITAL_ACCEPTANCE_REQUESTED",
  "HOSPITAL_NOTIFIED",
  "EN_ROUTE_TO_HOSPITAL",
  "ARRIVED",
]);

export default function App() {
  const [emergency, setEmergency] = useState<Emergency | null>(null);
  const [screen, setScreen] = useState<"enroute" | "pickedup">("enroute");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const emergencyId = emergency?.id ?? null;

  // Discover the emergency currently in progress.
  useEffect(() => {
    getActiveEmergency()
      .then((active) => setEmergency(active))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  // Live polling.
  useEffect(() => {
    if (!emergencyId) return;
    const interval = setInterval(async () => {
      try {
        setEmergency(await getEmergency(emergencyId));
      } catch {
        /* keep last known state on a transient failure */
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [emergencyId]);

  // Follow the lifecycle: once the patient is onboard, show the onboard screen.
  const autoSwitched = useRef<string | null>(null);
  useEffect(() => {
    if (!emergency) return;
    const onboard = ONBOARD.has(emergency.status);
    if (onboard && autoSwitched.current !== emergency.id) {
      autoSwitched.current = emergency.id;
      setScreen("pickedup");
    }
  }, [emergency?.status, emergency?.id]);

  /** Runs a backend action, surfacing failures instead of swallowing them. */
  const run = useCallback(
    async (fn: () => Promise<Emergency>) => {
      setBusy(true);
      setError(null);
      try {
        setEmergency(await fn());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const id = emergency?.id;

  // Dispatch. This transition is what also triggers the backend's automatic
  // hospital search, so the crew must actually mark themselves en route.
  const handleStartEnRoute = useCallback(() => {
    if (!id) return;
    return run(() =>
      updateStatus(id, {
        status: "AMBULANCE_EN_ROUTE",
        description: "Crew dispatched — en route to patient",
      })
    );
  }, [id, run]);

  const handlePickedUp = useCallback(() => {
    if (!id) return;
    return run(() =>
      updateStatus(id, {
        status: "PATIENT_PICKED_UP",
        description: "Patient onboarded",
      })
    );
  }, [id, run]);

  const handleSeverity = useCallback(
    (severity: AmbulanceSeverity) => {
      if (!id) return;
      return run(() =>
        updateStatus(id, {
          status: "SEVERITY_SELECTED",
          severity: severityToBackend(severity),
        })
      );
    },
    [id, run]
  );

  // Goes through the dedicated endpoint, which verifies a hospital is actually
  // assigned and recomputes the transport ETA. A raw status write would let the
  // emergency claim "hospital notified" with no hospital attached.
  const handleNotifyHospital = useCallback(() => {
    if (!id) return;
    return run(() => notifyHospital(id));
  }, [id, run]);

  const subtitle = emergency
    ? `Connected · Emergency ${emergency.id.slice(0, 8)}… · ${emergency.status.replace(/_/g, " ")}`
    : loading
    ? "Loading active emergency…"
    : "No active emergency. Trigger an SOS from the patient app.";

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
          DOCSAHAB · AMBULANCE WORKFLOW ·{" "}
          <span style={{ color: "#0E9F6E" }}>LIVE</span>
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
          {subtitle}
        </p>
      </div>

      {error && (
        <div className="mb-6 max-w-xl w-full px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center">
          {error}
        </div>
      )}

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
          <ScreenEnRoute
            emergency={emergency}
            busy={busy}
            onStartEnRoute={handleStartEnRoute}
            onPickedUp={handlePickedUp}
          />
        ) : (
          <ScreenPickedUp
            emergency={emergency}
            busy={busy}
            onSelectSeverity={handleSeverity}
            onNotifyHospital={handleNotifyHospital}
          />
        )}
      </PhoneFrame>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { HomeScreen } from "./components/HomeScreen";
import { SosActiveScreen } from "./components/SosActiveScreen";
import { MedicalProfileScreen } from "./components/MedicalProfileScreen";
import {
  createEmergency,
  assignAmbulance,
  getEmergency,
  getActiveEmergency,
  ApiError,
  type Emergency,
} from "./api";

type Screen = "home" | "sos" | "profile";

const labels: Record<Screen, string> = {
  home: "01 · Home",
  sos: "02 · SOS activated",
  profile: "03 · Emergency profile",
};

// The demo patient. Matches prisma/seed.ts — there is no auth/identity layer yet.
const PATIENT = {
  patientId: "patient-arjun-001",
  patientLatitude: 28.6139,
  patientLongitude: 77.209,
  patientAddress: "Connaught Place, Delhi NCR",
  emergencyType: "Cardiac Emergency",
  patientName: "Arjun Raghavan",
  patientAge: 34,
  patientSex: "Male",
  patientBloodGroup: "O+",
  patientAllergies: ["Penicillin", "Peanuts"],
  patientConditions: ["Asthma", "Hypertension"],
};

const POLL_MS = 3000;

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [emergency, setEmergency] = useState<Emergency | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emergencyId = emergency?.id ?? null;

  // Rehydrate on load: if an emergency is already in progress, show it.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    getActiveEmergency()
      .then((active) => {
        if (active) {
          setEmergency(active);
          setScreen("sos");
        }
      })
      .catch(() => {
        /* idle backend is not an error worth showing on first paint */
      });
  }, []);

  // Live status polling while an emergency is open.
  useEffect(() => {
    if (!emergencyId) return;
    const tick = async () => {
      try {
        setEmergency(await getEmergency(emergencyId));
      } catch {
        /* transient poll failure — keep the last known state */
      }
    };
    const interval = setInterval(tick, POLL_MS);
    return () => clearInterval(interval);
  }, [emergencyId]);

  /**
   * SOS: create the emergency, then immediately request an ambulance.
   * The assignment is a separate backend capability (nearest-unit selection +
   * atomic claim + ETA), so it needs its own call — creating the emergency
   * alone would leave it sitting at SOS_TRIGGERED forever.
   */
  const handleSos = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createEmergency(PATIENT);
      setEmergency(created);
      setScreen("sos");

      try {
        setEmergency(await assignAmbulance(created.id));
      } catch (e) {
        // The emergency is live even if no unit is free — say so, don't fail.
        const msg =
          e instanceof ApiError && e.code === "NO_AMBULANCE_AVAILABLE"
            ? "Emergency created. No ambulance is free right now — you are in the queue."
            : `Emergency created, but ambulance dispatch failed: ${(e as Error).message}`;
        setNotice(msg);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] py-12 px-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-10 px-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Docsahab · Patient app ·{" "}
              <span className="text-blue-600">LIVE</span>
            </div>
            <h1 className="mt-2 text-[28px] tracking-tight text-slate-900">
              Calm, trustworthy emergency medical assistance.
            </h1>
          </div>
          <div className="text-[12px] text-slate-500 max-w-sm text-right hidden md:block">
            {emergency ? (
              <span className="text-emerald-600 font-semibold">
                ● Emergency active · {emergency.status.replace(/_/g, " ")}
              </span>
            ) : (
              "Press SOS to create a real emergency via the backend API."
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            {notice}
          </div>
        )}

        <div className="flex justify-center">
          <PhoneFrame label={labels[screen]}>
            {screen === "home" && (
              <HomeScreen
                onSos={handleSos}
                busy={busy}
                onOpenProfile={() => setScreen("profile")}
              />
            )}
            {screen === "sos" && (
              <SosActiveScreen
                emergency={emergency}
                onBack={() => setScreen("home")}
              />
            )}
            {screen === "profile" && (
              <MedicalProfileScreen onBack={() => setScreen("home")} />
            )}
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}

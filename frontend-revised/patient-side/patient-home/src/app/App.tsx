import { useEffect, useRef, useState } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { HomeScreen } from "./components/HomeScreen";
import { SosActiveScreen } from "./components/SosActiveScreen";
import { MedicalProfileScreen } from "./components/MedicalProfileScreen";

export type SosState = "idle" | "countdown" | "sent" | "assigned";
type View = "home" | "details" | "profile";

// Existing prototype data — do not invent a new lifecycle.
export const ambulance = {
  vehicle: "DL-7B-AM-1101",
  unit: "BLS unit",
  eta: "6 min",
};

const labels: Record<View, string> = {
  home: "Patient · Home",
  details: "Patient · Emergency details",
  profile: "Patient · Medical profile",
};

export default function App() {
  const [view, setView] = useState<View>("home");
  const [sos, setSos] = useState<SosState>("idle");
  const [count, setCount] = useState(3);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  const startSos = () => {
    clearTimers();
    setSos("countdown");
    setCount(3);
    timers.current.push(window.setTimeout(() => setCount(2), 1000));
    timers.current.push(window.setTimeout(() => setCount(1), 2000));
    timers.current.push(
      window.setTimeout(() => {
        // SOS sent — go straight to the Emergency Details screen.
        setSos("sent");
        setView("details");
        // Backend then confirms ambulance assignment.
        timers.current.push(
          window.setTimeout(() => setSos("assigned"), 1600),
        );
      }, 3000),
    );
  };

  const cancelSos = () => {
    clearTimers();
    setSos("idle");
    setCount(3);
    setView("home");
  };

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] py-12 px-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-10 px-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Docsahab · Patient app
            </div>
            <h1 className="mt-2 text-[28px] tracking-tight text-slate-900">
              Calm, trustworthy emergency medical assistance.
            </h1>
          </div>
          <div className="text-[12px] text-slate-500 max-w-sm text-right hidden md:block">
            One screen. One decision. Designed for people who may be scared,
            injured, or helping someone they love.
          </div>
        </div>

        <div className="flex justify-center">
          <PhoneFrame label={labels[view]}>
            {view === "home" && (
              <HomeScreen
                sos={sos}
                count={count}
                onStartSos={startSos}
                onCancelSos={cancelSos}
                onOpenProfile={() => setView("profile")}
                onViewDetails={() => setView("details")}
              />
            )}
            {view === "details" && (
              <SosActiveScreen
                sos={sos}
                onBack={() => setView("home")}
                onOpenProfile={() => setView("profile")}
              />
            )}
            {view === "profile" && (
              <MedicalProfileScreen onBack={() => setView("home")} />
            )}
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}

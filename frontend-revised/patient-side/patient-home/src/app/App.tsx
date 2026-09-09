import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { HomeScreen } from "./components/HomeScreen";
import { SosActiveScreen } from "./components/SosActiveScreen";
import { MedicalProfileScreen } from "./components/MedicalProfileScreen";

// Onboarding screens, merged in from the patient-authentication design so the
// patient has ONE origin and therefore one session that survives a refresh.
import { PhoneFrame as AuthFrame } from "./auth/components/PhoneFrame";
import { LoginScreen } from "./auth/screens/LoginScreen";
import { OtpScreen } from "./auth/screens/OtpScreen";
import { PatientDetailsScreen } from "./auth/screens/PatientDetailsScreen";

import {
  ApiError,
  cancelEmergency,
  getActiveEmergency,
  getCurrentUser,
  getToken,
  requestOtp,
  saveProfile,
  signOut,
  triggerSos,
  verifyOtp,
  type EmergencyView,
  type PatientProfile,
} from "./api";
import { useDeviceLocation } from "./useDeviceLocation";

/**
 * Local SOS button state.
 *
 * IMPORTANT: only `countdown` is local. The moment the countdown completes the
 * backend owns everything — `sent`/`assigned` are derived from the real
 * emergency, never from a frontend timer. Cancelling during the countdown
 * therefore leaves no trace on the server, because nothing was created yet.
 */
export type SosState = "idle" | "countdown" | "sent" | "assigned";

type AuthStage = "booting" | "login" | "otp" | "profile" | "ready";
type View = "home" | "details" | "profile";

const POLL_MS = 2000;
const COUNTDOWN_SECONDS = 3;

const labels: Record<View, string> = {
  home: "Patient · Home",
  details: "Patient · Emergency details",
  profile: "Patient · Medical profile",
};

export default function App() {
  // ── Auth ────────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<AuthStage>("booting");
  const [phone, setPhone] = useState("");
  const [profile, setProfile] = useState<PatientProfile | null>(null);

  // ── Emergency ───────────────────────────────────────────────────────────
  const [emergency, setEmergency] = useState<EmergencyView | null>(null);
  const [sos, setSos] = useState<SosState>("idle");
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [view, setView] = useState<View>("home");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const location = useDeviceLocation();
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  // ── Boot: restore the session so a refresh never forces re-onboarding ────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!getToken()) {
        if (!cancelled) setStage("login");
        return;
      }
      try {
        const me = await getCurrentUser();
        if (cancelled) return;
        setProfile(me.profile);
        setPhone(me.phoneNumber);
        setStage(me.profileCompleted ? "ready" : "profile");
      } catch {
        if (!cancelled) setStage("login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Poll the shared emergency while signed in ───────────────────────────
  useEffect(() => {
    if (stage !== "ready") return;

    let cancelled = false;
    const tick = async () => {
      try {
        const live = await getActiveEmergency();
        if (cancelled) return;
        setEmergency(live);
        // Backend truth wins over the local button state once an emergency
        // exists — including after a refresh mid-emergency.
        if (live) {
          setSos(live.ambulance ? "assigned" : "sent");
          setView((v) => (v === "profile" ? v : "details"));
        } else {
          setSos((s) => (s === "countdown" ? s : "idle"));
          // The emergency reached a terminal state (arrived or cancelled).
          // Leave the live-emergency screen rather than stranding the patient
          // on an empty one, but don't yank them out of their profile.
          setView((v) => (v === "details" ? "home" : v));
        }
      } catch {
        /* transient poll failure — keep showing the last known state */
      }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [stage]);

  // ── Auth actions ────────────────────────────────────────────────────────
  const handleRequestOtp = useCallback(async (p: string) => {
    setError(null);
    try {
      await requestOtp(p);
      setPhone(p);
      setStage("otp");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      setError(null);
      try {
        const session = await verifyOtp(phone, code);
        // Returning users skip onboarding entirely.
        setStage(session.profileCompleted ? "ready" : "profile");
        if (session.profileCompleted) {
          const me = await getCurrentUser();
          setProfile(me.profile);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [phone]
  );

  const handleSaveProfile = useCallback(
    async (details: {
      fullName: string;
      age: string;
      gender: string;
      bloodGroup: string;
      conditions: string;
      allergies: string;
      medications: string;
      emergencyName: string;
      emergencyPhone: string;
    }) => {
      setError(null);
      try {
        const saved = await saveProfile({
          fullName: details.fullName,
          age: details.age,
          gender: details.gender,
          bloodGroup: details.bloodGroup,
          conditions: details.conditions,
          allergies: details.allergies,
          medications: details.medications,
          emergencyContactName: details.emergencyName,
          emergencyContactPhone: details.emergencyPhone,
        });
        setProfile(saved);
        setStage("ready");
      } catch (e) {
        setError((e as Error).message);
      }
    },
    []
  );

  // ── SOS ─────────────────────────────────────────────────────────────────

  /**
   * Confirms the SOS after the cancel window closes. Only at this point does
   * anything reach the backend.
   */
  const confirmSos = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await triggerSos({
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.precise ? undefined : "Approximate location",
        locationIsPrecise: location.precise,
      });
      setEmergency(result.emergency);
      setSos(result.emergency.ambulance ? "assigned" : "sent");
      setView("details");
      if (result.dispatch.note) setNotice(result.dispatch.note);
    } catch (e) {
      setSos("idle");
      setError(
        e instanceof ApiError && e.code === "PROFILE_INCOMPLETE"
          ? "Complete your medical profile before triggering an SOS."
          : (e as Error).message
      );
    } finally {
      setBusy(false);
    }
  }, [location]);

  const startSos = useCallback(() => {
    clearTimers();
    setSos("countdown");
    setCount(COUNTDOWN_SECONDS);
    for (let s = 1; s < COUNTDOWN_SECONDS; s++) {
      timers.current.push(
        window.setTimeout(() => setCount(COUNTDOWN_SECONDS - s), s * 1000)
      );
    }
    timers.current.push(
      window.setTimeout(() => void confirmSos(), COUNTDOWN_SECONDS * 1000)
    );
  }, [confirmSos]);

  /** Cancels during the window — nothing was sent, so nothing to undo. */
  const cancelSos = useCallback(() => {
    clearTimers();
    setSos("idle");
    setCount(COUNTDOWN_SECONDS);
    setView("home");
  }, []);

  const cancelActive = useCallback(async () => {
    setBusy(true);
    try {
      await cancelEmergency();
      setEmergency(null);
      setSos("idle");
      setView("home");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setProfile(null);
    setEmergency(null);
    setSos("idle");
    setStage("login");
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  if (stage === "booting") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#eef1f6] text-slate-500">
        Restoring your session…
      </div>
    );
  }

  if (stage !== "ready") {
    return (
      <AuthFrame>
        {error && (
          <div className="mx-6 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}
        {stage === "login" && <LoginScreen onContinue={handleRequestOtp} />}
        {stage === "otp" && (
          <OtpScreen
            phone={phone}
            onBack={() => setStage("login")}
            onVerify={handleVerifyOtp}
          />
        )}
        {stage === "profile" && (
          <PatientDetailsScreen
            onBack={handleSignOut}
            onContinue={handleSaveProfile}
          />
        )}
      </AuthFrame>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#eef1f6] py-12 px-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-6 px-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Docsahab · Patient app ·{" "}
              <span className="text-blue-600">LIVE</span>
            </div>
            <h1 className="mt-2 text-[28px] tracking-tight text-slate-900">
              Calm, trustworthy emergency medical assistance.
            </h1>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-[12px] text-slate-500">
              {profile?.fullName || "Signed in"} · +91 {phone}
            </div>
            <button
              onClick={handleSignOut}
              className="mt-1 text-[12px] font-semibold text-blue-600 hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Location transparency — never imply a real fix we do not have. */}
        <div className="mb-4 px-2 text-[12px]">
          {location.status === "locating" && (
            <span className="text-slate-500">Getting your location…</span>
          )}
          {location.status === "precise" && (
            <span className="text-emerald-600">
              ● Live location ready ({location.latitude.toFixed(4)},{" "}
              {location.longitude.toFixed(4)})
            </span>
          )}
          {location.status === "approximate" && (
            <span className="text-amber-600">
              ▲ {location.reason} — SOS will use an approximate position
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {notice}
          </div>
        )}

        <div className="flex justify-center">
          <PhoneFrame label={labels[view]}>
            {view === "home" && (
              <HomeScreen
                sos={sos}
                count={count}
                emergency={emergency}
                busy={busy}
                onStartSos={startSos}
                onCancelSos={cancelSos}
                onOpenProfile={() => setView("profile")}
                onViewDetails={() => setView("details")}
              />
            )}
            {view === "details" && (
              <SosActiveScreen
                emergency={emergency}
                busy={busy}
                onBack={() => setView("home")}
                onOpenProfile={() => setView("profile")}
                onCancelEmergency={cancelActive}
              />
            )}
            {view === "profile" && (
              <MedicalProfileScreen
                profile={profile}
                onBack={() => setView(emergency ? "details" : "home")}
              />
            )}
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}

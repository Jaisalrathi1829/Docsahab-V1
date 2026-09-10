// ============================================================================
// Docsahab Hospital Console
// ============================================================================
// Deliberately minimal, matching the authoritative product spec exactly:
//   - BEFORE pickup: incoming requests show Name / Age / Sex + Accept/Decline.
//     Nothing else — no vitals, no readiness checklists, no admissions.
//   - AFTER Notify Hospital: the active case shows Severity + ETA. Nothing else.
// Every screen is a direct render of real backend state (polled every 2s) —
// there is no local ranking, no local selection logic, no fabricated data.
// The hospital-decision-engine, running in the backend, is the sole
// authority on which hospital is even shown a request in the first place.
// ============================================================================

import { useEffect, useState } from "react";
import {
  requestOtp,
  verifyOtp,
  getCurrentUser,
  getToken,
  setToken,
  clearToken,
  signOut,
  getPendingRequests,
  respondToRequest,
  getActiveCase,
  ApiError,
  type HospitalProfile,
  type PendingRequest,
  type ActiveCase,
} from "./api";

const BLUE = "#2563eb", BLUE_BG = "#eff6ff";
const RED = "#dc2626", RED_BG = "#fef2f2";
const AMBER = "#d97706", AMBER_BG = "#fffbeb";
const GREEN = "#16a34a", GREEN_BG = "#f0fdf4";
const INK = "#0f172a", SUB = "#64748b", BORDER = "#e2e8f0", BG = "#f8fafc";

const SEVERITY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  RED: { label: "CRITICAL", color: RED, bg: RED_BG },
  YELLOW: { label: "MODERATE", color: AMBER, bg: AMBER_BG },
  GREEN: { label: "LOW", color: GREEN, bg: GREEN_BG },
};

const POLL_MS = 2000;

type Stage = "booting" | "login" | "otp" | "ready";

export default function App() {
  const [stage, setStage] = useState<Stage>("booting");
  const [phone, setPhone] = useState("");
  const [profile, setProfile] = useState<HospitalProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [activeCase, setActiveCase] = useState<ActiveCase | null>(null);

  // ── Boot: restore session ────────────────────────────────────────────────
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
        setPhone(me.phoneNumber ?? "");
        setStage("ready");
      } catch {
        if (!cancelled) setStage("login");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Poll: pending requests + active case ────────────────────────────────
  useEffect(() => {
    if (stage !== "ready") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [reqs, active] = await Promise.all([getPendingRequests(), getActiveCase()]);
        if (cancelled) return;
        setPending(reqs);
        setActiveCase(active);
      } catch {
        /* transient poll failure — keep last known state */
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [stage]);

  // ── Auth actions ─────────────────────────────────────────────────────────
  const handleRequestOtp = async (p: string) => {
    setError(null);
    setBusy(true);
    try {
      await requestOtp(p);
      setPhone(p);
      setStage("otp");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setError(null);
    setBusy(true);
    try {
      const session = await verifyOtp(phone, code);
      setToken(session.token);
      const me = await getCurrentUser();
      setProfile(me.profile);
      setStage("ready");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    try { await signOut(); } catch { /* ignore */ }
    clearToken();
    setProfile(null);
    setPending([]);
    setActiveCase(null);
    setStage("login");
  };

  // ── Request actions ──────────────────────────────────────────────────────
  const handleRespond = async (candidateId: string, response: "ACCEPTED" | "REJECTED") => {
    setBusy(true);
    setError(null);
    try {
      await respondToRequest(candidateId, response);
      const [reqs, active] = await Promise.all([getPendingRequests(), getActiveCase()]);
      setPending(reqs);
      setActiveCase(active);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (stage === "booting") {
    return <Centered>Restoring your session…</Centered>;
  }

  if (stage === "login") {
    return <LoginScreen onContinue={handleRequestOtp} busy={busy} error={error} />;
  }

  if (stage === "otp") {
    return (
      <OtpScreen
        phone={phone}
        onBack={() => setStage("login")}
        onVerify={handleVerifyOtp}
        busy={busy}
        error={error}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG }}>
      <Header hospitalName={profile?.name ?? "Hospital"} onSignOut={handleSignOut} />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px" }}>
        {error && (
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: RED_BG, border: `1px solid #fecaca`, color: "#991b1b", fontSize: 13 }}>
            {error}
          </div>
        )}

        {activeCase ? (
          <ActiveCasePanel activeCase={activeCase} />
        ) : (
          <PendingList requests={pending} busy={busy} onRespond={handleRespond} />
        )}
      </div>
    </div>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: BG, color: SUB, fontSize: 14 }}>
      {children}
    </div>
  );
}

function Header({ hospitalName, onSignOut }: { hospitalName: string; onSignOut: () => void }) {
  return (
    <div style={{ height: 60, background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: BLUE_BG, display: "flex", alignItems: "center", justifyContent: "center", color: BLUE, fontWeight: 800, fontSize: 13 }}>
        🏥
      </div>
      <div style={{ fontWeight: 700, color: INK, fontSize: 15 }}>{hospitalName}</div>
      <div style={{ marginLeft: "auto" }}>
        <button onClick={onSignOut} style={{ fontSize: 12, color: SUB, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── Auth screens ─────────────────────────────────────────────────────────

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Centered>
      <div style={{ width: 360, background: "#fff", borderRadius: 16, border: `1px solid ${BORDER}`, padding: 28, boxShadow: "0 4px 20px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: BLUE_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏥</div>
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: INK, textAlign: "center", margin: "0 0 4px" }}>{title}</h1>
        <p style={{ fontSize: 13, color: SUB, textAlign: "center", margin: "0 0 20px" }}>{subtitle}</p>
        {children}
      </div>
    </Centered>
  );
}

function LoginScreen({ onContinue, busy, error }: { onContinue: (phone: string) => void; busy: boolean; error: string | null }) {
  const [mobile, setMobile] = useState("");
  const valid = /^\d{10}$/.test(mobile);
  return (
    <AuthCard title="Docsahab Hospital Console" subtitle="Sign in with your registered hospital number">
      {error && <Banner>{error}</Banner>}
      <label style={{ fontSize: 12, fontWeight: 600, color: SUB, display: "block", marginBottom: 6 }}>Mobile number</label>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={10}
        value={mobile}
        onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder="Enter registered mobile number"
        style={inputStyle}
      />
      <button
        onClick={() => onContinue(mobile)}
        disabled={!valid || busy}
        style={{ ...primaryButton, opacity: !valid || busy ? 0.5 : 1, marginTop: 16 }}
      >
        {busy ? "Sending…" : "Continue"}
      </button>
      <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 14 }}>
        Demo hospital numbers: 9700000001 – 9700000010
      </p>
    </AuthCard>
  );
}

function OtpScreen({ phone, onBack, onVerify, busy, error }: {
  phone: string; onBack: () => void; onVerify: (code: string) => void; busy: boolean; error: string | null;
}) {
  const [code, setCode] = useState("");
  const valid = /^\d{6}$/.test(code);
  return (
    <AuthCard title="Verify your number" subtitle={`Enter the 6-digit code sent to +91 ${phone} (demo — any 6 digits work)`}>
      {error && <Banner>{error}</Banner>}
      <input
        type="tel"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="Enter 6-digit code"
        style={{ ...inputStyle, textAlign: "center", letterSpacing: 6, fontSize: 18 }}
      />
      <button
        onClick={() => onVerify(code)}
        disabled={!valid || busy}
        style={{ ...primaryButton, opacity: !valid || busy ? 0.5 : 1, marginTop: 16 }}
      >
        {busy ? "Verifying…" : "Verify & Continue"}
      </button>
      <button onClick={onBack} style={{ ...ghostButton, marginTop: 10 }}>Change number</button>
    </AuthCard>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: RED_BG, border: "1px solid #fecaca", color: "#991b1b", fontSize: 12.5 }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 10,
  border: `1.5px solid ${BORDER}`, fontSize: 14, outline: "none", color: INK,
};
const primaryButton: React.CSSProperties = {
  width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: BLUE,
  color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
};
const ghostButton: React.CSSProperties = {
  width: "100%", padding: "8px 0", borderRadius: 10, border: "none", background: "transparent",
  color: SUB, fontSize: 12.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline",
};

// ── Incoming requests — Name / Age / Sex + Accept / Decline. Nothing more. ──

function PendingList({ requests, busy, onRespond }: {
  requests: PendingRequest[]; busy: boolean; onRespond: (candidateId: string, response: "ACCEPTED" | "REJECTED") => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: INK, margin: 0 }}>Incoming Requests</h2>
        <span style={{ fontSize: 11, fontWeight: 800, color: RED, background: RED_BG, padding: "2px 9px", borderRadius: 20 }}>
          {requests.length}
        </span>
      </div>

      {requests.length === 0 ? (
        <EmptyState text="No incoming emergency requests right now." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map((r) => (
            <div key={r.candidateId} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: BLUE_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                👤
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>{r.patientName ?? "Unknown patient"}</div>
                <div style={{ fontSize: 13, color: SUB }}>
                  {r.patientAge != null ? `${r.patientAge} years` : "Age unknown"} · {r.patientSex ?? "—"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  disabled={busy}
                  onClick={() => onRespond(r.candidateId, "ACCEPTED")}
                  style={{ ...primaryButton, width: "auto", padding: "9px 18px", opacity: busy ? 0.6 : 1 }}
                >
                  Accept
                </button>
                <button
                  disabled={busy}
                  onClick={() => onRespond(r.candidateId, "REJECTED")}
                  style={{ padding: "9px 16px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fff", color: SUB, fontSize: 13.5, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: "#94a3b8" }}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>✅</div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}

// ── Active case: waiting (pre-notify) OR Severity + ETA (post-notify) ──────

function ActiveCasePanel({ activeCase }: { activeCase: ActiveCase }) {
  if (!activeCase.notified) {
    return (
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: activeCase.locked ? GREEN : BLUE }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: activeCase.locked ? GREEN : BLUE, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {activeCase.locked ? "Confirmed — Ambulance en route" : "Temporarily assigned"}
          </span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: INK }}>{activeCase.patientName ?? "Patient"}</div>
        <div style={{ fontSize: 14, color: SUB, marginTop: 2 }}>
          {activeCase.patientAge != null ? `${activeCase.patientAge} years` : "Age unknown"} · {activeCase.patientSex ?? "—"}
        </div>
        <p style={{ fontSize: 13, color: SUB, marginTop: 16, lineHeight: 1.5 }}>
          {activeCase.locked
            ? "The ambulance has picked up the patient. Severity and ETA will appear here once the crew notifies you."
            : "Waiting for the ambulance to confirm patient pickup."}
        </p>
      </div>
    );
  }

  // Post-notify: Severity + ETA to hospital. Nothing else.
  const sev = activeCase.severity ? SEVERITY_STYLE[activeCase.severity] : null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>
        {activeCase.patientName ?? "Patient"} — Incoming
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: sev?.bg ?? BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Severity</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: sev?.color ?? INK }}>{sev?.label ?? "—"}</div>
        </div>
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>ETA</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: INK }}>
            {activeCase.etaToHospitalMinutes != null ? `${activeCase.etaToHospitalMinutes} min` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

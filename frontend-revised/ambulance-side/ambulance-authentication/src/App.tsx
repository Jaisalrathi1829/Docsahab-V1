import { useState, useEffect, useRef, useCallback } from "react";
import docsahabLogo from "@/imports/image.png";
import {
  ApiError,
  endCall,
  enRouteToHospital,
  getActiveEmergency,
  getCurrentUser,
  getToken,
  markArrived,
  notifyHospital,
  pickUpPatient,
  requestOtp,
  saveProfile,
  selectSeverity,
  setDispatchStatus,
  signOut,
  startCall,
  startEnRoute,
  verifyOtp,
  type AmbulanceProfile,
  type EmergencyView,
  type Severity,
} from "./api";
import { useDeviceLocation, type DeviceLocationHandle } from "./useDeviceLocation";

// ─── Design Tokens ─────────────────────────────────────────────────────────
const C = {
  blue: "#1B4FD8",
  blueDark: "#1239A8",
  blueLight: "#EFF6FF",
  blueMid: "#DBEAFE",
  teal: "#0D9488",
  tealLight: "#CCFBF1",
  green: "#10B981",
  greenLight: "#D1FAE5",
  red: "#EF4444",
  redLight: "#FEE2E2",
  amber: "#F59E0B",
  amberLight: "#FEF3C7",
  cyan: "#06B6D4",
  cyanLight: "#CFFAFE",
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray700: "#334155",
  gray900: "#0F172A",
  white: "#FFFFFF",
};

const POLL_MS = 2000;

// ─── Shared Components ──────────────────────────────────────────────────────

function BrandMark({ size = 128 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <span className="brand-glow" />
      <span className="brand-breathe" />
      <span className="brand-ring" />
      <span className="brand-ring" style={{ animationDelay: "1.5s" }} />
      <img
        src={docsahabLogo}
        alt="Docsahab"
        className="brand-logo-img relative z-10 object-contain"
        style={{ width: "78%", height: "78%" }}
      />
    </div>
  );
}

function StatusPill({
  status,
  label,
}: {
  status: "online" | "offline" | "live" | "onboard" | "critical";
  label: string;
}) {
  const styles = {
    online: { bg: C.greenLight, color: C.teal, dot: C.green },
    offline: { bg: "#F1F5F9", color: C.gray500, dot: C.red },
    live: { bg: C.greenLight, color: C.teal, dot: C.green },
    onboard: { bg: C.cyanLight, color: "#0E7490", dot: C.cyan },
    critical: { bg: C.redLight, color: "#B91C1C", dot: C.red },
  };
  const s = styles[status];
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {label}
    </div>
  );
}

function AppHeader({
  status,
  statusLabel,
  vehicle,
  unit,
  driver,
  onSignOut,
}: {
  status?: "online" | "offline" | "live" | "onboard";
  statusLabel?: string;
  vehicle?: string;
  unit?: string | null;
  driver?: string | null;
  onSignOut?: () => void;
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between border-b" style={{ background: C.white, borderColor: C.gray200 }}>
      <div className="flex items-center gap-2">
        <BrandMark size={40} />
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="font-bold text-slate-900 leading-none text-sm">
          Docsahab
        </div>
      </div>
      <div className="flex items-center gap-2">
        {vehicle && (
          <div className="text-right">
            <div className="text-xs font-bold text-slate-800">{vehicle}</div>
            {unit && <div className="text-[10px] text-slate-500">{unit}</div>}
            {driver && <div className="text-[10px] text-slate-500">{driver}</div>}
          </div>
        )}
        {status && statusLabel && <StatusPill status={status} label={statusLabel} />}
        {onSignOut && (
          <button onClick={onSignOut} className="text-[10px] font-semibold text-slate-400 underline">
            Exit
          </button>
        )}
      </div>
    </div>
  );
}

function PrimaryButton({
  label,
  onClick,
  disabled,
  variant = "primary",
  fullWidth = true,
  size = "md",
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "outline" | "ghost";
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const base =
    "font-bold tracking-wide rounded-xl transition-all duration-200 flex items-center justify-center gap-2 select-none";
  const sizes = { sm: "px-4 py-2.5 text-sm", md: "px-5 py-3.5 text-sm", lg: "px-6 py-4 text-base" };
  const variants = {
    primary: disabled ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "text-white cursor-pointer active:scale-[0.98]",
    danger: "text-white cursor-pointer active:scale-[0.98]",
    outline: "border-2 cursor-pointer active:scale-[0.98]",
    ghost: "cursor-pointer active:scale-[0.98]",
  };
  const variantStyle: Record<string, React.CSSProperties> = {
    primary: disabled ? {} : { background: C.blue },
    danger: { background: C.red },
    outline: { borderColor: C.blue, color: C.blue },
    ghost: { color: C.blue },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${fullWidth ? "w-full" : ""}`}
      style={variantStyle[variant]}
    >
      {label}
    </button>
  );
}

function Banner({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  const s =
    tone === "error"
      ? { bg: C.redLight, border: "#FECACA", color: "#B91C1C" }
      : { bg: C.cyanLight, border: "#A5F3FC", color: "#0E7490" };
  return (
    <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {children}
    </div>
  );
}

// ─── Map ────────────────────────────────────────────────────────────────────
// Distances and ETAs are NEVER invented here — they come from the backend's
// navigation provider so both apps show identical numbers.

function MapPreview({
  fullScreen = false,
  destination = "patient",
  distanceKm,
  etaMinutes,
  destinationLabel,
  onClick,
}: {
  fullScreen?: boolean;
  destination?: "patient" | "hospital";
  distanceKm: number | null;
  etaMinutes: number | null;
  destinationLabel: string;
  onClick?: () => void;
}) {
  const patientColor = destination === "patient" ? C.red : C.blue;
  const destIcon = destination === "hospital" ? "🏥" : null;

  return (
    <div
      className={`relative overflow-hidden ${fullScreen ? "flex-1" : "rounded-2xl"} cursor-pointer`}
      style={{ background: "#E8F0FE" }}
      onClick={onClick}
    >
      <svg width="100%" height="100%" viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="280" fill="#E8F0FE" />
        <rect x="0" y="100" width="400" height="14" fill="#CBD5E1" rx="2" />
        <rect x="0" y="165" width="400" height="10" fill="#CBD5E1" rx="2" />
        <rect x="80" y="0" width="12" height="280" fill="#CBD5E1" rx="2" />
        <rect x="180" y="0" width="10" height="280" fill="#CBD5E1" rx="2" />
        <rect x="290" y="0" width="12" height="280" fill="#CBD5E1" rx="2" />
        <line x1="0" y1="107" x2="400" y2="107" stroke="white" strokeWidth="1.5" strokeDasharray="20,15" />
        <line x1="86" y1="0" x2="86" y2="280" stroke="white" strokeWidth="1" strokeDasharray="15,10" />
        <rect x="95" y="15" width="80" height="80" fill="#BFDBFE" rx="4" />
        <rect x="195" y="15" width="90" height="80" fill="#BFDBFE" rx="4" />
        <rect x="95" y="120" width="80" height="40" fill="#BFDBFE" rx="4" />
        <rect x="195" y="120" width="80" height="40" fill="#C7D2FE" rx="4" />
        <rect x="10" y="120" width="65" height="40" fill="#BFDBFE" rx="4" />
        <rect x="305" y="15" width="85" height="80" fill="#C7D2FE" rx="4" />
        <rect x="305" y="120" width="85" height="40" fill="#BFDBFE" rx="4" />
        <rect x="10" y="15" width="65" height="80" fill="#BFDBFE" rx="4" />
        <rect x="10" y="180" width="65" height="90" fill="#BFDBFE" rx="4" />
        <rect x="95" y="180" width="80" height="90" fill="#C7D2FE" rx="4" />
        <rect x="195" y="180" width="80" height="90" fill="#BFDBFE" rx="4" />
        <rect x="305" y="180" width="85" height="90" fill="#C7D2FE" rx="4" />
        <path d="M 120 107 L 240 107 L 240 140 L 290 140" stroke={C.blue} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        <path d="M 120 107 L 240 107 L 240 140 L 290 140" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8,8" opacity="0.6" />
        <g transform="translate(110, 95)">
          <circle r="14" fill={C.blue} />
          <circle r="14" fill={C.blue} opacity="0.3">
            <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
          <text fontSize="12" textAnchor="middle" dy="4" fill="white">🚑</text>
        </g>
        <g transform="translate(300, 140)">
          <circle r="14" fill={patientColor} />
          <circle r="14" fill={patientColor} opacity="0.25">
            <animate attributeName="r" values="14;20;14" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0;0.25" dur="1.5s" repeatCount="indefinite" />
          </circle>
          {destIcon ? (
            <text fontSize="11" textAnchor="middle" dy="4" fill="white">{destIcon}</text>
          ) : (
            <>
              <line x1="-5" y1="0" x2="5" y2="0" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="0" y1="-5" x2="0" y2="5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}
        </g>
        <rect x="80" y="66" width="66" height="18" fill="white" rx="9" fillOpacity="0.9" />
        <text x="113" y="79" fontSize="9" textAnchor="middle" fill={C.blue} fontWeight="600">Ambulance</text>
      </svg>

      {!fullScreen && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
          style={{ background: "rgba(15,23,42,0.75)", color: "white" }}
        >
          TAP TO NAVIGATE
        </div>
      )}

      <div className="absolute top-3 left-3 flex gap-2">
        <div className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(255,255,255,0.9)", color: C.blue }}>
          📍 {distanceKm !== null ? `${distanceKm} km` : "—"}
        </div>
        <div className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(255,255,255,0.9)", color: C.green }}>
          ETA {etaMinutes !== null ? `${etaMinutes} min` : "—"}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[9px]" style={{ background: "rgba(255,255,255,0.85)", color: C.gray500 }}>
        {destinationLabel} · simulated route
      </div>
    </div>
  );
}

function FullScreenMap({
  destination,
  distanceKm,
  etaMinutes,
  destinationLabel,
  onBack,
  navLabel,
}: {
  destination: "patient" | "hospital";
  distanceKm: number | null;
  etaMinutes: number | null;
  destinationLabel: string;
  onBack: () => void;
  navLabel: string;
}) {
  return (
    <div className="flex flex-col h-full" style={{ background: C.gray900 }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: C.white }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.blueMid }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="font-bold text-slate-900">
            {destinationLabel}
          </div>
          <div className="text-xs text-slate-500">
            Simulated route · {distanceKm !== null ? `${distanceKm} km` : "—"}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <div className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: C.greenLight, color: C.teal }}>
            ETA {etaMinutes !== null ? `${etaMinutes} min` : "—"}
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        <MapPreview
          fullScreen
          destination={destination}
          distanceKm={distanceKm}
          etaMinutes={etaMinutes}
          destinationLabel={destinationLabel}
        />
        <div className="absolute bottom-4 left-4 right-4 rounded-2xl p-4 shadow-xl" style={{ background: C.white }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: C.blueMid }}>🚑</div>
            <div className="flex-1">
              <div className="text-xs text-slate-500">Destination</div>
              <div className="font-semibold text-slate-900 text-sm">{destinationLabel}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Distance</div>
              <div className="font-bold text-slate-900">{distanceKm !== null ? `${distanceKm} km` : "—"}</div>
            </div>
          </div>
          <PrimaryButton label={`🧭  ${navLabel}`} onClick={onBack} />
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN: Mobile Login ───────────────────────────────────────────────────
function MobileScreen({
  onNext,
  busy,
  error,
}: {
  onNext: (num: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [mobile, setMobile] = useState("");
  const valid = /^\d{10}$/.test(mobile);

  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="flex flex-col items-center mb-10">
            <BrandMark size={132} />
            <div className="text-sm text-slate-500 font-medium mt-2">Emergency Response Network</div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border p-6" style={{ borderColor: C.gray200 }}>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-xl font-bold text-slate-900 mb-1">
              Welcome, Ambulance Partner
            </h1>
            <p className="text-sm text-slate-500 mb-6">Sign in to receive and respond to emergency requests.</p>

            {error && <div className="mb-4"><Banner tone="error">{error}</Banner></div>}

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Mobile Number</label>
              <div className="flex items-center rounded-xl border-2 overflow-hidden transition-colors" style={{ borderColor: mobile ? C.blue : C.gray200 }}>
                <div className="px-3 py-3.5 text-sm font-semibold border-r select-none flex items-center gap-1" style={{ background: C.blueMid, color: C.blue, borderColor: mobile ? C.blue : C.gray200 }}>
                  <span className="text-base">🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="flex-1 px-3 py-3.5 text-sm font-medium outline-none text-slate-800 placeholder-slate-400"
                  style={{ background: "transparent" }}
                />
              </div>
            </div>

            <PrimaryButton label={busy ? "SENDING…" : "CONTINUE"} onClick={() => onNext(mobile)} disabled={!valid || busy} />

            <p className="text-center text-[11px] text-slate-400 mt-4">
              Demo fleet numbers: 9800000001 – 9800000010
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN: OTP ────────────────────────────────────────────────────────────
function OTPScreen({
  mobile,
  onVerify,
  onBack,
  busy,
  error,
}: {
  mobile: string;
  onVerify: (code: string) => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(30);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (seconds === 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const maskedMobile = `+91 ••••• ••${mobile.slice(-3)}`;

  const handleOtpChange = (i: number, val: string) => {
    const v = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const filled = otp.every((d) => d !== "");

  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="flex flex-col items-center mb-8"><BrandMark size={104} /></div>

          <div className="bg-white rounded-3xl shadow-sm border p-6" style={{ borderColor: C.gray200 }}>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-xl font-bold text-slate-900 mb-1">
              Verify your mobile number
            </h1>
            <p className="text-sm text-slate-500 mb-1">We sent a 6-digit verification code to</p>
            <p className="text-sm font-semibold mb-2" style={{ color: C.blue }}>{maskedMobile}</p>
            <p className="text-[11px] text-slate-400 mb-5">Simulated verification — enter any 6 digits.</p>

            {error && <div className="mb-4"><Banner tone="error">{error}</Banner></div>}

            <div className="flex gap-2 mb-6 justify-center">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus();
                  }}
                  className="w-11 h-12 text-center text-lg font-bold rounded-xl border-2 outline-none transition-colors"
                  style={{ borderColor: digit ? C.blue : C.gray200, color: C.gray900, background: digit ? C.blueMid : C.white }}
                />
              ))}
            </div>

            <PrimaryButton label={busy ? "VERIFYING…" : "VERIFY & CONTINUE"} onClick={() => onVerify(otp.join(""))} disabled={!filled || busy} />

            <div className="flex flex-col items-center gap-2 mt-5">
              <p className="text-sm text-slate-500">Didn't receive the code?</p>
              {seconds > 0 ? (
                <p className="text-sm text-slate-400">Resend in {seconds}s</p>
              ) : (
                <button onClick={() => setSeconds(30)} className="text-sm font-semibold" style={{ color: C.blue }}>Resend OTP</button>
              )}
              <button onClick={onBack} className="text-sm font-medium text-slate-500 underline underline-offset-2 mt-1">
                Change mobile number
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN: Profile Setup ──────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 space-y-3 shadow-sm border" style={{ borderColor: C.gray200 }}>
      <div className="text-[10px] font-bold uppercase tracking-widest pb-1 border-b" style={{ color: C.blue, borderColor: C.blueMid }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FormField({
  label,
  placeholder,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type="text"
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors"
        style={{ borderColor: C.gray200, background: readOnly ? C.gray100 : C.white, color: readOnly ? C.gray500 : C.gray900 }}
      />
    </div>
  );
}

function FormSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
        style={{ borderColor: C.gray200, color: C.gray900 }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ProfileScreen({
  mobile,
  initial,
  onSubmit,
  busy,
  error,
}: {
  mobile: string;
  initial: AmbulanceProfile | null;
  onSubmit: (p: {
    driverName: string;
    driverLicense: string;
    drivingExperience: string;
    vehicleNo: string;
    ambulanceType: string;
    registrationNumber: string;
    serviceArea: string;
    baseLocation: string;
    emergencyContact: string;
  }) => void;
  busy: boolean;
  error: string | null;
}) {
  const [driverName, setDriverName] = useState(initial?.driverName ?? "");
  const [driverLicense, setDriverLicense] = useState(initial?.driverLicense ?? "");
  const [drivingExperience, setDrivingExperience] = useState(initial?.drivingExperience ?? "Select experience");
  const [vehicleNo, setVehicleNo] = useState(
    initial && !initial.vehicleNo.startsWith("UNREGISTERED-") ? initial.vehicleNo : ""
  );
  const [ambulanceType, setAmbulanceType] = useState(initial?.ambulanceType ?? "Select ambulance type");
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? "");
  const [serviceArea, setServiceArea] = useState(initial?.serviceArea ?? "Select city/area");
  const [baseLocation, setBaseLocation] = useState(initial?.baseLocation ?? "");
  const [emergencyContact, setEmergencyContact] = useState(initial?.emergencyContact ?? "");

  const ready = driverName.trim().length > 0 && vehicleNo.trim().length > 0;

  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <div className="px-4 pt-6 pb-4 border-b bg-white" style={{ borderColor: C.gray200 }}>
        <div className="flex justify-center mb-3"><BrandMark size={72} /></div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-lg font-bold text-slate-900 text-center">
          Set up your ambulance profile
        </h1>
        <p className="text-xs text-slate-500 text-center mt-1">
          Add your vehicle and professional details to start receiving emergency requests.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {error && <Banner tone="error">{error}</Banner>}

        <Section title="DRIVER INFORMATION">
          <FormField label="Full Name" placeholder="Enter full name" value={driverName} onChange={setDriverName} />
          <FormField label="Verified Mobile Number" value={`+91 ${mobile}`} readOnly />
          <FormField label="Driver License Number" placeholder="Enter license number" value={driverLicense} onChange={setDriverLicense} />
          <FormSelect
            label="Years of Driving Experience"
            value={drivingExperience}
            onChange={setDrivingExperience}
            options={["Select experience", "0-2 years", "3-5 years", "5-10 years", "10+ years"]}
          />
        </Section>

        <Section title="AMBULANCE INFORMATION">
          <FormField label="Vehicle Number" placeholder="e.g. DL-7B-AM-1101" value={vehicleNo} onChange={setVehicleNo} />
          <FormSelect
            label="Ambulance Type"
            value={ambulanceType}
            onChange={setAmbulanceType}
            options={["Select ambulance type", "BLS", "ALS", "Patient Transport"]}
          />
          <FormField label="Ambulance Registration Number" placeholder="Enter registration number" value={registrationNumber} onChange={setRegistrationNumber} />
        </Section>

        <Section title="SERVICE INFORMATION">
          <FormSelect
            label="Service Area"
            value={serviceArea}
            onChange={setServiceArea}
            options={["Select city/area", "Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Pune"]}
          />
          <FormField label="Ambulance Base Location" placeholder="Enter base location" value={baseLocation} onChange={setBaseLocation} />
          <FormField label="Emergency Contact Number" placeholder="Enter emergency contact" value={emergencyContact} onChange={setEmergencyContact} />
        </Section>

        <div className="pb-4">
          <PrimaryButton
            label={busy ? "SAVING…" : "CREATE AMBULANCE PROFILE"}
            disabled={!ready || busy}
            onClick={() =>
              onSubmit({
                driverName,
                driverLicense,
                drivingExperience: drivingExperience.startsWith("Select") ? "" : drivingExperience,
                vehicleNo,
                ambulanceType: ambulanceType.startsWith("Select") ? "" : ambulanceType,
                registrationNumber,
                serviceArea: serviceArea.startsWith("Select") ? "" : serviceArea,
                baseLocation,
                emergencyContact,
              })
            }
          />
          {!ready && (
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Driver name and vehicle number are required.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN: Dashboard (offline / online) ───────────────────────────────────
function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-xs px-2 py-0.5 rounded-full" style={{ background: ok ? C.greenLight : "#FEE2E2", color: ok ? C.teal : C.red }}>
        {value}
      </span>
    </div>
  );
}

function Dashboard({
  profile,
  location,
  onToggle,
  onSignOut,
  busy,
  error,
}: {
  profile: AmbulanceProfile;
  location: DeviceLocationHandle;
  onToggle: (online: boolean) => void;
  onSignOut: () => void;
  busy: boolean;
  error: string | null;
}) {
  const online = profile.isOnline;
  const locating = location.status === "locating";

  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <AppHeader
        status={online ? "online" : "offline"}
        statusLabel={online ? "ONLINE" : "OFFLINE"}
        vehicle={profile.vehicleNo}
        unit={profile.ambulanceType ? `${profile.ambulanceType} UNIT` : null}
        driver={profile.driverName}
        onSignOut={onSignOut}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-5 overflow-y-auto">
        {error && <div className="w-full max-w-sm"><Banner tone="error">{error}</Banner></div>}

        <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border p-6 text-center animate-fade-in-up" style={{ borderColor: C.gray200 }}>
          {online ? (
            <div
              className="w-36 h-36 rounded-full flex flex-col items-center justify-center mx-auto mb-4"
              style={{
                background: `radial-gradient(circle, ${C.greenLight} 60%, #A7F3D0 100%)`,
                border: `4px solid ${C.green}`,
                boxShadow: `0 0 0 12px ${C.greenLight}`,
              }}
            >
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: C.teal }} className="text-2xl font-black">WAITING</div>
              <div className="text-[10px] font-semibold text-center leading-tight mt-1" style={{ color: C.teal }}>
                For Emergency<br />Request
              </div>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#FEF2F2", border: "3px solid #FECACA" }}>
              <div className="w-5 h-5 rounded-full" style={{ background: C.red }} />
            </div>
          )}

          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-lg font-bold text-slate-900 mb-1">
            {online ? "🟢 ONLINE" : "🔴 OFFLINE"}
          </div>
          <p className="text-slate-800 font-semibold">
            {online ? "You are available for dispatch" : "You're currently unavailable"}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {online
              ? "Your ambulance is visible to the Docsahab dispatch system."
              : "You will not receive emergency requests while offline."}
          </p>

          <div className="mt-5 p-3 rounded-xl border space-y-2" style={{ background: C.gray50, borderColor: C.gray200 }}>
            <StatusRow
              label="Location sharing"
              value={locating ? "LOCATING…" : location.precise ? "GPS" : "APPROXIMATE"}
              ok={location.precise}
            />
            <StatusRow label="Emergency requests" value={online ? "ACTIVE" : "OFF"} ok={online} />
            <StatusRow label="Unit available" value={profile.isAvailable ? "YES" : "ON A JOB"} ok={profile.isAvailable} />
          </div>

          {/* Never imply a GPS lock we do not have — dispatch still routes to
              the approximate position, so say so plainly. */}
          {location.status === "approximate" && (
            <p className="mt-2 text-[11px] text-amber-600">
              ▲ {location.reason}.{" "}
              <button onClick={location.retry} className="font-semibold underline">
                Retry
              </button>
            </p>
          )}
          {location.status === "precise" && (
            <p className="mt-2 text-[11px] text-slate-400">
              Position {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </p>
          )}

          <div className="mt-5">
            <PrimaryButton
              label={busy ? "…" : locating ? "GETTING LOCATION…" : online ? "GO OFFLINE" : "GO ONLINE"}
              onClick={() => onToggle(!online)}
              disabled={busy || (!online && locating)}
              variant={online ? "outline" : "primary"}
              size="lg"
            />
          </div>
        </div>

        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: C.blueMid }}>🚑</div>
            <div>
              <div className="font-bold text-slate-900">{profile.vehicleNo}</div>
              <div className="text-xs text-slate-500">
                {profile.ambulanceType ?? "Unit"} · {profile.driverName ?? "Driver"}
              </div>
            </div>
            {profile.ambulanceType && (
              <div className="ml-auto">
                <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: C.blueMid, color: C.blue }}>
                  {profile.ambulanceType}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Emergency screens ──────────────────────────────────────────────────────

function InfoTile({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: accent ? C.blueMid : C.gray50, border: `1px solid ${C.gray200}` }}>
      <div className="text-base">{icon}</div>
      <div className="text-[10px] text-slate-500 mt-1">{label}</div>
      <div className="font-bold text-sm" style={{ color: accent ? C.blue : C.gray900 }}>{value}</div>
    </div>
  );
}

/** Patient identity + the two distinct clinical signals. */
function PatientCard({ e }: { e: EmergencyView }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: C.blue }}>Patient</div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-lg font-bold text-slate-900">
            {e.patient.name ?? "Unknown"}
          </div>
          <div className="text-sm text-slate-500">
            {[e.patient.age ? `${e.patient.age} years` : null, e.patient.gender].filter(Boolean).join(" · ") || "—"}
          </div>
          {e.patient.bloodGroup && (
            <div className="text-xs text-slate-500 mt-0.5">Blood group {e.patient.bloodGroup}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">Probable emergency</div>
          <div className="font-semibold text-sm text-slate-800">{e.probableEmergency ?? "—"}</div>
        </div>
      </div>

      {/* Critical alert is a SEPARATE concept from the probable emergency. */}
      {e.criticalAlert && (
        <div
          className="rounded-xl px-3 py-2 mb-2 flex items-center gap-2"
          style={{
            background: e.criticalAlertIsHighRisk ? C.redLight : C.amberLight,
            border: `1px solid ${e.criticalAlertIsHighRisk ? "#FECACA" : "#FDE68A"}`,
          }}
        >
          <span className="text-base">⚠️</span>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: e.criticalAlertIsHighRisk ? "#B91C1C" : "#92400E" }}>
              Critical alert
            </div>
            <div className="text-sm font-bold" style={{ color: e.criticalAlertIsHighRisk ? "#B91C1C" : "#92400E" }}>
              {e.criticalAlert}
            </div>
          </div>
        </div>
      )}

      {e.patient.conditions.length > 0 && (
        <div className="text-xs text-slate-600 mb-1">
          <span className="font-semibold">History:</span> {e.patient.conditions.join(", ")}
        </div>
      )}
      {e.patient.medications.length > 0 && (
        <div className="text-xs text-slate-600">
          <span className="font-semibold">Medications:</span> {e.patient.medications.join(", ")}
        </div>
      )}
    </div>
  );
}

function EmergencyAssignedScreen({
  e,
  onStartNav,
  onMapClick,
  busy,
}: {
  e: EmergencyView;
  onStartNav: () => void;
  onMapClick: () => void;
  busy: boolean;
}) {
  const nav = e.navigation.toPatient;
  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <AppHeader status="live" statusLabel="LIVE EMERGENCY" vehicle={e.ambulance?.vehicleNo} unit={e.ambulance?.type} />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="rounded-2xl p-4 flex items-center gap-3 animate-fade-in-up emergency-pulse" style={{ background: C.redLight, border: "2px solid #FECACA" }}>
          <div className="text-2xl">🚨</div>
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#B91C1C" }} className="font-black text-base">
              EMERGENCY ASSIGNED
            </div>
            <div className="text-sm font-medium" style={{ color: "#DC2626" }}>Patient assistance required</div>
          </div>
        </div>

        <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: C.cyanLight }}>
          <span className="text-xs font-semibold" style={{ color: "#0E7490" }}>
            Automatically assigned to your ambulance by dispatch
          </span>
        </div>

        <PatientCard e={e} />

        <div className="grid grid-cols-2 gap-2">
          <InfoTile icon="📍" label="Distance" value={nav ? `${nav.distanceKm} km` : "—"} />
          <InfoTile icon="⏱" label="ETA" value={nav ? `${nav.etaMinutes} MIN` : "—"} accent />
        </div>

        <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ height: 180, borderColor: C.gray200 }}>
          <MapPreview
            onClick={onMapClick}
            destination="patient"
            distanceKm={nav?.distanceKm ?? null}
            etaMinutes={nav?.etaMinutes ?? null}
            destinationLabel="Patient location"
          />
        </div>

        <PrimaryButton label={busy ? "STARTING…" : "🧭  START NAVIGATION"} onClick={onStartNav} disabled={busy} size="lg" />
        <div className="pb-2" />
      </div>
    </div>
  );
}

function EnRouteScreen({
  e,
  onPatientOnCall,
  onMapClick,
  onPickedUp,
  busy,
}: {
  e: EmergencyView;
  onPatientOnCall: () => void;
  onMapClick: () => void;
  onPickedUp: () => void;
  busy: boolean;
}) {
  const nav = e.navigation.toPatient;
  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <AppHeader status="live" statusLabel="LIVE EMERGENCY" vehicle={e.ambulance?.vehicleNo} unit={e.ambulance?.type} driver={e.ambulance?.driverName} />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.blueMid, border: `2px solid ${C.blue}` }}>
          <div className="text-2xl">🚑</div>
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: C.blueDark }} className="font-black text-base">
              Ambulance En Route to Patient
            </div>
            <div className="text-xs font-medium text-slate-600">Hospital coordination running in parallel</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-5 text-center" style={{ borderColor: C.gray200 }}>
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">ETA TO PATIENT</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: C.blue }} className="text-5xl font-black">
            {nav ? nav.etaMinutes : "—"}
          </div>
          <div className="text-lg font-bold text-slate-700">MIN</div>
          <div className="mt-2 text-xs text-slate-500">
            {e.ambulance?.vehicleNo} · {e.probableEmergency ?? "Emergency"}
          </div>
        </div>

        <PatientCard e={e} />

        {/* Hospital appears here — coordination completes DURING transit. */}
        {e.hospital && (
          <div className="bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">🏥</span>
              <span className="font-bold text-slate-900 text-sm">
                {e.hospital.locked ? "HOSPITAL LOCKED" : "HOSPITAL (PROVISIONAL)"}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-700">{e.hospital.name}</div>
            <div className="text-xs text-slate-500 mt-1">
              {e.hospital.locked
                ? "Destination is final."
                : "May still change until the patient is picked up."}
            </div>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ height: 180, borderColor: C.gray200 }}>
          <MapPreview
            onClick={onMapClick}
            destination="patient"
            distanceKm={nav?.distanceKm ?? null}
            etaMinutes={nav?.etaMinutes ?? null}
            destinationLabel="Patient location"
          />
        </div>

        <button
          onClick={onPatientOnCall}
          disabled={busy || e.call.active}
          className="w-full rounded-2xl p-4 flex items-center gap-3 transition-all active:scale-[0.99] disabled:opacity-60"
          style={{ background: C.greenLight, border: `2px solid ${C.green}` }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: C.green }}>📞</div>
          <div className="text-left">
            <div className="font-bold text-sm" style={{ color: "#065F46" }}>
              {e.call.active ? "CALL IN PROGRESS" : "PATIENT ON CALL"}
            </div>
            <div className="text-xs" style={{ color: "#047857" }}>
              {e.call.active ? "Patient is on speaker" : "Tap to connect with patient"}
            </div>
          </div>
        </button>

        <PrimaryButton label={busy ? "SAVING…" : "PATIENT PICKED UP →"} onClick={onPickedUp} disabled={busy} size="lg" />
        <div className="pb-2" />
      </div>
    </div>
  );
}

function PatientOnCallScreen({ e, onEnd, busy }: { e: EmergencyView; onEnd: () => void; busy: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!e.call.startedAt) return;
    const started = new Date(e.call.startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [e.call.startedAt]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col h-full items-center justify-between px-6 py-10" style={{ background: "linear-gradient(160deg, #0F2027 0%, #203A43 50%, #1B4FD8 100%)" }}>
      <div className="w-full flex items-center justify-between">
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-white font-bold text-lg">Docsahab</div>
          <div className="text-slate-400 text-xs">Emergency Response</div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.green }} />
          <span className="text-xs font-semibold" style={{ color: "#34D399" }}>Connected</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl" style={{ background: "rgba(255,255,255,0.1)", border: "3px solid rgba(255,255,255,0.2)" }}>
          👤
        </div>
        <div className="text-center">
          <div className="text-white text-xl font-bold">{e.patient.name ?? "Patient"}</div>
          <div className="text-slate-400 text-sm mt-1">Patient on call</div>
          <div style={{ color: "#34D399" }} className="text-sm font-semibold mt-0.5">🟢 Connected with patient</div>
          <div className="text-slate-400 text-xs mt-1">{fmt(elapsed)}</div>
          <div className="text-slate-500 text-[10px] mt-2">Simulated call — no audio connection exists.</div>
        </div>
      </div>

      <div className="w-full space-y-4">
        <button
          onClick={onEnd}
          disabled={busy}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ background: C.red }}
        >
          END CALL
        </button>
      </div>
    </div>
  );
}

function SeverityCard({
  code,
  label,
  selected,
  onClick,
  disabled,
}: {
  code: "RED" | "YELLOW" | "GREEN";
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const colors = {
    RED: { bg: C.redLight, border: C.red, text: "#B91C1C", dot: C.red },
    YELLOW: { bg: C.amberLight, border: C.amber, text: "#92400E", dot: C.amber },
    GREEN: { bg: C.greenLight, border: C.green, text: "#065F46", dot: C.green },
  };
  const c = colors[code];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl p-3 text-center transition-all border-2 active:scale-[0.97] disabled:opacity-60"
      style={{ background: selected ? c.bg : C.white, borderColor: selected ? c.border : C.gray200 }}
    >
      <div className="w-3 h-3 rounded-full mx-auto mb-1.5" style={{ background: c.dot }} />
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: selected ? c.text : C.gray500 }}>{code}</div>
      <div className="text-xs font-medium mt-0.5" style={{ color: selected ? c.text : C.gray400 }}>{label}</div>
    </button>
  );
}

function PatientPickedUpScreen({
  e,
  onSeverity,
  onNotifyHospital,
  onMapClick,
  onEnRouteHospital,
  onArrived,
  busy,
}: {
  e: EmergencyView;
  onSeverity: (s: Severity) => void;
  onNotifyHospital: () => void;
  onMapClick: () => void;
  onEnRouteHospital: () => void;
  onArrived: () => void;
  busy: boolean;
}) {
  const nav = e.navigation.toHospital;
  const notified = e.hospital?.notifiedAt !== null && e.hospital?.notifiedAt !== undefined;
  const severityChosen = e.severity !== null;

  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <AppHeader status="onboard" statusLabel="ONBOARD" vehicle={e.ambulance?.vehicleNo} unit={e.ambulance?.type} driver={e.ambulance?.driverName} />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-2 shadow-sm border" style={{ borderColor: C.gray200 }}>
          {["Picked Up", "Severity", "Notify"].map((step, i) => {
            const done = i === 0 || (i === 1 && severityChosen) || (i === 2 && notified);
            return (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: done ? C.green : C.gray200, color: "white" }}>
                  {done ? "✓" : i + 1}
                </div>
                <span className="text-xs font-medium" style={{ color: done ? C.teal : C.gray500 }}>{step}</span>
                {i < 2 && <div className="flex-1 h-px" style={{ background: C.gray200 }} />}
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: C.greenLight }}>
              <span style={{ color: C.green }} className="text-sm">✓</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.teal }}>PATIENT ONBOARD</span>
          </div>
          <div className="font-bold text-slate-900">
            {e.patient.name}{e.patient.age ? `, ${e.patient.age}` : ""}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 py-2 rounded-xl text-center" style={{ background: C.blueMid }}>
              <div className="text-[10px] text-slate-500">ETA TO HOSPITAL</div>
              <div className="font-black text-xl" style={{ color: C.blue }}>
                {nav ? nav.etaMinutes : "—"} <span className="text-sm font-bold">MIN</span>
              </div>
            </div>
          </div>
        </div>

        {/* Manual medic triage — never inferred. */}
        <div className="bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Select Severity</span>
            {!severityChosen && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.redLight, color: C.red }}>Required</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SeverityCard code="RED" label="Critical" selected={e.severity === "RED"} onClick={() => onSeverity("RED")} disabled={busy || severityChosen} />
            <SeverityCard code="YELLOW" label="Moderate" selected={e.severity === "YELLOW"} onClick={() => onSeverity("YELLOW")} disabled={busy || severityChosen} />
            <SeverityCard code="GREEN" label="Stable" selected={e.severity === "GREEN"} onClick={() => onSeverity("GREEN")} disabled={busy || severityChosen} />
          </div>
          {severityChosen && (
            <div className="mt-2 text-[11px] text-slate-500">Severity recorded — it cannot be changed again.</div>
          )}
        </div>

        {/* Hospital — locked at pickup by the backend. */}
        <div className="bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🏥</span>
            <span className="font-bold text-slate-900 text-sm">
              {e.hospital ? (e.hospital.locked ? "HOSPITAL LOCKED" : "HOSPITAL PROVISIONAL") : "FINDING HOSPITAL"}
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-700 mb-2">
            {e.hospital?.name ?? "Coordinating with hospitals…"}
          </div>
          {e.hospital && (
            <div className="flex items-center gap-1.5 text-sm" style={{ color: C.green }}>
              <span>✓</span>
              <span className="font-medium text-slate-700">
                {e.hospital.locked ? "Destination final" : "Accepted (provisional)"}
              </span>
            </div>
          )}
        </div>

        <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ height: 150, borderColor: C.gray200 }}>
          <MapPreview
            onClick={onMapClick}
            destination="hospital"
            distanceKm={nav?.distanceKm ?? null}
            etaMinutes={nav?.etaMinutes ?? null}
            destinationLabel={e.hospital?.name ?? "Hospital"}
          />
        </div>

        {!notified ? (
          <>
            <PrimaryButton
              label={busy ? "SENDING…" : "🔔  NOTIFY HOSPITAL"}
              onClick={onNotifyHospital}
              disabled={busy || !severityChosen || !e.hospital}
              size="lg"
            />
            {!severityChosen && (
              <p className="text-center text-[11px] text-slate-400">Select severity before notifying the hospital.</p>
            )}
          </>
        ) : (
          <>
            <div className="rounded-2xl p-4 space-y-2" style={{ background: C.greenLight, border: `2px solid ${C.green}` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🟢</span>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#065F46" }} className="font-black text-base">
                  HOSPITAL NOTIFIED
                </span>
              </div>
              {["Severity Shared", "ETA Shared", "Patient Onboard Confirmed"].map((item) => (
                <div key={item} className="flex items-center gap-1.5 text-sm">
                  <span style={{ color: C.green }}>✓</span>
                  <span className="font-medium" style={{ color: "#047857" }}>{item}</span>
                </div>
              ))}
            </div>

            {e.status === "HOSPITAL_NOTIFIED" && (
              <PrimaryButton label={busy ? "…" : "🚑  START TRANSPORT"} onClick={onEnRouteHospital} disabled={busy} size="lg" />
            )}
            {e.status === "EN_ROUTE_TO_HOSPITAL" && (
              <PrimaryButton label={busy ? "…" : "✅  ARRIVED AT HOSPITAL"} onClick={onArrived} disabled={busy} size="lg" />
            )}
          </>
        )}

        <div className="pb-2" />
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────

type Stage = "booting" | "mobile" | "otp" | "profile" | "ready";
type MapView = null | "patient" | "hospital";

export default function App() {
  const [stage, setStage] = useState<Stage>("booting");
  const [mobile, setMobile] = useState("");
  const [profile, setProfile] = useState<AmbulanceProfile | null>(null);
  const [emergency, setEmergency] = useState<EmergencyView | null>(null);
  const [mapView, setMapView] = useState<MapView>(null);
  const [onCallScreen, setOnCallScreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const location = useDeviceLocation();

  // ── Boot: restore session so a refresh keeps the crew signed in ──────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        if (!cancelled) setStage("mobile");
        return;
      }
      try {
        const me = await getCurrentUser();
        if (cancelled) return;
        setProfile(me.profile);
        setMobile(me.phoneNumber ?? "");
        setStage(me.profileCompleted ? "ready" : "profile");
      } catch {
        if (!cancelled) setStage("mobile");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Poll the shared emergency + own dispatch state ──────────────────────
  useEffect(() => {
    if (stage !== "ready") return;
    let cancelled = false;

    const tick = async () => {
      try {
        const [live, me] = await Promise.all([getActiveEmergency(), getCurrentUser()]);
        if (cancelled) return;
        setEmergency(live);
        setProfile(me.profile);
        // Leave the call screen automatically if the call ended elsewhere.
        if (live && !live.call.active) setOnCallScreen(false);
        if (!live) setOnCallScreen(false);
      } catch {
        /* keep last known state on a transient failure */
      }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [stage]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const [live, me] = await Promise.all([getActiveEmergency(), getCurrentUser()]);
    setEmergency(live);
    setProfile(me.profile);
  }, []);

  // ── Auth actions ────────────────────────────────────────────────────────
  const handleMobile = (num: string) =>
    run(async () => {
      await requestOtp(num);
      setMobile(num);
      setStage("otp");
    });

  const handleVerify = (code: string) =>
    run(async () => {
      const session = await verifyOtp(mobile, code);
      const me = await getCurrentUser();
      setProfile(me.profile);
      setStage(session.profileCompleted ? "ready" : "profile");
    });

  const handleSaveProfile = (p: Parameters<typeof saveProfile>[0]) =>
    run(async () => {
      const saved = await saveProfile(p);
      setProfile(saved);
      setStage("ready");
    });

  const handleSignOut = async () => {
    await signOut();
    setProfile(null);
    setEmergency(null);
    setStage("mobile");
  };

  // ── Dispatch toggle (real backend state) ────────────────────────────────
  const handleToggleOnline = (online: boolean) =>
    run(async () => {
      // Always send a position when going online. The hook has already resolved
      // one — a real GPS fix where the browser allowed it, the service-area
      // fallback otherwise — so a denied permission degrades to an approximate
      // (clearly labelled) position instead of stranding the unit OFFLINE.
      const updated = await setDispatchStatus(
        online
          ? { isOnline: true, latitude: location.latitude, longitude: location.longitude }
          : { isOnline: false }
      );
      setProfile(updated);
    });

  // ── Emergency actions ───────────────────────────────────────────────────
  const act = (fn: (id: string) => Promise<EmergencyView>) => () => {
    if (!emergency) return;
    return run(async () => {
      const updated = await fn(emergency.id);
      setEmergency(updated);
    });
  };

  const handleStartCall = () => {
    if (!emergency) return;
    return run(async () => {
      const updated = await startCall(emergency.id);
      setEmergency(updated);
      setOnCallScreen(true);
    });
  };

  const handleEndCall = () => {
    if (!emergency) return;
    return run(async () => {
      const updated = await endCall(emergency.id);
      setEmergency(updated);
      setOnCallScreen(false);
    });
  };

  const handleSeverity = (severity: Severity) => {
    if (!emergency) return;
    return run(async () => {
      const updated = await selectSeverity(emergency.id, severity);
      setEmergency(updated);
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const shell = (children: React.ReactNode) => (
    <div className="flex items-center justify-center min-h-full" style={{ background: "#1B4FD8" }}>
      <div
        className="relative overflow-hidden shadow-2xl"
        style={{
          width: "min(420px, 100vw)",
          height: "min(860px, 100vh)",
          borderRadius: "clamp(0px, calc((100vw - 420px) * 100), 32px)",
          background: "#EFF6FF",
        }}
      >
        {children}
      </div>
    </div>
  );

  if (stage === "booting") {
    return shell(
      <div className="grid h-full place-items-center text-slate-500 text-sm">Restoring your session…</div>
    );
  }

  if (stage === "mobile") return shell(<MobileScreen onNext={handleMobile} busy={busy} error={error} />);
  if (stage === "otp")
    return shell(<OTPScreen mobile={mobile} onVerify={handleVerify} onBack={() => setStage("mobile")} busy={busy} error={error} />);
  if (stage === "profile")
    return shell(<ProfileScreen mobile={mobile} initial={profile} onSubmit={handleSaveProfile} busy={busy} error={error} />);

  if (!profile) return shell(<div className="grid h-full place-items-center text-slate-500 text-sm">Loading…</div>);

  // Full-screen navigation overlay
  if (mapView) {
    const nav = mapView === "patient" ? emergency?.navigation.toPatient : emergency?.navigation.toHospital;
    return shell(
      <FullScreenMap
        destination={mapView}
        distanceKm={nav?.distanceKm ?? null}
        etaMinutes={nav?.etaMinutes ?? null}
        destinationLabel={mapView === "patient" ? "Patient location" : emergency?.hospital?.name ?? "Hospital"}
        navLabel={mapView === "patient" ? "NAVIGATE TO PATIENT" : "NAVIGATE TO HOSPITAL"}
        onBack={() => setMapView(null)}
      />
    );
  }

  // No emergency → dashboard (online/offline)
  if (!emergency) {
    return shell(
      <Dashboard
        profile={profile}
        location={location}
        onToggle={handleToggleOnline}
        onSignOut={handleSignOut}
        busy={busy}
        error={error}
      />
    );
  }

  // Active call overlay
  if (onCallScreen && emergency.call.active) {
    return shell(<PatientOnCallScreen e={emergency} onEnd={handleEndCall} busy={busy} />);
  }

  // Emergency screens, driven purely by the backend status
  const body = emergency.patientOnboard ? (
    <PatientPickedUpScreen
      e={emergency}
      busy={busy}
      onSeverity={handleSeverity}
      onNotifyHospital={act(notifyHospital)}
      onMapClick={() => setMapView("hospital")}
      onEnRouteHospital={act(enRouteToHospital)}
      onArrived={async () => {
        await act(markArrived)();
        await refresh();
      }}
    />
  ) : emergency.status === "AMBULANCE_ASSIGNED" ? (
    <EmergencyAssignedScreen
      e={emergency}
      busy={busy}
      onStartNav={act(startEnRoute)}
      onMapClick={() => setMapView("patient")}
    />
  ) : (
    <EnRouteScreen
      e={emergency}
      busy={busy}
      onPatientOnCall={handleStartCall}
      onMapClick={() => setMapView("patient")}
      onPickedUp={act(pickUpPatient)}
    />
  );

  return shell(
    <div className="flex flex-col h-full">
      {error && (
        <div className="px-4 pt-2">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
      <div className="flex-1 min-h-0">{body}</div>
    </div>
  );
}

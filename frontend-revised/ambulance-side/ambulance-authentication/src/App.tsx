import { useState, useEffect, useRef } from "react";
import docsahabLogo from "@/imports/image.png";

// ─── Types ─────────────────────────────────────────────────────────────────
type Screen =
  | "mobile"
  | "otp"
  | "profile"
  | "profile-success"
  | "dashboard-offline"
  | "dashboard-online"
  | "emergency-assigned"
  | "map-patient-fullscreen"
  | "enroute"
  | "patient-on-call"
  | "patient-pickedup"
  | "map-hospital-fullscreen";

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

// ─── Shared Components ──────────────────────────────────────────────────────

function DocsahabLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: 28, md: 36, lg: 48 };
  const s = sizes[size];
  const textSizes = { sm: "text-sm", md: "text-base", lg: "text-xl" };
  const subSizes = { sm: "text-[9px]", md: "text-[10px]", lg: "text-xs" };
  return (
    <div className="flex items-center gap-2">
      <div
        style={{ width: s, height: s, background: C.blue, borderRadius: 10 }}
        className="flex items-center justify-center flex-shrink-0"
      >
        <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 7v6c0 5.25 3.5 10.15 8 11.35C16.5 23.15 20 18.25 20 13V7L12 2z" fill="white" fillOpacity="0.25"/>
          <path d="M12 6v12M6 12h12" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className={`font-bold text-slate-900 leading-none ${textSizes[size]}`}>
          Docsahab
        </div>
        <div className={`text-slate-500 font-medium leading-none mt-0.5 ${subSizes[size]}`}>
          Emergency Response Network
        </div>
      </div>
    </div>
  );
}

// Animated hero brand mark — real DocSahab logo with white knocked out
// via multiply blend, floating over a rotating glow + breathing halo.
function BrandMark({ size = 128 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
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
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: s.dot }}
      />
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
}: {
  status?: "online" | "offline" | "live" | "onboard";
  statusLabel?: string;
  vehicle?: string;
  unit?: string;
  driver?: string;
}) {
  return (
    <div
      className="px-4 py-3 flex items-center justify-between border-b"
      style={{ background: C.white, borderColor: C.gray200 }}
    >
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
        {status && statusLabel && (
          <StatusPill status={status} label={statusLabel} />
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
  const sizes = {
    sm: "px-4 py-2.5 text-sm",
    md: "px-5 py-3.5 text-sm",
    lg: "px-6 py-4 text-base",
  };
  const variants = {
    primary: disabled
      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
      : `text-white cursor-pointer active:scale-[0.98]`,
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

// ─── SVG Map Component ──────────────────────────────────────────────────────
function MapPreview({
  fullScreen = false,
  destination = "patient",
  onClick,
}: {
  fullScreen?: boolean;
  destination?: "patient" | "hospital";
  onClick?: () => void;
}) {
  const patientColor = destination === "patient" ? C.red : C.blue;
  const destinationLabel = destination === "patient" ? "Patient Location" : "St. Mary Hospital";
  const destIcon = destination === "hospital" ? "🏥" : null;

  return (
    <div
      className={`relative overflow-hidden ${fullScreen ? "flex-1" : "rounded-2xl"} cursor-pointer`}
      style={{ background: "#E8F0FE" }}
      onClick={onClick}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 280"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Base */}
        <rect width="400" height="280" fill="#E8F0FE" />

        {/* Road grid */}
        <rect x="0" y="100" width="400" height="14" fill="#CBD5E1" rx="2" />
        <rect x="0" y="165" width="400" height="10" fill="#CBD5E1" rx="2" />
        <rect x="80" y="0" width="12" height="280" fill="#CBD5E1" rx="2" />
        <rect x="180" y="0" width="10" height="280" fill="#CBD5E1" rx="2" />
        <rect x="290" y="0" width="12" height="280" fill="#CBD5E1" rx="2" />

        {/* Road center lines */}
        <line x1="0" y1="107" x2="400" y2="107" stroke="white" strokeWidth="1.5" strokeDasharray="20,15" />
        <line x1="86" y1="0" x2="86" y2="280" stroke="white" strokeWidth="1" strokeDasharray="15,10" />

        {/* Blocks */}
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

        {/* Route path */}
        <path
          d="M 120 107 L 240 107 L 240 140 L 290 140"
          stroke={C.blue}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="0"
          opacity="0.8"
        />
        <path
          d="M 120 107 L 240 107 L 240 140 L 290 140"
          stroke="white"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="8,8"
          opacity="0.6"
        />

        {/* Ambulance marker */}
        <g transform="translate(110, 95)">
          <circle r="14" fill={C.blue} />
          <circle r="14" fill={C.blue} opacity="0.3">
            <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
          <text fontSize="12" textAnchor="middle" dy="4" fill="white">🚑</text>
        </g>

        {/* Destination marker */}
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

        {/* Labels */}
        <rect x="80" y="66" width="66" height="18" fill="white" rx="9" fillOpacity="0.9" />
        <text x="113" y="79" fontSize="9" textAnchor="middle" fill={C.blue} fontWeight="600">Ambulance</text>

        <rect x="252" y="148" width={destination === "hospital" ? 80 : 74} height="18" fill="white" rx="9" fillOpacity="0.9" />
        <text x={destination === "hospital" ? 292 : 289} y="161" fontSize="9" textAnchor="middle" fill={patientColor} fontWeight="600">
          {destinationLabel}
        </text>
      </svg>

      {/* Tap to navigate overlay */}
      {!fullScreen && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
          style={{ background: "rgba(15,23,42,0.75)", color: "white" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="currentColor" />
          </svg>
          TAP TO NAVIGATE
        </div>
      )}

      {/* Info overlay */}
      <div
        className="absolute top-3 left-3 flex gap-2"
      >
        <div className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
          style={{ background: "rgba(255,255,255,0.9)", color: C.blue }}>
          📍 1.8 km
        </div>
        <div className="px-2.5 py-1 rounded-lg text-xs font-bold"
          style={{ background: "rgba(255,255,255,0.9)", color: C.green }}>
          ETA 4 min
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 1: Mobile Login ─────────────────────────────────────────────────
function MobileScreen({ onNext }: { onNext: (num: string) => void }) {
  const [mobile, setMobile] = useState("");
  const valid = /^\d{10}$/.test(mobile);

  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm animate-fade-in-up">
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <BrandMark size={132} />
            <div className="text-sm text-slate-500 font-medium mt-2">Emergency Response Network</div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-sm border p-6" style={{ borderColor: C.gray200 }}>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-xl font-bold text-slate-900 mb-1">
              Welcome, Ambulance Partner
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              Sign in to receive and respond to emergency requests.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                Mobile Number
              </label>
              <div
                className="flex items-center rounded-xl border-2 overflow-hidden transition-colors"
                style={{ borderColor: mobile ? C.blue : C.gray200 }}
              >
                <div
                  className="px-3 py-3.5 text-sm font-semibold border-r select-none flex items-center gap-1"
                  style={{ background: C.blueMid, color: C.blue, borderColor: mobile ? C.blue : C.gray200 }}
                >
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

            <PrimaryButton
              label="CONTINUE"
              onClick={() => onNext(mobile)}
              disabled={!valid}
            />

            <p className="text-center text-[11px] text-slate-400 mt-4 flex items-center justify-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" />
              </svg>
              Your mobile number is securely used to access your Docsahab account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 2: OTP ──────────────────────────────────────────────────────────
function OTPScreen({
  mobile,
  onVerify,
  onBack,
}: {
  mobile: string;
  onVerify: () => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(30);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  useEffect(() => {
    if (seconds === 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const maskedMobile = `+91 ••••• ••${mobile.slice(-3)}`;

  const handleOtpChange = (i: number, val: string) => {
    const v = val.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[i] = v;
    setOtp(newOtp);
    if (v && i < 5) refs[i + 1].current?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) refs[i - 1].current?.focus();
  };

  const filled = otp.every((d) => d !== "");

  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="flex flex-col items-center mb-8">
            <BrandMark size={104} />
          </div>

          <div className="bg-white rounded-3xl shadow-sm border p-6" style={{ borderColor: C.gray200 }}>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-xl font-bold text-slate-900 mb-1">
              Verify your mobile number
            </h1>
            <p className="text-sm text-slate-500 mb-1">
              We sent a 6-digit verification code to
            </p>
            <p className="text-sm font-semibold mb-6" style={{ color: C.blue }}>
              {maskedMobile}
            </p>

            {/* OTP boxes */}
            <div className="flex gap-2 mb-6 justify-center">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={refs[i]}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-11 h-12 text-center text-lg font-bold rounded-xl border-2 outline-none transition-colors"
                  style={{
                    borderColor: digit ? C.blue : C.gray200,
                    color: C.gray900,
                    background: digit ? C.blueMid : C.white,
                  }}
                />
              ))}
            </div>

            <PrimaryButton
              label="VERIFY & CONTINUE"
              onClick={onVerify}
              disabled={!filled}
            />

            <div className="flex flex-col items-center gap-2 mt-5">
              <p className="text-sm text-slate-500">Didn't receive the code?</p>
              {seconds > 0 ? (
                <p className="text-sm text-slate-400">Resend in {seconds}s</p>
              ) : (
                <button
                  onClick={() => setSeconds(30)}
                  className="text-sm font-semibold"
                  style={{ color: C.blue }}
                >
                  Resend OTP
                </button>
              )}
              <button
                onClick={onBack}
                className="text-sm font-medium text-slate-500 underline underline-offset-2 mt-1"
              >
                Change mobile number
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 3: Profile Setup ─────────────────────────────────────────────────
function ProfileScreen({ mobile, onSubmit }: { mobile: string; onSubmit: () => void }) {
  const [equipment, setEquipment] = useState<string[]>(["Oxygen", "Stretcher", "First Aid Kit"]);

  const toggleEquip = (e: string) =>
    setEquipment((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);

  const equipOptions = ["Oxygen", "Stretcher", "First Aid Kit", "Defibrillator", "Ventilator", "Cardiac Monitor"];

  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      {/* Fixed header */}
      <div className="px-4 pt-6 pb-4 border-b bg-white" style={{ borderColor: C.gray200 }}>
        <div className="flex justify-center mb-3">
          <BrandMark size={72} />
        </div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-lg font-bold text-slate-900 text-center">
          Set up your ambulance profile
        </h1>
        <p className="text-xs text-slate-500 text-center mt-1">
          Add your vehicle and professional details to start receiving emergency requests.
        </p>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Driver Info */}
        <Section title="DRIVER INFORMATION">
          <FormField label="Full Name" placeholder="Enter full name" />
          <FormField label="Verified Mobile Number" value={`+91 ${mobile}`} readOnly />
          <FormField label="Driver License Number" placeholder="Enter license number" />
          <FormSelect label="Years of Driving Experience" options={["Select experience", "0-2 years", "3-5 years", "5-10 years", "10+ years"]} />
        </Section>

        {/* Ambulance Info */}
        <Section title="AMBULANCE INFORMATION">
          <FormField label="Vehicle Number" placeholder="e.g. DL-7B-AM-1101" />
          <FormSelect label="Ambulance Type" options={["Select ambulance type", "BLS", "ALS", "Patient Transport"]} />
          <FormField label="Ambulance Registration Number" placeholder="Enter registration number" />
        </Section>

        {/* Service Info */}
        <Section title="SERVICE INFORMATION">
          <FormSelect label="Service Area" options={["Select city/area", "Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Pune"]} />
          <FormField label="Ambulance Base Location" placeholder="Enter base location" />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              Medical Equipment Available
            </label>
            <div className="flex flex-wrap gap-2">
              {equipOptions.map((e) => (
                <button
                  key={e}
                  onClick={() => toggleEquip(e)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all"
                  style={{
                    borderColor: equipment.includes(e) ? C.blue : C.gray200,
                    background: equipment.includes(e) ? C.blueMid : C.white,
                    color: equipment.includes(e) ? C.blue : C.gray500,
                  }}
                >
                  {equipment.includes(e) ? "✓ " : ""}{e}
                </button>
              ))}
            </div>
          </div>

          <FormField label="Emergency Contact Number" placeholder="Enter emergency contact" />
        </Section>

        <div className="pb-4">
          <PrimaryButton label="CREATE AMBULANCE PROFILE" onClick={onSubmit} />
        </div>
      </div>
    </div>
  );
}

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
  readOnly,
}: {
  label: string;
  placeholder?: string;
  value?: string;
  readOnly?: boolean;
}) {
  const [val, setVal] = useState(value || "");
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type="text"
        readOnly={readOnly}
        value={val}
        onChange={(e) => !readOnly && setVal(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors"
        style={{
          borderColor: C.gray200,
          background: readOnly ? C.gray100 : C.white,
          color: readOnly ? C.gray500 : C.gray900,
        }}
      />
    </div>
  );
}

function FormSelect({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <select
        className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
        style={{ borderColor: C.gray200, color: C.gray900 }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Profile Success ─────────────────────────────────────────────────────────
function ProfileSuccessScreen({ onContinue }: { onContinue: () => void }) {
  useEffect(() => {
    const t = setTimeout(onContinue, 2200);
    return () => clearTimeout(t);
  }, [onContinue]);

  return (
    <div className="flex flex-col h-full items-center justify-center px-6" style={{ background: C.blueLight }}>
      <div className="animate-fade-in-up flex flex-col items-center gap-5">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: C.greenLight }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-center">
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-xl font-bold text-slate-900">
            Ambulance profile created
          </div>
          <div className="text-sm text-slate-500 mt-2">
            You're ready to receive emergency requests.
          </div>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: i === 0 ? C.blue : C.gray200 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Offline ───────────────────────────────────────────────────────
function DashboardOffline({ onGoOnline }: { onGoOnline: () => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <AppHeader
        status="offline"
        statusLabel="OFFLINE"
        vehicle="DL-7B-AM-1101"
        unit="BLS UNIT"
        driver="Arjun Sharma"
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6">
        {/* Status card */}
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border p-6 text-center animate-fade-in-up" style={{ borderColor: C.gray200 }}>
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 relative"
            style={{ background: "#FEF2F2", border: `3px solid #FECACA` }}
          >
            <div className="w-5 h-5 rounded-full" style={{ background: C.red }} />
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-lg font-bold text-slate-900 mb-1">
            🔴 OFFLINE
          </div>
          <p className="text-slate-800 font-semibold">You're currently unavailable</p>
          <p className="text-sm text-slate-500 mt-1">
            You will not receive emergency requests while offline.
          </p>

          <div className="mt-5 p-3 rounded-xl border space-y-2" style={{ background: C.gray50, borderColor: C.gray200 }}>
            <StatusRow label="Location sharing" value="OFF" ok={false} />
            <StatusRow label="Emergency requests" value="OFF" ok={false} />
          </div>

          <div className="mt-5">
            <PrimaryButton label="GO ONLINE" onClick={onGoOnline} size="lg" />
          </div>
        </div>

        {/* Vehicle card */}
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: C.blueMid }}>
              🚑
            </div>
            <div>
              <div className="font-bold text-slate-900">DL-7B-AM-1101</div>
              <div className="text-xs text-slate-500">BLS Unit · Arjun Sharma</div>
            </div>
            <div className="ml-auto">
              <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: C.blueMid, color: C.blue }}>
                BLS
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold text-xs px-2 py-0.5 rounded-full`} style={{
        background: ok ? C.greenLight : "#FEE2E2",
        color: ok ? C.teal : C.red
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── Dashboard Online ────────────────────────────────────────────────────────
function DashboardOnline({ onGoOffline }: { onGoOffline: () => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <AppHeader
        status="online"
        statusLabel="ONLINE"
        vehicle="DL-7B-AM-1101"
        unit="BLS UNIT"
        driver="Arjun Sharma"
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 gap-4">
        <div className="w-full max-w-sm animate-fade-in-up">
          {/* Main status ring */}
          <div className="flex flex-col items-center mb-5">
            <div
              className="w-40 h-40 rounded-full flex flex-col items-center justify-center relative"
              style={{
                background: `radial-gradient(circle, ${C.greenLight} 60%, #A7F3D0 100%)`,
                border: `4px solid ${C.green}`,
                boxShadow: `0 0 0 12px ${C.greenLight}, 0 0 0 20px rgba(16,185,129,0.08)`,
              }}
            >
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-2xl font-black" style={{ color: C.teal }}>
                WAITING
              </div>
              <div className="text-[10px] font-semibold text-center leading-tight mt-1" style={{ color: C.teal }}>
                For Emergency<br />Request
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-slate-500 mb-5">
            Your ambulance is visible to the Docsahab emergency coordination system.
          </p>

          {/* Status card */}
          <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-2.5 mb-4" style={{ borderColor: C.gray200 }}>
            <div className="flex items-center gap-1.5 text-sm">
              <span style={{ color: C.green }}>✓</span>
              <span className="text-slate-700 font-medium">Ambulance available</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span style={{ color: C.green }}>✓</span>
              <span className="text-slate-700 font-medium">Location active</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span style={{ color: C.green }}>✓</span>
              <span className="text-slate-700 font-medium">Ready for dispatch</span>
            </div>
            <div className="pt-2 border-t" style={{ borderColor: C.gray200 }}>
              <StatusRow label="Location sharing" value="ON" ok={true} />
              <div className="mt-2">
                <StatusRow label="Emergency requests" value="ACTIVE" ok={true} />
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400 mb-4 flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: C.green }} />
            Waiting for emergency request...
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 bg-white rounded-xl px-4 py-2.5 border mb-4" style={{ borderColor: C.gray200 }}>
            <span>Active Requests</span>
            <span className="font-bold text-slate-900">0</span>
          </div>

          <PrimaryButton label="GO OFFLINE" onClick={onGoOffline} variant="outline" />
        </div>
      </div>
    </div>
  );
}

// ─── Emergency Assigned ───────────────────────────────────────────────────────
function EmergencyAssignedScreen({
  onStartNav,
  onMapClick,
}: {
  onStartNav: () => void;
  onMapClick: () => void;
}) {
  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <AppHeader
        status="live"
        statusLabel="LIVE EMERGENCY"
        vehicle="DL-7B-AM-1101"
        unit="BLS UNIT"
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Emergency banner */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3 animate-fade-in-up emergency-pulse"
          style={{ background: C.redLight, border: `2px solid #FECACA` }}
        >
          <div className="text-2xl">🚨</div>
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="font-black text-base" style={{ color: "#B91C1C" }}>
              EMERGENCY ASSIGNED
            </div>
            <div className="text-sm font-medium" style={{ color: "#DC2626" }}>Patient assistance required</div>
          </div>
          <div className="ml-auto">
            <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: C.red, color: C.white }}>
              CRITICAL
            </span>
          </div>
        </div>

        {/* Auto-assign note */}
        <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: C.cyanLight }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke={C.cyan} strokeWidth="2" />
            <path d="M12 8v4l3 3" stroke={C.cyan} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: "#0E7490" }}>
            Automatically assigned to your ambulance
          </span>
        </div>

        {/* Patient card */}
        <div className="bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: C.blue }}>Patient</div>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-lg font-bold text-slate-900">
                Rajeev Sharma
              </div>
              <div className="text-sm text-slate-500">Age: 58 years</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-sm text-slate-800">Cardiac Emergency</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <InfoTile icon="📍" label="Distance" value="1.8 km" />
            <InfoTile icon="⏱" label="ETA" value="4 MIN" accent />
          </div>
        </div>

        {/* Map */}
        <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ height: 180, borderColor: C.gray200 }}>
          <MapPreview onClick={onMapClick} destination="patient" />
        </div>

        {/* Start nav button */}
        <PrimaryButton label="🧭  START NAVIGATION" onClick={onStartNav} size="lg" />
        <div className="pb-2" />
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: accent ? C.blueMid : C.gray50, border: `1px solid ${C.gray200}` }}>
      <div className="text-base">{icon}</div>
      <div className="text-[10px] text-slate-500 mt-1">{label}</div>
      <div className="font-bold text-sm" style={{ color: accent ? C.blue : C.gray900 }}>{value}</div>
    </div>
  );
}

// ─── Full Screen Map ──────────────────────────────────────────────────────────
function FullScreenMap({
  destination,
  onBack,
  navLabel,
}: {
  destination: "patient" | "hospital";
  onBack: () => void;
  navLabel: string;
}) {
  const title = destination === "patient" ? "Patient Location" : "Hospital Location";

  return (
    <div className="flex flex-col h-full" style={{ background: C.gray900 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: C.white }}>
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: C.blueMid }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="font-bold text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">Fastest route · 1.8 km</div>
        </div>
        <div className="ml-auto flex gap-2">
          <div className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: C.greenLight, color: C.teal }}>
            ETA 4 min
          </div>
        </div>
      </div>

      {/* Full screen map */}
      <div className="flex-1 relative">
        <MapPreview fullScreen destination={destination} />

        {/* Location info overlay */}
        <div
          className="absolute bottom-4 left-4 right-4 rounded-2xl p-4 shadow-xl"
          style={{ background: C.white }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: C.blueMid }}>
              🚑
            </div>
            <div className="flex-1">
              <div className="text-xs text-slate-500">Your location</div>
              <div className="font-semibold text-slate-900 text-sm">Current Location</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Distance</div>
              <div className="font-bold text-slate-900">1.8 km</div>
            </div>
          </div>
          <PrimaryButton label={`🧭  ${navLabel}`} onClick={onBack} />
        </div>
      </div>
    </div>
  );
}

// ─── En Route Screen ──────────────────────────────────────────────────────────
function EnRouteScreen({
  onPatientOnCall,
  onMapClick,
}: {
  onPatientOnCall: () => void;
  onMapClick: () => void;
}) {
  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <AppHeader
        status="live"
        statusLabel="LIVE EMERGENCY"
        vehicle="DL-7B-AM-1101"
        unit="BLS UNIT"
        driver="Arjun Sharma"
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Status banner */}
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.blueMid, border: `2px solid ${C.blue}` }}>
          <div className="text-2xl">🚑</div>
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="font-black text-base" style={{ color: C.blueDark }}>
              Ambulance En Route to Patient
            </div>
            <div className="text-xs font-medium text-slate-600">Live tracking active</div>
          </div>
        </div>

        {/* ETA card */}
        <div className="bg-white rounded-2xl shadow-sm border p-5 text-center" style={{ borderColor: C.gray200 }}>
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">ETA TO PATIENT</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: C.blue }} className="text-5xl font-black">
            4
          </div>
          <div className="text-lg font-bold text-slate-700">MIN</div>
          <div className="mt-2 text-xs text-slate-500">DL-7B-AM-1101 · Cardiac Emergency · CRITICAL</div>
        </div>

        {/* Patient info */}
        <div className="bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.blue }}>Patient</div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: C.blueMid }}>
              👤
            </div>
            <div>
              <div className="font-bold text-slate-900">Rajeev Sharma</div>
              <div className="text-sm text-slate-500">58 years · Male</div>
              <div className="text-xs font-semibold mt-0.5" style={{ color: C.red }}>Cardiac Emergency · CRITICAL</div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ height: 180, borderColor: C.gray200 }}>
          <MapPreview onClick={onMapClick} destination="patient" />
        </div>

        {/* Patient on call */}
        <button
          onClick={onPatientOnCall}
          className="w-full rounded-2xl p-4 flex items-center gap-3 transition-all active:scale-[0.99]"
          style={{ background: C.greenLight, border: `2px solid ${C.green}` }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.green }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .17h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" fill="white" />
            </svg>
          </div>
          <div className="text-left">
            <div className="font-bold text-sm" style={{ color: "#065F46" }}>PATIENT ON CALL</div>
            <div className="text-xs" style={{ color: "#047857" }}>Tap to connect with patient</div>
          </div>
          <div className="ml-auto">
            <span className="w-2 h-2 rounded-full animate-pulse inline-block" style={{ background: C.green }} />
          </div>
        </button>

        <div className="pb-2" />
      </div>
    </div>
  );
}

// ─── Patient On Call Screen ──────────────────────────────────────────────────
function PatientOnCallScreen({ onBack }: { onBack: () => void }) {
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div
      className="flex flex-col h-full items-center justify-between px-6 py-10"
      style={{ background: `linear-gradient(160deg, #0F2027 0%, #203A43 50%, #1B4FD8 100%)` }}
    >
      {/* Header */}
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

      {/* Patient avatar */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center text-5xl relative"
          style={{ background: "rgba(255,255,255,0.1)", border: "3px solid rgba(255,255,255,0.2)" }}
        >
          👤
          <div
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: C.green }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .17h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" fill="white" />
            </svg>
          </div>
        </div>
        <div className="text-center">
          <div className="text-white text-xl font-bold">Rajeev Sharma</div>
          <div className="text-slate-400 text-sm mt-1">Patient on call</div>
          <div style={{ color: "#34D399" }} className="text-sm font-semibold mt-0.5">
            🟢 Connected with patient
          </div>
          <div className="text-slate-400 text-xs mt-1">{fmt(elapsed)}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full space-y-4">
        <div className="flex items-center justify-center gap-6">
          {/* Mute */}
          <button
            onClick={() => setMuted(!muted)}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
            style={{ background: muted ? C.red : "rgba(255,255,255,0.12)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              {muted ? (
                <path d="M19 19L5 5M12 1a3 3 0 013 3v4M9 9v3a3 3 0 005.13 2.13M17 16.95A7 7 0 015 12v-2M12 19v4M8 23h8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3zM19 12a7 7 0 01-14 0M12 19v4M8 23h8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>

          {/* Speaker */}
          <button
            onClick={() => setSpeaker(!speaker)}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
            style={{ background: speaker ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {speaker && <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" stroke="white" strokeWidth="2" strokeLinecap="round" />}
            </svg>
          </button>
        </div>

        <div className="text-center text-xs" style={{ color: speaker ? "#34D399" : "rgba(255,255,255,0.4)" }}>
          Speaker {speaker ? "ON" : "OFF"}
        </div>

        {/* End call */}
        <button
          onClick={onBack}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-white transition-all active:scale-[0.98]"
          style={{ background: C.red }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.07 9.8 19.79 19.79 0 012 .17h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11z" fill="white" />
            <line x1="23" y1="1" x2="1" y2="23" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          END CALL
        </button>
      </div>
    </div>
  );
}

// ─── Patient Picked Up ────────────────────────────────────────────────────────
function PatientPickedUpScreen({
  onNotifyHospital,
  onMapClick,
}: {
  onNotifyHospital: () => void;
  onMapClick: () => void;
}) {
  const [severity, setSeverity] = useState<"red" | "yellow" | "green">("red");
  const [notified, setNotified] = useState(false);

  const handleNotify = () => {
    setNotified(true);
    onNotifyHospital();
  };

  return (
    <div className="flex flex-col h-full" style={{ background: C.blueLight }}>
      <AppHeader
        status="onboard"
        statusLabel="ONBOARD"
        vehicle="DL-7B-AM-1101"
        unit="BLS UNIT"
        driver="Arjun Sharma"
      />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Progress */}
        <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-2 shadow-sm border" style={{ borderColor: C.gray200 }}>
          {["Picked Up", "Severity", "Notify"].map((step, i) => (
            <div key={step} className="flex items-center gap-2 flex-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: i === 0 ? C.green : i === 1 ? (severity ? C.blue : C.gray200) : (notified ? C.green : C.gray200), color: "white" }}
              >
                {i === 0 ? "✓" : i + 1}
              </div>
              <span className="text-xs font-medium" style={{ color: i === 0 ? C.teal : C.gray500 }}>{step}</span>
              {i < 2 && <div className="flex-1 h-px" style={{ background: C.gray200 }} />}
            </div>
          ))}
        </div>

        {/* Patient onboard */}
        <div className="bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: C.greenLight }}>
              <span style={{ color: C.green }} className="text-sm">✓</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.teal }}>PATIENT ONBOARD</span>
          </div>
          <div className="font-bold text-slate-900">Rajeev Sharma, 58</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 py-2 rounded-xl text-center" style={{ background: C.blueMid }}>
              <div className="text-[10px] text-slate-500">ETA TO HOSPITAL</div>
              <div className="font-black text-xl" style={{ color: C.blue }}>8 <span className="text-sm font-bold">MIN</span></div>
            </div>
          </div>
        </div>

        {/* Severity */}
        <div className="bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Select Severity</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.redLight, color: C.red }}>Required</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SeverityCard
              code="red"
              label="Critical"
              selected={severity === "red"}
              onClick={() => setSeverity("red")}
            />
            <SeverityCard
              code="yellow"
              label="Moderate"
              selected={severity === "yellow"}
              onClick={() => setSeverity("yellow")}
            />
            <SeverityCard
              code="green"
              label="Stable"
              selected={severity === "green"}
              onClick={() => setSeverity("green")}
            />
          </div>
        </div>

        {/* Hospital Ready */}
        <div className="bg-white rounded-2xl shadow-sm border p-4" style={{ borderColor: C.gray200 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🏥</span>
            <span className="font-bold text-slate-900 text-sm">HOSPITAL READY</span>
          </div>
          <div className="text-sm font-semibold text-slate-700 mb-2">St. Mary Hospital</div>
          <div className="flex items-center gap-1.5 text-sm" style={{ color: C.green }}>
            <span>✓</span>
            <span className="font-medium text-slate-700">Accepted</span>
          </div>
        </div>

        {/* Hospital map */}
        <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ height: 150, borderColor: C.gray200 }}>
          <MapPreview onClick={onMapClick} destination="hospital" />
        </div>

        {/* Notify or notified */}
        {!notified ? (
          <PrimaryButton label="🔔  NOTIFY HOSPITAL" onClick={handleNotify} size="lg" />
        ) : (
          <div className="rounded-2xl p-4 space-y-2" style={{ background: C.greenLight, border: `2px solid ${C.green}` }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🟢</span>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="font-black text-base" style={{ color: "#065F46" }}>
                HOSPITAL NOTIFIED
              </span>
            </div>
            {["Severity Shared", "ETA Shared", "Resources"].map((item) => (
              <div key={item} className="flex items-center gap-1.5 text-sm">
                <span style={{ color: C.green }}>✓</span>
                <span className="font-medium" style={{ color: "#047857" }}>{item}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pb-2" />
      </div>
    </div>
  );
}

function SeverityCard({
  code,
  label,
  selected,
  onClick,
}: {
  code: "red" | "yellow" | "green";
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const colors = {
    red: { bg: C.redLight, border: C.red, text: "#B91C1C", dot: C.red },
    yellow: { bg: C.amberLight, border: C.amber, text: "#92400E", dot: C.amber },
    green: { bg: C.greenLight, border: C.green, text: "#065F46", dot: C.green },
  };
  const c = colors[code];

  return (
    <button
      onClick={onClick}
      className="rounded-xl p-3 text-center transition-all border-2 active:scale-[0.97]"
      style={{
        background: selected ? c.bg : C.white,
        borderColor: selected ? c.border : C.gray200,
      }}
    >
      <div className="w-3 h-3 rounded-full mx-auto mb-1.5" style={{ background: c.dot }} />
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: selected ? c.text : C.gray500 }}>
        {code.toUpperCase()}
      </div>
      <div className="text-xs font-medium mt-0.5" style={{ color: selected ? c.text : C.gray400 }}>
        {label}
      </div>
      {selected && (
        <div className="mt-1 w-4 h-4 rounded-full mx-auto flex items-center justify-center" style={{ background: c.border }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("mobile");
  const [mobileNum, setMobileNum] = useState("");
  const [prevScreen, setPrevScreen] = useState<Screen>("enroute");

  const go = (s: Screen) => setScreen(s);

  const openMap = (destination: "patient" | "hospital", from: Screen) => {
    setPrevScreen(from);
    go(destination === "patient" ? "map-patient-fullscreen" : "map-hospital-fullscreen");
  };

  const renderScreen = () => {
    switch (screen) {
      case "mobile":
        return (
          <MobileScreen
            onNext={(num) => {
              setMobileNum(num);
              go("otp");
            }}
          />
        );

      case "otp":
        return (
          <OTPScreen
            mobile={mobileNum}
            onVerify={() => go("profile")}
            onBack={() => go("mobile")}
          />
        );

      case "profile":
        return <ProfileScreen mobile={mobileNum} onSubmit={() => go("profile-success")} />;

      case "profile-success":
        return <ProfileSuccessScreen onContinue={() => go("dashboard-offline")} />;

      case "dashboard-offline":
        return <DashboardOffline onGoOnline={() => go("dashboard-online")} />;

      case "dashboard-online":
        return (
          <div className="flex flex-col h-full">
            <DashboardOnline onGoOffline={() => go("dashboard-offline")} />
            {/* Simulate emergency after 3 seconds */}
            <SimulateEmergency onEmergency={() => go("emergency-assigned")} />
          </div>
        );

      case "emergency-assigned":
        return (
          <EmergencyAssignedScreen
            onStartNav={() => go("enroute")}
            onMapClick={() => openMap("patient", "emergency-assigned")}
          />
        );

      case "map-patient-fullscreen":
        return (
          <FullScreenMap
            destination="patient"
            onBack={() => go(prevScreen as Screen)}
            navLabel="NAVIGATE TO PATIENT"
          />
        );

      case "map-hospital-fullscreen":
        return (
          <FullScreenMap
            destination="hospital"
            onBack={() => go(prevScreen as Screen)}
            navLabel="NAVIGATE TO HOSPITAL"
          />
        );

      case "enroute":
        return (
          <EnRouteScreen
            onPatientOnCall={() => go("patient-on-call")}
            onMapClick={() => openMap("patient", "enroute")}
          />
        );

      case "patient-on-call":
        return <PatientOnCallScreen onBack={() => go("enroute")} />;

      case "patient-pickedup":
        return (
          <PatientPickedUpScreen
            onNotifyHospital={() => {}}
            onMapClick={() => openMap("hospital", "patient-pickedup")}
          />
        );

      default:
        return null;
    }
  };

  return (
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
        {renderScreen()}

        {/* Bottom CTA for enroute → patient pickedup */}
        {screen === "enroute" && (
          <button
            onClick={() => go("patient-pickedup")}
            className="absolute bottom-4 right-4 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg"
            style={{ background: C.teal }}
          >
            PATIENT PICKED UP →
          </button>
        )}
      </div>
    </div>
  );
}

// Simulate emergency after 3s while on online screen
function SimulateEmergency({ onEmergency }: { onEmergency: () => void }) {
  const triggered = useRef(false);
  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    const t = setTimeout(onEmergency, 3500);
    return () => clearTimeout(t);
  }, [onEmergency]);
  return null;
}

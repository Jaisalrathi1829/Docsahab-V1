import { useEffect, useRef, useState } from "react";
import { StatusBar } from "../components/PhoneFrame";
import { LogoHero } from "../components/LogoHero";
import { PrimaryButton } from "../components/ui";
import { ChevronLeft } from "../components/icons";

function maskPhone(phone: string) {
  const last3 = phone.slice(-3);
  return `••••• ••${last3}`;
}

export function OtpScreen({
  phone,
  onBack,
  onVerify,
}: {
  phone: string;
  onBack: () => void;
  onVerify: () => void;
}) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(30);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const complete = code.every((c) => c !== "");

  function setDigit(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = d;
    setCode(next);
    if (d && i < 5) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (d.length) {
      const next = ["", "", "", "", "", ""];
      d.split("").forEach((c, idx) => (next[idx] = c));
      setCode(next);
      inputs.current[Math.min(d.length, 5)]?.focus();
      e.preventDefault();
    }
  }

  return (
    <div className="ds-enter flex min-h-full flex-col bg-[linear-gradient(180deg,#eaf3ff_0%,#f6faff_38%,#ffffff_100%)]">
      <StatusBar />

      <div className="px-6 pt-4">
        <button
          onClick={onBack}
          aria-label="Back to login"
          className="grid size-10 place-items-center rounded-full border border-brand-100 bg-white text-ink shadow-sm transition hover:bg-brand-50"
        >
          <ChevronLeft className="size-5" />
        </button>
      </div>

      <LogoHero size="sm" />

      <div className="flex-1 rounded-t-[36px] bg-white px-8 pt-9 shadow-[0_-16px_40px_-28px_rgba(23,80,196,0.4)]">
        <h1 className="text-center font-display text-[23px] font-extrabold tracking-tight text-ink">
          Verify your mobile number
        </h1>
        <p className="mt-2 text-center text-[14px] leading-relaxed text-slate-soft">
          We sent a verification code to
        </p>
        <p className="mt-0.5 text-center text-[15px] font-semibold text-ink">
          +91 {maskPhone(phone)}
        </p>

        <div className="mt-8 flex justify-between gap-2" onPaste={onPaste}>
          {code.map((c, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              autoFocus={i === 0}
              inputMode="numeric"
              value={c}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              className={`h-14 w-[14%] rounded-2xl border bg-brand-50/50 text-center font-display text-[22px] font-bold text-ink outline-none transition ${
                c ? "border-brand-400 bg-white ring-2 ring-brand-100" : "border-brand-100"
              } focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100`}
            />
          ))}
        </div>

        <p className="mt-4 text-center text-[11.5px] text-slate-soft">
          Demo prototype — enter any 6 digits to continue.
        </p>

        <div className="mt-7">
          <PrimaryButton disabled={!complete} onClick={onVerify}>
            Verify &amp; Continue
          </PrimaryButton>
        </div>

        <div className="mt-6 text-center text-[13.5px]">
          <span className="text-slate-soft">Didn&apos;t receive the code? </span>
          {seconds > 0 ? (
            <span className="font-semibold text-brand-300">Resend in {seconds}s</span>
          ) : (
            <button
              onClick={() => {
                setSeconds(30);
                setCode(["", "", "", "", "", ""]);
                inputs.current[0]?.focus();
              }}
              className="font-semibold text-brand-600 hover:underline"
            >
              Resend OTP
            </button>
          )}
        </div>

        <div className="mt-3 text-center">
          <button
            onClick={onBack}
            className="text-[13px] font-semibold text-brand-600 underline-offset-2 hover:underline"
          >
            Change mobile number
          </button>
        </div>
      </div>
    </div>
  );
}

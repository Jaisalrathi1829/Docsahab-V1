import { useState } from "react";
import { StatusBar } from "../components/PhoneFrame";
import { LogoHero } from "../components/LogoHero";
import { PrimaryButton } from "../components/ui";
import { ShieldIcon } from "../components/icons";

export function LoginScreen({ onContinue }: { onContinue: (phone: string) => void }) {
  const [phone, setPhone] = useState("");
  const digits = phone.replace(/\D/g, "");
  const valid = digits.length === 10;

  function format(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)} ${d.slice(5)}`;
  }

  return (
    <div className="ds-enter flex min-h-full flex-col bg-[linear-gradient(180deg,#eaf3ff_0%,#f6faff_38%,#ffffff_100%)]">
      <StatusBar />

      {/* Official Docsahab logo on subtle healthcare hero */}
      <LogoHero size="lg" animateLogo />

      <div className="flex-1 rounded-t-[36px] bg-white px-8 pt-9 shadow-[0_-16px_40px_-28px_rgba(23,80,196,0.4)]">
        <h1 className="text-center font-display text-[24px] font-extrabold tracking-tight text-ink">
          Welcome to Docsahab
        </h1>
        <p className="mt-2 text-center text-[14px] leading-relaxed text-slate-soft">
          Enter your mobile number to continue.
        </p>

        <form
          className="mt-9"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onContinue(digits);
          }}
        >
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-ink/70">
              Mobile number
            </span>
            <div className="flex items-center gap-2 rounded-2xl border border-brand-100 bg-brand-50/50 px-3 py-1.5 transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100">
              <span className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-[15px] font-semibold text-ink shadow-sm">
                🇮🇳 +91
              </span>
              <input
                autoFocus
                inputMode="numeric"
                value={format(phone)}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter mobile number"
                className="w-full bg-transparent py-2.5 text-[16px] font-medium tracking-wide text-ink outline-none placeholder:font-normal placeholder:text-slate-soft/70"
              />
            </div>
          </label>

          <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-brand-50 px-4 py-3">
            <ShieldIcon className="mt-0.5 size-4 shrink-0 text-brand-600" />
            <p className="text-[12.5px] leading-relaxed text-slate-soft">
              Your number is used only to securely access your Docsahab account.
            </p>
          </div>

          <div className="mt-8">
            <PrimaryButton type="submit" disabled={!valid}>
              Continue
            </PrimaryButton>
          </div>
        </form>

        <p className="mt-8 pb-8 text-center text-[12px] leading-relaxed text-slate-soft">
          By continuing, you agree to our{" "}
          <span className="font-semibold text-brand-600">Terms</span> &{" "}
          <span className="font-semibold text-brand-600">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}

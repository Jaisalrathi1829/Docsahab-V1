import type { ReactNode } from "react";
import { ChevronDown } from "./icons";

export function PrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-2xl bg-brand-600 px-6 py-4 text-center font-display text-sm font-bold uppercase tracking-[0.14em] text-white shadow-[0_16px_30px_-12px_rgba(28,100,232,0.7)] transition-all duration-200 hover:bg-brand-700 hover:shadow-[0_18px_34px_-12px_rgba(28,100,232,0.75)] active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-brand-100 disabled:text-brand-300 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink/70">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-soft">{hint}</span>}
    </label>
  );
}

const inputCx =
  "w-full rounded-2xl border border-brand-100 bg-white px-4 py-3.5 text-[15px] font-medium text-ink placeholder:font-normal placeholder:text-slate-soft/70 shadow-[0_2px_8px_-4px_rgba(23,80,196,0.15)] outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCx} ${props.className ?? ""}`} />;
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCx} appearance-none pr-11 ${value ? "text-ink" : "text-slate-soft/70"}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o} className="text-ink">
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-brand-400" />
    </div>
  );
}

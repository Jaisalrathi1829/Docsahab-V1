import { Stethoscope, User, Phone, ChevronRight, ShieldCheck } from "lucide-react";

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-[#1f6feb] flex items-center justify-center">
        <Stethoscope className="w-5 h-5 text-white" strokeWidth={2.5} />
      </div>
      <div className="leading-tight">
        <div className="text-[17px] text-slate-900 tracking-tight">Docsahab</div>
        <div className="text-[11px] text-slate-500">Emergency medical assistance</div>
      </div>
    </div>
  );
}

function SosButton({ onPress, busy }: { onPress?: () => void; busy?: boolean }) {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute w-[300px] h-[300px] rounded-full bg-[#1f6feb]/[0.04]" />
      <div className="absolute w-[240px] h-[240px] rounded-full bg-[#1f6feb]/[0.07]" />
      <button
        onClick={onPress}
        disabled={busy}
        className={`relative w-[200px] h-[200px] rounded-full bg-gradient-to-b from-[#2c7cf5] to-[#1d5fd6] text-white flex flex-col items-center justify-center shadow-[0_20px_44px_-14px_rgba(31,111,235,0.5)] active:scale-[0.98] transition-transform ${
          busy ? "opacity-70" : ""
        }`}>
        <span className="text-[11px] tracking-[0.22em] uppercase opacity-80">
          {busy ? "Sending" : "Tap for"}
        </span>
        <span className="mt-1.5 text-[44px] tracking-[0.18em] leading-none">
          SOS
        </span>
        <span className="mt-2.5 text-[12px] opacity-90">
          {busy ? "Dispatching an ambulance…" : "Connects you to a medic"}
        </span>
      </button>
    </div>
  );
}

function SecondaryAction({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <button onClick={onPress} className="w-full flex items-center gap-4 px-4 py-4 bg-white border border-slate-200/80 rounded-2xl active:bg-slate-50 transition-colors">
      <div className="w-11 h-11 rounded-xl bg-[#eef4ff] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#1f6feb]" strokeWidth={2.2} />
      </div>
      <div className="flex-1 text-left">
        <div className="text-[15px] text-slate-900 leading-tight">{title}</div>
        <div className="text-[12px] text-slate-500 mt-0.5">{subtitle}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400" />
    </button>
  );
}

export function HomeScreen({
  onSos,
  onOpenProfile,
  busy,
}: {
  onSos?: () => void;
  onOpenProfile?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <Logo />
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
          <span className="text-[13px] text-slate-700">AR</span>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e8f6ee] text-[#1f7a44]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1f7a44]" />
          <span className="text-[11px]">Location active · Delhi NCR</span>
        </div>
        <h1 className="mt-3 text-[26px] leading-[1.15] tracking-tight text-slate-900">
          Hello, Arjun.
          <br />
          <span className="text-slate-500">
            Professional help is one tap away.
          </span>
        </h1>
      </div>

      <div className="mt-6 mb-7 flex items-center justify-center">
        <SosButton onPress={onSos} busy={busy} />
      </div>

      <div className="px-6 flex items-center justify-center gap-2 text-[12px] text-slate-500 -mt-2 mb-6">
        <ShieldCheck className="w-3.5 h-3.5 text-[#1f7a44]" />
        Verified ambulances · 24×7 medical team
      </div>

      <div className="px-5 pb-6 space-y-2.5">
        <div className="px-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">
          Ready before you need it
        </div>
        <SecondaryAction
          icon={User}
          title="Emergency Profile"
          subtitle="Blood group, allergies, conditions"
          onPress={onOpenProfile}
        />
        <SecondaryAction
          icon={Phone}
          title="Emergency Contacts"
          subtitle="3 people will be notified instantly"
        />
      </div>
    </div>
  );
}

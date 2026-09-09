import { Plus } from "lucide-react";

export function DocsahabLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-xl bg-[#1F6FEB] flex items-center justify-center shadow-sm">
        <Plus className="w-5 h-5 text-white" strokeWidth={3} />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[#0B2545] tracking-tight" style={{ fontSize: 17, fontWeight: 700 }}>
          Docsahab
        </span>
        <span className="text-[#6B7A90]" style={{ fontSize: 10, letterSpacing: 1.2 }}>
          EMERGENCY RESPONSE
        </span>
      </div>
    </div>
  );
}

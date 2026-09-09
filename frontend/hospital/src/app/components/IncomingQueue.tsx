import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { AlertTriangle, Clock, Ambulance, Heart, Activity, Flame, Droplet, Brain } from "lucide-react";

export type Severity = "critical" | "high" | "moderate";

export type EmergencyRequest = {
  id: string;
  severity: Severity;
  type: string;
  eta: number;
  ambulanceId: string;
  ageSec: number;
  alert?: string;
  rank: 1 | 2 | 3;
  icon?: "heart" | "activity" | "flame" | "droplet" | "brain";
};

const severityStyles: Record<Severity, { dot: string; ring: string; label: string; bg: string }> = {
  critical: { dot: "bg-red-500", ring: "ring-red-200", label: "Critical", bg: "bg-red-50" },
  high: { dot: "bg-orange-500", ring: "ring-orange-200", label: "High", bg: "bg-orange-50" },
  moderate: { dot: "bg-amber-500", ring: "ring-amber-200", label: "Moderate", bg: "bg-amber-50" },
};

const iconMap = {
  heart: Heart,
  activity: Activity,
  flame: Flame,
  droplet: Droplet,
  brain: Brain,
};

/** Compact age label — raw seconds become unreadable past a minute or two. */
export function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function IncomingQueue({
  requests,
  selectedId,
  onSelect,
}: {
  requests: EmergencyRequest[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="px-5 pt-5 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-slate-900" style={{ fontSize: 16, fontWeight: 600 }}>Incoming Requests</div>
            <div className="text-slate-500 mt-0.5" style={{ fontSize: 12 }}>Live emergency queue</div>
          </div>
          <Badge className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-50">
            <span className="relative flex h-2 w-2 mr-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            {requests.length} Live
          </Badge>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2.5">
          {requests.map((r) => {
            const s = severityStyles[r.severity];
            const Icon = iconMap[r.icon ?? "activity"];
            const isSelected = r.id === selectedId;
            return (
              <Card
                key={r.id}
                onClick={() => onSelect(r.id)}
                className={`cursor-pointer transition-all p-0 overflow-hidden border ${
                  isSelected
                    ? "border-blue-400 ring-2 ring-blue-100 shadow-sm"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`${s.bg} px-4 py-2.5 flex items-center justify-between border-b border-slate-100`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                    <span className="text-slate-800" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>
                      {s.label.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-slate-500" style={{ fontSize: 11 }}>
                    Ranked #{r.rank}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${s.bg}`}>
                      <Icon className={`h-5 w-5 ${r.severity === "critical" ? "text-red-600" : r.severity === "high" ? "text-orange-600" : "text-amber-600"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-900 truncate" style={{ fontSize: 15, fontWeight: 600 }}>
                        {r.type}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-slate-600" style={{ fontSize: 12 }}>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          ETA {r.eta} min
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Ambulance className="h-3.5 w-3.5" />
                          #{r.ambulanceId}
                        </span>
                      </div>
                    </div>
                  </div>
                  {r.alert && (
                    <div className="mt-3 flex items-start gap-2 px-2.5 py-2 rounded-md bg-red-50 border border-red-100">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
                      <span className="text-red-700" style={{ fontSize: 12 }}>{r.alert}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <span className="text-slate-400" style={{ fontSize: 11 }}>
                      Received {formatAge(r.ageSec)} ago
                    </span>
                    {isSelected && (
                      <span className="text-blue-600 inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600 }}>
                        Reviewing →
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

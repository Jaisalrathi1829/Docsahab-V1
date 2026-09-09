import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { CheckCircle2, XCircle, Phone, MessageSquare, Headphones, Bed, UserCheck, Users, Bell, Package, MapPin, ArrowRight } from "lucide-react";
import { EmergencyRequest } from "./IncomingQueue";

type Accepted = {
  id: string;
  type: string;
  severity: "critical" | "high" | "moderate";
  eta: number;
  status: string;
};

export function ActionPanel({
  accepted,
  isCurrentAccepted,
  busy,
  onAccept,
  onDecline,
  acceptedList,
  checklist,
  onToggleCheck,
  currentReq,
}: {
  accepted: boolean;
  isCurrentAccepted: boolean;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  acceptedList: Accepted[];
  checklist: { key: string; label: string; icon: React.ReactNode; done: boolean }[];
  onToggleCheck: (key: string) => void;
  currentReq: EmergencyRequest;
}) {
  return (
    <div className="flex h-full flex-col bg-white border-l border-slate-200">
      {/* Decision Area */}
      <div className="p-5 border-b border-slate-100">
        {!isCurrentAccepted ? (
          <>
            <div className="text-slate-900 mb-1" style={{ fontSize: 14, fontWeight: 600 }}>
              Decision
            </div>
            <div className="text-slate-500 mb-4" style={{ fontSize: 12 }}>
              Confirm capability and accept this patient.
            </div>
            <Button
              onClick={onAccept}
              disabled={busy}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-12"
              style={{ fontSize: 15, fontWeight: 600 }}
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              {busy ? "Submitting…" : "Accept Patient"}
            </Button>
            <Button
              onClick={onDecline}
              disabled={busy}
              variant="ghost"
              className="w-full mt-2 text-slate-600 hover:text-red-700 hover:bg-red-50 h-10"
              style={{ fontSize: 13 }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Unable to Accept
            </Button>
          </>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-700" style={{ fontSize: 13, fontWeight: 600 }}>
              <CheckCircle2 className="h-5 w-5" />
              Patient Accepted
            </div>
            <div className="text-emerald-700/80 mt-1" style={{ fontSize: 12 }}>
              Ambulance #{currentReq.ambulanceId} is en route. Prepare resources below.
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-white border border-emerald-100 px-3 py-2">
              <div>
                <div className="text-slate-500" style={{ fontSize: 11 }}>PATIENT ARRIVING</div>
                <div className="text-slate-900" style={{ fontSize: 20, fontWeight: 600 }}>
                  {currentReq.eta} min remaining
                </div>
              </div>
              <MapPin className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        )}
      </div>

      {/* Preparation Checklist */}
      {isCurrentAccepted && (
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="text-slate-900" style={{ fontSize: 14, fontWeight: 600 }}>
              Preparation Checklist
            </div>
            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50">
              {checklist.filter((c) => c.done).length}/{checklist.length} ready
            </Badge>
          </div>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li
                key={item.key}
                onClick={() => onToggleCheck(item.key)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  item.done
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <Checkbox checked={item.done} className="border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" />
                <span className={`shrink-0 ${item.done ? "text-emerald-700" : "text-slate-500"}`}>{item.icon}</span>
                <span className={item.done ? "text-emerald-800 line-through" : "text-slate-700"} style={{ fontSize: 13 }}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Accepted queue */}
      <div className="p-5 border-b border-slate-100 flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="text-slate-900" style={{ fontSize: 14, fontWeight: 600 }}>
            Accepted Cases
          </div>
          <Badge variant="outline" className="border-slate-200 text-slate-600">
            {acceptedList.length}
          </Badge>
        </div>
        <ScrollArea className="flex-1 -mx-1">
          <div className="space-y-2 px-1">
            {acceptedList.length === 0 && (
              <div className="text-center text-slate-400 py-6 border border-dashed border-slate-200 rounded-lg" style={{ fontSize: 12 }}>
                No accepted patients yet
              </div>
            )}
            {acceptedList.map((a) => {
              const dot = a.severity === "critical" ? "bg-red-500" : a.severity === "high" ? "bg-orange-500" : "bg-amber-500";
              return (
                <Card key={a.id} className="p-3 border border-slate-200">
                  <div className="flex items-start gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${dot} mt-1.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-900 truncate" style={{ fontSize: 13, fontWeight: 600 }}>{a.type}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-slate-500" style={{ fontSize: 12 }}>ETA {a.eta} min</span>
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
                          {a.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Communication */}
      <div className="p-5">
        <div className="text-slate-500 mb-2" style={{ fontSize: 11, letterSpacing: 0.5 }}>
          COMMUNICATION
        </div>
        <div className="grid grid-cols-3 gap-2">
          <CommButton icon={<Phone className="h-4 w-4" />} label="Call" />
          <CommButton icon={<MessageSquare className="h-4 w-4" />} label="Message" />
          <CommButton icon={<Headphones className="h-4 w-4" />} label="Desk" />
        </div>
      </div>
    </div>
  );
}

function CommButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-colors">
      {icon}
      <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
    </button>
  );
}

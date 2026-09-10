import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { ResponseTimer } from "./ResponseTimer";
import { EmergencyRequest } from "./IncomingQueue";
import { AlertTriangle, Droplet, User, Heart, Clock, Ambulance, Activity, Stethoscope } from "lucide-react";

type PatientInfo = {
  age: number;
  sex: string;
  bloodGroup: string;
  allergies: string[];
  conditions: string[];
  vitals: { bp: string; hr: number; spo2: number; temp: string };
};

export function RequestDetails({
  req,
  patient,
  secondsLeft,
}: {
  req: EmergencyRequest;
  patient: PatientInfo;
  secondsLeft: number;
}) {
  const sevBadge =
    req.severity === "critical"
      ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-50"
      : req.severity === "high"
      ? "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-50"
      : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50";
  const sevDot =
    req.severity === "critical" ? "bg-red-500" : req.severity === "high" ? "bg-orange-500" : "bg-amber-500";

  return (
    <div className="flex h-full flex-col bg-slate-50/50">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className={sevBadge}>
                <span className={`h-1.5 w-1.5 rounded-full ${sevDot} mr-1.5`} />
                {req.severity.toUpperCase()} SEVERITY
              </Badge>
              <Badge variant="outline" className="border-slate-200 text-slate-600">
                Ranked Candidate #{req.rank}
              </Badge>
            </div>
            <div className="text-slate-900" style={{ fontSize: 22, fontWeight: 600 }}>
              {req.type}
            </div>
            <div className="text-slate-500 mt-0.5" style={{ fontSize: 13 }}>
              Ambulance #{req.ambulanceId} · Request received {req.ageSec}s ago
            </div>
          </div>
          <ResponseTimer secondsLeft={secondsLeft} />
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          <StatTile icon={<Clock className="h-4 w-4" />} label="ETA" value={`${req.eta} min`} accent="blue" />
          <StatTile icon={<Ambulance className="h-4 w-4" />} label="Ambulance" value={`#${req.ambulanceId}`} accent="slate" />
          <StatTile icon={<User className="h-4 w-4" />} label="Patient" value={`${patient.age}y · ${patient.sex}`} accent="slate" />
          <StatTile icon={<Droplet className="h-4 w-4" />} label="Blood Group" value={patient.bloodGroup} accent="red" />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Critical alerts */}
        {(patient.allergies.length > 0 || patient.conditions.length > 0) && (
          <Card className="p-0 overflow-hidden border-red-200">
            <div className="bg-red-50 px-5 py-3 border-b border-red-100 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-red-800" style={{ fontSize: 13, fontWeight: 600 }}>
                Critical Medical Alerts
              </span>
            </div>
            <div className="p-5 grid grid-cols-2 gap-5">
              <div>
                <div className="text-slate-500 mb-2" style={{ fontSize: 11, letterSpacing: 0.5 }}>
                  SEVERE ALLERGIES
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {patient.allergies.length === 0 ? (
                    <span className="text-slate-400" style={{ fontSize: 13 }}>None reported</span>
                  ) : (
                    patient.allergies.map((a) => (
                      <Badge key={a} className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-50">
                        {a}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-2" style={{ fontSize: 11, letterSpacing: 0.5 }}>
                  CRITICAL CONDITIONS
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {patient.conditions.map((c) => (
                    <Badge key={c} className="bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-50">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Vitals */}
        <Card className="p-0 overflow-hidden">
          <div className="bg-white px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <span className="text-slate-800" style={{ fontSize: 13, fontWeight: 600 }}>
              Live Vitals from Ambulance
            </span>
            <Badge className="ml-auto bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-50">
              <span className="relative flex h-1.5 w-1.5 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
              </span>
              Streaming
            </Badge>
          </div>
          <div className="p-5 grid grid-cols-4 gap-5">
            <VitalTile label="Blood Pressure" value={patient.vitals.bp} unit="mmHg" warn />
            <VitalTile label="Heart Rate" value={String(patient.vitals.hr)} unit="bpm" warn />
            <VitalTile label="SpO₂" value={`${patient.vitals.spo2}`} unit="%" warn={patient.vitals.spo2 < 95} />
            <VitalTile label="Temperature" value={patient.vitals.temp} unit="°F" />
          </div>
        </Card>

        {/* Emergency Timeline */}
        <Card className="p-0 overflow-hidden">
          <div className="bg-white px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-slate-500" />
            <span className="text-slate-800" style={{ fontSize: 13, fontWeight: 600 }}>
              Emergency Timeline
            </span>
          </div>
          <div className="p-5">
            <Timeline />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "blue" | "red" | "slate";
}) {
  const accentMap = {
    blue: "text-blue-600 bg-blue-50",
    red: "text-red-600 bg-red-50",
    slate: "text-slate-600 bg-slate-100",
  };
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${accentMap[accent]}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-slate-500" style={{ fontSize: 11, letterSpacing: 0.4 }}>
            {label.toUpperCase()}
          </div>
          <div className="text-slate-900 truncate" style={{ fontSize: 15, fontWeight: 600 }}>
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function VitalTile({ label, value, unit, warn }: { label: string; value: string; unit: string; warn?: boolean }) {
  return (
    <div>
      <div className="text-slate-500" style={{ fontSize: 11, letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={warn ? "text-red-600" : "text-slate-900"} style={{ fontSize: 24, fontWeight: 600 }}>
          {value}
        </span>
        <span className="text-slate-400" style={{ fontSize: 12 }}>{unit}</span>
      </div>
    </div>
  );
}

function Timeline() {
  const events = [
    { label: "SOS Triggered", time: "14:02", done: true },
    { label: "Ambulance Assigned", time: "14:03", done: true },
    { label: "Patient Picked Up", time: "14:09", done: true },
    { label: "Severity Updated to Critical", time: "14:11", done: true, alert: true },
    { label: "Hospital Acceptance Requested", time: "14:14", done: true, active: true },
    { label: "En Route to Hospital", time: "—", done: false },
  ];
  return (
    <ol className="space-y-3">
      {events.map((e, i) => (
        <li key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                e.active ? "bg-blue-500 ring-4 ring-blue-100" : e.done ? (e.alert ? "bg-red-500" : "bg-emerald-500") : "bg-slate-300"
              }`}
            />
            {i < events.length - 1 && <span className="w-px flex-1 bg-slate-200 my-1" style={{ minHeight: 16 }} />}
          </div>
          <div className="flex-1 pb-1 flex items-center justify-between">
            <span className={e.done ? "text-slate-800" : "text-slate-400"} style={{ fontSize: 13 }}>
              {e.label}
            </span>
            <span className="text-slate-400" style={{ fontSize: 12 }}>{e.time}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

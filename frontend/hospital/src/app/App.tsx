import { useEffect, useMemo, useState, useCallback } from "react";
import { IncomingQueue, EmergencyRequest } from "./components/IncomingQueue";
import { RequestDetails } from "./components/RequestDetails";
import { ActionPanel } from "./components/ActionPanel";
import { Bed, UserCheck, Users, Bell, Package } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { Activity, Bell as BellIcon, Settings } from "lucide-react";
import {
  getHospitalRequests,
  respondToHospitalRequest,
  severityToHospitalUi,
  type HospitalRequest,
} from "./api";

/**
 * Which hospital this console is signed in as. There is no auth layer yet, so
 * the identity is pinned to a real seeded hospital (prisma/seed.ts) — it must
 * be a genuine ID because acceptance writes a real foreign key.
 */
const HOSPITAL_ID = "hosp-001";
const HOSPITAL_NAME = "AIIMS Delhi";

const POLL_MS = 3000;

const initialChecklist = [
  { key: "bed", label: "Bed Assigned — ER Bay 3", icon: <Bed className="h-4 w-4" />, done: true },
  { key: "doctor", label: "Doctor Assigned — Dr. Mehra", icon: <UserCheck className="h-4 w-4" />, done: true },
  { key: "team", label: "Trauma Team Ready", icon: <Users className="h-4 w-4" />, done: false },
  { key: "er", label: "ER Notified", icon: <Bell className="h-4 w-4" />, done: true },
  { key: "resources", label: "Cath Lab & Resources Ready", icon: <Package className="h-4 w-4" />, done: false },
];

/** Picks a plausible icon from the emergency type so the queue stays readable. */
function iconFor(type: string | null): EmergencyRequest["icon"] {
  const t = (type ?? "").toLowerCase();
  if (t.includes("cardiac") || t.includes("heart")) return "heart";
  if (t.includes("trauma") || t.includes("bleed") || t.includes("rta")) return "droplet";
  if (t.includes("stroke") || t.includes("cva")) return "brain";
  if (t.includes("burn")) return "flame";
  return "activity";
}

export default function App() {
  const [requests, setRequests] = useState<HospitalRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<EmergencyRequest[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(57);
  const [checklist, setChecklist] = useState(initialChecklist);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Poll this hospital's real inbox of ranked acceptance requests.
  const load = useCallback(async () => {
    try {
      const next = await getHospitalRequests(HOSPITAL_ID);
      setRequests(next);
      setSelectedId((current) =>
        current && next.some((r) => r.emergencyId === current)
          ? current
          : next[0]?.emergencyId ?? null
      );
    } catch {
      /* transient failure — keep showing the last known queue */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [selectedId]);

  useEffect(() => {
    setSecondsLeft(57);
  }, [selectedId]);

  // Map the backend's request payload onto the queue's view model.
  const queue: EmergencyRequest[] = useMemo(
    () =>
      requests.map((r) => ({
        id: r.emergencyId,
        severity: severityToHospitalUi(r.severity),
        type: r.emergencyType ?? "Emergency",
        eta: r.estimatedArrivalMinutes,
        ambulanceId:
          r.emergency?.assignedAmbulance?.vehicleNo ??
          r.emergency?.assignedAmbulanceId ??
          "—",
        ageSec: Math.max(
          0,
          Math.floor((Date.now() - new Date(r.requestedAt).getTime()) / 1000)
        ),
        alert: r.criticalAlert ?? undefined,
        rank: Math.min(r.rank, 3) as 1 | 2 | 3,
        icon: iconFor(r.emergencyType),
      })),
    [requests]
  );

  const selectedRequest = useMemo(
    () => requests.find((r) => r.emergencyId === selectedId) ?? null,
    [requests, selectedId]
  );
  const selected = useMemo(
    () => queue.find((q) => q.id === selectedId) ?? null,
    [queue, selectedId]
  );

  const patient = useMemo(() => {
    const em = selectedRequest?.emergency;
    if (!em) return null;
    return {
      age: em.patientAge ?? 0,
      sex: em.patientSex ?? "—",
      bloodGroup: em.patientBloodGroup ?? "—",
      allergies: em.patientAllergies ?? [],
      conditions: em.patientConditions ?? [],
    };
  }, [selectedRequest]);

  const isCurrentAccepted = selectedId
    ? accepted.some((a) => a.id === selectedId)
    : false;

  // Snapshots, not queue lookups: an accepted request immediately leaves the
  // PENDING inbox, so deriving this from `queue` would make it disappear the
  // moment it succeeds.
  const acceptedList = useMemo(
    () =>
      accepted.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        eta: a.eta,
        status: "Accepted",
      })),
    [accepted]
  );

  /**
   * Accept/decline go through the hospital-response endpoint, which owns the
   * candidate workflow: it records the answer on the candidate row, claims the
   * assignment atomically, and refuses to corrupt an already-locked emergency.
   */
  const respond = useCallback(
    async (response: "ACCEPTED" | "REJECTED") => {
      if (!selectedRequest) return;
      setBusy(true);
      try {
        const result = await respondToHospitalRequest(selectedRequest.emergencyId, {
          hospitalId: HOSPITAL_ID,
          response,
          ...(response === "REJECTED"
            ? { rejectionReason: "Unable to accept — capacity" }
            : {}),
        });

        if (response === "ACCEPTED") {
          if (result.assignmentChanged) {
            const snapshot = queue.find((q) => q.id === selectedRequest.emergencyId);
            if (snapshot) {
              setAccepted((list) =>
                list.some((a) => a.id === snapshot.id) ? list : [...list, snapshot]
              );
            }
            toast.success("Patient Accepted", {
              description: "Ambulance notified. Preparation queue updated.",
            });
          } else if (result.locked) {
            toast.warning("Assignment already locked", {
              description: "This patient is en route to another hospital.",
            });
          } else {
            toast("Acceptance recorded", {
              description: "Another hospital currently holds this assignment.",
            });
          }
        } else {
          toast("Marked Unable to Accept", {
            description: "Coordinator will route to the next ranked hospital.",
          });
        }
        await load();
      } catch (e) {
        toast.error(
          response === "ACCEPTED" ? "Failed to accept" : "Failed to decline",
          { description: (e as Error).message }
        );
      } finally {
        setBusy(false);
      }
    },
    [selectedRequest, queue, load]
  );

  function toggleCheck(key: string) {
    setChecklist((cs) => cs.map((c) => (c.key === key ? { ...c, done: !c.done } : c)));
  }

  return (
    <div className="size-full bg-slate-50 flex flex-col" style={{ minHeight: "100vh" }}>
      <TopBar queueCount={queue.length} />
      <div className="flex-1 grid" style={{ gridTemplateColumns: "340px 1fr 360px", minHeight: 0 }}>
        {selected && patient && selectedRequest ? (
          <>
            <IncomingQueue
              requests={queue}
              selectedId={selectedId ?? ""}
              onSelect={setSelectedId}
            />
            <RequestDetails
              req={selected}
              patient={patient}
              secondsLeft={secondsLeft}
              requiredServices={selectedRequest.requiredServices}
              timeline={selectedRequest.emergency?.timelineEvents ?? []}
            />
            <ActionPanel
              accepted={accepted.length > 0}
              isCurrentAccepted={isCurrentAccepted}
              busy={busy}
              onAccept={() => respond("ACCEPTED")}
              onDecline={() => respond("REJECTED")}
              acceptedList={acceptedList}
              checklist={checklist}
              onToggleCheck={toggleCheck}
              currentReq={selected}
            />
          </>
        ) : (
          <div className="col-span-3 flex items-center justify-center text-slate-500">
            {loaded
              ? "No incoming requests. Trigger an SOS from the patient app and dispatch the ambulance."
              : "Connecting to Docsahab…"}
          </div>
        )}
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

function TopBar({ queueCount }: { queueCount: number }) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center px-5 gap-5 shrink-0">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-slate-900" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.1 }}>
            Docsahab
          </div>
          <div className="text-slate-500" style={{ fontSize: 11, lineHeight: 1.1 }}>
            Hospital Console
          </div>
        </div>
      </div>
      <div className="h-8 w-px bg-slate-200" />
      <div>
        <div className="text-slate-900" style={{ fontSize: 13, fontWeight: 600 }}>
          {HOSPITAL_NAME} · Emergency Wing
        </div>
        <div className="text-slate-500" style={{ fontSize: 11 }}>
          {queueCount} incoming request{queueCount === 1 ? "" : "s"} awaiting response
        </div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-emerald-700" style={{ fontSize: 12, fontWeight: 600 }}>
            Online · Accepting
          </span>
        </div>
        <div className="text-slate-500" style={{ fontSize: 12 }}>{time}</div>
        <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><BellIcon className="h-4 w-4" /></button>
        <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><Settings className="h-4 w-4" /></button>
        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center" style={{ fontSize: 12, fontWeight: 600 }}>
          DR
        </div>
      </div>
    </div>
  );
}

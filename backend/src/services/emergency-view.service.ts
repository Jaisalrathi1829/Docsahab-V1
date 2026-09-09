// ============================================================================
// Emergency View Service
// ============================================================================
// Builds the ONE view-model both the patient app and the ambulance app
// render. Everything a client needs to draw its screen is computed here, on
// the server:
//
//   - lifecycle status + progress
//   - assigned ambulance / hospital
//   - navigation legs (ambulance→patient, patient→hospital) with distance+ETA
//   - call state
//   - hospital temporary-vs-locked state
//   - probable emergency + critical alert
//
// Deriving this server-side is what guarantees the two apps can never
// disagree: they are not each computing their own version of the truth, they
// are rendering the same payload.
// ============================================================================

import { CallStatus, EmergencyStatus } from "@prisma/client";
import { navigationProvider } from "../providers/navigation.provider";
import { isHighRiskAllergy } from "./clinical-derivation.service";

type EmergencyWithRelations = {
  id: string;
  status: EmergencyStatus;
  severity: string | null;
  emergencyType: string | null;
  patientId: string;
  patientLatitude: number;
  patientLongitude: number;
  patientAddress: string | null;
  patientName: string | null;
  patientAge: number | null;
  patientSex: string | null;
  patientBloodGroup: string | null;
  patientAllergies: string[];
  patientConditions: string[];
  patientMedications: string[];
  criticalAlert: string | null;
  etaMinutes: number | null;
  assignedAmbulanceId: string | null;
  assignedHospitalId: string | null;
  callStatus: CallStatus;
  callStartedAt: Date | null;
  callEndedAt: Date | null;
  hospitalLockedAt: Date | null;
  hospitalNotifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignedAmbulance?: {
    id: string;
    vehicleNo: string;
    latitude: number;
    longitude: number;
    ambulanceType: string | null;
    driverName: string | null;
  } | null;
  assignedHospital?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  } | null;
  patient?: {
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    phoneNumber: string;
  } | null;
  timelineEvents?: Array<{
    status: EmergencyStatus;
    label: string;
    description: string | null;
    createdAt: Date;
  }>;
  hospitalCandidates?: Array<{
    hospitalId: string;
    hospitalName: string | null;
    rank: number;
    response: string;
  }>;
};

/**
 * Statuses at which the patient is physically onboard the ambulance.
 * Used to decide which navigation leg is the active one.
 */
const ONBOARD_STATUSES: ReadonlySet<EmergencyStatus> = new Set([
  EmergencyStatus.PATIENT_PICKED_UP,
  EmergencyStatus.SEVERITY_SELECTED,
  EmergencyStatus.HOSPITAL_SEARCHING,
  EmergencyStatus.HOSPITAL_ACCEPTANCE_REQUESTED,
  EmergencyStatus.HOSPITAL_NOTIFIED,
  EmergencyStatus.EN_ROUTE_TO_HOSPITAL,
  EmergencyStatus.ARRIVED,
]);

export function buildEmergencyView(emergency: EmergencyWithRelations) {
  const patientPoint = {
    latitude: emergency.patientLatitude,
    longitude: emergency.patientLongitude,
  };

  // Leg 1 — ambulance to patient. Only meaningful while a unit is assigned
  // and the patient is not yet onboard.
  const toPatient =
    emergency.assignedAmbulance &&
    !ONBOARD_STATUSES.has(emergency.status)
      ? navigationProvider.estimate(
          {
            latitude: emergency.assignedAmbulance.latitude,
            longitude: emergency.assignedAmbulance.longitude,
          },
          patientPoint
        )
      : null;

  // Leg 2 — patient to hospital. Meaningful as soon as a hospital exists,
  // including before pickup (the crew wants to see where they're heading).
  const toHospital = emergency.assignedHospital
    ? navigationProvider.estimate(patientPoint, {
        latitude: emergency.assignedHospital.latitude,
        longitude: emergency.assignedHospital.longitude,
      })
    : null;

  const onboard = ONBOARD_STATUSES.has(emergency.status);
  const hospitalLocked = emergency.hospitalLockedAt !== null;

  return {
    id: emergency.id,
    status: emergency.status,
    severity: emergency.severity,

    // Two DISTINCT signals, never conflated:
    //   probableEmergency ← medical history (conditions)
    //   criticalAlert     ← allergies
    probableEmergency: emergency.emergencyType,
    criticalAlert: emergency.criticalAlert,
    criticalAlertIsHighRisk: isHighRiskAllergy(emergency.patientAllergies),

    patient: {
      id: emergency.patientId,
      name: emergency.patientName,
      age: emergency.patientAge,
      gender: emergency.patientSex,
      bloodGroup: emergency.patientBloodGroup,
      allergies: emergency.patientAllergies,
      conditions: emergency.patientConditions,
      medications: emergency.patientMedications,
      phoneNumber: emergency.patient?.phoneNumber ?? null,
      emergencyContactName: emergency.patient?.emergencyContactName ?? null,
      emergencyContactPhone: emergency.patient?.emergencyContactPhone ?? null,
    },

    location: {
      latitude: emergency.patientLatitude,
      longitude: emergency.patientLongitude,
      address: emergency.patientAddress,
    },

    ambulance: emergency.assignedAmbulance
      ? {
          id: emergency.assignedAmbulance.id,
          vehicleNo: emergency.assignedAmbulance.vehicleNo,
          type: emergency.assignedAmbulance.ambulanceType,
          driverName: emergency.assignedAmbulance.driverName,
          latitude: emergency.assignedAmbulance.latitude,
          longitude: emergency.assignedAmbulance.longitude,
        }
      : null,

    hospital: emergency.assignedHospital
      ? {
          id: emergency.assignedHospital.id,
          name: emergency.assignedHospital.name,
          latitude: emergency.assignedHospital.latitude,
          longitude: emergency.assignedHospital.longitude,
          // Before pickup the destination may still change; after pickup it
          // is final and the backend refuses to move it.
          temporary: !hospitalLocked,
          locked: hospitalLocked,
          lockedAt: emergency.hospitalLockedAt?.toISOString() ?? null,
          notifiedAt: emergency.hospitalNotifiedAt?.toISOString() ?? null,
        }
      : null,

    navigation: {
      toPatient,
      toHospital,
      activeLeg: onboard ? ("hospital" as const) : ("patient" as const),
    },

    call: {
      status: emergency.callStatus,
      // Drives the patient app's automatic speakerphone view.
      active: emergency.callStatus === CallStatus.ACTIVE,
      startedAt: emergency.callStartedAt?.toISOString() ?? null,
      endedAt: emergency.callEndedAt?.toISOString() ?? null,
      simulated: true,
    },

    patientOnboard: onboard,
    etaMinutes: emergency.etaMinutes,

    timeline: (emergency.timelineEvents ?? []).map((t) => ({
      status: t.status,
      label: t.label,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),

    hospitalCandidates: (emergency.hospitalCandidates ?? []).map((c) => ({
      hospitalId: c.hospitalId,
      hospitalName: c.hospitalName,
      rank: c.rank,
      response: c.response,
    })),

    createdAt: emergency.createdAt.toISOString(),
    updatedAt: emergency.updatedAt.toISOString(),
  };
}

export type EmergencyView = ReturnType<typeof buildEmergencyView>;

import { z } from 'zod';

export const EmergencyIdSchema = z.string().min(1);
export const HospitalIdSchema = z.string().min(1);
export const AmbulanceIdSchema = z.string().min(1);
export const PatientIdSchema = z.string().min(1);

export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const EmergencyRequirementInputSchema = z.object({
  emergencyId: EmergencyIdSchema,
  probableEmergencyType: z.string().min(1),
  severity: z.enum(['CRITICAL', 'HIGH', 'MODERATE', 'LOW']),
  patientLocation: CoordinatesSchema,
  ambulanceLocation: CoordinatesSchema,
});

export const HospitalResponseInputSchema = z.object({
  emergencyId: EmergencyIdSchema,
  candidateId: z.string().min(1),
  hospitalId: HospitalIdSchema,
  response: z.enum(['ACCEPT', 'REJECT']),
});

export const PickupInputSchema = z.object({
  emergencyId: EmergencyIdSchema,
  pickedUpAt: z.string().datetime().or(z.date()),
});

export const HospitalLiveStatusUpdateSchema = z.object({
  hospitalId: HospitalIdSchema,
  acceptingEmergencyPatients: z.boolean(),
  operationalStatus: z.enum(['OPERATIONAL', 'DEGRADED', 'OFFLINE', 'MAINTENANCE']),
  emergencyDepartmentStatus: z.enum(['AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'UNKNOWN']),
  traumaDepartmentStatus: z.enum(['AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'UNKNOWN']),
});

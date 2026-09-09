// ============================================================================
// Zod Validation Schemas
// ============================================================================
// All request validation for the Emergency Core Service.
// These schemas are used by the validate middleware to reject malformed
// requests before they reach the controller/service layer.
// ============================================================================

import { z } from "zod";
import { EmergencyStatus, Severity } from "@prisma/client";

// --------------------------------------------------------------------------
// Reusable: UUID param validator
// --------------------------------------------------------------------------

export const emergencyIdParamSchema = z.object({
  id: z.string().uuid({ message: "Emergency ID must be a valid UUID" }),
});

// --------------------------------------------------------------------------
// POST /sos — Create Emergency
// --------------------------------------------------------------------------

export const createEmergencySchema = z.object({
  patientId: z
    .string({ required_error: "patientId is required" })
    .min(1, "patientId cannot be empty"),

  patientLatitude: z
    .number({ required_error: "patientLatitude is required" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),

  patientLongitude: z
    .number({ required_error: "patientLongitude is required" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),

  patientAddress: z.string().optional(),

  emergencyType: z.string().optional(),

  // Emergency profile fields (optional, denormalized from patient profile)
  patientName: z.string().optional(),
  patientAge: z.number().int().positive().optional(),
  patientSex: z.string().optional(),
  patientBloodGroup: z.string().optional(),
  patientAllergies: z.array(z.string()).optional(),
  patientConditions: z.array(z.string()).optional(),
});

// --------------------------------------------------------------------------
// PATCH /emergency/:id/status — Update Status
// --------------------------------------------------------------------------

// Build a Zod enum from the Prisma EmergencyStatus values
const emergencyStatusValues = Object.values(EmergencyStatus) as [
  string,
  ...string[]
];

const severityValues = Object.values(Severity) as [string, ...string[]];

export const updateStatusSchema = z.object({
  status: z.enum(emergencyStatusValues, {
    required_error: "status is required",
    invalid_type_error: `status must be one of: ${emergencyStatusValues.join(", ")}`,
  }) as z.ZodType<EmergencyStatus>,

  // Optional fields that accompany specific transitions
  severity: z
    .enum(severityValues, {
      invalid_type_error: `severity must be one of: ${severityValues.join(", ")}`,
    })
    .optional() as z.ZodType<Severity | undefined>,

  assignedAmbulanceId: z.string().optional(),
  assignedHospitalId: z.string().optional(),
  etaMinutes: z.number().int().nonnegative().optional(),
  emergencyType: z.string().optional(),
  criticalAlert: z.string().optional(),

  // Timeline event extras
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// --------------------------------------------------------------------------
// Type inference helpers
// --------------------------------------------------------------------------

export type CreateEmergencyBody = z.infer<typeof createEmergencySchema>;
export type UpdateStatusBody = z.infer<typeof updateStatusSchema>;
export type EmergencyIdParams = z.infer<typeof emergencyIdParamSchema>;

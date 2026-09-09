// ============================================================================
// Auth & Profile — Zod Validation Schemas
// ============================================================================

import { z } from "zod";
import { authConfig } from "../config/auth.config";

const phoneSchema = z
  .string({ required_error: "phoneNumber is required" })
  .trim()
  .regex(/^\+?\d[\d\s-]{8,14}$/, "Enter a valid mobile number");

export const requestOtpSchema = z.object({
  phoneNumber: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phoneNumber: phoneSchema,
  code: z
    .string({ required_error: "code is required" })
    .regex(
      new RegExp(`^\\d{${authConfig.otpLength}}$`),
      `Verification code must be ${authConfig.otpLength} digits`
    ),
});

// --------------------------------------------------------------------------
// Patient profile
// --------------------------------------------------------------------------

/**
 * The UI collects conditions/allergies/medications as free text. Accepting a
 * string OR an array here keeps that ergonomic while normalising to the
 * array the schema stores.
 */
const listField = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return [] as string[];
    const raw = Array.isArray(value) ? value : value.split(",");
    return raw.map((v) => v.trim()).filter(Boolean);
  });

export const patientProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  age: z.coerce.number().int().positive("Age must be a positive number").max(130),
  gender: z.string().trim().optional(),
  bloodGroup: z.string().trim().min(1, "Blood group is required"),
  conditions: listField,
  allergies: listField,
  medications: listField,
  emergencyContactName: z.string().trim().optional(),
  emergencyContactPhone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Emergency contact must be 10 digits")
    .optional(),
});

// --------------------------------------------------------------------------
// SOS
// --------------------------------------------------------------------------

export const triggerSosSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  address: z.string().trim().optional(),
  locationIsPrecise: z.boolean().optional(),
});

// --------------------------------------------------------------------------
// Ambulance profile / dispatch
// --------------------------------------------------------------------------

export const ambulanceProfileSchema = z.object({
  driverName: z.string().trim().min(1, "Driver name is required"),
  driverLicense: z.string().trim().optional(),
  drivingExperience: z.string().trim().optional(),
  vehicleNo: z.string().trim().min(1, "Vehicle number is required"),
  ambulanceType: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  serviceArea: z.string().trim().optional(),
  baseLocation: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
});

export const dispatchStatusSchema = z.object({
  isOnline: z.boolean({ required_error: "isOnline is required" }),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export type PatientProfileBody = z.infer<typeof patientProfileSchema>;
export type AmbulanceProfileBody = z.infer<typeof ambulanceProfileSchema>;

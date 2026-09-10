// ============================================================================
// HospitalProfileProvider Adapter (Postgres-backed)
// ============================================================================
// Maps the real Docsahab `Hospital` table into the engine's HospitalProfile
// contract. The current schema only tracks 3 capability booleans
// (hasICU/hasTraumaCare/hasCardiology) — hasICU is treated as a RESOURCE
// (ICU bed capacity, via HospitalLiveStatus), not a capability, matching how
// the old ranking system used it. Capabilities map only what the schema can
// honestly represent: TRAUMA and CARDIAC_EMERGENCY.
// ============================================================================

import { prisma } from "../prisma/client";
import {
  HospitalProfileProvider,
  HospitalProfile,
  HospitalId,
  createHospitalId,
  createHospitalProfile,
  CommonCapabilities,
} from "hospital-decision-engine";
import type { Hospital } from "@prisma/client";

export function toHospitalProfile(hospital: Hospital): HospitalProfile {
  const caps: Set<import("hospital-decision-engine").Capability> = new Set();
  if (hospital.hasCardiology) caps.add(CommonCapabilities.CARDIAC_EMERGENCY);
  if (hospital.hasTraumaCare) caps.add(CommonCapabilities.TRAUMA);

  return createHospitalProfile({
    hospitalId: createHospitalId(hospital.id),
    name: hospital.name,
    location: { latitude: hospital.latitude, longitude: hospital.longitude },
    capabilities: caps,
    services: new Set(),
    contactInfo: { phone: hospital.phoneNumber ?? "UNKNOWN", address: hospital.name },
  });
}

export class PostgresHospitalProfileProvider implements HospitalProfileProvider {
  async getHospitalProfile(hospitalId: HospitalId): Promise<HospitalProfile | null> {
    const row = await prisma.hospital.findUnique({ where: { id: hospitalId.toString() } });
    return row ? toHospitalProfile(row) : null;
  }

  async getAllHospitalProfiles(): Promise<ReadonlyMap<HospitalId, HospitalProfile>> {
    const rows = await prisma.hospital.findMany();
    const map = new Map<HospitalId, HospitalProfile>();
    for (const row of rows) {
      map.set(createHospitalId(row.id), toHospitalProfile(row));
    }
    return map;
  }
}

export const hospitalProfileProvider = new PostgresHospitalProfileProvider();

// ============================================================================
// HospitalLiveStatusProvider Adapter (Postgres-backed)
// ============================================================================
// Reads/writes the real `HospitalLiveStatus` table. This is genuinely
// hospital-OPERATED data (updated via the Hospital console's authenticated
// session, see hospital-console.controller.ts) — not fabricated telemetry.
// `lastUpdated` is a real database timestamp, so the engine's FRESH/STALE/
// EXPIRED classification is real, not simulated.
// ============================================================================

import { prisma } from "../prisma/client";
import {
  HospitalLiveStatusProvider,
  HospitalLiveStatus,
  HospitalId,
  createHospitalId,
  createHospitalLiveStatus,
  CommonResources,
  OperationalStatus,
  DepartmentStatus,
} from "hospital-decision-engine";
import type { HospitalLiveStatus as PrismaLiveStatus } from "@prisma/client";

export function toEngineLiveStatus(row: PrismaLiveStatus): HospitalLiveStatus {
  return createHospitalLiveStatus({
    hospitalId: createHospitalId(row.hospitalId),
    acceptingEmergencyPatients: row.acceptingEmergencyPatients,
    operationalStatus: row.operationalStatus as OperationalStatus,
    emergencyDepartmentStatus: row.emergencyDepartmentStatus as DepartmentStatus,
    traumaDepartmentStatus: row.traumaDepartmentStatus as DepartmentStatus,
    availableResources: new Map([
      [CommonResources.ICU_BEDS, row.icuBedsAvailable],
      [CommonResources.GENERAL_BEDS, row.generalBedsAvailable],
      [CommonResources.ER_AVAILABILITY, row.erBaysAvailable],
      [CommonResources.TRAUMA_AVAILABILITY, row.traumaBaysAvailable],
      [CommonResources.EMERGENCY_RESOURCES, row.ventilatorsAvailable],
    ]),
    currentERLoad: "UNKNOWN",
    currentTraumaLoad: "UNKNOWN",
    capacityIndicators: {
      generalBedsAvailable: row.generalBedsAvailable,
      icuBedsAvailable: row.icuBedsAvailable,
      erBaysAvailable: row.erBaysAvailable,
      traumaBaysAvailable: row.traumaBaysAvailable,
      ventilatorsAvailable: row.ventilatorsAvailable,
      bloodProductsAvailable: row.bloodProductsAvailable,
    },
    dataSource: row.dataSource,
    lastUpdated: row.lastUpdated,
  });
}

export class PostgresHospitalLiveStatusProvider implements HospitalLiveStatusProvider {
  async getHospitalLiveStatus(hospitalId: HospitalId): Promise<HospitalLiveStatus | null> {
    const row = await prisma.hospitalLiveStatus.findUnique({ where: { hospitalId: hospitalId.toString() } });
    return row ? toEngineLiveStatus(row) : null;
  }

  async getAllHospitalLiveStatuses(): Promise<ReadonlyMap<HospitalId, HospitalLiveStatus>> {
    const rows = await prisma.hospitalLiveStatus.findMany();
    const map = new Map<HospitalId, HospitalLiveStatus>();
    for (const row of rows) {
      map.set(createHospitalId(row.hospitalId), toEngineLiveStatus(row));
    }
    return map;
  }

  /** Not used by the ranking path — hospital-operated updates go through updateLiveStatus() below. */
  async updateHospitalLiveStatus(): Promise<void> {
    throw new Error("Use updateLiveStatus() from hospital-live-status.service.ts for authenticated writes");
  }
}

export const hospitalLiveStatusProvider = new PostgresHospitalLiveStatusProvider();

// ============================================================================
// PostgresSelectionStateStore — real, durable SelectionStateStore
// ============================================================================
// Implements the engine's SelectionStateStore port against the real
// `HospitalSelectionState` table (JSONB snapshot + optimistic version).
// Survives backend restarts and is safe across multiple backend instances —
// the compare-and-set is a real conditional UPDATE, not an in-memory Map.
//
// Accepts an optional Prisma client/transaction handle so callers can
// participate in a larger transaction (see hospital-engine.service.ts, which
// needs the selection-state write and the Emergency.assignedHospitalId write
// to commit or roll back together, atomically).
// ============================================================================

import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma/client";
import {
  SelectionStateStore,
  VersionedSelection,
  CasResult,
  SelectionSnapshot,
  EmergencyId,
  SelectionError,
  SelectionErrorCode,
} from "hospital-decision-engine";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * SelectionSnapshot contains nested Date objects (createdAt, updatedAt,
 * lockedAt, expiresAt, invitedAt, respondedAt). JSON.stringify turns Dates
 * into ISO strings automatically; this reviver turns known date-shaped keys
 * back into real Date objects on the way back out of JSONB.
 */
const DATE_KEYS = new Set(["createdAt", "updatedAt", "lockedAt", "expiresAt", "invitedAt", "respondedAt", "acceptedAt", "rejectedAt"]);

function reviveDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveDates);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DATE_KEYS.has(k) && typeof v === "string") {
        out[k] = new Date(v);
      } else {
        out[k] = reviveDates(v);
      }
    }
    return out;
  }
  return value;
}

function serialize(snapshot: SelectionSnapshot): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(snapshot));
}

function deserialize(json: unknown): SelectionSnapshot {
  return reviveDates(json) as SelectionSnapshot;
}

export class PostgresSelectionStateStore implements SelectionStateStore {
  constructor(private readonly db: Db = prisma) {}

  async load(emergencyId: EmergencyId): Promise<VersionedSelection | null> {
    const row = await this.db.hospitalSelectionState.findUnique({
      where: { emergencyId: emergencyId.toString() },
    });
    if (!row) return null;
    return { snapshot: deserialize(row.snapshot), version: row.version };
  }

  async create(snapshot: SelectionSnapshot): Promise<VersionedSelection> {
    try {
      const row = await this.db.hospitalSelectionState.create({
        data: {
          emergencyId: snapshot.emergencyId.toString(),
          snapshot: serialize(snapshot),
          version: 1,
        },
      });
      return { snapshot: deserialize(row.snapshot), version: row.version };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new SelectionError(
          SelectionErrorCode.SELECTION_ALREADY_EXISTS,
          `Selection already exists for emergency ${snapshot.emergencyId}`,
          false
        );
      }
      throw e;
    }
  }

  async compareAndSwap(
    emergencyId: EmergencyId,
    expectedVersion: number,
    next: SelectionSnapshot
  ): Promise<CasResult> {
    const result = await this.db.hospitalSelectionState.updateMany({
      where: { emergencyId: emergencyId.toString(), version: expectedVersion },
      data: { snapshot: serialize(next), version: { increment: 1 } },
    });

    if (result.count === 0) {
      const current = await this.load(emergencyId);
      if (!current) {
        throw new SelectionError(
          SelectionErrorCode.NO_SELECTION_STATE,
          `Cannot compareAndSwap missing selection ${emergencyId}`,
          false
        );
      }
      return { ok: false, conflict: true, current };
    }

    return { ok: true, version: expectedVersion + 1 };
  }
}

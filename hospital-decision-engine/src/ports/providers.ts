import { HospitalId, Capability, ResourceType, Coordinates } from '../domain/models/types';
import { HospitalProfile } from '../domain/models/hospital-profile';
import { HospitalLiveStatus } from '../domain/models/hospital-live-status';

export interface HospitalProfileProvider {
  getHospitalProfile(hospitalId: HospitalId): Promise<HospitalProfile | null>;
  getAllHospitalProfiles(): Promise<ReadonlyMap<HospitalId, HospitalProfile>>;
}

export interface HospitalLiveStatusProvider {
  getHospitalLiveStatus(hospitalId: HospitalId): Promise<HospitalLiveStatus | null>;
  getAllHospitalLiveStatuses(): Promise<ReadonlyMap<HospitalId, HospitalLiveStatus>>;
  updateHospitalLiveStatus(hospitalId: HospitalId, status: Partial<HospitalLiveStatus>): Promise<void>;
}

export interface ETAProvider {
  calculateETA(origin: Coordinates, destination: Coordinates): Promise<ETAResult>;
}

export interface ETAResult {
  distanceKm: number;
  etaSeconds: number;
  timestamp: Date;
  provider: string;
  metadata?: Record<string, unknown>;
}

export interface HospitalInvitationDispatcher {
  sendInvitation(invitation: HospitalInvitation): Promise<InvitationResult>;
  sendInvitations(invitations: ReadonlyArray<HospitalInvitation>): Promise<ReadonlyArray<InvitationResult>>;
}

export interface HospitalInvitation {
  candidateId: string;
  emergencyId: string;
  hospitalId: HospitalId;
  emergencyType: string;
  patientLocation: Coordinates;
  ambulanceLocation: Coordinates;
  expectedArrivalTime: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
}

export interface InvitationResult {
  candidateId: string;
  hospitalId: HospitalId;
  dispatched: boolean;
  dispatchError?: string;
}

export interface ClockProvider {
  now(): Date;
}

export interface SystemClockProvider extends ClockProvider {
  now(): Date;
}

export const createSystemClock = (): SystemClockProvider => ({
  now: () => new Date(),
});

import { HospitalId, Capability, ResourceType } from './types';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface HospitalProfile {
  hospitalId: HospitalId;
  name: string;
  location: Coordinates;
  capabilities: ReadonlySet<Capability>;
  services: ReadonlySet<string>;
  contactInfo: ContactInfo;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactInfo {
  phone: string;
  email?: string;
  address: string;
  emergencyContact?: string;
}

export interface HospitalProfileSnapshot {
  profile: HospitalProfile;
  snapshotAt: Date;
}

export function createHospitalProfile(data: {
  hospitalId: HospitalId;
  name: string;
  location: Coordinates;
  capabilities: ReadonlySet<Capability>;
  services: ReadonlySet<string>;
  contactInfo: ContactInfo;
  metadata?: Record<string, unknown>;
}): HospitalProfile {
  const now = new Date();
  return {
    ...data,
    metadata: data.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}
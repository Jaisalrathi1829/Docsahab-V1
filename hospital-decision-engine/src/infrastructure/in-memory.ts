import { HospitalProfileProvider, HospitalLiveStatusProvider, ETAProvider, ETAResult, ClockProvider } from '../ports/providers';
import { HospitalId, EmergencyId, Capability, ResourceType, Coordinates, createHospitalId, createEmergencyId, CommonCapabilities, CommonResources } from '../domain/models/types';
import { HospitalProfile, ContactInfo, createHospitalProfile } from '../domain/models/hospital-profile';
import { HospitalLiveStatus, CapacityIndicators, OperationalStatus, DepartmentStatus, LoadLevel, createHospitalLiveStatus, FreshnessLevel } from '../domain/models/hospital-live-status';

export class InMemoryHospitalProfileProvider implements HospitalProfileProvider {
  private profiles = new Map<HospitalId, HospitalProfile>();

  constructor(initialProfiles?: ReadonlyArray<HospitalProfile>) {
    if (initialProfiles) {
      for (const profile of initialProfiles) {
        this.profiles.set(profile.hospitalId, profile);
      }
    }
  }

  async getHospitalProfile(hospitalId: HospitalId): Promise<HospitalProfile | null> {
    return this.profiles.get(hospitalId) ?? null;
  }

  async getAllHospitalProfiles(): Promise<ReadonlyMap<HospitalId, HospitalProfile>> {
    return new Map(this.profiles);
  }

  addProfile(profile: HospitalProfile): void {
    this.profiles.set(profile.hospitalId, profile);
  }
}

export class InMemoryHospitalLiveStatusProvider implements HospitalLiveStatusProvider {
  private statuses = new Map<HospitalId, HospitalLiveStatus>();

  constructor(initialStatuses?: ReadonlyArray<HospitalLiveStatus>) {
    if (initialStatuses) {
      for (const status of initialStatuses) {
        this.statuses.set(status.hospitalId, status);
      }
    }
  }

  async getHospitalLiveStatus(hospitalId: HospitalId): Promise<HospitalLiveStatus | null> {
    return this.statuses.get(hospitalId) ?? null;
  }

  async getAllHospitalLiveStatuses(): Promise<ReadonlyMap<HospitalId, HospitalLiveStatus>> {
    return new Map(this.statuses);
  }

  async updateHospitalLiveStatus(hospitalId: HospitalId, update: Partial<HospitalLiveStatus>): Promise<void> {
    const existing = this.statuses.get(hospitalId);
    if (existing) {
      this.statuses.set(hospitalId, { ...existing, ...update, lastUpdated: new Date() });
    }
  }

  setStatus(status: HospitalLiveStatus): void {
    this.statuses.set(status.hospitalId, status);
  }
}

export class HaversineETAProvider implements ETAProvider {
  private readonly averageSpeedKmh: number;

  constructor(averageSpeedKmh: number = 60) {
    this.averageSpeedKmh = averageSpeedKmh;
  }

  async calculateETA(origin: Coordinates, destination: Coordinates): Promise<ETAResult> {
    const distanceKm = this.haversineDistance(origin, destination);
    const etaSeconds = (distanceKm / this.averageSpeedKmh) * 3600;

    return {
      distanceKm,
      etaSeconds: Math.round(etaSeconds),
      timestamp: new Date(),
      provider: 'HaversineETAProvider',
      metadata: { averageSpeedKmh: this.averageSpeedKmh },
    };
  }

  private haversineDistance(a: Coordinates, b: Coordinates): number {
    const R = 6371;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const deltaLng = ((b.longitude - a.longitude) * Math.PI) / 180;

    const sinDeltaLat = Math.sin(deltaLat / 2);
    const sinDeltaLng = Math.sin(deltaLng / 2);
    const aVal = sinDeltaLat * sinDeltaLat + Math.cos(lat1) * Math.cos(lat2) * sinDeltaLng * sinDeltaLng;
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));

    return R * c;
  }
}

export class InMemoryClockProvider implements ClockProvider {
  private currentTime: Date;

  constructor(initialTime?: Date) {
    this.currentTime = initialTime ?? new Date();
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  setTime(time: Date): void {
    this.currentTime = new Date(time.getTime());
  }

  advance(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }
}

export function createDemoHospitalData(baseTime: Date = new Date()): {
  profiles: HospitalProfile[];
  statuses: HospitalLiveStatus[];
} {
  const profiles: HospitalProfile[] = [
    createHospitalProfile({
      hospitalId: createHospitalId('H-001'),
      name: 'City General Hospital',
      location: { latitude: 28.6139, longitude: 77.2090 },
      capabilities: new Set([
        CommonCapabilities.CARDIAC_EMERGENCY,
        CommonCapabilities.TRAUMA,
        CommonCapabilities.NEUROLOGICAL_EMERGENCY,
        CommonCapabilities.PEDIATRIC_EMERGENCY,
        CommonCapabilities.OBSTETRIC_EMERGENCY,
      ]),
      services: new Set(['ER', 'ICU', 'Cardiology', 'Neurology', 'Trauma', 'Pediatrics', 'OB/GYN']),
      contactInfo: {
        phone: '+91-11-23456789',
        email: 'emergency@citygeneral.com',
        address: '123 Main Street, New Delhi',
        emergencyContact: '+91-11-23456790',
      },
    }),
    createHospitalProfile({
      hospitalId: createHospitalId('H-002'),
      name: 'Metro Heart Institute',
      location: { latitude: 28.6200, longitude: 77.2150 },
      capabilities: new Set([
        CommonCapabilities.CARDIAC_EMERGENCY,
        CommonCapabilities.NEUROLOGICAL_EMERGENCY,
      ]),
      services: new Set(['ER', 'ICU', 'Cardiology', 'Neurology']),
      contactInfo: {
        phone: '+91-11-23456791',
        email: 'emergency@metroheart.com',
        address: '456 Cardiac Ave, New Delhi',
        emergencyContact: '+91-11-23456792',
      },
    }),
    createHospitalProfile({
      hospitalId: createHospitalId('H-003'),
      name: 'Apollo Trauma Center',
      location: { latitude: 28.6050, longitude: 77.2000 },
      capabilities: new Set([
        CommonCapabilities.TRAUMA,
        CommonCapabilities.BURN_UNIT,
        CommonCapabilities.TOXICOLOGY,
      ]),
      services: new Set(['ER', 'ICU', 'Trauma', 'Burn Unit', 'Toxicology']),
      contactInfo: {
        phone: '+91-11-23456793',
        email: 'emergency@apollotrauma.com',
        address: '789 Trauma Blvd, New Delhi',
        emergencyContact: '+91-11-23456794',
      },
    }),
    createHospitalProfile({
      hospitalId: createHospitalId('H-004'),
      name: 'Children\'s Medical Center',
      location: { latitude: 28.6300, longitude: 77.2200 },
      capabilities: new Set([
        CommonCapabilities.PEDIATRIC_EMERGENCY,
        CommonCapabilities.NEUROLOGICAL_EMERGENCY,
      ]),
      services: new Set(['ER', 'ICU', 'Pediatrics', 'Pediatric Neurology']),
      contactInfo: {
        phone: '+91-11-23456795',
        email: 'emergency@childrensmc.com',
        address: '321 Kids Way, New Delhi',
        emergencyContact: '+91-11-23456796',
      },
    }),
    createHospitalProfile({
      hospitalId: createHospitalId('H-005'),
      name: 'Regional Medical College',
      location: { latitude: 28.5950, longitude: 77.1900 },
      capabilities: new Set([
        CommonCapabilities.CARDIAC_EMERGENCY,
        CommonCapabilities.TRAUMA,
        CommonCapabilities.OBSTETRIC_EMERGENCY,
        CommonCapabilities.ISOLATION,
      ]),
      services: new Set(['ER', 'ICU', 'Cardiology', 'Trauma', 'OB/GYN', 'Infectious Disease']),
      contactInfo: {
        phone: '+91-11-23456797',
        email: 'emergency@regionalmc.com',
        address: '555 College Road, New Delhi',
        emergencyContact: '+91-11-23456798',
      },
    }),
  ];

  const statuses: HospitalLiveStatus[] = [
    createHospitalLiveStatus({
      hospitalId: createHospitalId('H-001'),
      acceptingEmergencyPatients: true,
      operationalStatus: 'OPERATIONAL',
      emergencyDepartmentStatus: 'AVAILABLE',
      traumaDepartmentStatus: 'AVAILABLE',
      availableResources: new Map([
        [CommonResources.ICU_BEDS, 8],
        [CommonResources.GENERAL_BEDS, 25],
        [CommonResources.ER_AVAILABILITY, 12],
        [CommonResources.TRAUMA_AVAILABILITY, 6],
        [CommonResources.EMERGENCY_RESOURCES, 10],
      ]),
      currentERLoad: 'MODERATE',
      currentTraumaLoad: 'LOW',
      capacityIndicators: {
        generalBedsAvailable: 25,
        icuBedsAvailable: 8,
        erBaysAvailable: 12,
        traumaBaysAvailable: 6,
        ventilatorsAvailable: 10,
        bloodProductsAvailable: true,
      },
      dataSource: 'HOSPITAL_DIRECT_FEED',
      lastUpdated: baseTime,
    }),
    createHospitalLiveStatus({
      hospitalId: createHospitalId('H-002'),
      acceptingEmergencyPatients: true,
      operationalStatus: 'OPERATIONAL',
      emergencyDepartmentStatus: 'AVAILABLE',
      traumaDepartmentStatus: 'UNAVAILABLE',
      availableResources: new Map([
        [CommonResources.ICU_BEDS, 12],
        [CommonResources.GENERAL_BEDS, 15],
        [CommonResources.ER_AVAILABILITY, 8],
        [CommonResources.TRAUMA_AVAILABILITY, 0],
        [CommonResources.EMERGENCY_RESOURCES, 8],
      ]),
      currentERLoad: 'LOW',
      currentTraumaLoad: 'UNKNOWN',
      capacityIndicators: {
        generalBedsAvailable: 15,
        icuBedsAvailable: 12,
        erBaysAvailable: 8,
        traumaBaysAvailable: 0,
        ventilatorsAvailable: 8,
        bloodProductsAvailable: true,
      },
      dataSource: 'HOSPITAL_DIRECT_FEED',
      lastUpdated: baseTime,
    }),
    createHospitalLiveStatus({
      hospitalId: createHospitalId('H-003'),
      acceptingEmergencyPatients: true,
      operationalStatus: 'OPERATIONAL',
      emergencyDepartmentStatus: 'AVAILABLE',
      traumaDepartmentStatus: 'AVAILABLE',
      availableResources: new Map([
        [CommonResources.ICU_BEDS, 4],
        [CommonResources.GENERAL_BEDS, 20],
        [CommonResources.ER_AVAILABILITY, 10],
        [CommonResources.TRAUMA_AVAILABILITY, 8],
        [CommonResources.EMERGENCY_RESOURCES, 6],
      ]),
      currentERLoad: 'HIGH',
      currentTraumaLoad: 'MODERATE',
      capacityIndicators: {
        generalBedsAvailable: 20,
        icuBedsAvailable: 4,
        erBaysAvailable: 10,
        traumaBaysAvailable: 8,
        ventilatorsAvailable: 6,
        bloodProductsAvailable: true,
      },
      dataSource: 'HOSPITAL_DIRECT_FEED',
      lastUpdated: baseTime,
    }),
    createHospitalLiveStatus({
      hospitalId: createHospitalId('H-004'),
      acceptingEmergencyPatients: false,
      operationalStatus: 'OPERATIONAL',
      emergencyDepartmentStatus: 'AVAILABLE',
      traumaDepartmentStatus: 'UNAVAILABLE',
      availableResources: new Map([
        [CommonResources.ICU_BEDS, 6],
        [CommonResources.GENERAL_BEDS, 10],
        [CommonResources.ER_AVAILABILITY, 5],
        [CommonResources.TRAUMA_AVAILABILITY, 0],
        [CommonResources.EMERGENCY_RESOURCES, 4],
      ]),
      currentERLoad: 'LOW',
      currentTraumaLoad: 'UNKNOWN',
      capacityIndicators: {
        generalBedsAvailable: 10,
        icuBedsAvailable: 6,
        erBaysAvailable: 5,
        traumaBaysAvailable: 0,
        ventilatorsAvailable: 4,
        bloodProductsAvailable: false,
      },
      dataSource: 'HOSPITAL_DIRECT_FEED',
      lastUpdated: baseTime,
    }),
    createHospitalLiveStatus({
      hospitalId: createHospitalId('H-005'),
      acceptingEmergencyPatients: true,
      operationalStatus: 'DEGRADED',
      emergencyDepartmentStatus: 'LIMITED',
      traumaDepartmentStatus: 'AVAILABLE',
      availableResources: new Map([
        [CommonResources.ICU_BEDS, 3],
        [CommonResources.GENERAL_BEDS, 30],
        [CommonResources.ER_AVAILABILITY, 6],
        [CommonResources.TRAUMA_AVAILABILITY, 4],
        [CommonResources.EMERGENCY_RESOURCES, 5],
      ]),
      currentERLoad: 'HIGH',
      currentTraumaLoad: 'LOW',
      capacityIndicators: {
        generalBedsAvailable: 30,
        icuBedsAvailable: 3,
        erBaysAvailable: 6,
        traumaBaysAvailable: 4,
        ventilatorsAvailable: 5,
        bloodProductsAvailable: true,
      },
      dataSource: 'HOSPITAL_DIRECT_FEED',
      lastUpdated: baseTime,
    }),
  ];

  return { profiles, statuses };
}

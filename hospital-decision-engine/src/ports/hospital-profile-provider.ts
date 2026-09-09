import { HospitalId } from '../domain/models/types';
import { HospitalProfile } from '../domain/models/hospital-profile';

export interface HospitalProfileProvider {
  getProfile(hospitalId: HospitalId): Promise<HospitalProfile | null>;
  getAllProfiles(): Promise<HospitalProfile[]>;
}

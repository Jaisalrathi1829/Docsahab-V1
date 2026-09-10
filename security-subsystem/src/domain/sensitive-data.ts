import { Role } from '../contracts/security-context';

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'HIGHLY_SENSITIVE';

export type SensitiveField =
  | 'MEDICAL_CONDITIONS'
  | 'ALLERGIES'
  | 'MEDICATIONS'
  | 'BLOOD_GROUP'
  | 'EMERGENCY_CONTACT'
  | 'PRECISE_LOCATION';

export const ROLE_FIELD_ACCESS: Record<SensitiveField, Role[]> = {
  MEDICAL_CONDITIONS: ['PATIENT', 'AMBULANCE', 'HOSPITAL', 'ADMIN'],
  ALLERGIES: ['PATIENT', 'AMBULANCE', 'HOSPITAL', 'ADMIN'],
  MEDICATIONS: ['PATIENT', 'AMBULANCE', 'HOSPITAL', 'ADMIN'],
  BLOOD_GROUP: ['PATIENT', 'AMBULANCE', 'HOSPITAL', 'ADMIN'],
  EMERGENCY_CONTACT: ['PATIENT', 'ADMIN'],
  PRECISE_LOCATION: ['PATIENT', 'AMBULANCE', 'ADMIN'],
};

export interface SensitiveFieldMapping {
  dataField: string;
  sensitiveField: SensitiveField;
}

export class SensitiveDataPolicy {
  canAccess(role: Role, field: SensitiveField): boolean {
    return (ROLE_FIELD_ACCESS[field] ?? []).includes(role);
  }

  filterForRole(
    data: Record<string, unknown>,
    role: Role,
    fieldMapping: ReadonlyArray<SensitiveFieldMapping>
  ): Record<string, unknown> {
    const filtered: Record<string, unknown> = Object.fromEntries(Object.entries(data));

    for (const mapping of fieldMapping) {
      if (!(mapping.dataField in data)) continue;
      if (!this.canAccess(role, mapping.sensitiveField)) {
        delete filtered[mapping.dataField];
      }
    }

    return filtered;
  }
}
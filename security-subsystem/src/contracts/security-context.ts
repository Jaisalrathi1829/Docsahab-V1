export type Role = 'PATIENT' | 'AMBULANCE' | 'HOSPITAL' | 'ADMIN' | 'SYSTEM';

export interface SecurityContext {
  subjectId: string;
  role: Role;
  sessionId?: string;
  tokenId?: string;
  hospitalId?: string;
  ambulanceId?: string;
  patientId?: string;
  issuedAt: Date;
  expiresAt: Date;
  authMethod: string;
}

export type Action =
  | 'CREATE_SOS'
  | 'READ_OWN_PROFILE'
  | 'UPDATE_OWN_PROFILE'
  | 'READ_OWN_EMERGENCY'
  | 'READ_ASSIGNED_EMERGENCY'
  | 'READ_AUTHORIZED_PATIENT_DATA'
  | 'UPDATE_EMERGENCY_FIELD'
  | 'SET_SEVERITY'
  | 'ACCESS_PATIENT_LOCATION'
  | 'NAVIGATE_TO_PATIENT'
  | 'READ_AUTHORIZED_INVITATION'
  | 'ACCEPT_INVITATION'
  | 'REJECT_INVITATION'
  | 'UPDATE_OWN_LIVE_STATUS'
  | 'ADMIN_ACTION';

export type ResourceType =
  | 'PATIENT'
  | 'AMBULANCE'
  | 'HOSPITAL'
  | 'EMERGENCY'
  | 'CANDIDATE'
  | 'INVITATION'
  | 'ASSIGNMENT'
  | 'TIMELINE_EVENT'
  | 'SEVERITY'
  | 'LIVE_STATUS';

export interface AuthorizationDecision {
  allowed: boolean;
  reason: string;
}

export interface ResourceRelationshipResolver {
  hasRelationship(context: SecurityContext, resourceType: ResourceType, resourceId: string): Promise<boolean>;
}

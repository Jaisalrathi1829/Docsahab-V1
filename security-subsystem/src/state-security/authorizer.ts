import { Role, SecurityContext } from '../contracts/security-context';

export type EmergencyState =
  | 'EMERGENCY_CREATED'
  | 'AMBULANCE_ASSIGNED'
  | 'AMBULANCE_EN_ROUTE'
  | 'HOSPITAL_SEARCH'
  | 'TEMPORARY_ASSIGNMENT'
  | 'PATIENT_PICKUP'
  | 'HOSPITAL_LOCKED'
  | 'EN_ROUTE_TO_HOSPITAL'
  | 'ARRIVED'
  | 'COMPLETED';

export interface StateTransitionRequest {
  fromState: EmergencyState;
  toState: EmergencyState;
}

const ALWAYS_ALLOWED_ROLES: Role[] = ['SYSTEM', 'ADMIN'];

const ROLE_ALLOWED_TRANSITIONS: Record<Role, Partial<Record<EmergencyState, EmergencyState[]>>> = {
  SYSTEM: {},
  ADMIN: {},
  PATIENT: {
    EMERGENCY_CREATED: ['AMBULANCE_ASSIGNED'],
  },
  AMBULANCE: {
    AMBULANCE_ASSIGNED: ['AMBULANCE_EN_ROUTE'],
    AMBULANCE_EN_ROUTE: ['HOSPITAL_SEARCH'],
    TEMPORARY_ASSIGNMENT: ['PATIENT_PICKUP'],
    PATIENT_PICKUP: ['HOSPITAL_LOCKED'],
    EN_ROUTE_TO_HOSPITAL: ['ARRIVED'],
    ARRIVED: ['COMPLETED'],
  },
  HOSPITAL: {},
};

export class StateTransitionAuthorizer {
  authorizeTransition(context: SecurityContext, fromState: EmergencyState, toState: EmergencyState): { allowed: boolean; reason: string } {
    if (ALWAYS_ALLOWED_ROLES.includes(context.role)) {
      return { allowed: true, reason: 'System/Admin role authorized transition' };
    }

    const allowedFrom = ROLE_ALLOWED_TRANSITIONS[context.role]?.[fromState];
    const allowed = Array.isArray(allowedFrom) && allowedFrom.includes(toState);
    return {
      allowed,
      reason: allowed ? `Transition ${fromState} -> ${toState} allowed for ${context.role}` : `Transition ${fromState} -> ${toState} denied for ${context.role}`,
    };
  }
}
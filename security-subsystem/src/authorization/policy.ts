import { Action, AuthorizationDecision, ResourceType, SecurityContext } from '../contracts/security-context';

const ROLE_ACTION_MAP: Record<string, Action[]> = {
  PATIENT: ['CREATE_SOS', 'READ_OWN_PROFILE', 'READ_OWN_EMERGENCY', 'UPDATE_OWN_PROFILE'],
  AMBULANCE: ['READ_ASSIGNED_EMERGENCY', 'READ_AUTHORIZED_PATIENT_DATA', 'UPDATE_EMERGENCY_FIELD', 'SET_SEVERITY', 'ACCESS_PATIENT_LOCATION', 'NAVIGATE_TO_PATIENT'],
  HOSPITAL: ['READ_AUTHORIZED_INVITATION', 'ACCEPT_INVITATION', 'REJECT_INVITATION', 'UPDATE_OWN_LIVE_STATUS'],
  ADMIN: ['ADMIN_ACTION', 'READ_OWN_PROFILE', 'READ_OWN_EMERGENCY', 'UPDATE_OWN_LIVE_STATUS'],
  SYSTEM: ['ADMIN_ACTION'],
};

export function authorizeByRole(context: SecurityContext, action: Action): AuthorizationDecision {
  const allowedActions = ROLE_ACTION_MAP[context.role] ?? [];
  const allowed = allowedActions.includes(action);
  return {
    allowed,
    reason: allowed ? 'Role permits action' : `Role ${context.role} not permitted for ${action}`,
  };
}

// ============================================================================
// InMemoryInvitationDispatcher — TEST/DEV ONLY
// ============================================================================
// Reference implementation of HospitalInvitationDispatcher for tests and local
// demos. It records dispatched invitations in memory instead of sending them
// over a network. Production injects a real dispatcher (WebSocket / push /
// hospital console) — invitation transport is an orchestration concern that the
// engine core never owns.
// ============================================================================

import {
  HospitalInvitationDispatcher,
  HospitalInvitation,
  InvitationResult,
} from '../ports/providers';

export class InMemoryInvitationDispatcher implements HospitalInvitationDispatcher {
  readonly sent: HospitalInvitation[] = [];
  /** Optional set of hospitalIds whose dispatch should be simulated as failing. */
  constructor(private readonly failFor: ReadonlySet<string> = new Set()) {}

  async sendInvitation(invitation: HospitalInvitation): Promise<InvitationResult> {
    if (this.failFor.has(invitation.hospitalId.toString())) {
      return {
        candidateId: invitation.candidateId,
        hospitalId: invitation.hospitalId,
        dispatched: false,
        dispatchError: 'Simulated dispatch failure',
      };
    }
    this.sent.push(invitation);
    return { candidateId: invitation.candidateId, hospitalId: invitation.hospitalId, dispatched: true };
  }

  async sendInvitations(invitations: ReadonlyArray<HospitalInvitation>): Promise<ReadonlyArray<InvitationResult>> {
    return Promise.all(invitations.map((i) => this.sendInvitation(i)));
  }
}

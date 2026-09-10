// ============================================================================
// Hospital Console Controller
// ============================================================================
// Every handler acts on `req.auth!.subjectId` (the authenticated hospital) —
// never a client-supplied hospitalId — so a hospital can only see its own
// invitations, respond to its own invitations, and update its own live
// status. That is what makes "Hospital A may not touch Hospital B" true.
// ============================================================================

import { Request, Response, NextFunction } from "express";
import * as hospitalEngine from "../services/hospital-engine.service";
import * as liveStatusService from "../services/hospital-live-status.service";
import { successResponse } from "../utils/api-response";

export async function getPendingRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requests = await hospitalEngine.getPendingRequestsForHospital(req.auth!.subjectId);
    res.status(200).json(successResponse(requests, "Pending requests retrieved"));
  } catch (error) {
    next(error);
  }
}

export async function respond(
  req: Request<{ candidateId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await hospitalEngine.respondToHospitalInvitation(
      req.auth!.subjectId,
      req.params.candidateId,
      req.body.response
    );
    res
      .status(200)
      .json(
        successResponse(
          { emergency: result.emergency, replacementOccurred: result.decision.replacementOccurred },
          req.body.response === "ACCEPTED" ? "Accepted" : "Declined"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function getActiveCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const active = await hospitalEngine.getHospitalActiveCase(req.auth!.subjectId);
    res.status(200).json(successResponse(active, active ? "Active case retrieved" : "No active case"));
  } catch (error) {
    next(error);
  }
}

export async function getLiveStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = await liveStatusService.getLiveStatus(req.auth!.subjectId);
    res.status(200).json(successResponse(status, "Live status retrieved"));
  } catch (error) {
    next(error);
  }
}

export async function updateLiveStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = await liveStatusService.updateLiveStatus(req.auth!.subjectId, req.body);
    res.status(200).json(successResponse(status, "Live status updated"));
  } catch (error) {
    next(error);
  }
}

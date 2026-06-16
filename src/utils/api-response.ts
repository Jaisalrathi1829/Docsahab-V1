// ============================================================================
// Standardized API Response Utility
// ============================================================================
// Provides consistent response shapes across all endpoints.
// All frontends and integration modules can rely on this contract.
// ============================================================================

/**
 * Success response shape:
 * {
 *   "success": true,
 *   "data": { ... },
 *   "message": "..."
 * }
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
}

/**
 * Error response shape:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "INVALID_STATUS_TRANSITION",
 *     "message": "Cannot transition from SOS_TRIGGERED to ARRIVED"
 *   }
 * }
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Build a success response.
 */
export function successResponse<T>(data: T, message: string): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

/**
 * Build an error response.
 */
export function errorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };
}

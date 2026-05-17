import type { ApiError } from "../shared/types";

const AUTH_ERROR_CODES = new Set(["105", "106", "107", "119", "session_expired", "auth_failed"]);

export class AppError extends Error {
  readonly apiError: ApiError;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "AppError";
    this.apiError = error;
  }
}

export function asApiError(error: unknown): ApiError {
  if (error instanceof AppError) {
    return error.apiError;
  }

  if (error instanceof Error) {
    return {
      code: "unexpected_error",
      message: error.message,
      retryable: false
    };
  }

  return {
    code: "unexpected_error",
    message: "Unexpected error.",
    retryable: false
  };
}

export function isAuthError(error: unknown): boolean {
  const apiError = asApiError(error);
  return AUTH_ERROR_CODES.has(apiError.code);
}

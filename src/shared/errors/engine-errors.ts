export type EngineErrorCode =
  | "INTERPRETATION_FAILED"
  | "VALIDATION_FAILED"
  | "EXECUTION_FAILED"
  | "HANDLER_NOT_FOUND"
  | "PERSISTENCE_FAILED"
  | "UNKNOWN";

export interface EngineError {
  code: EngineErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export function createEngineError(
  code: EngineErrorCode,
  message: string,
  details?: Record<string, unknown>,
): EngineError {
  return { code, message, details };
}

export function isEngineError(error: unknown): error is EngineError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

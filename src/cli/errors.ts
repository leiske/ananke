import type { CliFailure, CliSuccess } from "./types";

export class CliError extends Error {
  code: string;
  exitCode: number;
  details?: unknown;

  constructor(code: string, message: string, exitCode = 1, details?: unknown) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

export function ok(message: string, data?: unknown): CliSuccess {
  return { ok: true, message, data };
}

export function fail(code: string, message: string, details?: unknown): CliFailure {
  return {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  };
}

export function asCliFailure(error: unknown): CliFailure {
  if (error instanceof CliError) {
    return fail(error.code, error.message, error.details);
  }

  if (error instanceof Error) {
    return fail("UNEXPECTED_ERROR", error.message);
  }

  return fail("UNEXPECTED_ERROR", "Unexpected error");
}

export function mapExitCode(code: string): number {
  switch (code) {
    case "INVALID_ARGS":
      return 2;
    case "NOT_FOUND":
      return 3;
    case "CONFLICT":
      return 4;
    case "NOT_IMPLEMENTED":
      return 10;
    default:
      return 1;
  }
}

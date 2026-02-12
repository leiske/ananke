import { fail } from "../cli/errors";
import type { CliResult } from "../cli/types";

export function notImplemented(commandName: string, input: unknown): CliResult {
  return fail(
    "NOT_IMPLEMENTED",
    `${commandName} is scaffolded but not implemented yet`,
    { input },
  );
}

import type { WorkspacePaths } from "../workspace/paths";

export interface CliGlobals {
  json: boolean;
  root: string;
}

export interface ParsedArgv {
  globals: CliGlobals;
  command: ParsedCommand | null;
}

export interface ParsedCommand {
  path: string[];
  input: unknown;
}

export interface CommandContext {
  cwd: string;
  globals: CliGlobals;
  paths: WorkspacePaths;
}

export interface CliSuccess {
  ok: true;
  message: string;
  data?: unknown;
}

export interface CliFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type CliResult = CliSuccess | CliFailure;

export type CommandHandler = (
  ctx: CommandContext,
  input: unknown,
) => Promise<CliResult> | CliResult;

export interface CommandDefinition {
  path: string[];
  description: string;
  handler: CommandHandler;
}

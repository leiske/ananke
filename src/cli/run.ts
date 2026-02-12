import { asCliFailure, fail, mapExitCode } from "./errors";
import { renderHelp, renderResult } from "./output";
import { parseArgv } from "./parser";
import { listCommands, resolveCommand } from "./registry";
import type { CommandContext } from "./types";
import { detectWorkspaceRoot, getWorkspacePaths } from "../workspace/paths";

export async function runCli(argv: string[]): Promise<number> {
  const cwd = process.cwd();
  const prefersJson = argv.includes("--json");

  try {
    const parsed = parseArgv(argv, cwd);
    const ctx = createContext(cwd, parsed.globals.json, parsed.globals.root);

    if (parsed.command === null) {
      renderHelp(ctx, listCommands());
      return 0;
    }

    const definition = resolveCommand(parsed.command.path);
    if (!definition) {
      const failure = fail(
        "INVALID_ARGS",
        `Unknown command: ${parsed.command.path.join(" ")}`,
      );
      renderResult(ctx, failure);

      if (!ctx.globals.json) {
        renderHelp(ctx, listCommands());
      }

      return mapExitCode(failure.error.code);
    }

    const result = await definition.handler(ctx, parsed.command.input);
    renderResult(ctx, result);
    return result.ok ? 0 : mapExitCode(result.error.code);
  } catch (error) {
    const fallbackRoot = detectWorkspaceRoot(cwd);
    const fallbackContext = createContext(cwd, prefersJson, fallbackRoot);
    const failure = asCliFailure(error);
    renderResult(fallbackContext, failure);
    return mapExitCode(failure.error.code);
  }
}

function createContext(cwd: string, json: boolean, root: string): CommandContext {
  return {
    cwd,
    globals: { json, root },
    paths: getWorkspacePaths(root),
  };
}

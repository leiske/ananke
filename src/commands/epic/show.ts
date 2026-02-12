import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fail, ok } from "../../cli/errors";
import type { CommandHandler } from "../../cli/types";
import type { Epic } from "../../workspace/types";

interface EpicShowInput {
  epicId: string;
}

export const epicShowCommand: CommandHandler = async (ctx, input) => {
  const parsed = input as EpicShowInput;

  const workspaceRoot = ctx.paths.root;
  const epicsDir = ctx.paths.epicsDir;
  const epicPath = path.join(epicsDir, `${parsed.epicId}.json`);

  if (!existsSync(epicsDir)) {
    return fail("NOT_FOUND", "Workspace not initialized. Run `ananke init` first.");
  }

  if (!existsSync(epicPath)) {
    return fail("NOT_FOUND", `Epic not found: ${parsed.epicId}`);
  }

  let epic: Epic;
  try {
    const raw = await readFile(epicPath, "utf8");
    epic = JSON.parse(raw) as Epic;
  } catch (_error) {
    return fail("CONFLICT", `Failed reading epic file: ${parsed.epicId}`);
  }

  return ok(`Loaded epic ${parsed.epicId}`, {
    epic,
    path: relativePath(workspaceRoot, epicPath),
  });
};

function relativePath(root: string, target: string): string {
  const rel = path.relative(root, target);
  if (rel.length === 0) {
    return ".";
  }

  return rel;
}

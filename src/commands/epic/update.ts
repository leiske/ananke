import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fail, ok } from "../../cli/errors";
import type { CliFailure, CommandHandler } from "../../cli/types";
import type { Epic, EpicStatus } from "../../workspace/types";

interface ParsedEpicUpdateArgs {
  epicId: string;
  title?: string;
  goal?: string;
  status?: EpicStatus;
  context?: string;
  digest?: string;
  addConstraints: string[];
  addDecisions: string[];
}

export const epicUpdateCommand: CommandHandler = async (ctx, input) => {
  const parsed = input as ParsedEpicUpdateArgs;

  const workspaceRoot = ctx.paths.root;
  const epicsDir = ctx.paths.epicsDir;
  const epicPath = path.join(epicsDir, `${parsed.epicId}.json`);

  if (!existsSync(epicsDir)) {
    return fail("NOT_FOUND", "Workspace not initialized. Run `ananke init` first.");
  }

  if (!existsSync(epicPath)) {
    return fail("NOT_FOUND", `Epic not found: ${parsed.epicId}`);
  }

  const currentEpic = await readEpic(epicPath);
  if (isCliFailure(currentEpic)) {
    return currentEpic;
  }

  if (currentEpic.id !== parsed.epicId) {
    return fail("CONFLICT", `Epic file id mismatch: expected ${parsed.epicId}`);
  }

  const nextEpic: Epic = {
    ...currentEpic,
    constraints: [...currentEpic.constraints],
    decisions: [...currentEpic.decisions],
  };

  let changed = false;

  changed = assignIfChanged(nextEpic, "title", parsed.title) || changed;
  changed = assignIfChanged(nextEpic, "goal", parsed.goal) || changed;
  changed = assignIfChanged(nextEpic, "status", parsed.status) || changed;
  changed = assignIfChanged(nextEpic, "context", parsed.context) || changed;
  changed = assignIfChanged(nextEpic, "digest", parsed.digest) || changed;

  const constraintsAdded = appendUnique(nextEpic.constraints, parsed.addConstraints);
  const decisionsAdded = appendUnique(nextEpic.decisions, parsed.addDecisions);
  if (constraintsAdded > 0 || decisionsAdded > 0) {
    changed = true;
  }

  if (!changed) {
    return ok(`No changes applied to epic ${parsed.epicId}`, {
      epic: {
        id: nextEpic.id,
        status: nextEpic.status,
      },
      path: relativePath(workspaceRoot, epicPath),
      applied: {
        constraints_added: 0,
        decisions_added: 0,
      },
    });
  }

  nextEpic.updated_at = new Date().toISOString();

  await writeJson(epicPath, nextEpic);

  return ok(`Updated epic ${parsed.epicId}`, {
    epic: {
      id: nextEpic.id,
      status: nextEpic.status,
    },
    path: relativePath(workspaceRoot, epicPath),
    applied: {
      constraints_added: constraintsAdded,
      decisions_added: decisionsAdded,
    },
  });
};

async function readEpic(filePath: string): Promise<Epic | CliFailure> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!isValidEpic(parsed)) {
      return fail("CONFLICT", "Invalid epic file contents");
    }

    return parsed;
  } catch (_error) {
    return fail("CONFLICT", "Failed reading epic file");
  }
}

function isValidEpic(value: unknown): value is Epic {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const epic = value as Partial<Epic>;
  if (!isNonEmptyString(epic.id) || !isNonEmptyString(epic.title) || !isNonEmptyString(epic.goal)) {
    return false;
  }

  if (epic.status !== "active" && epic.status !== "paused" && epic.status !== "done") {
    return false;
  }

  if (!isStringArray(epic.constraints) || !isStringArray(epic.decisions)) {
    return false;
  }

  if (!isNonEmptyString(epic.created_at) || !isNonEmptyString(epic.updated_at)) {
    return false;
  }

  if (epic.context !== undefined && typeof epic.context !== "string") {
    return false;
  }

  if (epic.digest !== undefined && typeof epic.digest !== "string") {
    return false;
  }

  return true;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function assignIfChanged<T extends keyof Epic>(
  epic: Epic,
  key: T,
  value: Epic[T] | undefined,
): boolean {
  if (value === undefined || epic[key] === value) {
    return false;
  }

  epic[key] = value;
  return true;
}

function appendUnique(target: string[], incoming: string[]): number {
  const seen = new Set(target);
  let added = 0;

  for (const value of incoming) {
    if (seen.has(value)) {
      continue;
    }

    target.push(value);
    seen.add(value);
    added += 1;
  }

  return added;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relativePath(root: string, target: string): string {
  const rel = path.relative(root, target);
  if (rel.length === 0) {
    return ".";
  }

  return rel;
}

function isCliFailure(value: CliFailure | Epic): value is CliFailure {
  return "ok" in value && value.ok === false;
}

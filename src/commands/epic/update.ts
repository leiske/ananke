import { fail, ok } from "../../cli/errors";
import type { CliFailure, CommandHandler } from "../../cli/types";
import { assertEpicExists, assertWorkspaceInitialized } from "../../workspace/assertions";
import { isEpic } from "../../workspace/guards";
import { readJsonFile, toWorkspaceRelative, writeJsonFile } from "../../workspace/io";
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

  const workspaceFailure = assertWorkspaceInitialized(ctx.paths);
  if (workspaceFailure) {
    return workspaceFailure;
  }

  const epicPathOrFailure = assertEpicExists(ctx.paths, parsed.epicId);
  if (typeof epicPathOrFailure !== "string") {
    return epicPathOrFailure;
  }

  const epicRecord = await readEpic(epicPathOrFailure);
  if (!("epic" in epicRecord)) {
    return epicRecord;
  }
  const currentEpic = epicRecord.epic;

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
      path: toWorkspaceRelative(workspaceRoot, epicPathOrFailure),
      applied: {
        constraints_added: 0,
        decisions_added: 0,
      },
    });
  }

  nextEpic.updated_at = new Date().toISOString();

  await writeJsonFile(epicPathOrFailure, nextEpic);

  return ok(`Updated epic ${parsed.epicId}`, {
    epic: {
      id: nextEpic.id,
      status: nextEpic.status,
    },
    path: toWorkspaceRelative(workspaceRoot, epicPathOrFailure),
    applied: {
      constraints_added: constraintsAdded,
      decisions_added: decisionsAdded,
    },
  });
};

async function readEpic(filePath: string): Promise<{ epic: Epic } | CliFailure> {
  try {
    const parsed = await readJsonFile<unknown>(filePath);
    if (!isEpic(parsed)) {
      return fail("CONFLICT", "Invalid epic file contents");
    }

    return { epic: parsed };
  } catch (_error) {
    return fail("CONFLICT", "Failed reading epic file");
  }
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

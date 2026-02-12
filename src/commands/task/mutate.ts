import { fail } from "../../cli/errors";
import type { CliFailure, CommandContext } from "../../cli/types";
import { assertWorkspaceInitialized } from "../../workspace/assertions";
import { readTaskOrFail, writeTask } from "../../workspace/store";
import type { Task, TaskStatus } from "../../workspace/types";

export interface TaskMutationPatch {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: 0 | 1 | 2 | 3 | 4;
  notes?: string;
  outcomeSummary?: string;
  addAcceptance: string[];
}

export interface TaskMutationResult {
  task: Task;
  filePath: string;
  changed: boolean;
  acceptanceAdded: number;
}

export function isCliFailure(value: unknown): value is CliFailure {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }

  return (value as { ok?: unknown }).ok === false;
}

export async function mutateTask(
  ctx: CommandContext,
  taskId: string,
  patch: TaskMutationPatch,
): Promise<TaskMutationResult | CliFailure> {
  const workspaceFailure = assertWorkspaceInitialized(ctx.paths);
  if (workspaceFailure) {
    return workspaceFailure;
  }

  if (patch.status === "done" && patch.outcomeSummary === undefined) {
    return fail("INVALID_ARGS", "--outcome-summary is required when --status is done");
  }

  const taskRecord = await readTaskOrFail(ctx.paths, taskId);
  if (!("task" in taskRecord)) {
    return taskRecord;
  }

  const currentTask = taskRecord.task;
  const nextTask: Task = {
    ...currentTask,
    acceptance: currentTask.acceptance === undefined ? undefined : [...currentTask.acceptance],
  };

  let changed = false;

  changed = assignIfChanged(nextTask, "title", patch.title) || changed;
  changed = assignIfChanged(nextTask, "description", patch.description) || changed;
  changed = assignIfChanged(nextTask, "status", patch.status) || changed;
  changed = assignIfChanged(nextTask, "priority", patch.priority) || changed;
  changed = assignIfChanged(nextTask, "notes", patch.notes) || changed;
  changed = assignIfChanged(nextTask, "outcome_summary", patch.outcomeSummary) || changed;

  const acceptanceAdded = appendUniqueAcceptance(nextTask, patch.addAcceptance);
  if (acceptanceAdded > 0) {
    changed = true;
  }

  if (!changed) {
    return {
      task: nextTask,
      filePath: taskRecord.filePath,
      changed: false,
      acceptanceAdded,
    };
  }

  nextTask.updated_at = new Date().toISOString();

  try {
    await writeTask(ctx.paths, nextTask);
  } catch (_error) {
    return fail("CONFLICT", `Failed writing task file: ${taskId}`);
  }

  return {
    task: nextTask,
    filePath: taskRecord.filePath,
    changed: true,
    acceptanceAdded,
  };
}

function assignIfChanged<T extends keyof Task>(task: Task, key: T, value: Task[T] | undefined): boolean {
  if (value === undefined || task[key] === value) {
    return false;
  }

  task[key] = value;
  return true;
}

function appendUniqueAcceptance(task: Task, incoming: string[]): number {
  if (incoming.length === 0) {
    return 0;
  }

  const existing = task.acceptance === undefined ? [] : [...task.acceptance];
  const seen = new Set(existing);
  let added = 0;

  for (const value of incoming) {
    if (seen.has(value)) {
      continue;
    }

    existing.push(value);
    seen.add(value);
    added += 1;
  }

  if (added > 0) {
    task.acceptance = existing;
  }

  return added;
}

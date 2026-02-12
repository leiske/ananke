import { ok } from "../../cli/errors";
import type { CliSuccess, CommandContext } from "../../cli/types";
import { toWorkspaceRelative } from "../../workspace/io";
import type { Task } from "../../workspace/types";
import type { TaskMutationResult } from "./mutate";

export function formatTaskCreatedResult(
  ctx: CommandContext,
  task: Task,
  filePath: string,
): CliSuccess {
  return ok(`Created task ${task.id}`, {
    task: {
      id: task.id,
      epic_id: task.epic_id,
      status: task.status,
      priority: task.priority,
    },
    path: toWorkspaceRelative(ctx.paths.root, filePath),
  });
}

export function formatTaskLoadedResult(
  ctx: CommandContext,
  task: Task,
  filePath: string,
): CliSuccess {
  return ok(`Loaded task ${task.id}`, {
    task,
    path: toWorkspaceRelative(ctx.paths.root, filePath),
  });
}

export function formatTaskMutationResult(
  ctx: CommandContext,
  taskId: string,
  successVerb: string,
  mutation: TaskMutationResult,
): CliSuccess {
  if (!mutation.changed) {
    return ok(`No changes applied to task ${taskId}`, {
      task: {
        id: mutation.task.id,
        status: mutation.task.status,
        priority: mutation.task.priority,
      },
      path: toWorkspaceRelative(ctx.paths.root, mutation.filePath),
      applied: {
        acceptance_added: 0,
      },
    });
  }

  return ok(`${successVerb} task ${taskId}`, {
    task: {
      id: mutation.task.id,
      status: mutation.task.status,
      priority: mutation.task.priority,
    },
    path: toWorkspaceRelative(ctx.paths.root, mutation.filePath),
    applied: {
      acceptance_added: mutation.acceptanceAdded,
    },
  });
}

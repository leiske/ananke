import { fail, ok } from "../cli/errors";
import type { CliFailure, CommandHandler } from "../cli/types";
import { assertWorkspaceInitialized } from "../workspace/assertions";
import {
  readAllEpicsOrFail,
  readAllTasksOrFail,
  readBlocksOrFail,
  readEpicOrFail,
} from "../workspace/store";
import type { BlockEdge, Epic, Task } from "../workspace/types";

interface ReadyInput {
  epicId?: string;
  limit?: number;
}

interface ReadyTask {
  id: string;
  epic_id: string;
  title: string;
  priority: number;
}

export const readyCommand: CommandHandler = async (ctx, input) => {
  const parsed = input as ReadyInput;

  const workspaceFailure = assertWorkspaceInitialized(ctx.paths);
  if (workspaceFailure) {
    return workspaceFailure;
  }

  if (parsed.epicId !== undefined) {
    const epicRecord = await readEpicOrFail(ctx.paths, parsed.epicId);
    if (!("epic" in epicRecord)) {
      return epicRecord;
    }
  }

  const tasks = await readAllTasksOrFail(ctx.paths);
  if (isCliFailure(tasks)) {
    return tasks;
  }

  const epics = await readAllEpicsOrFail(ctx.paths);
  if (isCliFailure(epics)) {
    return epics;
  }

  const blocks = await readBlocksOrFail(ctx.paths);
  if (isCliFailure(blocks)) {
    return blocks;
  }

  const taskById = new Map(tasks.map((task) => [task.id, task] as const));
  const epicById = new Map(epics.map((epic) => [epic.id, epic] as const));

  const filteredByEpic =
    parsed.epicId === undefined
      ? tasks
      : tasks.filter((task) => task.epic_id === parsed.epicId);

  const readyTasks: Task[] = [];
  for (const task of filteredByEpic) {
    const readiness = isTaskReady(task, epicById, blocks, taskById);
    if (isCliFailure(readiness)) {
      return readiness;
    }

    if (!readiness) {
      continue;
    }

    readyTasks.push(task);
  }

  readyTasks.sort(compareReadyTasks);

  const limitedTasks =
    parsed.limit === undefined ? readyTasks : readyTasks.slice(0, parsed.limit);

  const payloadTasks: ReadyTask[] = limitedTasks.map((task) => ({
    id: task.id,
    epic_id: task.epic_id,
    title: task.title,
    priority: task.priority,
  }));

  return ok("Computed ready tasks", {
    tasks: payloadTasks,
  });
};

function isTaskReady(
  task: Task,
  epicById: Map<string, Epic>,
  blocks: BlockEdge[],
  taskById: Map<string, Task>,
): boolean | CliFailure {
  if (task.status !== "todo") {
    return false;
  }

  const epic = epicById.get(task.epic_id);
  if (epic === undefined) {
    return fail("CONFLICT", `Task references missing epic: ${task.id} -> ${task.epic_id}`);
  }

  if (epic.status === "done") {
    return false;
  }

  for (const edge of blocks) {
    if (edge.to !== task.id) {
      continue;
    }

    const blocker = taskById.get(edge.from);
    if (blocker === undefined) {
      return fail("CONFLICT", `Dependency references missing task: ${edge.from} -> ${edge.to}`);
    }

    if (blocker.status !== "done") {
      return false;
    }
  }

  return true;
}

function compareReadyTasks(left: Task, right: Task): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  if (left.updated_at !== right.updated_at) {
    return left.updated_at.localeCompare(right.updated_at);
  }

  return left.id.localeCompare(right.id);
}

function isCliFailure(value: unknown): value is { ok: false } {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }

  return (value as { ok?: unknown }).ok === false;
}

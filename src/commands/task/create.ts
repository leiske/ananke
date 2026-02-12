import { fail } from "../../cli/errors";
import type { CliFailure, CommandHandler } from "../../cli/types";
import { assertWorkspaceInitialized } from "../../workspace/assertions";
import { TASK_PREFIX } from "../../workspace/ids";
import { readEpicOrFail, readIndexOrFail, writeIndex, writeTask } from "../../workspace/store";
import type { AnankeIndex, Task } from "../../workspace/types";
import { formatTaskCreatedResult } from "./result";

interface TaskCreateInput {
  epicId: string;
  title: string;
  description: string;
  priority: 0 | 1 | 2 | 3 | 4;
  acceptance: string[];
}

export const taskCreateCommand: CommandHandler = async (ctx, input) => {
  const parsed = input as TaskCreateInput;

  const workspaceFailure = assertWorkspaceInitialized(ctx.paths);
  if (workspaceFailure) {
    return workspaceFailure;
  }

  const epicRecord = await readEpicOrFail(ctx.paths, parsed.epicId);
  if (!("epic" in epicRecord)) {
    return epicRecord;
  }

  if (epicRecord.epic.status === "done") {
    return fail(
      "CONFLICT",
      `Cannot create task under done epic: ${parsed.epicId}. Reopen with \`ananke epic update ${parsed.epicId} --status active\``,
    );
  }

  const index = await readIndexOrFail(ctx.paths);
  if (isCliFailure(index)) {
    return index;
  }

  const taskId = formatTaskId(index.next_task);
  const taskPath = `${ctx.paths.tasksDir}/${taskId}.json`;
  if (await Bun.file(taskPath).exists()) {
    return fail("CONFLICT", `Task already exists: ${taskId}`);
  }

  const timestamp = new Date().toISOString();
  const task: Task = {
    id: taskId,
    epic_id: parsed.epicId,
    title: parsed.title,
    description: parsed.description,
    status: "todo",
    priority: parsed.priority,
    created_at: timestamp,
    updated_at: timestamp,
  };

  if (parsed.acceptance.length > 0) {
    task.acceptance = parsed.acceptance;
  }

  const nextIndex: AnankeIndex = {
    next_epic: index.next_epic,
    next_task: index.next_task + 1,
    updated_at: timestamp,
  };

  try {
    await writeTask(ctx.paths, task);
    await writeIndex(ctx.paths, nextIndex);
  } catch (_error) {
    return fail("CONFLICT", `Failed writing task file: ${taskId}`);
  }

  return formatTaskCreatedResult(ctx, task, taskPath);
};

function formatTaskId(nextTask: number): string {
  return `${TASK_PREFIX}-${String(nextTask).padStart(3, "0")}`;
}

function isCliFailure(value: CliFailure | AnankeIndex): value is CliFailure {
  return "ok" in value && value.ok === false;
}

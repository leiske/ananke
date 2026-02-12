import type { CommandHandler } from "../../cli/types";
import type { TaskStatus } from "../../workspace/types";
import { isCliFailure, mutateTask } from "./mutate";
import { formatTaskMutationResult } from "./result";

interface TaskUpdateInput {
  taskId: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: 0 | 1 | 2 | 3 | 4;
  notes?: string;
  outcomeSummary?: string;
  addAcceptance: string[];
}

export const taskUpdateCommand: CommandHandler = async (ctx, input) => {
  const parsed = input as TaskUpdateInput;

  const mutation = await mutateTask(ctx, parsed.taskId, {
    title: parsed.title,
    description: parsed.description,
    status: parsed.status,
    priority: parsed.priority,
    notes: parsed.notes,
    outcomeSummary: parsed.outcomeSummary,
    addAcceptance: parsed.addAcceptance,
  });

  if (isCliFailure(mutation)) {
    return mutation;
  }

  return formatTaskMutationResult(ctx, parsed.taskId, "Updated", mutation);
};

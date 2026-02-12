import type { AnankeIndex, BlockEdge, Epic, Task } from "./types";

export function isAnankeIndex(value: unknown): value is AnankeIndex {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const index = value as Partial<AnankeIndex>;
  return (
    typeof index.next_epic === "number" &&
    Number.isInteger(index.next_epic) &&
    index.next_epic >= 1 &&
    typeof index.next_task === "number" &&
    Number.isInteger(index.next_task) &&
    index.next_task >= 1 &&
    isNonEmptyString(index.updated_at)
  );
}

export function isEpic(value: unknown): value is Epic {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const epic = value as Partial<Epic>;
  return (
    isNonEmptyString(epic.id) &&
    isNonEmptyString(epic.title) &&
    isNonEmptyString(epic.goal) &&
    isEpicStatus(epic.status) &&
    isStringArray(epic.constraints) &&
    isStringArray(epic.decisions) &&
    isNonEmptyString(epic.created_at) &&
    isNonEmptyString(epic.updated_at) &&
    (epic.context === undefined || typeof epic.context === "string") &&
    (epic.digest === undefined || typeof epic.digest === "string")
  );
}

export function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const task = value as Partial<Task>;
  return (
    isNonEmptyString(task.id) &&
    isNonEmptyString(task.epic_id) &&
    isNonEmptyString(task.title) &&
    isNonEmptyString(task.description) &&
    isTaskStatus(task.status) &&
    isPriority(task.priority) &&
    isNonEmptyString(task.created_at) &&
    isNonEmptyString(task.updated_at) &&
    (task.notes === undefined || typeof task.notes === "string") &&
    (task.acceptance === undefined || isStringArray(task.acceptance)) &&
    (task.outcome_summary === undefined || isNonEmptyString(task.outcome_summary))
  );
}

export function isBlockEdgeArray(value: unknown): value is BlockEdge[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((edge) => isBlockEdge(edge));
}

function isBlockEdge(value: unknown): value is BlockEdge {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const edge = value as Partial<BlockEdge>;
  return isNonEmptyString(edge.from) && isNonEmptyString(edge.to);
}

function isEpicStatus(value: unknown): value is Epic["status"] {
  return value === "active" || value === "paused" || value === "done";
}

function isTaskStatus(value: unknown): value is Task["status"] {
  return value === "todo" || value === "doing" || value === "done";
}

function isPriority(value: unknown): value is Task["priority"] {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 4
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

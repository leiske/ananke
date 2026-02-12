import { fail, ok } from "../../cli/errors";
import type { CommandHandler } from "../../cli/types";
import { assertWorkspaceInitialized } from "../../workspace/assertions";
import {
  readBlocksOrFail,
  readTaskOrFail,
  writeBlocks,
} from "../../workspace/store";
import type { BlockEdge } from "../../workspace/types";

interface DepAddInput {
  fromTask: string;
  toTask: string;
}

export const depAddCommand: CommandHandler = async (ctx, input) => {
  const parsed = input as DepAddInput;

  const workspaceFailure = assertWorkspaceInitialized(ctx.paths);
  if (workspaceFailure) {
    return workspaceFailure;
  }

  const fromTask = await readTaskOrFail(ctx.paths, parsed.fromTask);
  if (!("task" in fromTask)) {
    return fromTask;
  }

  const toTask = await readTaskOrFail(ctx.paths, parsed.toTask);
  if (!("task" in toTask)) {
    return toTask;
  }

  const blocks = await readBlocksOrFail(ctx.paths);
  if (isCliFailure(blocks)) {
    return blocks;
  }

  const alreadyExists = blocks.some(
    (edge) => edge.from === parsed.fromTask && edge.to === parsed.toTask,
  );

  if (alreadyExists) {
    return ok(`Dependency already exists: ${parsed.fromTask} -> ${parsed.toTask}`, {
      edge: {
        from: parsed.fromTask,
        to: parsed.toTask,
      },
      applied: {
        added: 0,
      },
    });
  }

  const nextEdges = [...blocks, { from: parsed.fromTask, to: parsed.toTask }];
  if (introducesCycle(nextEdges, parsed.fromTask, parsed.toTask)) {
    return fail(
      "CONFLICT",
      `Dependency would introduce cycle: ${parsed.fromTask} -> ${parsed.toTask}`,
    );
  }

  try {
    await writeBlocks(ctx.paths, nextEdges);
  } catch (_error) {
    return fail("CONFLICT", "Failed writing .ananke/deps/blocks.json");
  }

  return ok(`Added dependency ${parsed.fromTask} -> ${parsed.toTask}`, {
    edge: {
      from: parsed.fromTask,
      to: parsed.toTask,
    },
    applied: {
      added: 1,
    },
  });
};

function introducesCycle(edges: BlockEdge[], fromTask: string, toTask: string): boolean {
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const existing = adjacency.get(edge.from);
    if (existing === undefined) {
      adjacency.set(edge.from, [edge.to]);
      continue;
    }

    existing.push(edge.to);
  }

  const stack = [toTask];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || visited.has(current)) {
      continue;
    }

    if (current === fromTask) {
      return true;
    }

    visited.add(current);
    const next = adjacency.get(current);
    if (next === undefined) {
      continue;
    }

    for (const taskId of next) {
      if (!visited.has(taskId)) {
        stack.push(taskId);
      }
    }
  }

  return false;
}

function isCliFailure(value: unknown): value is { ok: false } {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }

  return (value as { ok?: unknown }).ok === false;
}

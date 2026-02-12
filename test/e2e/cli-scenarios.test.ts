import { describe, expect, test } from "bun:test";
import {
  createTempRoot,
  removeTempRoot,
  runCli,
  withTempRoot,
  type CliFailure,
  type CliSuccess,
} from "./helpers/cli";

describe("CLI e2e scenarios", () => {
  test("workspace lifecycle scenario", async () => {
    await withTempRoot(async (root) => {
      const initFirst = expectSuccess(await runCli(root, ["init"]));
      expect(initFirst.message).toContain("Initialized");
      const created = readCreatedPaths(initFirst);
      expect(created).toContain(".agents");
      expect(created).toContain(".agents/skills");
      expect(created).toContain(".agents/skills/ananke");
      expect(created).toContain(".agents/skills/ananke/SKILL.md");

      expectFailure(await runCli(root, ["init"]), "CONFLICT", 4);
      expectSuccess(await runCli(root, ["init", "--update"]));
      expectSuccess(await runCli(root, ["init", "--reset"]));
    });
  });

  test("root isolation scenario", async () => {
    const rootA = await createTempRoot();
    const rootB = await createTempRoot();

    try {
      expectSuccess(await runCli(rootA, ["init"]));
      expectSuccess(await runCli(rootB, ["init"]));

      const epicA = expectSuccess(
        await runCli(rootA, ["epic", "create", "--title", "A", "--goal", "Root A goal"]),
      );
      const epicB = expectSuccess(
        await runCli(rootB, ["epic", "create", "--title", "B", "--goal", "Root B goal"]),
      );

      expect(readEpicId(epicA)).toBe("EPC-001");
      expect(readEpicId(epicB)).toBe("EPC-001");
    } finally {
      await removeTempRoot(rootA);
      await removeTempRoot(rootB);
    }
  });

  test("epic and task lifecycle scenario", async () => {
    await withTempRoot(async (root) => {
      expectSuccess(await runCli(root, ["init"]));

      const epicCreate = expectSuccess(
        await runCli(root, [
          "epic",
          "create",
          "--title",
          "Search Revamp",
          "--goal",
          "Ship v1 semantic search",
          "--constraint",
          "No daemon in MVP",
          "--decision",
          "Use JSON source of truth",
          "--context",
          "Initial rollout",
        ]),
      );
      const epicId = readEpicId(epicCreate);
      expect(epicId).toMatch(/^EPC-[0-9]+$/);

      const epicShowInitial = expectSuccess(await runCli(root, ["epic", "show", epicId]));
      const initialEpic = readEpic(epicShowInitial);
      expect(initialEpic.title).toBe("Search Revamp");
      expect(initialEpic.goal).toBe("Ship v1 semantic search");
      expect(initialEpic.status).toBe("active");

      const epicUpdate = expectSuccess(
        await runCli(root, [
          "epic",
          "update",
          epicId,
          "--status",
          "paused",
          "--context",
          "Paused for validation",
          "--digest",
          "Captured first pass learnings",
          "--add-constraint",
          "No network in tests",
          "--add-decision",
          "Use Bun shell e2e harness",
        ]),
      );
      const updatedApplied = readApplied(epicUpdate);
      expect(updatedApplied.constraints_added).toBe(1);
      expect(updatedApplied.decisions_added).toBe(1);

      const epicNoop = expectSuccess(
        await runCli(root, [
          "epic",
          "update",
          epicId,
          "--add-constraint",
          "No network in tests",
          "--add-decision",
          "Use Bun shell e2e harness",
        ]),
      );
      const noopApplied = readApplied(epicNoop);
      expect(noopApplied.constraints_added).toBe(0);
      expect(noopApplied.decisions_added).toBe(0);

      const epicShowUpdated = expectSuccess(await runCli(root, ["epic", "show", epicId]));
      const updatedEpic = readEpic(epicShowUpdated);
      expect(updatedEpic.status).toBe("paused");
      expect(updatedEpic.context).toBe("Paused for validation");
      expect(updatedEpic.digest).toBe("Captured first pass learnings");
      expect(updatedEpic.constraints).toContain("No daemon in MVP");
      expect(updatedEpic.constraints).toContain("No network in tests");
      expect(updatedEpic.decisions).toContain("Use JSON source of truth");
      expect(updatedEpic.decisions).toContain("Use Bun shell e2e harness");

      const taskCreate = expectSuccess(
        await runCli(root, [
          "task",
          "create",
          "--epic",
          epicId,
          "--title",
          "Build e2e suite",
          "--description",
          "Exercise CLI-only behavior",
          "--priority",
          "1",
          "--acceptance",
          "Scenario flow passes",
        ]),
      );
      const taskId = readTaskId(taskCreate);
      expect(taskId).toMatch(/^TSK-[0-9]+$/);

      const taskShowInitial = expectSuccess(await runCli(root, ["task", "show", taskId]));
      const initialTask = readTask(taskShowInitial);
      expect(initialTask.epic_id).toBe(epicId);
      expect(initialTask.status).toBe("todo");
      expect(initialTask.priority).toBe(1);
      expect(initialTask.title).toBe("Build e2e suite");

      const taskUpdateDoing = expectSuccess(
        await runCli(root, [
          "task",
          "update",
          taskId,
          "--status",
          "doing",
          "--notes",
          "Implementing scenario coverage",
          "--add-acceptance",
          "Create/update/close flow validated",
          "--add-acceptance",
          "Create/update/close flow validated",
        ]),
      );
      const updateApplied = readApplied(taskUpdateDoing);
      expect(updateApplied.acceptance_added).toBe(1);

      const taskShowDoing = expectSuccess(await runCli(root, ["task", "show", taskId]));
      const doingTask = readTask(taskShowDoing);
      expect(doingTask.status).toBe("doing");
      expect(doingTask.notes).toBe("Implementing scenario coverage");
      expect(doingTask.acceptance).toContain("Scenario flow passes");
      expect(doingTask.acceptance).toContain("Create/update/close flow validated");

      expectFailure(
        await runCli(root, ["task", "update", taskId, "--status", "done"]),
        "INVALID_ARGS",
        2,
      );

      const closeTask = expectSuccess(
        await runCli(root, [
          "task",
          "close",
          taskId,
          "--summary",
          "Closed after validating create, update, and close paths",
        ]),
      );
      const closeTaskData = readTaskSummary(closeTask);
      expect(closeTaskData.status).toBe("done");

      const taskShowDone = expectSuccess(await runCli(root, ["task", "show", taskId]));
      const doneTask = readTask(taskShowDone);
      expect(doneTask.status).toBe("done");
      expect(doneTask.outcome_summary).toBe(
        "Closed after validating create, update, and close paths",
      );
    });
  });

  test("blocking relationship controls ready queue", async () => {
    await withTempRoot(async (root) => {
      expectSuccess(await runCli(root, ["init"]));

      const epicCreate = expectSuccess(
        await runCli(root, [
          "epic",
          "create",
          "--title",
          "Dependency Flow",
          "--goal",
          "Model blocking relationships",
        ]),
      );
      const epicId = readEpicId(epicCreate);

      const blockerCreate = expectSuccess(
        await runCli(root, [
          "task",
          "create",
          "--epic",
          epicId,
          "--title",
          "Implement prerequisite",
          "--description",
          "Complete blocker task first",
          "--priority",
          "2",
        ]),
      );
      const blockerId = readTaskId(blockerCreate);

      const blockedCreate = expectSuccess(
        await runCli(root, [
          "task",
          "create",
          "--epic",
          epicId,
          "--title",
          "Ship dependent task",
          "--description",
          "Should only be ready after blocker is done",
          "--priority",
          "0",
        ]),
      );
      const blockedId = readTaskId(blockedCreate);

      expectSuccess(await runCli(root, ["dep", "add", blockerId, blockedId]));

      const readyWhileBlocked = readReadyTaskIds(await runCli(root, ["ready", "--epic", epicId]));
      expect(readyWhileBlocked).toContain(blockerId);
      expect(readyWhileBlocked).not.toContain(blockedId);

      expectSuccess(
        await runCli(root, ["task", "close", blockerId, "--summary", "Prerequisite complete"]),
      );

      const readyAfterClose = readReadyTaskIds(await runCli(root, ["ready", "--epic", epicId]));
      expect(readyAfterClose).toContain(blockedId);
    });
  });

  test("dep add idempotency and cycle rejection scenario", async () => {
    await withTempRoot(async (root) => {
      expectSuccess(await runCli(root, ["init"]));

      const epicCreate = expectSuccess(
        await runCli(root, [
          "epic",
          "create",
          "--title",
          "Cycle Detection",
          "--goal",
          "Reject cycles in dependency graph",
        ]),
      );
      const epicId = readEpicId(epicCreate);

      const taskA = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Task A",
            "--description",
            "First task",
          ]),
        ),
      );
      const taskB = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Task B",
            "--description",
            "Second task",
          ]),
        ),
      );
      const taskC = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Task C",
            "--description",
            "Third task",
          ]),
        ),
      );

      const addFirst = expectSuccess(await runCli(root, ["dep", "add", taskA, taskB]));
      expect(readApplied(addFirst).added).toBe(1);

      const addDuplicate = expectSuccess(await runCli(root, ["dep", "add", taskA, taskB]));
      expect(readApplied(addDuplicate).added).toBe(0);

      expectSuccess(await runCli(root, ["dep", "add", taskB, taskC]));
      expectFailure(await runCli(root, ["dep", "add", taskC, taskA]), "CONFLICT", 4);
    });
  });

  test("dep rm idempotency and unblocking scenario", async () => {
    await withTempRoot(async (root) => {
      expectSuccess(await runCli(root, ["init"]));

      const epicId = readEpicId(
        expectSuccess(
          await runCli(root, [
            "epic",
            "create",
            "--title",
            "Dependency Removal",
            "--goal",
            "Ensure dep rm updates readiness",
          ]),
        ),
      );

      const blockerId = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Blocker",
            "--description",
            "Block dependent task",
            "--priority",
            "2",
          ]),
        ),
      );

      const blockedId = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Blocked",
            "--description",
            "Wait for blocker",
            "--priority",
            "0",
          ]),
        ),
      );

      expectSuccess(await runCli(root, ["dep", "add", blockerId, blockedId]));

      const readyBeforeRemoval = readReadyTaskIds(await runCli(root, ["ready", "--epic", epicId]));
      expect(readyBeforeRemoval).toContain(blockerId);
      expect(readyBeforeRemoval).not.toContain(blockedId);

      const rmFirst = expectSuccess(await runCli(root, ["dep", "rm", blockerId, blockedId]));
      expect(readApplied(rmFirst).removed).toBe(1);

      const readyAfterRemoval = readReadyTaskIds(await runCli(root, ["ready", "--epic", epicId]));
      expect(readyAfterRemoval).toContain(blockedId);

      const rmSecond = expectSuccess(await runCli(root, ["dep", "rm", blockerId, blockedId]));
      expect(readApplied(rmSecond).removed).toBe(0);
    });
  });

  test("ready excludes blocked task when blocker is doing scenario", async () => {
    await withTempRoot(async (root) => {
      expectSuccess(await runCli(root, ["init"]));

      const epicId = readEpicId(
        expectSuccess(
          await runCli(root, [
            "epic",
            "create",
            "--title",
            "Doing Blocks",
            "--goal",
            "Blockers should require done status",
          ]),
        ),
      );

      const blockerId = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Blocker",
            "--description",
            "Will be moved to doing",
          ]),
        ),
      );

      const blockedId = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Blocked",
            "--description",
            "Should remain blocked",
          ]),
        ),
      );

      expectSuccess(await runCli(root, ["dep", "add", blockerId, blockedId]));
      expectSuccess(await runCli(root, ["task", "update", blockerId, "--status", "doing"]));

      const ready = readReadyTaskIds(await runCli(root, ["ready", "--epic", epicId]));
      expect(ready).not.toContain(blockedId);
    });
  });

  test("ready excludes tasks from done epic scenario", async () => {
    await withTempRoot(async (root) => {
      expectSuccess(await runCli(root, ["init"]));

      const epicId = readEpicId(
        expectSuccess(
          await runCli(root, [
            "epic",
            "create",
            "--title",
            "Done Epic Exclusion",
            "--goal",
            "Exclude todo tasks when epic is done",
          ]),
        ),
      );

      const taskId = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Leftover Task",
            "--description",
            "Should disappear from ready",
          ]),
        ),
      );

      const readyBefore = readReadyTaskIds(await runCli(root, ["ready", "--epic", epicId]));
      expect(readyBefore).toContain(taskId);

      expectSuccess(await runCli(root, ["epic", "update", epicId, "--status", "done"]));

      const readyAfterEpicDone = readReadyTaskIds(await runCli(root, ["ready", "--epic", epicId]));
      expect(readyAfterEpicDone).not.toContain(taskId);

      const readyGlobal = readReadyTaskIds(await runCli(root, ["ready"]));
      expect(readyGlobal).not.toContain(taskId);
    });
  });

  test("ready epic filter respects cross-epic blockers scenario", async () => {
    await withTempRoot(async (root) => {
      expectSuccess(await runCli(root, ["init"]));

      const epicA = readEpicId(
        expectSuccess(
          await runCli(root, [
            "epic",
            "create",
            "--title",
            "Epic A",
            "--goal",
            "Owns blocker",
          ]),
        ),
      );
      const epicB = readEpicId(
        expectSuccess(
          await runCli(root, [
            "epic",
            "create",
            "--title",
            "Epic B",
            "--goal",
            "Owns blocked task",
          ]),
        ),
      );

      const blockerId = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicA,
            "--title",
            "Cross-epic blocker",
            "--description",
            "Must finish first",
          ]),
        ),
      );

      const blockedId = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicB,
            "--title",
            "Cross-epic blocked",
            "--description",
            "Depends on epic A task",
          ]),
        ),
      );

      expectSuccess(await runCli(root, ["dep", "add", blockerId, blockedId]));

      const readyEpicBBlocked = readReadyTaskIds(await runCli(root, ["ready", "--epic", epicB]));
      expect(readyEpicBBlocked).not.toContain(blockedId);

      expectSuccess(await runCli(root, ["task", "close", blockerId, "--summary", "Done"]));

      const readyEpicBAfterClose = readReadyTaskIds(await runCli(root, ["ready", "--epic", epicB]));
      expect(readyEpicBAfterClose).toContain(blockedId);
    });
  });

  test("ready ordering and limit scenario", async () => {
    await withTempRoot(async (root) => {
      expectSuccess(await runCli(root, ["init"]));

      const epicId = readEpicId(
        expectSuccess(
          await runCli(root, [
            "epic",
            "create",
            "--title",
            "Ready Ordering",
            "--goal",
            "Sort ready queue deterministically",
          ]),
        ),
      );

      const highPriority = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Priority Zero",
            "--description",
            "Should be first",
            "--priority",
            "0",
          ]),
        ),
      );

      const mediumOlder = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Priority One Older",
            "--description",
            "Should be before updated peer",
            "--priority",
            "1",
          ]),
        ),
      );

      const mediumNewer = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Priority One Newer",
            "--description",
            "Will have newer updated_at",
            "--priority",
            "1",
          ]),
        ),
      );

      const lowPriority = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Priority Two",
            "--description",
            "Should be last",
            "--priority",
            "2",
          ]),
        ),
      );

      expectSuccess(
        await runCli(root, ["task", "update", mediumNewer, "--notes", "Touch to bump timestamp"]),
      );

      const orderedReady = readReadyTaskIds(await runCli(root, ["ready", "--epic", epicId]));
      expect(orderedReady).toEqual([highPriority, mediumOlder, mediumNewer, lowPriority]);

      const limitedReady = readReadyTaskIds(
        await runCli(root, ["ready", "--epic", epicId, "--limit", "2"]),
      );
      expect(limitedReady).toEqual([highPriority, mediumOlder]);
    });
  });

  test("dep command argument and not-found contracts scenario", async () => {
    await withTempRoot(async (root) => {
      expectSuccess(await runCli(root, ["init"]));

      const epicId = readEpicId(
        expectSuccess(
          await runCli(root, [
            "epic",
            "create",
            "--title",
            "Dep Validation",
            "--goal",
            "Validate parser and lookup failures",
          ]),
        ),
      );

      const existingTaskId = readTaskId(
        expectSuccess(
          await runCli(root, [
            "task",
            "create",
            "--epic",
            epicId,
            "--title",
            "Existing Task",
            "--description",
            "Used for dep validation",
          ]),
        ),
      );

      expectFailure(
        await runCli(root, ["dep", "add", existingTaskId, "TSK-999"]),
        "NOT_FOUND",
        3,
      );
      expectFailure(
        await runCli(root, ["dep", "add", "TSK-999", existingTaskId]),
        "NOT_FOUND",
        3,
      );
      expectFailure(
        await runCli(root, ["dep", "add", existingTaskId, existingTaskId]),
        "INVALID_ARGS",
        2,
      );
    });
  });

  test("error contract scenario", async () => {
    await withTempRoot(async (root) => {
      expectSuccess(await runCli(root, ["init"]));

      expectFailure(await runCli(root, ["epic", "show", "EPC-999"]), "NOT_FOUND", 3);
      expectFailure(await runCli(root, ["task", "show", "TSK-999"]), "NOT_FOUND", 3);

      expectFailure(
        await runCli(root, [
          "task",
          "create",
          "--epic",
          "EPC-999",
          "--title",
          "Orphan task",
          "--description",
          "Should fail when epic missing",
        ]),
        "NOT_FOUND",
        3,
      );

      expectFailure(await runCli(root, ["epic", "show", "bad-id"]), "INVALID_ARGS", 2);
    });
  });
});

function expectSuccess(invocation: Awaited<ReturnType<typeof runCli>>): CliSuccess {
  expect(invocation.exitCode).toBe(0);
  expect(invocation.json.ok).toBe(true);
  return invocation.json as CliSuccess;
}

function expectFailure(
  invocation: Awaited<ReturnType<typeof runCli>>,
  code: string,
  exitCode: number,
): CliFailure {
  expect(invocation.exitCode).toBe(exitCode);
  expect(invocation.json.ok).toBe(false);
  const failure = invocation.json as CliFailure;
  expect(failure.error.code).toBe(code);
  return failure;
}

function readEpicId(success: CliSuccess): string {
  const id = (success.data as { epic?: { id?: string } } | undefined)?.epic?.id;
  expect(id).toBeDefined();
  return id as string;
}

function readTaskId(success: CliSuccess): string {
  const id = (success.data as { task?: { id?: string } } | undefined)?.task?.id;
  expect(id).toBeDefined();
  return id as string;
}

function readEpic(success: CliSuccess): {
  id: string;
  title: string;
  goal: string;
  status: string;
  context?: string;
  digest?: string;
  constraints: string[];
  decisions: string[];
} {
  const epic = (success.data as { epic?: unknown } | undefined)?.epic;
  expect(epic).toBeDefined();
  return epic as {
    id: string;
    title: string;
    goal: string;
    status: string;
    context?: string;
    digest?: string;
    constraints: string[];
    decisions: string[];
  };
}

function readTask(success: CliSuccess): {
  id: string;
  epic_id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  notes?: string;
  acceptance?: string[];
  outcome_summary?: string;
} {
  const task = (success.data as { task?: unknown } | undefined)?.task;
  expect(task).toBeDefined();
  return task as {
    id: string;
    epic_id: string;
    title: string;
    description: string;
    status: string;
    priority: number;
    notes?: string;
    acceptance?: string[];
    outcome_summary?: string;
  };
}

function readApplied(success: CliSuccess): Record<string, number> {
  const applied = (success.data as { applied?: unknown } | undefined)?.applied;
  expect(applied).toBeDefined();
  return applied as Record<string, number>;
}

function readTaskSummary(success: CliSuccess): {
  id: string;
  status: string;
  priority: number;
} {
  const task = (success.data as { task?: unknown } | undefined)?.task;
  expect(task).toBeDefined();
  return task as {
    id: string;
    status: string;
    priority: number;
  };
}

function readCreatedPaths(success: CliSuccess): string[] {
  const created = (success.data as { created?: unknown } | undefined)?.created;
  expect(created).toBeDefined();
  expect(Array.isArray(created)).toBe(true);
  expect((created as unknown[]).every((entry) => typeof entry === "string")).toBe(true);
  return created as string[];
}

function readReadyTaskIds(invocation: Awaited<ReturnType<typeof runCli>>): string[] {
  const success = expectSuccess(invocation);
  const payload = success as { tasks?: unknown; data?: { tasks?: unknown } };
  const tasksValue = Array.isArray(payload.tasks)
    ? payload.tasks
    : Array.isArray(payload.data?.tasks)
      ? payload.data.tasks
      : undefined;

  expect(tasksValue).toBeDefined();

  const taskIds = (tasksValue as Array<{ id?: unknown }>).map((task) => task.id);
  expect(taskIds.every((id) => typeof id === "string")).toBe(true);
  return taskIds as string[];
}

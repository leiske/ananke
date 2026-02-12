import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { fail, ok } from "../cli/errors";
import type { CommandHandler } from "../cli/types";
import { EPIC_ID_PATTERN_SOURCE, TASK_ID_PATTERN_SOURCE } from "../workspace/ids";
import { toWorkspaceRelative, writeJsonFile } from "../workspace/io";
import type { AnankeIndex } from "../workspace/types";

type InitMode = "create" | "update" | "reset";

export const initCommand: CommandHandler = async (ctx, input) => {
  const options = (input ?? {}) as { update?: boolean; reset?: boolean };
  const update = options.update === true;
  const reset = options.reset === true;
  const mode: InitMode = reset ? "reset" : update ? "update" : "create";

  const workspaceRoot = ctx.paths.root;
  const anankeDir = ctx.paths.anankeDir;
  const agentsDir = `${workspaceRoot}/.agents`;
  const agentsSkillsDir = `${agentsDir}/skills`;
  const anankeSkillDir = `${agentsSkillsDir}/ananke`;
  const anankeSkillFile = `${anankeSkillDir}/SKILL.md`;
  const epicsDir = ctx.paths.epicsDir;
  const tasksDir = ctx.paths.tasksDir;
  const depsDir = ctx.paths.depsDir;
  const packsDir = ctx.paths.packsDir;
  const indexFile = ctx.paths.indexFile;
  const blocksFile = ctx.paths.blocksFile;
  const schemaFile = ctx.paths.schemaFile;

  const anankeExists = existsSync(anankeDir);

  if (anankeExists && mode === "create") {
    return fail(
      "CONFLICT",
      ".ananke already exists (use --update or --reset to continue)",
    );
  }

  if (anankeExists && mode === "reset") {
    await rm(anankeDir, { recursive: true, force: true });
  }

  const created: string[] = [];

  await ensureDir(anankeDir, created, workspaceRoot);
  await ensureDir(agentsDir, created, workspaceRoot);
  await ensureDir(agentsSkillsDir, created, workspaceRoot);
  await ensureDir(anankeSkillDir, created, workspaceRoot);
  await ensureDir(epicsDir, created, workspaceRoot);
  await ensureDir(tasksDir, created, workspaceRoot);
  await ensureDir(depsDir, created, workspaceRoot);
  await ensureDir(packsDir, created, workspaceRoot);

  const now = new Date().toISOString();
  const defaultIndex: AnankeIndex = {
    next_epic: 1,
    next_task: 1,
    updated_at: now,
  };

  await ensureJsonFile(indexFile, defaultIndex, mode, created, workspaceRoot);
  await ensureJsonFile(blocksFile, [], mode, created, workspaceRoot);
  await ensureTextFile(
    anankeSkillFile,
    buildAnankeSkillMarkdown(),
    mode,
    created,
    workspaceRoot,
    true,
  );
  await ensureJsonFile(
    schemaFile,
    buildCanonicalSchema(),
    mode,
    created,
    workspaceRoot,
  );

  return ok("Initialized .ananke workspace", { created });
};

async function ensureDir(dirPath: string, created: string[], root: string): Promise<void> {
  if (existsSync(dirPath)) {
    return;
  }

  await mkdir(dirPath, { recursive: true });
  created.push(toWorkspaceRelative(root, dirPath));
}

async function ensureJsonFile(
  filePath: string,
  defaultValue: unknown,
  mode: InitMode,
  created: string[],
  root: string,
): Promise<void> {
  if (!existsSync(filePath)) {
    await writeJsonFile(filePath, defaultValue);
    created.push(toWorkspaceRelative(root, filePath));
    return;
  }

  if (mode !== "update") {
    return;
  }

  const fileStats = await stat(filePath);
  if (fileStats.size > 0) {
    return;
  }

  const existingContent = await readFile(filePath, "utf8");
  if (existingContent.length > 0) {
    return;
  }

  await writeJsonFile(filePath, defaultValue);
  created.push(toWorkspaceRelative(root, filePath));
}

async function ensureTextFile(
  filePath: string,
  defaultValue: string,
  mode: InitMode,
  created: string[],
  root: string,
  replaceOnUpdate: boolean,
): Promise<void> {
  if (!existsSync(filePath)) {
    await Bun.write(filePath, defaultValue);
    created.push(toWorkspaceRelative(root, filePath));
    return;
  }

  if (mode === "update" && replaceOnUpdate) {
    await Bun.write(filePath, defaultValue);
    return;
  }

  if (mode !== "update") {
    return;
  }

  const fileStats = await stat(filePath);
  if (fileStats.size > 0) {
    return;
  }

  const existingContent = await readFile(filePath, "utf8");
  if (existingContent.length > 0) {
    return;
  }

  await Bun.write(filePath, defaultValue);
  created.push(toWorkspaceRelative(root, filePath));
}

function buildAnankeSkillMarkdown(): string {
  return `---
name: ananke
description: Use the ananke CLI as the source of truth for epic and task execution, dependency management, and deterministic context packs.
compatibility: opencode
metadata:
  domain: task-management
  interface: cli
  style: json-first
---

# ananke

Use this skill when working in repositories that use ananke for durable task memory.

## Purpose

Drive work through epics, tasks, and blockers instead of ad-hoc notes. Preserve durable memory with task outcome summaries and start implementation from deterministic context packs.

## Command Invocation Rules

- Prefer machine-readable output by passing \`--json\`.
- Run the CLI:
  - \`ananke --json ...\`
- Use \`--root <path>\` for isolated test or sandbox runs.
- Treat command output as authoritative and always check \`ok\`.
- Response envelopes:
  - success: \`{ ok: true, message, data? }\`
  - failure: \`{ ok: false, error: { code, message, details? } }\`

## Built-in Command List

The current output of \`ananke --help\` is:

\`\`\`text
ananke - AI-native local execution layer

Usage:
  ananke [--json] [--root <path>] <command> [command args/options]

Commands:
  init               Initialize .ananke workspace scaffold
  epic create        Create a new epic
  epic show          Show one epic by id
  epic update        Update an existing epic
  task create        Create a new task
  task show          Show one task by id
  task update        Update an existing task
  task close         Close a task with outcome summary
  dep add            Add a blocks dependency edge
  dep rm             Remove a blocks dependency edge
  ready              List tasks ready to execute
  pack               Generate a task context pack
\`\`\`

## ID and Validation Rules

- Epic IDs: \`EPC-<number>\`
- Task IDs: \`TSK-<number>\`
- Fix parser-level argument errors instead of retrying with guesses.
- Important error codes:
  - \`INVALID_ARGS\` (exit 2)
  - \`NOT_FOUND\` (exit 3)
  - \`CONFLICT\` (exit 4)
  - \`NOT_IMPLEMENTED\` (exit 10)

## Standard Workflow

1. Ensure workspace is initialized.
2. Create or select the target epic.
3. Create tasks with acceptance criteria.
4. Add dependency edges with \`dep add\` when work is blocked.
5. Query \`ready\` for deterministic next work.
6. Move active task to \`doing\`.
7. Implement and validate changes.
8. Close task with a durable summary.
9. Re-run \`ready\` and continue.

## Command Playbook

Initialize workspace:

\`\`\`bash
ananke --json --root "$ROOT" init
\`\`\`

Create epic:

\`\`\`bash
ananke --json --root "$ROOT" epic create \\
  --title "Pack command" \\
  --goal "Generate deterministic task context packs"
\`\`\`

Create task:

\`\`\`bash
ananke --json --root "$ROOT" task create \\
  --epic EPC-001 \\
  --title "Implement pack command handler" \\
  --description "Build md/json context pack generation for one task" \\
  --priority 1 \\
  --acceptance "Writes .ananke/packs/<task>.md by default" \\
  --acceptance "Supports --format json --stdout"
\`\`\`

Add and remove blockers:

\`\`\`bash
ananke --json --root "$ROOT" dep add TSK-001 TSK-002
ananke --json --root "$ROOT" dep rm TSK-001 TSK-002
\`\`\`

List ready work:

\`\`\`bash
ananke --json --root "$ROOT" ready
ananke --json --root "$ROOT" ready --epic EPC-001 --limit 5
\`\`\`

Move a task to doing:

\`\`\`bash
ananke --json --root "$ROOT" task update TSK-002 --status doing --notes "Started implementation"
\`\`\`

Close a task (required durable memory):

\`\`\`bash
ananke --json --root "$ROOT" task close TSK-002 --summary "Implemented X, validated Y, risks Z"
\`\`\`

Generate context pack:

\`\`\`bash
ananke --json --root "$ROOT" pack TSK-002
ananke --json --root "$ROOT" pack TSK-002 --format json --stdout
\`\`\`

## Required Agent Behaviors

- Start implementation from \`pack <task-id>\` when available.
- Keep task state accurate: \`todo -> doing -> done\`.
- Never transition to \`done\` without a meaningful summary.
- Use dependencies to model sequencing constraints explicitly.
- Select next work from \`ready\` output, not intuition.

## Temporary Fallback Until pack Is Implemented

If \`pack\` returns \`NOT_IMPLEMENTED\`:

1. Run \`task show <task-id>\`.
2. Run \`epic show <epic-id>\` from the task data.
3. Run \`ready --epic <epic-id>\` for execution context.
4. Continue work and close with a high-quality summary.

Use this fallback only until \`pack\` is implemented.
`;
}

function buildCanonicalSchema(): unknown {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "ananke.schema.json",
    title: "Ananke Workspace Schema",
    type: "object",
    additionalProperties: false,
    required: ["index", "epic", "task", "blocks"],
    properties: {
      index: { $ref: "#/$defs/index" },
      epic: { $ref: "#/$defs/epic" },
      task: { $ref: "#/$defs/task" },
      blocks: { $ref: "#/$defs/blocks" },
    },
    $defs: {
      index: {
        type: "object",
        additionalProperties: false,
        required: ["next_epic", "next_task", "updated_at"],
        properties: {
          next_epic: { type: "integer", minimum: 1 },
          next_task: { type: "integer", minimum: 1 },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      epic: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "title",
          "goal",
          "status",
          "constraints",
          "decisions",
          "created_at",
          "updated_at",
        ],
        properties: {
          id: { type: "string", pattern: EPIC_ID_PATTERN_SOURCE },
          title: { type: "string", minLength: 1 },
          goal: { type: "string", minLength: 1 },
          status: { type: "string", enum: ["active", "paused", "done"] },
          constraints: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          decisions: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          context: { type: "string" },
          digest: { type: "string" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      task: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "epic_id",
          "title",
          "description",
          "status",
          "priority",
          "created_at",
          "updated_at",
        ],
        properties: {
          id: { type: "string", pattern: TASK_ID_PATTERN_SOURCE },
          epic_id: { type: "string", pattern: EPIC_ID_PATTERN_SOURCE },
          title: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          status: { type: "string", enum: ["todo", "doing", "done"] },
          priority: { type: "integer", minimum: 0, maximum: 4 },
          notes: { type: "string" },
          acceptance: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          outcome_summary: { type: "string", minLength: 1 },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      blockEdge: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to"],
        properties: {
          from: { type: "string", pattern: TASK_ID_PATTERN_SOURCE },
          to: { type: "string", pattern: TASK_ID_PATTERN_SOURCE },
        },
      },
      blocks: {
        type: "array",
        items: { $ref: "#/$defs/blockEdge" },
      },
    },
  };
}

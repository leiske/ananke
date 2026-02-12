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

---
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

- Prefer machine-readable output by passing `--json`.
- Run the CLI:
  - `ananke --json ...`
- Use `--root <path>` for isolated test or sandbox runs.
- Treat command output as authoritative and always check `ok`.
- Response envelopes:
  - success: `{ ok: true, message, data? }`
  - failure: `{ ok: false, error: { code, message, details? } }`

## Built-in Command List

The current output of `ananke --help` is:

```text
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
```

## ID and Validation Rules

- Epic IDs: `EPC-<number>`
- Task IDs: `TSK-<number>`
- Fix parser-level argument errors instead of retrying with guesses.
- Important error codes:
  - `INVALID_ARGS` (exit 2)
  - `NOT_FOUND` (exit 3)
  - `CONFLICT` (exit 4)
  - `NOT_IMPLEMENTED` (exit 10)

## Standard Workflow

1. Ensure workspace is initialized.
2. Create or select the target epic.
3. Create tasks with acceptance criteria.
4. Add dependency edges with `dep add` when work is blocked.
5. Query `ready` for deterministic next work.
6. Move active task to `doing`.
7. Implement and validate changes.
8. Close task with a durable summary.
9. Re-run `ready` and continue.

## Command Playbook

Initialize workspace:

```bash
ananke --json --root "$ROOT" init
```

Create epic:

```bash
ananke --json --root "$ROOT" epic create \
  --title "Pack command" \
  --goal "Generate deterministic task context packs"
```

Create task:

```bash
ananke --json --root "$ROOT" task create \
  --epic EPC-001 \
  --title "Implement pack command handler" \
  --description "Build md/json context pack generation for one task" \
  --priority 1 \
  --acceptance "Writes .ananke/packs/<task>.md by default" \
  --acceptance "Supports --format json --stdout"
```

Add and remove blockers:

```bash
ananke --json --root "$ROOT" dep add TSK-001 TSK-002
ananke --json --root "$ROOT" dep rm TSK-001 TSK-002
```

List ready work:

```bash
ananke --json --root "$ROOT" ready
ananke --json --root "$ROOT" ready --epic EPC-001 --limit 5
```

Move a task to doing:

```bash
ananke --json --root "$ROOT" task update TSK-002 --status doing --notes "Started implementation"
```

Close a task (required durable memory):

```bash
ananke --json --root "$ROOT" task close TSK-002 --summary "Implemented X, validated Y, risks Z"
```

Generate context pack:

```bash
ananke --json --root "$ROOT" pack TSK-002
ananke --json --root "$ROOT" pack TSK-002 --format json --stdout
```

## Required Agent Behaviors

- Start implementation from `pack <task-id>` when available.
- Keep task state accurate: `todo -> doing -> done`.
- Never transition to `done` without a meaningful summary.
- Use dependencies to model sequencing constraints explicitly.
- Select next work from `ready` output, not intuition.

## Temporary Fallback Until pack Is Implemented

If `pack` returns `NOT_IMPLEMENTED`:

1. Run `task show <task-id>`.
2. Run `epic show <epic-id>` from the task data.
3. Run `ready --epic <epic-id>` for execution context.
4. Continue work and close with a high-quality summary.

Use this fallback only until `pack` is implemented.

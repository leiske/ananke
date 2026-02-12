# AI-Native Local Execution Layer (MVP) - High-Level Spec

## Purpose

Build a minimal, local, git-friendly execution system for AI agents that models:

- Epics as durable intent and memory anchors
- Tasks as executable units of work
- Explicit task dependencies (`blocks`)
- Deterministic "ready work" computation
- Context pack generation for agent startup

This system is intentionally **not** a full ticketing platform. It is an AI-first execution layer designed to reduce context loss between agent runs.

## Product Principles

1. AI-native first
   - Every object should be easy for an LLM to read, write, and summarize.
   - Prefer structured fields over free-form markdown where possible.
2. Local and durable
   - Data lives in-repo and is committed to git.
   - No daemon, no background service, no OS-wide setup in MVP.
3. Deterministic retrieval
   - Agents should not guess what to read next.
   - `ready` and `pack` define exact retrieval behavior.
4. Small surface area
   - Minimal commands and schema.
   - Defer concurrency controls and distributed workflows.
5. Memory over process theater
   - Prioritize preserving useful implementation learnings.
   - Avoid workflow complexity not tied to agent effectiveness.

## Scope

### In Scope (MVP)

- Epic CRUD (basic)
- Task CRUD (basic)
- Dependency edges (`blocks` only)
- Ready queue (`ready` command)
- Context pack generation (`pack` command)
- Required close-out summary on completed tasks

### Out of Scope (MVP)

- External system integration (Jira, Linear, GitHub, etc.)
- Multi-agent claiming and lease locks
- Daemon/background sync
- Messaging/mail systems
- Multiple dependency types beyond `blocks`
- Advanced automation (auto-compaction, merge drivers, etc.)

## Minimal Filesystem Layout

```text
.ananke/
  index.json
  schema.json
  epics/
    EPC-001.json
  tasks/
    TSK-001.json
  deps/
    blocks.json
  packs/
    TSK-001.md
```

Notes:

- `index.json` provides lightweight lookup metadata and counters.
- `schema.json` provides canonical JSON Schema for index/epic/task/blocks shapes.
- Source of truth is individual epic/task JSON files + `deps/blocks.json`.
- `packs/` are generated artifacts (can be re-generated).

## Conceptual Data Model

### Epic

Epics are long-lived memory anchors for top-level intent.

Required fields:

- `id` (string, e.g. `EPC-001`)
- `title` (string)
- `goal` (string)
- `status` (`active|paused|done`)
- `constraints` (array of strings)
- `decisions` (array of strings)
- `created_at` (ISO timestamp)
- `updated_at` (ISO timestamp)

Optional fields:

- `context` (string; evolving high-level brief)
- `digest` (string; roll-up of key learnings from closed tasks)

### Task

Tasks are executable work units under a single epic.

Required fields:

- `id` (string, e.g. `TSK-001`)
- `epic_id` (string)
- `title` (string)
- `description` (string)
- `status` (`todo|doing|done`)
- `priority` (integer `0..4`, lower means more urgent)
- `created_at` (ISO timestamp)
- `updated_at` (ISO timestamp)

Optional fields:

- `notes` (string; in-progress learnings)
- `acceptance` (array of strings)
- `outcome_summary` (string; required for any transition to `done`)

### Dependency Graph

MVP supports one edge type:

- `blocks`: task A must be done before task B is ready

Minimal edge representation:

```json
[
  { "from": "TSK-001", "to": "TSK-002" }
]
```

Interpretation:

- `from` blocks `to`
- Task `to` is ready only when all inbound blockers are `done`

## JSON Schema Sketches (High-Level)

### `.ananke/epics/EPC-001.json`

```json
{
  "id": "EPC-001",
  "title": "AI-native local execution layer",
  "goal": "Ship a minimal epic/task/dependency/ready/pack system",
  "status": "active",
  "constraints": [
    "No daemon in MVP",
    "Local repo only",
    "Schema must be LLM-friendly"
  ],
  "decisions": [
    "Use JSON as source of truth",
    "Support only blocks dependencies in MVP"
  ],
  "context": "Primary objective and current approach summary.",
  "digest": "Accumulated key outcomes from closed tasks.",
  "created_at": "2026-02-11T00:00:00Z",
  "updated_at": "2026-02-11T00:00:00Z"
}
```

### `.ananke/tasks/TSK-001.json`

```json
{
  "id": "TSK-001",
  "epic_id": "EPC-001",
  "title": "Define JSON schema",
  "description": "Specify fields for epic, task, and dependency edges.",
  "status": "todo",
  "priority": 1,
  "acceptance": [
    "Epic and task schema documented",
    "Status transitions defined"
  ],
  "notes": "Keep fields terse and machine-readable.",
  "created_at": "2026-02-11T00:00:00Z",
  "updated_at": "2026-02-11T00:00:00Z"
}
```

### `.ananke/deps/blocks.json`

```json
[
  { "from": "TSK-001", "to": "TSK-002" },
  { "from": "TSK-002", "to": "TSK-003" }
]
```

## Command Surface (MVP)

### `epic`

- `epic create`
- `epic show <epic-id>`
- `epic update <epic-id>`

### `task`

- `task create --epic <epic-id>`
- `task show <task-id>`
- `task update <task-id>`
- `task close <task-id> --summary "..."` (writes `outcome_summary` and sets `done`)

### `dep`

- `dep add <from-task> <to-task>`
- `dep rm <from-task> <to-task>`

### `ready`

- `ready`
- `ready --epic <epic-id>`

Ready criteria for task T:

1. `status == todo`
2. all blockers of T are `done`
3. parent epic is not `done`

### `pack`

- `pack <task-id>`

Generates a context pack markdown file in `.ananke/packs/`.

## CLI Command Contracts (Expected)

Command namespace is shown as `ananke` (placeholder binary name).

### Global flags

- `--json` - machine-readable output for agents
- `--root <path>` - workspace root (default: current git repo root)

Behavior:

- `--json` implies no ANSI color output.

### `ananke init`

Purpose:

- Bootstrap `.ananke/` structure and scaffold files.

Contract:

- Creates required directories if missing.
- Writes scaffold files: `index.json`, `deps/blocks.json`, and `schema.json`.
- Default mode fails if `.ananke/` already exists.
- `--update` allows existing workspace and only fills missing/empty scaffold files.
- `--reset` removes existing `.ananke/` and recreates a fresh scaffold.

Flags:

- `--update` - allow existing workspace and backfill missing/empty scaffold files
- `--reset` - destructive re-initialize (deletes and recreates `.ananke/`)

Examples:

```bash
ananke init
ananke init --json
ananke init --update
ananke init --reset
```

Example JSON response:

```json
{
  "ok": true,
  "message": "Initialized .ananke workspace",
  "data": {
    "created": [
      ".ananke",
      ".ananke/epics",
      ".ananke/tasks",
      ".ananke/deps",
      ".ananke/packs",
      ".ananke/index.json",
      ".ananke/deps/blocks.json",
      ".ananke/schema.json"
    ]
  }
}
```

### `ananke epic create`

Purpose:

- Create a new epic memory anchor.

Flags:

- `--title <text>` (required)
- `--goal <text>` (required)
- `--constraint <text>` (repeatable)
- `--decision <text>` (repeatable)
- `--context <text>` (optional)

Examples:

```bash
ananke epic create --title "Search Revamp" --goal "Ship v1 semantic search"
ananke epic create --title "Search Revamp" --goal "Ship v1 semantic search" --constraint "No hosted vector DB" --decision "Use pgvector"
```

Example JSON response:

```json
{
  "ok": true,
  "message": "Created epic EPC-001",
  "data": {
    "epic": {
      "id": "EPC-001",
      "status": "active"
    },
    "path": ".ananke/epics/EPC-001.json"
  }
}
```

### `ananke epic show`

Flags:

- `<epic-id>` (positional, required)

Examples:

```bash
ananke epic show EPC-001
ananke epic show EPC-001 --json
```

### `ananke epic update`

Contract:

- Requires at least one update flag.
- `--add-constraint` and `--add-decision` are append-only and dedupe exact string matches.
- `--title`, `--goal`, `--status`, `--context`, and `--digest` replace current values.
- `updated_at` changes only when at least one effective change is applied.

Flags:

- `<epic-id>` (required)
- `--title <text>`
- `--goal <text>`
- `--status active|paused|done`
- `--add-constraint <text>` (repeatable)
- `--add-decision <text>` (repeatable)
- `--context <text>`
- `--digest <text>`

Examples:

```bash
ananke epic update EPC-001 --add-decision "Use generated packs as default handoff"
ananke epic update EPC-001 --status paused
ananke epic update EPC-001 --add-constraint "No daemon in MVP" --add-constraint "No daemon in MVP"
```

### `ananke epic digest refresh` (Post-MVP Extension)

Purpose:

- Rebuild epic `digest` using durable task memory and an LLM summarizer.

Contract:

- Reads all tasks in the epic with `status=done` and non-empty `outcome_summary`.
- Produces a concise digest focused on decisions, outcomes, risks, and open follow-ups.
- Writes the synthesized digest to epic `digest` and updates `updated_at`.
- Deterministic input ordering before LLM invocation:
  1. `updated_at` ascending
  2. `id` ascending

Flags:

- `<epic-id>` (required)
- `--model <name>` (optional, implementation-defined)
- `--stdout` (optional; print digest without writing)

Examples:

```bash
ananke epic digest refresh EPC-001
ananke epic digest refresh EPC-001 --stdout
```

### `ananke task create`

Purpose:

- Create executable task under a single epic.

Flags:

- `--epic <epic-id>` (required)
- `--title <text>` (required)
- `--description <text>` (required)
- `--priority 0|1|2|3|4` (default: 2)
- `--acceptance <text>` (repeatable)

Examples:

```bash
ananke task create --epic EPC-001 --title "Define schema" --description "Finalize fields and invariants" --priority 1
ananke task create --epic EPC-001 --title "Build ready query" --description "Compute unblocked todo tasks" --acceptance "Excludes blocked tasks" --acceptance "Supports --epic filter"
```

Example JSON response:

```json
{
  "ok": true,
  "task": {
    "id": "TSK-001",
    "epic_id": "EPC-001",
    "status": "todo",
    "priority": 1
  },
  "path": ".ananke/tasks/TSK-001.json"
}
```

### `ananke task show`

Flags:

- `<task-id>` (required)

Examples:

```bash
ananke task show TSK-001
ananke task show TSK-001 --json
```

### `ananke task update`

Contract:

- Requires at least one update flag.
- Any transition to `status=done` requires non-empty `--outcome-summary`.
- `--add-acceptance` appends and dedupes exact string matches.
- `updated_at` changes only when at least one effective change is applied.

Flags:

- `<task-id>` (required)
- `--title <text>`
- `--description <text>`
- `--status todo|doing|done`
- `--priority 0|1|2|3|4`
- `--notes <text>`
- `--outcome-summary <text>`
- `--add-acceptance <text>` (repeatable)

Examples:

```bash
ananke task update TSK-001 --status doing --notes "Drafted initial schema and enums"
ananke task update TSK-001 --priority 0
ananke task update TSK-001 --status done --outcome-summary "Finalized schema and locked status/priority invariants"
```

### `ananke task close`

Purpose:

- Mark task done and capture durable memory.

Contract:

- Requires non-empty `--summary`.
- Sets `status=done` and writes `outcome_summary`.

Flags:

- `<task-id>` (required)
- `--summary <text>` (required)

Examples:

```bash
ananke task close TSK-001 --summary "Finalized schema with strict status enums and added cycle validation notes"
ananke task close TSK-002 --summary "Implemented ready query and added epic filter support"
```

### `ananke dep add`

Purpose:

- Add `blocks` edge from source to target.

Contract:

- Rejects self-edge (`TSK-x -> TSK-x`).
- Rejects edge that introduces a cycle.
- Idempotent if edge already exists.

Flags:

- `<from-task>` (required)
- `<to-task>` (required)

Examples:

```bash
ananke dep add TSK-001 TSK-002
ananke dep add TSK-002 TSK-003
```

### `ananke dep rm`

Flags:

- `<from-task>` (required)
- `<to-task>` (required)

Examples:

```bash
ananke dep rm TSK-001 TSK-002
```

### `ananke ready`

Purpose:

- List executable tasks in deterministic order.

Default ordering:

1. `priority` ascending (`0` first)
2. `updated_at` ascending
3. `id` ascending

Flags:

- `--epic <epic-id>` (optional filter)
- `--limit <n>` (optional)

Examples:

```bash
ananke ready
ananke ready --epic EPC-001 --json
ananke ready --limit 5
```

Example JSON response:

```json
{
  "ok": true,
  "tasks": [
    {
      "id": "TSK-004",
      "epic_id": "EPC-001",
      "title": "Implement pack generator",
      "priority": 1
    }
  ]
}
```

### `ananke pack`

Purpose:

- Generate deterministic LLM-ready context for a specific task.

Contract:

- Reads epic + task + blockers + recent closed outcomes in same epic.
- Writes markdown output file under `.ananke/packs/<task-id>.md`.

Flags:

- `<task-id>` (required)
- `--format md|json` (default: `md`)
- `--recent <n>` (default: `5`, max: `20`)
- `--stdout` (print instead of writing file)

Examples:

```bash
ananke pack TSK-004
ananke pack TSK-004 --format json --stdout
ananke pack TSK-004 --recent 3
```

Example JSON response:

```json
{
  "ok": true,
  "task_id": "TSK-004",
  "output": ".ananke/packs/TSK-004.md",
  "sections": [
    "task_header",
    "epic_brief",
    "task_intent",
    "blocking_context",
    "prior_memory",
    "action_scaffold"
  ]
}
```

## Context Pack Specification (AI-Native)

`pack <task-id>` should include, in order:

1. Task header
   - id, title, status, priority
2. Epic brief
   - goal, constraints, key decisions, current context
3. Task intent
   - description, acceptance criteria
4. Blocking context
   - unresolved blockers and short summaries
5. Relevant prior memory
   - recent (N=3 to 5) closed tasks in same epic with `outcome_summary`
6. Action prompt scaffold
   - "Plan", "Implementation steps", "Validation", "Risks", "Next update"

The pack should be concise, deterministic, and suitable as direct input to an LLM run.

## Lifecycle and Memory Rules

1. Every task must belong to exactly one epic.
2. Any transition of a task to `done` requires `outcome_summary`.
3. Epic `digest` should be periodically updated from closed task summaries.
   - Preferred path after MVP: `ananke epic digest refresh <epic-id>`.
4. New task execution should start from `pack <task-id>` by default.
5. "Memory" is preserved in:
   - epic context + decisions + digest
   - task notes + outcome summaries
   - git history of `.ananke/`

## Non-Functional Requirements

- Human-readable and machine-parseable JSON
- Stable IDs and deterministic sorting in outputs
- Fast local queries (no network)
- Safe to use in a normal single-branch git workflow

## Future Extensions (Post-MVP)

1. Concurrency controls
   - atomic task claiming with lease expiration
   - optional integration lock for single-branch git mutation safety
2. Memory quality automation
   - promote `epic digest refresh` from extension to default workflow
   - automatic epic digest synthesis from task outcomes via LLM summarization
3. Validation and linting
   - required fields, cycle checks, stale-task checks
4. Optional import/export bridges
   - later, if needed, without polluting core model

## MVP Success Criteria

- A new agent run can start work using only `pack <task-id>`.
- `ready` reliably identifies next executable tasks.
- Closed tasks leave useful residue via `outcome_summary`.
- Epic-level memory quality improves over time (less rediscovery).

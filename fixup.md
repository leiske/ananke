# Fixup Plan

## 1) Replace hand-rolled parsing with `commander`

### Why this fix
- Current parsing is split across global-token scanning and per-command manual parsing, which has already caused drift (`--root` parsed globally but not consistently respected by commands).
- We want stricter, predictable CLI grammar and fewer edge-case bugs.

### Decision
- Adopt `commander` as the command parser.
- Keep existing command surface and output/error envelopes.

### Target semantics
- Grammar: `ananke [global flags] <command> [command args/options]`
- Global flags are accepted only before the command path.
- Unknown flags/args fail with `INVALID_ARGS`.
- `--json` continues to control machine-readable output in the existing renderer.

### Implementation details
- Wire `commander` in `src/cli/parser.ts` and return a normalized parse result suitable for current dispatch.
- Keep `src/cli/run.ts` as the orchestrator for rendering and exit-code mapping.
- Preserve existing error code semantics (`INVALID_ARGS`, `NOT_FOUND`, `CONFLICT`, etc.).

### Compatibility notes
- Intentional strictness change: globals after command path are no longer tolerated.

## 2) Enforce globals-first rule for `--json` and `--root`

### Why this fix
- A strict global-option position prevents accidental interpretation of command values as globals and keeps parser behavior deterministic.

### Decision
- `--json` and `--root` must appear before command tokens.
- If a global appears after command tokens, fail immediately with `INVALID_ARGS`.

### Examples
- Valid: `ananke --json --root . epic show E-1`
- Invalid: `ananke epic show E-1 --json`
- Invalid: `ananke epic update E-1 --root . --title "x"`

### Implementation details
- Add parse-time checks in `src/cli/parser.ts`.
- Keep help text explicit about ordering in `src/cli/output.ts` usage line and command help copy.

## 3) Make `--root` actually authoritative in command handlers

### Why this fix
- Current implemented commands derive workspace from `ctx.cwd`, not the parsed root, which violates contract and surprises users.

### Decision
- All file operations must use `ctx.paths` (derived from `ctx.globals.root`) rather than recomputing from `ctx.cwd`.

### Implementation details
- Update command handlers that currently use `ctx.cwd`:
  - `src/commands/init.ts`
  - `src/commands/epic/create.ts`
  - `src/commands/epic/show.ts`
  - `src/commands/epic/update.ts`
- Use `ctx.paths.anankeDir`, `ctx.paths.indexFile`, `ctx.paths.epicsDir`, etc.
- Keep response `path` values workspace-relative to `ctx.paths.root`.

## 4) Allow empty strings for `context` and `digest`

### Why this fix
- We explicitly want to support clearing or intentionally blanking these fields without adding extra flags.

### Decision
- `epic update --context ""` and `epic update --digest ""` are valid and persist empty strings.

### Implementation details
- In `src/commands/epic/update.ts`, treat missing values differently from empty-string values:
  - Missing token value => `INVALID_ARGS`.
  - Present value `""` => valid.
- Keep effective-change behavior:
  - `updated_at` changes only if resulting value differs from current value.

### Behavior notes
- This is intentionally different from fields that require non-empty text (e.g., `title`, `goal`).

## 5) Expand ID format to uppercase 1-3 letter prefixes + variable-width numeric suffix

### Why this fix
- Current fixed-width ID validation (`E-001`, `T-001`) does not scale and is too rigid for larger ranges and broader prefixes.

### Decision
- Canonical ID pattern: `^[A-Z]{1,3}-[0-9]+$`.
- Uppercase prefixes only.

### Implementation details
- Centralize regex helpers in a shared module (e.g., `src/workspace/ids.ts`) to prevent drift.
- Apply shared pattern checks in implemented command validators and schema generation:
  - `src/commands/epic/show.ts`
  - `src/commands/epic/update.ts`
  - `src/commands/init.ts` (schema patterns)
- Keep current ID generation behavior for now (`padStart(3)`) since it naturally supports counts > 999.

### Known caveat
- Lexical string sorting of IDs can be misleading once widths vary (`X-10` vs `X-2`).
- For any future ID-based ordering, parse numeric suffix and sort numerically.

## 6) Non-goals for this fixup

- No repository/storage abstraction refactor in this pass.
- No atomic multi-file write or transaction redesign in this pass.
- No test-suite expansion in this pass.

## 7) Manual verification checklist

- Parser accepts globals only before command path.
- Globals after command path fail with `INVALID_ARGS`.
- `--root` changes the workspace used by `init` and implemented `epic` commands.
- `epic update --context ""` and `epic update --digest ""` both succeed and persist.
- ID validation accepts `E-1`, `EP-12345`, `ABC-999999`; rejects lowercase and >3-letter prefixes.
- Existing `--json` output shape remains unchanged.

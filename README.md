# ananke

CLI scaffold for an AI-native local execution layer.

## Install

```bash
bun install
```

## Run

```bash
bun run src/bin/ananke.ts
```

You can pass subcommands after it, for example:

```bash
bun run src/bin/ananke.ts ready
bun run src/bin/ananke.ts --json task create
```

## Structure

- `src/bin` - executable entrypoint
- `src/cli` - parser, command registry, output, and runtime
- `src/commands` - one file per command handler
- `src/workspace` - workspace path helpers and domain types

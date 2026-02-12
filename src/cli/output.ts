import type { CliResult, CommandContext, CommandDefinition } from "./types";

interface JsonHelpShape {
  ok: true;
  commands: Array<{ command: string; description: string }>;
}

export function renderResult(ctx: CommandContext, result: CliResult): void {
  if (ctx.globals.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.ok) {
    console.log(result.message);
    if (result.data !== undefined) {
      console.log(JSON.stringify(result.data, null, 2));
    }
    return;
  }

  console.error(`Error (${result.error.code}): ${result.error.message}`);
  if (result.error.details !== undefined) {
    console.error(JSON.stringify(result.error.details, null, 2));
  }
}

export function renderHelp(ctx: CommandContext, commands: CommandDefinition[]): void {
  if (ctx.globals.json) {
    const payload: JsonHelpShape = {
      ok: true,
      commands: commands.map((command) => ({
        command: command.path.join(" "),
        description: command.description,
      })),
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log("ananke - AI-native local execution layer");
  console.log("");
  console.log("Usage:");
  console.log("  ananke [--json] [--root <path>] <command> [command args/options]");
  console.log("");
  console.log("Commands:");

  for (const command of commands) {
    const left = command.path.join(" ");
    console.log(`  ${left.padEnd(18)} ${command.description}`);
  }
}

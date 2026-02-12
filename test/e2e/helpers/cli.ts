import { $ } from "bun";

export interface CliSuccess {
  ok: true;
  message: string;
  data?: unknown;
}

export interface CliFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type CliJson = CliSuccess | CliFailure;

export interface CliInvocation {
  exitCode: number;
  stdout: string;
  stderr: string;
  json: CliJson;
}

export async function createTempRoot(): Promise<string> {
  const output = await $`mktemp -d`.quiet();
  const path = output.text().trim();
  if (path.length === 0) {
    throw new Error("mktemp did not return a directory path");
  }

  return path;
}

export async function removeTempRoot(root: string): Promise<void> {
  if (root.length === 0 || root === "/") {
    throw new Error(`Refusing to remove unsafe path: ${root}`);
  }

  await $`rm -rf ${root}`.quiet().nothrow();
}

export async function withTempRoot<T>(run: (root: string) => Promise<T>): Promise<T> {
  const root = await createTempRoot();
  try {
    return await run(root);
  } finally {
    await removeTempRoot(root);
  }
}

export async function runCli(root: string, args: string[]): Promise<CliInvocation> {
  const tokens = ["bun", "run", "src/bin/ananke.ts", "--json", "--root", root, ...args];
  const output = await $`${toRawCommand(tokens)}`.cwd(process.cwd()).quiet().nothrow();

  const stdout = output.stdout.toString("utf8").trim();
  const stderr = output.stderr.toString("utf8").trim();
  if (stdout.length === 0) {
    throw new Error(`CLI returned empty stdout. stderr=${stderr}`);
  }

  let json: CliJson;
  try {
    json = JSON.parse(stdout) as CliJson;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed parsing CLI JSON (${message}). stdout=${stdout} stderr=${stderr}`);
  }

  return {
    exitCode: output.exitCode,
    stdout,
    stderr,
    json,
  };
}

function toRawCommand(tokens: string[]): { raw: string } {
  return {
    raw: tokens.map((token) => $.escape(token)).join(" "),
  };
}

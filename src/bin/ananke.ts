#!/usr/bin/env bun

import { runCli } from "../cli/run";

const exitCode = await runCli(process.argv.slice(2));
process.exit(exitCode);

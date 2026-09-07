#!/usr/bin/env node

// TypeScript entry point. Run `npm run build` before invoking this file directly.
import { main } from "../src/cli.js";

process.exitCode = main();

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const nextDir = resolve(".next");

if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
}

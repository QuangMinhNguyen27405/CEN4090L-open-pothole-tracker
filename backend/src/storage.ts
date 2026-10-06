import { mkdir } from "node:fs/promises";
import path from "node:path";

export const UPLOAD_DIR = path.join(import.meta.dirname, "..", "uploads");

await mkdir(UPLOAD_DIR, { recursive: true });

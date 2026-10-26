import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getAppRoot } from "./app-root";

export type SavedPrompt = {
  id: string;
  title: string;
  body: string;
  /** Empty string = explicitly no negative prompt. */
  negativePrompt?: string;
  createdAt: string;
  updatedAt: string;
};

function dataDir() {
  return path.join(getAppRoot(), "data");
}

function promptsPath() {
  return path.join(dataDir(), "prompts.json");
}

function ensure() {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(promptsPath())) {
    writeFileSync(promptsPath(), JSON.stringify({ prompts: [] }, null, 2), "utf8");
  }
}

function readAll(): SavedPrompt[] {
  ensure();
  try {
    const raw = JSON.parse(readFileSync(promptsPath(), "utf8")) as {
      prompts?: SavedPrompt[];
    };
    return Array.isArray(raw.prompts) ? raw.prompts : [];
  } catch {
    return [];
  }
}

function writeAll(prompts: SavedPrompt[]) {
  ensure();
  writeFileSync(promptsPath(), JSON.stringify({ prompts }, null, 2), "utf8");
}

export function listPrompts() {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createPrompt(input: {
  title: string;
  body: string;
  negativePrompt?: string;
}) {
  const now = new Date().toISOString();
  const prompt: SavedPrompt = {
    id: `prm_${randomUUID().slice(0, 10)}`,
    title: input.title.trim() || "Untitled prompt",
    body: input.body.trim(),
    negativePrompt:
      typeof input.negativePrompt === "string" ? input.negativePrompt.trim() : "",
    createdAt: now,
    updatedAt: now,
  };
  const prompts = readAll();
  prompts.unshift(prompt);
  writeAll(prompts);
  return prompt;
}

export function updatePrompt(
  id: string,
  patch: { title?: string; body?: string; negativePrompt?: string },
) {
  const prompts = readAll();
  const idx = prompts.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const next: SavedPrompt = {
    ...prompts[idx],
    ...(typeof patch.title === "string"
      ? { title: patch.title.trim() || "Untitled prompt" }
      : {}),
    ...(typeof patch.body === "string" ? { body: patch.body.trim() } : {}),
    ...(typeof patch.negativePrompt === "string"
      ? { negativePrompt: patch.negativePrompt.trim() }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  prompts[idx] = next;
  writeAll(prompts);
  return next;
}

export function deletePrompt(id: string) {
  const prompts = readAll();
  const next = prompts.filter((p) => p.id !== id);
  if (next.length === prompts.length) return false;
  writeAll(next);
  return true;
}

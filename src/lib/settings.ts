import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";

import { getAppRoot } from "./app-root";

export type AppSettings = {
  outputDir: string;
  videoOutputDir: string;
  geminiApiKey: string;
  /** Google AI Studio billing page — open from Settings / top bar. */
  billingUrl: string;
  /** Remaining Gemini API / AI Studio prepay balance tracked locally (USD). */
  apiBalanceUsd: number;
  /** Lifetime tracked spend deducted by ArnaVideo (USD). */
  totalSpentUsd: number;
  defaultModelId: string;
  defaultAspectRatio: string;
  defaultResolution: "1K" | "2K" | "4K";
};

/** Re-export for callers that import from settings. */
export { getAppRoot } from "./app-root";

const ENV_PATH = () => path.join(getAppRoot(), ".env");
const LEGACY_SETTINGS_PATH = () => path.join(getAppRoot(), "data", "settings.json");

const ENV_MAP = {
  geminiApiKey: "GEMINI_API_KEY",
  billingUrl: "BILLING_URL",
  outputDir: "OUTPUT_DIR",
  videoOutputDir: "VIDEO_OUTPUT_DIR",
  apiBalanceUsd: "API_BALANCE_USD",
  totalSpentUsd: "TOTAL_SPENT_USD",
  defaultModelId: "DEFAULT_MODEL_ID",
  defaultAspectRatio: "DEFAULT_ASPECT_RATIO",
  defaultResolution: "DEFAULT_RESOLUTION",
} as const;

const DEFAULT_BILLING_URL = "https://aistudio.google.com/billing";

function defaultOutputDirRel() {
  return path.join("media", "images");
}

function defaultVideoOutputDirRel() {
  return path.join("media", "videos");
}

function resolveDir(value: string, fallbackRel: string) {
  const raw = (value || fallbackRel).trim();
  return path.isAbsolute(raw) ? raw : path.resolve(getAppRoot(), raw);
}

function toStoragePath(absoluteOrRel: string, fallbackRel: string) {
  const absolute = resolveDir(absoluteOrRel, fallbackRel);
  const root = getAppRoot();
  const rel = path.relative(root, absolute);
  // Prefer portable relative paths when the folder lives under the app root.
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    return rel.split(path.sep).join("/");
  }
  return absolute;
}

export function getDefaultSettings(): AppSettings {
  return {
    outputDir: resolveDir(defaultOutputDirRel(), defaultOutputDirRel()),
    videoOutputDir: resolveDir(defaultVideoOutputDirRel(), defaultVideoOutputDirRel()),
    geminiApiKey: "",
    billingUrl: DEFAULT_BILLING_URL,
    apiBalanceUsd: 0,
    totalSpentUsd: 0,
    defaultModelId: "gemini-nano-banana-2.1",
    defaultAspectRatio: "16:9",
    defaultResolution: "2K",
  };
}

function parseEnvContent(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
      value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
    out[key] = value;
  }
  return out;
}

function readEnvFile(): Record<string, string> {
  const file = ENV_PATH();
  if (!existsSync(file)) return {};
  try {
    return parseEnvContent(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function quoteEnvValue(value: string) {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

function writeEnvFile(values: Record<string, string>) {
  const file = ENV_PATH();
  const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
  const lines = existing ? existing.split(/\r?\n/) : [];
  const managed = new Set<string>(Object.values(ENV_MAP));
  const seen = new Set<string>();
  const nextLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      nextLines.push(line);
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      nextLines.push(line);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!managed.has(key)) {
      nextLines.push(line);
      continue;
    }
    if (key in values) {
      nextLines.push(`${key}=${quoteEnvValue(values[key] ?? "")}`);
      seen.add(key);
    }
  }

  const missing = [...managed].filter((key) => !seen.has(key));
  if (missing.length > 0) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    if (!existing.includes("# ArnaVideo settings")) {
      nextLines.push("# ArnaVideo settings (written by the app — do not commit .env)");
    }
    for (const key of missing) {
      nextLines.push(`${key}=${quoteEnvValue(values[key] ?? "")}`);
    }
  }

  const nextContent = `${nextLines.join("\n").replace(/\n*$/, "\n")}`;
  // Skip no-op writes — Next.js restarts the dev server whenever .env changes.
  if (nextContent !== existing.replace(/\r\n/g, "\n").replace(/\n*$/, "\n") && nextContent !== existing) {
    writeFileSync(file, nextContent, "utf8");
  }

  // Keep in-process env in sync for the current Node process.
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
}

function migrateLegacySettingsJson(env: Record<string, string>) {
  const legacyPath = LEGACY_SETTINGS_PATH();
  if (!existsSync(legacyPath)) return env;

  try {
    const raw = JSON.parse(readFileSync(legacyPath, "utf8")) as Partial<{
      geminiApiKey: string;
      outputDir: string;
      videoOutputDir: string;
      apiBalanceUsd: number;
      totalSpentUsd: number;
      defaultModelId: string;
      defaultAspectRatio: string;
      defaultResolution: string;
    }>;
    const merged = { ...env };
    let changed = false;

    if (!merged.GEMINI_API_KEY && raw.geminiApiKey) {
      merged.GEMINI_API_KEY = raw.geminiApiKey;
      changed = true;
    }
    if (!merged.OUTPUT_DIR && raw.outputDir) {
      merged.OUTPUT_DIR = toStoragePath(raw.outputDir, defaultOutputDirRel());
      changed = true;
    }
    if (!merged.VIDEO_OUTPUT_DIR && raw.videoOutputDir) {
      merged.VIDEO_OUTPUT_DIR = toStoragePath(
        raw.videoOutputDir,
        defaultVideoOutputDirRel(),
      );
      changed = true;
    }
    if (!merged.API_BALANCE_USD && typeof raw.apiBalanceUsd === "number") {
      merged.API_BALANCE_USD = String(raw.apiBalanceUsd);
      changed = true;
    }
    if (!merged.TOTAL_SPENT_USD && typeof raw.totalSpentUsd === "number") {
      merged.TOTAL_SPENT_USD = String(raw.totalSpentUsd);
      changed = true;
    }
    if (!merged.DEFAULT_MODEL_ID && raw.defaultModelId) {
      merged.DEFAULT_MODEL_ID = raw.defaultModelId;
      changed = true;
    }
    if (!merged.DEFAULT_ASPECT_RATIO && raw.defaultAspectRatio) {
      merged.DEFAULT_ASPECT_RATIO = raw.defaultAspectRatio;
      changed = true;
    }
    if (!merged.DEFAULT_RESOLUTION && raw.defaultResolution) {
      merged.DEFAULT_RESOLUTION = raw.defaultResolution;
      changed = true;
    }

    // Remove legacy file so secrets only live in .env
    unlinkSync(legacyPath);
    return changed ? merged : env;
  } catch {
    return env;
  }
}

function settingsFromEnvMap(env: Record<string, string>): AppSettings {
  const defaults = getDefaultSettings();
  const resolution = (env.DEFAULT_RESOLUTION || defaults.defaultResolution) as
    | "1K"
    | "2K"
    | "4K";

  return {
    outputDir: resolveDir(env.OUTPUT_DIR || defaultOutputDirRel(), defaultOutputDirRel()),
    videoOutputDir: resolveDir(
      env.VIDEO_OUTPUT_DIR || defaultVideoOutputDirRel(),
      defaultVideoOutputDirRel(),
    ),
    geminiApiKey: env.GEMINI_API_KEY || "",
    billingUrl: (env.BILLING_URL || defaults.billingUrl).trim(),
    apiBalanceUsd: Math.max(0, Number(env.API_BALANCE_USD || 0) || 0),
    totalSpentUsd: Math.max(0, Number(env.TOTAL_SPENT_USD || 0) || 0),
    defaultModelId: env.DEFAULT_MODEL_ID || defaults.defaultModelId,
    defaultAspectRatio: env.DEFAULT_ASPECT_RATIO || defaults.defaultAspectRatio,
    defaultResolution: ["1K", "2K", "4K"].includes(resolution)
      ? resolution
      : defaults.defaultResolution,
  };
}

function settingsToEnvValues(settings: AppSettings): Record<string, string> {
  return {
    GEMINI_API_KEY: settings.geminiApiKey,
    BILLING_URL: settings.billingUrl.trim() || DEFAULT_BILLING_URL,
    OUTPUT_DIR: toStoragePath(settings.outputDir, defaultOutputDirRel()),
    VIDEO_OUTPUT_DIR: toStoragePath(settings.videoOutputDir, defaultVideoOutputDirRel()),
    API_BALANCE_USD: String(settings.apiBalanceUsd),
    TOTAL_SPENT_USD: String(settings.totalSpentUsd),
    DEFAULT_MODEL_ID: settings.defaultModelId,
    DEFAULT_ASPECT_RATIO: settings.defaultAspectRatio,
    DEFAULT_RESOLUTION: settings.defaultResolution,
  };
}

export function readSettings(): AppSettings {
  let env = readEnvFile();
  const migrated = migrateLegacySettingsJson(env);
  if (migrated !== env) {
    env = migrated;
    // One-time migration write only (legacy settings.json → .env).
    const settings = settingsFromEnvMap({
      ...env,
      OUTPUT_DIR: env.OUTPUT_DIR || defaultOutputDirRel().split(path.sep).join("/"),
      VIDEO_OUTPUT_DIR:
        env.VIDEO_OUTPUT_DIR || defaultVideoOutputDirRel().split(path.sep).join("/"),
      BILLING_URL: env.BILLING_URL || DEFAULT_BILLING_URL,
    });
    writeEnvFile(settingsToEnvValues(settings));
    ensureOutputDir(settings.outputDir);
    ensureVideoOutputDir(settings.videoOutputDir);
    return settings;
  }

  // Never write on a normal read — writing .env restarts Next.js in dev and
  // leaves the UI stuck on "Loading workspace…".
  return settingsFromEnvMap(env);
}

export function writeSettings(patch: Partial<AppSettings>): AppSettings {
  const current = readSettings();
  const next: AppSettings = {
    ...current,
    ...patch,
  };

  if (typeof next.apiBalanceUsd === "number") {
    next.apiBalanceUsd = Math.max(0, Number(next.apiBalanceUsd.toFixed(6)));
  }
  if (typeof next.totalSpentUsd === "number") {
    next.totalSpentUsd = Math.max(0, Number(next.totalSpentUsd.toFixed(6)));
  }
  if (typeof patch.outputDir === "string") {
    next.outputDir = resolveDir(patch.outputDir, defaultOutputDirRel());
  }
  if (typeof patch.videoOutputDir === "string") {
    next.videoOutputDir = resolveDir(patch.videoOutputDir, defaultVideoOutputDirRel());
  }

  writeEnvFile(settingsToEnvValues(next));
  ensureOutputDir(next.outputDir);
  ensureVideoOutputDir(next.videoOutputDir);
  return next;
}

export function deductApiSpend(amountUsd: number): AppSettings {
  const settings = readSettings();
  const spend = Math.max(0, amountUsd);
  return writeSettings({
    apiBalanceUsd: Math.max(0, settings.apiBalanceUsd - spend),
    totalSpentUsd: settings.totalSpentUsd + spend,
  });
}

export function ensureOutputDir(dir?: string) {
  const target = dir ?? readSettings().outputDir;
  if (!existsSync(target)) mkdirSync(target, { recursive: true });
  const assets = path.join(target, "assets");
  if (!existsSync(assets)) mkdirSync(assets, { recursive: true });
  return target;
}

export function ensureVideoOutputDir(dir?: string) {
  const target = dir ?? readSettings().videoOutputDir;
  if (!existsSync(target)) mkdirSync(target, { recursive: true });
  const assets = path.join(target, "assets");
  if (!existsSync(assets)) mkdirSync(assets, { recursive: true });
  return target;
}

export function getAssetsDir() {
  return path.join(ensureOutputDir(), "assets");
}

export function getVideoAssetsDir() {
  return path.join(ensureVideoOutputDir(), "assets");
}

export function settingsPublicView(settings: AppSettings = readSettings()) {
  return {
    outputDir: settings.outputDir,
    videoOutputDir: settings.videoOutputDir,
    billingUrl: settings.billingUrl,
    hasGeminiApiKey: Boolean(settings.geminiApiKey),
    apiBalanceUsd: settings.apiBalanceUsd,
    totalSpentUsd: settings.totalSpentUsd,
    defaultModelId: settings.defaultModelId,
    defaultAspectRatio: settings.defaultAspectRatio,
    defaultResolution: settings.defaultResolution,
  };
}

export function resolveGeminiApiKey() {
  return readSettings().geminiApiKey;
}

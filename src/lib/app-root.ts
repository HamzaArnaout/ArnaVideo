import path from "path";

/** Portable root next to the runnable app (dev = project root, ship = folder with .exe). */
export function getAppRoot() {
  if (process.env.ARNA_APP_ROOT?.trim()) {
    return path.resolve(process.env.ARNA_APP_ROOT.trim());
  }
  return process.cwd();
}

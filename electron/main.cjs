const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

const PORT = Number(process.env.ARNA_PORT || 3001);

/** User-writable root: beside the file you copied, or the project root in dev. */
function getUserRoot() {
  // Portable .exe unpacks to a temp folder. Keep .env, data, and media next to the real file.
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }
  if (app.isPackaged) return path.dirname(process.execPath);
  return path.join(__dirname, "..");
}

/** Next standalone server files. */
function getServerRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, "app");
  return path.join(__dirname, "..");
}

let serverProcess = null;
let mainWindow = null;

function ensureUserDirs(userRoot) {
  for (const rel of ["media/images/assets", "media/videos/assets", "data"]) {
    const dir = path.join(userRoot, ...rel.split("/"));
    fs.mkdirSync(dir, { recursive: true });
  }
  const envPath = path.join(userRoot, ".env");
  if (!fs.existsSync(envPath)) {
    const exampleCandidates = [
      path.join(userRoot, ".env.example"),
      path.join(path.dirname(process.execPath), ".env.example"),
    ];
    const example = exampleCandidates.find((candidate) => fs.existsSync(candidate));
    const seed = example
      ? fs.readFileSync(example, "utf8")
      : [
          "GEMINI_API_KEY=",
          "OUTPUT_DIR=media/images",
          "VIDEO_OUTPUT_DIR=media/videos",
          "API_BALANCE_USD=0",
          "TOTAL_SPENT_USD=0",
          "BILLING_URL=https://aistudio.google.com/billing",
          "DEFAULT_MODEL_ID=gemini-nano-banana-2.1",
          "DEFAULT_ASPECT_RATIO=16:9",
          "DEFAULT_RESOLUTION=2K",
          "",
        ].join("\n");
    fs.writeFileSync(envPath, seed, "utf8");
  }
}

function waitForServer(url, timeoutMs = 90_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("ArnaVideo server failed to start in time."));
          return;
        }
        setTimeout(tick, 350);
      });
      req.setTimeout(1500, () => {
        req.destroy();
      });
    };
    tick();
  });
}

function startServer() {
  const userRoot = getUserRoot();
  const serverRoot = getServerRoot();
  ensureUserDirs(userRoot);

  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: "127.0.0.1",
    ARNA_APP_ROOT: userRoot,
    NODE_ENV: "production",
  };

  if (app.isPackaged) {
    const serverJs = path.join(serverRoot, "server.js");
    serverProcess = spawn(process.execPath, [serverJs], {
      cwd: serverRoot,
      env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: "pipe",
      windowsHide: true,
    });
  } else {
    serverProcess = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["next", "start", "-H", "127.0.0.1", "-p", String(PORT)],
      {
        cwd: serverRoot,
        env,
        stdio: "pipe",
        shell: true,
        windowsHide: true,
      },
    );
  }

  const stderrChunks = [];
  serverProcess.stdout?.on("data", (buf) => {
    console.log(`[server] ${buf}`);
  });
  serverProcess.stderr?.on("data", (buf) => {
    stderrChunks.push(buf.toString());
    console.error(`[server] ${buf}`);
  });
  let serverExited = false;
  const exited = new Promise((resolve) => {
    serverProcess.on("exit", (code) => {
      serverExited = true;
      console.log(`[server] exited ${code}`);
      resolve(code);
    });
  });
  return {
    stderrChunks,
    exited,
    isExited: () => serverExited,
  };
}

function loadScreen(html) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function showBootScreen() {
  loadScreen(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>ArnaVideo</title>
<style>
  html, body { margin: 0; height: 100%; background: #0b0b0c; color: #a1a1aa;
    font: 14px/1.4 "Segoe UI", sans-serif; }
  main { height: 100%; display: flex; align-items: center; justify-content: center; }
</style>
</head>
<body><main>Starting ArnaVideo…</main></body>
</html>`);
}

function showBootError(message) {
  const safe = String(message || "The local server did not start.")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  loadScreen(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>ArnaVideo</title>
<style>
  html, body { margin: 0; height: 100%; background: #0b0b0c; color: #d4d4d8;
    font: 14px/1.5 "Segoe UI", sans-serif; }
  main { max-width: 640px; margin: 0 auto; padding: 48px 24px; white-space: pre-wrap; }
  h1 { font-size: 16px; font-weight: 600; margin: 0 0 12px; }
</style>
</head>
<body><main><h1>ArnaVideo couldn't start</h1>${safe}</main></body>
</html>`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: "ArnaVideo",
    backgroundColor: "#0b0b0c",
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  showBootScreen();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopServer() {
  if (!serverProcess || serverProcess.killed) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"], {
        windowsHide: true,
      });
    } else {
      serverProcess.kill("SIGTERM");
    }
  } catch {
    // ignore
  }
  serverProcess = null;
}

app.whenReady().then(async () => {
  createWindow();
  const { stderrChunks, exited, isExited } = startServer();
  const appUrl = `http://127.0.0.1:${PORT}`;
  try {
    await Promise.race([
      waitForServer(appUrl).then(() => {
        if (isExited()) {
          const detail = stderrChunks.join("").trim();
          throw new Error(detail || "ArnaVideo server exited before it was ready.");
        }
      }),
      exited.then((code) => {
        const detail = stderrChunks.join("").trim();
        throw new Error(detail || `ArnaVideo server exited with code ${code ?? "unknown"}.`);
      }),
    ]);
  } catch (err) {
    console.error(err);
    const detail = stderrChunks.join("").trim() || (err && err.message) || "The local server did not start.";
    showBootError(detail.slice(0, 1500));
    return;
  }
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadURL(appUrl);
});

app.on("window-all-closed", () => {
  stopServer();
  app.quit();
});

app.on("before-quit", () => {
  stopServer();
});

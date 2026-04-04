const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const http = require("http");

let mainWindow;
let server;
let activePort;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const PORT_START = 3456;
const PORT_END = 3460;

// ---------------------------------------------------------------------------
// User data — stored outside the app package so updates don't destroy it
// macOS: ~/Library/Application Support/CapitalOS/
// Windows: %APPDATA%/CapitalOS/
// ---------------------------------------------------------------------------

function getUserDataPath(...segments) {
  return path.join(app.getPath("userData"), ...segments);
}

function ensureUserData() {
  const userDataDir = app.getPath("userData");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const unpackedRoot = path.join(process.resourcesPath, "app.asar.unpacked");

  // Migrate database: copy seed DB on first launch only
  const userDb = getUserDataPath("dev.db");
  if (!fs.existsSync(userDb)) {
    const seedDb = path.join(unpackedRoot, "prisma", "dev.db");
    if (fs.existsSync(seedDb)) {
      fs.copyFileSync(seedDb, userDb);
      console.log("Database seeded to userData:", userDb);
    }
  }

  // Migrate .env: copy on first launch only
  const userEnv = getUserDataPath(".env");
  if (!fs.existsSync(userEnv)) {
    const seedEnv = path.join(unpackedRoot, ".env");
    if (fs.existsSync(seedEnv)) {
      fs.copyFileSync(seedEnv, userEnv);
      console.log(".env seeded to userData:", userEnv);
    }
  }
}

function loadEnvFromUserData() {
  const envPath = getUserDataPath(".env");
  if (!fs.existsSync(envPath)) return;

  try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (key !== "DATABASE_URL") {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to load .env from userData:", e.message);
  }
}

// ---------------------------------------------------------------------------
// Auto-updater (GitHub Releases)
// ---------------------------------------------------------------------------

function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info.version);
  });

  autoUpdater.on("update-downloaded", (info) => {
    const response = dialog.showMessageBoxSync(mainWindow, {
      type: "info",
      title: "Update Ready",
      message: `CapitalOS v${info.version} has been downloaded.`,
      detail: "The update will be installed when you restart the app.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
    });

    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-updater error:", err.message);
  });

  // Check for updates after a short delay (don't block startup)
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error("Update check failed:", err.message);
    });
  }, 5000);
}

// ---------------------------------------------------------------------------
// Next.js server
// ---------------------------------------------------------------------------

async function tryListen(httpServer, port) {
  return new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, () => {
      httpServer.removeListener("error", reject);
      resolve(port);
    });
  });
}

async function startNextServer() {
  if (isDev) return;

  const appRoot = path.join(process.resourcesPath, "app.asar");
  const unpackedRoot = path.join(process.resourcesPath, "app.asar.unpacked");

  // Allow unpacked .next files to resolve modules from the asar's node_modules
  process.env.NODE_PATH = path.join(appRoot, "node_modules");
  require("module").Module._initPaths();

  // Migrate user data on first launch, then load from userData
  ensureUserData();

  // Set DATABASE_URL to userData (survives app updates)
  process.env.DATABASE_URL = `file:${getUserDataPath("dev.db")}`;

  // Load .env from userData
  loadEnvFromUserData();

  // Start Next.js
  const next = require("next");
  const nextApp = next({
    dev: false,
    dir: unpackedRoot,
    port: PORT_START,
  });

  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  server = http.createServer((req, res) => {
    handle(req, res);
  });

  for (let port = PORT_START; port <= PORT_END; port++) {
    try {
      activePort = await tryListen(server, port);
      console.log(`CapitalOS running on port ${activePort}`);
      return;
    } catch (err) {
      if (err.code === "EADDRINUSE") {
        console.warn(`Port ${port} in use, trying ${port + 1}...`);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`All ports ${PORT_START}-${PORT_END} are in use. Close other applications and try again.`);
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "CapitalOS",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = isDev ? "http://localhost:3000" : `http://localhost:${activePort || PORT_START}`;
  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.on("ready", async () => {
  try {
    await startNextServer();
    createWindow();
    setupAutoUpdater();
  } catch (err) {
    console.error("Failed to start:", err);
    dialog.showErrorBox(
      "CapitalOS Error",
      `Failed to start:\n\n${err.message}\n\n${err.stack || ""}`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (server) server.close();
});

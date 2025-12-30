const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, fork } = require("child_process");
const dotenv = require("dotenv");
const http = require("http");
const os = require("os");

app.disableHardwareAcceleration();

try {
  const tempLogPath = path.join(os.tmpdir(), "electron-app-early-crash.log");
  const startupMessage = `[${new Date().toISOString()}] Electron app starting. Node version: ${process.version
    }. Electron version: ${process.versions.electron}. Packaged: ${app.isPackaged
    }\n`;
  fs.writeFileSync(tempLogPath, startupMessage, { flag: "a" });
} catch (e) {
  console.error("Critical: Failed to write early temp log:", e);
}

const log = require("electron-log");
log.transports.file.level = "info";
log.transports.file.format = "{h}:{i}:{s}:{ms} {text}";
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.file.file = path.join(app.getPath("userData"), "app.log");

Object.assign(console, log.functions);

console.log(
  "electron-log initialized successfully. All console output will now go to app.log."
);

let backendProcess;
const isDev = process.env.NODE_ENV === "development";

function waitForBackendReady(port, timeout = 140000) {
  console.log(`Waiting for backend to be ready on port ${port}...`);
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      http
        .get(`http://localhost:${port}/ping`, (res) => {
          if (res.statusCode === 200) {
            console.log("Backend is ready!");
            resolve();
          } else {
            console.warn(
              `Backend responded with status ${res.statusCode}. Retrying...`
            );
            if (Date.now() - start > timeout) {
              reject(
                `Backend responded with status ${res.statusCode} but not 200 after timeout`
              );
            } else {
              setTimeout(check, 500);
            }
          }
        })
        .on("error", (err) => {
          console.warn(
            `Backend not yet reachable: ${err.message}. Retrying...`
          );
          if (Date.now() - start > timeout) {
            reject("Backend not ready after timeout");
          } else {
            setTimeout(check, 500);
          }
        });
    };

    check();
  });
}

function createWindow() {
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splash.loadFile(path.join(__dirname, "splash.html"));
  console.log(
    `Splash screen loaded from: ${path.join(__dirname, "splash.html")}`
  );

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: path.join(__dirname, "frontend", "src", "assets", "logo.png"),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  console.log(
    `Main window icon loaded from: ${path.join(
      __dirname,
      "frontend",
      "src",
      "assets",
      "logo.png"
    )}`
  );

  const loadApp = async () => {
    try {
      const port = process.env.PORT || 5000;
      await waitForBackendReady(port);
      const indexPath = path.join(__dirname, "frontend", "dist", "index.html");
      console.log(`Attempting to load frontend from: ${indexPath}`);
      if (fs.existsSync(indexPath)) {
        win.loadFile(indexPath);
        console.log("Frontend index.html loaded successfully.");
      } else {
        win.loadURL("data:text/html,<h1>❌ dist/index.html not found</h1>");
        console.error(`Frontend index.html not found at: ${indexPath}`);
      }
    } catch (err) {
      win.loadURL(
        `data:text/html,<h1>Backend failed to start or respond: ${err}</h1>`
      );
      console.error(`Error loading app due to backend issues: ${err}`);
    }

    win.once("ready-to-show", () => {
      splash.destroy();
      win.show();
      console.log("Main window is ready and shown.");
    });
  };

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
    console.log(
      "Running in development mode. Loading frontend from localhost:5173."
    );
    win.once("ready-to-show", () => {
      splash.destroy();
      win.show();
    });
  } else {
    console.log(
      "Running in production mode. Attempting to load packaged frontend."
    );
    loadApp();
  }
}

function startBackend() {
  let actualBackendDir;
  if (app.isPackaged) {
    actualBackendDir = path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "mongo_backend"
    );
    console.log(
      `App is packaged. Backend directory expected at: ${actualBackendDir}`
    );
  } else {
    actualBackendDir = path.join(__dirname, "mongo_backend");
    console.log(
      `App is in development. Backend directory set to: ${actualBackendDir}`
    );
  }

  const finalBackendPath = path.join(actualBackendDir, "src", "app.js");
  const finalEnvPath = path.join(actualBackendDir, "src", ".env");

  console.log(`Attempting to start backend.`);
  console.log(`Backend app.js path: ${finalBackendPath}`);
  console.log(`Backend .env path: ${finalEnvPath}`);

  if (!fs.existsSync(finalBackendPath)) {
    console.error(`❌ Backend app.js not found at: ${finalBackendPath}`);
    return;
  }

  // Load environment variables
  const envFileExists = fs.existsSync(finalEnvPath);
  if (envFileExists) {
    const result = dotenv.config({ path: finalEnvPath });
    if (result.error) {
      console.error("❌ Failed to load .env:", result.error);
      console.error("dotenv error details:", result.error.message);
      return;
    }
    console.log("✅ .env file loaded successfully");
  } else {
    console.warn(
      `⚠️ .env file not found at: ${finalEnvPath}. Relying on system environment or default values.`
    );
  }

  console.log("Environment variables for backend process:");
  console.log(`  PORT: ${process.env.PORT || 5000}`);
  console.log(
    `  MONGO_URI: ${process.env.MONGO_URI ? "****** (present)" : "not set"}`
  );
  console.log(
    `  JWT_SECRET: ${process.env.JWT_SECRET ? "****** (present)" : "not set"}`
  );
  console.log(`  NODE_ENV: ${isDev ? "development" : "production"}`);

  // CRITICAL FIX: Use the correct Node.js executable
  let nodeExecutable;
  if (app.isPackaged) {
    // In packaged apps, use process.execPath but set ELECTRON_RUN_AS_NODE
    // This tells Electron to run as Node.js instead of launching a new Electron instance
    nodeExecutable = process.execPath;
  } else {
    // In development, use regular node
    nodeExecutable = "node";
  }

  console.log(`Using Node executable: ${nodeExecutable}`);

  const spawnOptions = {
    cwd: actualBackendDir,
    env: {
      ...process.env,
      PORT: process.env.PORT || 5000,
      MONGO_URI: process.env.MONGO_URI,
      JWT_SECRET: process.env.JWT_SECRET,
      NODE_ENV: isDev ? "development" : "production",
      // CRITICAL: This tells Electron to run as Node.js in packaged apps
      ...(app.isPackaged && { ELECTRON_RUN_AS_NODE: "1" })
    },
    stdio: ["inherit", "inherit", "inherit"],
  };

  // Use fork for better process management in development, spawn for packaged
  if (isDev) {
    // In development, use fork for better debugging
    backendProcess = fork(finalBackendPath, [], {
      cwd: actualBackendDir,
      env: spawnOptions.env,
      silent: false
    });
  } else {
    // In packaged apps, use spawn with the correct executable
    backendProcess = spawn(nodeExecutable, [finalBackendPath], spawnOptions);
  }

  backendProcess.on("error", (err) => {
    console.error("Backend process failed to start:", err);
    console.error("Error details:", {
      code: err.code,
      errno: err.errno,
      syscall: err.syscall,
      path: err.path,
      spawnfile: err.spawnfile
    });
  });

  backendProcess.on("exit", (code, signal) => {
    if (code !== 0) {
      console.error(
        `Backend process exited with code ${code} and signal ${signal}`
      );
    } else {
      console.log("Backend process exited cleanly.");
    }
  });

  backendProcess.on("close", (code) => {
    console.log(`Backend process closed with code ${code}`);
  });

  // Add stdout/stderr handling for spawn (fork handles this automatically)
  if (!isDev && backendProcess.stdout) {
    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend stdout: ${data}`);
    });
  }

  if (!isDev && backendProcess.stderr) {
    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend stderr: ${data}`);
    });
  }

  console.log("Backend process initiated.");
}

function stopBackend() {
  if (backendProcess) {
    console.log("Attempting to stop backend process...");

    // Try graceful shutdown first
    if (process.platform === 'win32') {
      // On Windows, use taskkill for better process cleanup
      spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t'], { stdio: 'inherit' });
    } else {
      // On Unix-like systems, send SIGTERM first, then SIGKILL if needed
      backendProcess.kill('SIGTERM');

      // Fallback to SIGKILL after 5 seconds
      setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          backendProcess.kill('SIGKILL');
        }
      }, 5000);
    }

    backendProcess = null;
    console.log("Backend process stop initiated.");
  }
}

app.whenReady().then(() => {
  console.log("Electron app is ready.");
  startBackend();
  createWindow();
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
  console.log("All windows closed. App will quit.");
});

app.on("before-quit", stopBackend);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    console.log("App activated. Creating new window.");
  }
});
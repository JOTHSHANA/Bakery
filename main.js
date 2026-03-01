const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");
const kill = require("tree-kill");

app.disableHardwareAcceleration();

let mainWindow;
let backendProcess;
let frontendProcess;

const isDev = !app.isPackaged;

/* ------------------------------------------------ */
/* WAIT FOR SERVER READY */
/* ------------------------------------------------ */

function waitForServer(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      http.get(url, () => resolve())
          .on("error", () => {
            if (Date.now() - start > timeout)
              reject(`Timeout waiting for ${url}`);
            else
              setTimeout(check, 500);
          });
    };

    check();
  });
}

/* ------------------------------------------------ */
/* START FRONTEND (VITE DEV SERVER) */
/* ------------------------------------------------ */

function startFrontend() {
  if (!isDev) return;

  console.log("Starting frontend dev server...");

  frontendProcess = spawn("npm", ["run", "dev"], {
    cwd: path.join(__dirname, "frontend"), // adjust if needed
    shell: true,
    stdio: "inherit",
  });

  frontendProcess.on("exit", (code) =>
    console.log("Frontend exited:", code)
  );
}

/* ------------------------------------------------ */
/* START BACKEND */
/* ------------------------------------------------ */

function startBackend() {

  const backendDir = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", "mongo_backend")
    : path.join(__dirname, "mongo_backend");

  const backendFile = path.join(backendDir, "src", "app.js");

  if (!fs.existsSync(backendFile)) {
    console.error("Backend not found:", backendFile);
    return;
  }

  console.log("Starting backend...");

  const nodeExec = app.isPackaged ? process.execPath : "node";

  backendProcess = spawn(nodeExec, [backendFile], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: process.env.PORT || 5000,
      ...(app.isPackaged && { ELECTRON_RUN_AS_NODE: "1" }),
    },
    stdio: "inherit",
  });

  backendProcess.on("exit", (code) =>
    console.log("Backend exited:", code)
  );
}

/* ------------------------------------------------ */
/* STOP PROCESSES */
/* ------------------------------------------------ */

function stopProcesses() {
  if (backendProcess) kill(backendProcess.pid);
  if (frontendProcess) kill(frontendProcess.pid);
}

/* ------------------------------------------------ */
/* CREATE WINDOW */
/* ------------------------------------------------ */

function createWindow() {

  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
  });

  splash.loadFile(path.join(__dirname, "splash.html"));

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (isDev) {

    console.log("DEV MODE");

    startFrontend();

    waitForServer("http://localhost:5173")
      .then(() => {
        console.log("Frontend ready");
        mainWindow.loadURL("http://localhost:5173");
      })
      .catch((err) => {
        console.error(err);
        mainWindow.loadURL("data:text/html,<h1>Frontend failed to start</h1>");
      });

  } else {

    console.log("PRODUCTION MODE");

    const indexPath = path.join(__dirname, "frontend", "dist", "index.html");

    if (fs.existsSync(indexPath))
      mainWindow.loadFile(indexPath);
    else
      mainWindow.loadURL("data:text/html,<h1>dist/index.html not found</h1>");
  }

  mainWindow.once("ready-to-show", () => {
    splash.destroy();
    mainWindow.show();
  });
}

/* ------------------------------------------------ */
/* SILENT PRINT */
/* ------------------------------------------------ */

ipcMain.on("print-html", (event, htmlContent) => {

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  printWindow.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent)
  );

  printWindow.webContents.on("did-finish-load", () => {
    setTimeout(() => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
        },
        () => printWindow.close()
      );
    }, 200);
  });

});

/* ------------------------------------------------ */
/* APP EVENTS */
/* ------------------------------------------------ */

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on("window-all-closed", () => {
  stopProcesses();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopProcesses);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0)
    createWindow();
});
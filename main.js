const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");
const kill = require("tree-kill");

const { printUSB } = require("./printer/escposPrinter");

/* PERFORMANCE */

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");

/* SINGLE INSTANCE */

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow;
let splashWindow;
let backendProcess;
let frontendProcess;
let logFile;

const isDev = !app.isPackaged;

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

/* LOGGER */

function log(msg) {

  const line = `[${new Date().toISOString()}] ${msg}\n`;

  console.log(msg);

  if (!logFile) return;

  try {
    fs.appendFileSync(logFile, line);
  } catch {}
}

/* WAIT SERVER */

function waitForServer(url, timeout = 20000) {

  return new Promise((resolve, reject) => {

    const start = Date.now();

    const check = () => {

      http.get(url, () => resolve())
        .on("error", () => {

          if (Date.now() - start > timeout)
            reject("Server timeout");

          else setTimeout(check, 500);

        });

    };

    check();

  });

}

/* FRONTEND */

function startFrontend() {

  if (!isDev) return;

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";

  frontendProcess = spawn(npm, ["run", "dev"], {
    cwd: path.join(__dirname, "frontend"),
    shell: true,
    stdio: "pipe"
  });

  frontendProcess.stdout.on("data", d => log(d.toString()));
  frontendProcess.stderr.on("data", d => log(d.toString()));

}

/* BACKEND */

function startBackend() {

  const backendDir = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", "mongo_backend")
    : path.join(__dirname, "mongo_backend");

  const file = path.join(backendDir, "src", "app.js");

  if (!fs.existsSync(file)) {
    log("Backend not found");
    return;
  }

  backendProcess = spawn("node", [file], {
    cwd: backendDir,
    stdio: "inherit"
  });

}

/* STOP PROCESSES */

function stopProcesses() {

  if (backendProcess?.pid) kill(backendProcess.pid);
  if (frontendProcess?.pid) kill(frontendProcess.pid);

}

/* WINDOW */

function createWindow() {

  const preload = path.join(__dirname, "preload.js");

  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));

  mainWindow = new BrowserWindow({

    width: 1200,
    height: 800,
    show: false,

    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }

  });

  if (isDev) {

    startFrontend();

    waitForServer("http://localhost:5173")
      .then(() => mainWindow.loadURL("http://localhost:5173"))
      .catch(() => mainWindow.loadURL("data:text/html,<h1>Frontend failed</h1>"));

  } else {

    mainWindow.loadFile(
      path.join(__dirname, "frontend", "dist", "index.html")
    );

  }

  mainWindow.once("ready-to-show", () => {

    splashWindow.close();
    mainWindow.show();

  });

}

/* PRINT HTML RECEIPT */

ipcMain.handle("print-html", async (event, htmlContent) => {

  log("PRINT REQUEST RECEIVED");

  /* TRY USB ESC/POS FIRST */

  try {

    await printUSB(htmlContent);

    log("USB printer success");

    return true;

  } catch (err) {

    log("USB printer failed → fallback to Windows printer");

  }

  /* FALLBACK → ELECTRON PRINT */

  const printWindow = new BrowserWindow({
    show: false
  });

  return new Promise((resolve) => {

    printWindow.webContents.once("did-finish-load", async () => {

      try {

        const printers = await printWindow.webContents.getPrintersAsync();

        log("Detected printers: " + printers.map(p => p.name).join(", "));

        let pdfPrinter = printers.find(p =>
          p.name.toLowerCase().includes("pdf")
        );

        if (!pdfPrinter && printers.length > 0) {
          pdfPrinter = printers[0];
        }

        if (!pdfPrinter) {

          log("No printers available");

          printWindow.close();
          resolve(false);
          return;

        }

        log("Fallback printer: " + pdfPrinter.name);

        printWindow.webContents.print(
          {
            silent: true,
            deviceName: pdfPrinter.name,
            printBackground: true
          },
          (success) => {

            printWindow.close();
            resolve(success);

          }
        );

      } catch (err) {

        log("Fallback printing failed: " + err);

        printWindow.close();
        resolve(false);

      }

    });

    printWindow.loadURL(
      "data:text/html;charset=utf-8," +
      encodeURIComponent(htmlContent)
    );

  });

});

/* IPC TEST */

ipcMain.handle("ping", ()=>"pong");

/* APP READY */

app.whenReady().then(()=>{

  logFile = path.join(app.getPath("userData"), "app.log");

  startBackend();
  createWindow();

});

/* EVENTS */

app.on("window-all-closed", ()=>{

  stopProcesses();

  if (process.platform !== "darwin")
    app.quit();

});

app.on("before-quit", stopProcesses);

app.on("activate", ()=>{

  if (BrowserWindow.getAllWindows().length === 0)
    createWindow();

});

/* CRASH HANDLING */

process.on("uncaughtException", err => log(err));
process.on("unhandledRejection", err => log(err));
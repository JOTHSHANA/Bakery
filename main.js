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
      http
        .get(url, () => resolve())
        .on("error", () => {
          if (Date.now() - start > timeout) reject("Server timeout");
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
    stdio: "pipe",
  });

  frontendProcess.stdout.on("data", (d) => log(d.toString()));
  frontendProcess.stderr.on("data", (d) => log(d.toString()));
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
    stdio: "inherit",
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
    alwaysOnTop: true,
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
      sandbox: true,
    },
  });

  if (isDev) {
    startFrontend();

    waitForServer("http://localhost:5173")
      .then(() => mainWindow.loadURL("http://localhost:5173"))
      .catch(() =>
        mainWindow.loadURL("data:text/html,<h1>Frontend failed</h1>"),
      );
  } else {
    mainWindow.loadFile(path.join(__dirname, "frontend", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    splashWindow.close();
    mainWindow.show();
  });
}
// SAVE RECEIPT TO FILE
function saveReceiptToFile(htmlContent) {
  try {

    const receiptDir = path.join(
      app.getPath("downloads"),
      "HB_Receipts"
    );

    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }

    const filePath = path.join(
      receiptDir,
      `receipt_${Date.now()}.html`
    );

    fs.writeFileSync(filePath, htmlContent);

    log("Receipt saved locally → " + filePath);

    return filePath;

  } catch (err) {

    log("Save receipt failed → " + err);
    return null;

  }
}
// PRINT HTML RECEIPT
async function printReceipt(htmlContent) {

  const printWindow = new BrowserWindow({
    show: false
  });

  await printWindow.loadURL(
    "data:text/html;charset=utf-8," +
    encodeURIComponent(htmlContent)
  );

  const printers = await printWindow.webContents.getPrintersAsync();

  log("Detected printers: " + printers.map(p => p.name).join(", "));

  let filteredPrinters = printers.filter(p =>
    !/pdf|xps|onenote/i.test(p.name)
  );

  let targetPrinter = filteredPrinters.find(p =>
    /(epson|tm-t|pos|thermal)/i.test(p.name)
  );

  if (!targetPrinter) {
    targetPrinter = filteredPrinters.find(p => p.isDefault);
  }

  if (!targetPrinter) {
    printWindow.close();
    throw new Error("No printer available");
  }

  return new Promise((resolve, reject) => {

    printWindow.webContents.print(
      {
        silent: true,
        deviceName: targetPrinter.name,
        printBackground: true
      },
      (success) => {

        printWindow.close();

        if (success) resolve(true);
        else reject(new Error("Print failed"));

      }
    );

  });

}
// SAFE PRINT WITH FALLBACK
async function safePrintReceipt(htmlContent) {

  try {

    await printReceipt(htmlContent);

    log("Receipt printed successfully");

    return {
      success: true
    };

  } catch (err) {

    log("Printing failed → fallback save");

    const path = saveReceiptToFile(htmlContent);

    return {
      success: false,
      saved: true,
      path
    };

  }

}

// IPC HANDLERS
ipcMain.handle("print-html", async (event, htmlContent) => {

  log("PRINT REQUEST RECEIVED");

  const result = await safePrintReceipt(htmlContent);

  return result;

});
// SAVE RECEIPT TO FILE
ipcMain.handle("save-receipt", async (event, htmlContent) => {

  const path = saveReceiptToFile(htmlContent);

  return {
    saved: true,
    path
  };

});
/* IPC TEST */

ipcMain.handle("ping", () => "pong");
/* APP READY */

app.whenReady().then(() => {
  logFile = path.join(app.getPath("userData"), "app.log");

  startBackend();
  createWindow();
});

/* EVENTS */

app.on("window-all-closed", () => {
  stopProcesses();

  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopProcesses);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* CRASH HANDLING */

process.on("uncaughtException", (err) => log(err));
process.on("unhandledRejection", (err) => log(err));

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
/* SERVER WAIT */
/* ------------------------------------------------ */
function waitForServer(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      http
        .get(url, () => resolve())
        .on("error", () => {
          if (Date.now() - start > timeout)
            reject(`Timeout waiting for ${url}`);
          else setTimeout(check, 500);
        });
    };

    check();
  });
}

/* ------------------------------------------------ */
/* START FRONTEND */
/* ------------------------------------------------ */
function startFrontend() {
  if (!isDev) return;

  console.log("Starting frontend dev server...");

  frontendProcess = spawn("npm", ["run", "dev"], {
    cwd: path.join(__dirname, "frontend"),
    shell: true,
    stdio: "pipe", // 🔥 IMPORTANT
  });

  frontendProcess.stdout.on("data", (data) => {
    console.log("[VITE]", data.toString());
  });

  frontendProcess.stderr.on("data", (data) => {
    console.error("[VITE ERROR]", data.toString());
  });

  frontendProcess.on("exit", (code) => console.log("Frontend exited:", code));
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
    stdio: "inherit",
  });
}

/* ------------------------------------------------ */
/* STOP CHILD PROCESSES */
/* ------------------------------------------------ */
function stopProcesses() {
  if (backendProcess) kill(backendProcess.pid);
  if (frontendProcess) kill(frontendProcess.pid);
}

/* ------------------------------------------------ */
/* WINDOW CREATION */
/* ------------------------------------------------ */
function createWindow() {
  const preloadPath = path.join(__dirname, "preload.js");

  console.log("APP DIR:", __dirname);
  console.log("PRELOAD PATH:", preloadPath);
  console.log("PRELOAD EXISTS:", fs.existsSync(preloadPath));

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
      preload: preloadPath, // ✅ VERY IMPORTANT
      contextIsolation: true, // ✅ REQUIRED
      nodeIntegration: false, // ✅ REQUIRED
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
        mainWindow.loadURL("data:text/html,<h1>Frontend failed</h1>");
      });
  } else {
    console.log("PRODUCTION MODE");
    mainWindow.loadFile(path.join(__dirname, "frontend", "dist", "index.html"));
  }

  mainWindow.webContents.once("did-finish-load", async () => {
    console.log("🔍 Checking printers from MAIN WINDOW...");

    try {
      const printers = await mainWindow.webContents.getPrintersAsync();

      console.log("================================");
      console.log("MAIN WINDOW PRINTERS:");
      console.log(JSON.stringify(printers, null, 2));
      console.log("================================");

    } catch (err) {
      console.error("❌ Failed to get printers:", err);
    }
  });

  mainWindow.once("ready-to-show", () => {
    splash.destroy();
    mainWindow.show();
  });
}

/* ------------------------------------------------ */
/* SILENT PRINT */
/* ------------------------------------------------ */
console.log("✅ Registering IPC listeners");

ipcMain.handle("print-html", async (event, htmlContent) => {
  console.log("🖨️ PRINT REQUEST RECEIVED");

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
    },
  });

  return new Promise((resolve) => {

    printWindow.webContents.once("did-finish-load", async () => {
      try {
        const printers = await printWindow.webContents.getPrintersAsync();

        console.log("Available printers:", printers.map(p => p.name));

        /* -------------------------------- */
        /* FIND EPSON PRINTER */
        /* -------------------------------- */

        let printer = printers.find(p =>
          p.name.toLowerCase().includes("epson")
        );

        /* fallback if Epson not found */
        if (!printer) {
          console.log("⚠ EPSON not found → using default printer");
          printer = printers.find(p => p.isDefault);
        }

        if (!printer) {
          console.error("❌ No printer available");
          printWindow.close();
          resolve(false);
          return;
        }

        console.log("🎯 Printing to:", printer.name);

        /* -------------------------------- */
        /* SILENT PRINT */
        /* -------------------------------- */

        printWindow.webContents.print(
          {
            silent: true,
            deviceName: printer.name,
            printBackground: true,
            margins: { marginType: "none" },
            pageSize: {
              width: 80000,   // 80mm receipt
              height: 200000
            }
          },
          (success, err) => {
            if (success) console.log("✅ Print success");
            else console.error("❌ Print failed:", err);

            printWindow.close();
            resolve(success);
          }
        );

      } catch (err) {
        console.error("Print error:", err);
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

ipcMain.handle("ping", () => {
  console.log("🏓 PING RECEIVED IN MAIN");
  return "pong";
});

/* ------------------------------------------------ */
/* APP READY */
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
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

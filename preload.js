const { contextBridge, ipcRenderer } = require("electron");

console.log("PRELOAD LOADED");

contextBridge.exposeInMainWorld("electronAPI", {
  printHTML: (html) => ipcRenderer.invoke("print-html", html),
  saveReceipt: (html) => ipcRenderer.invoke("save-receipt", html),
  ping: () => ipcRenderer.invoke("ping"), 
});

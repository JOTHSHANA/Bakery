const { contextBridge, ipcRenderer } = require("electron");

console.log("PRELOAD LOADED");

contextBridge.exposeInMainWorld("electronAPI", {
  printHTML: (html) => ipcRenderer.invoke("print-html", html),
  ping: () => ipcRenderer.invoke("ping"),
});
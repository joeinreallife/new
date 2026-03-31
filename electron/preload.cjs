const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dispatchCockpitDesktop", {
  isDesktop: true,
  pickWorkbookFile: () => ipcRenderer.invoke("dispatch-cockpit:pick-workbook"),
  readWorkbookFile: (filePath) =>
    ipcRenderer.invoke("dispatch-cockpit:read-workbook-file", filePath),
  saveWorkbookFile: (payload) => ipcRenderer.invoke("dispatch-cockpit:save-workbook", payload),
});

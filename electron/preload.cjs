const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("dispatchCockpitDesktop", {
  isDesktop: true,
});

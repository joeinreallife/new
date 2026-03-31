import fs from "node:fs/promises";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1680,
    height: 980,
    minWidth: 1280,
    minHeight: 820,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${sourceId}:${line} ${message}`);
  });
  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error(`[did-fail-load] ${code} ${description} ${url}`);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("[render-process-gone]", details);
  });

  window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

ipcMain.handle("dispatch-cockpit:pick-workbook", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open workbook",
    properties: ["openFile"],
    filters: [
      { name: "Excel workbooks", extensions: ["xlsx", "xls"] },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  const filePath = result.filePaths[0];
  const buffer = await fs.readFile(filePath);

  return {
    filePath,
    fileName: path.basename(filePath),
    base64: buffer.toString("base64"),
  };
});

ipcMain.handle("dispatch-cockpit:read-workbook-file", async (_event, filePath) => {
  if (!filePath) {
    return null;
  }

  const buffer = await fs.readFile(filePath);

  return {
    filePath,
    fileName: path.basename(filePath),
    base64: buffer.toString("base64"),
  };
});

ipcMain.handle("dispatch-cockpit:save-workbook", async (_event, payload) => {
  const result = await dialog.showSaveDialog({
    title: "Save workbook snapshot",
    defaultPath: payload?.suggestedFileName || "dispatch-cockpit.xlsx",
    filters: [{ name: "Excel workbooks", extensions: ["xlsx"] }],
  });

  if (result.canceled || !result.filePath || !payload?.base64) {
    return null;
  }

  await fs.writeFile(result.filePath, Buffer.from(payload.base64, "base64"));

  return {
    filePath: result.filePath,
  };
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

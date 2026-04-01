import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { formatRegionLabel, getPlantRegionMeta, REGION_ORDER } from "./dispatchMetadata.js";
import { SOURCE_FILES } from "./sourceFiles.js";

const MATERIAL_KEYS = ["cement", "flyash", "plc", "lc3"];
const MATERIAL_LABELS = {
  cement: "cement",
  flyash: "flyash",
  plc: "plc",
  lc3: "lc3",
};

const MATERIAL_USAGE_LABELS = {
  cement: "Cement",
  flyash: "Fly-ash",
  plc: "PLC",
  lc3: "LC3",
};

const MATERIAL_USAGE_PLACEHOLDERS = {
  cement: 2.45,
  flyash: 4.5,
  plc: 1.85,
  lc3: 3.2,
};

const UI_SCALE = 0.92;

const DEMO_DRIVERS = [
  { id: "d01", name: "driver_01", status: "available", location: "rialto_yard" },
  { id: "d02", name: "driver_02", status: "to_source", location: "lucerne_valley" },
  { id: "d03", name: "driver_03", status: "at_plant", location: "plant_02" },
  { id: "d04", name: "driver_04", status: "returning", location: "i-15_sb" },
  { id: "d05", name: "driver_05", status: "off_shift", location: "-" },
  { id: "d06", name: "driver_06", status: "available", location: "fontana_yard" },
  { id: "d07", name: "driver_07", status: "to_plant", location: "plant_05" },
  { id: "d08", name: "driver_08", status: "break", location: "barstow" },
];

const DRIVER_LOG_STORAGE_KEY = "dispatch-cockpit-driver-logs-v1";

function createDriverLogDraft(plantId = null) {
  return {
    plantId,
    location: "",
    truckNumber: "",
    driver: "",
    source: "",
    invCode: "",
  };
}

function loadDriverLogs() {
  try {
    const raw = window.localStorage.getItem(DRIVER_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function emptyMaterialSlot() {
  return {
    loads: null,
    onHand: null,
    diff: null,
    requiredLoads: null,
    time: "",
  };
}

function emptyMaterialSummary() {
  return {
    cement: emptyMaterialSlot(),
    flyash: emptyMaterialSlot(),
    plc: emptyMaterialSlot(),
    lc3: emptyMaterialSlot(),
  };
}

const DEMO_MATERIALS_BY_PLANT = {
  1: {
    cement: { loads: 4.86, onHand: 6.25, diff: 1.39, requiredLoads: 0, time: "11:33" },
    flyash: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
    plc: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
    lc3: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
  },
  2: {
    cement: { loads: 7.07, onHand: 8.5, diff: 1.43, requiredLoads: 0, time: "14:39" },
    flyash: { loads: 0.06, onHand: 2.25, diff: 2.19, requiredLoads: 0, time: "12:09" },
    plc: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
    lc3: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
  },
  3: {
    cement: { loads: 4.23, onHand: 6, diff: 1.77, requiredLoads: 0, time: "10:03" },
    flyash: { loads: 0.11, onHand: 1.5, diff: 1.39, requiredLoads: 0, time: "11:02" },
    plc: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
    lc3: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
  },
  4: {
    cement: { loads: 2.85, onHand: 10.5, diff: 7.65, requiredLoads: 0, time: "23:00" },
    flyash: { loads: 0.09, onHand: 2, diff: 1.91, requiredLoads: 0, time: "11:27" },
    plc: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
    lc3: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
  },
  5: {
    cement: { loads: 2.93, onHand: 12, diff: 9.07, requiredLoads: 0, time: "11:01" },
    flyash: { loads: 0.38, onHand: 3.5, diff: 3.12, requiredLoads: 0, time: "10:17" },
    plc: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
    lc3: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
  },
  6: {
    cement: { loads: 3.52, onHand: 3, diff: -0.52, requiredLoads: 0, time: "10:34" },
    flyash: { loads: 0.01, onHand: 2.25, diff: 2.24, requiredLoads: 0, time: "08:23" },
    plc: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
    lc3: { loads: null, onHand: null, diff: null, requiredLoads: null, time: "" },
  },
};

const DEMO_BASE = {
  meta: {
    generatedAt: "2026-03-30T21:00:00-07:00",
    files: {
      yardage: "1.xlsx",
      adjustments: "2.xlsx",
      material: "material_requirements_extracted_corrected.csv",
    },
  },
  plants: [
    { id: 1, active: true, yardage: 279.5 },
    { id: 2, active: true, yardage: 838 },
    { id: 3, active: true, yardage: 390 },
    { id: 4, active: true, yardage: 232 },
    { id: 5, active: true, yardage: 381 },
    { id: 6, active: true, yardage: 539 },
  ],
};

function summarize(base) {
  const plants = base.plants.map((plant) => ({
    ...plant,
    ...getPlantRegionMeta(plant),
    materials: DEMO_MATERIALS_BY_PLANT[plant.id] ?? emptyMaterialSummary(),
  }));

  return {
    ...base,
    plants,
    summary: {
      activePlants: plants.filter((plant) => plant.active).length,
      totalYardage: plants.reduce((sum, plant) => sum + (plant.yardage ?? 0), 0),
    },
  };
}

const DEMO_DATA = summarize(DEMO_BASE);
const SHIPPED_SHEET = "ShippedOrderSummary";
const LOAD_SHEET = "Load Schedule";
const MAX_PLANT_ID = 75;

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).replace(/,/g, "").trim();
  if (!text) return null;
  if (text.startsWith("(") && text.endsWith(")")) {
    const inner = Number(text.slice(1, -1));
    return Number.isFinite(inner) ? -inner : null;
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function toInteger(value) {
  const numeric = toNumber(value);
  return numeric === null ? null : Math.trunc(numeric);
}

function getSheetRows(workbook, preferredName, fallbackIndex = 0) {
  const sheetName = workbook.SheetNames.includes(preferredName)
    ? preferredName
    : workbook.SheetNames[fallbackIndex];
  if (!sheetName) throw new Error("Workbook is missing sheets.");
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
}

function findHeaderRow(rows, expectedHeaders) {
  const wanted = expectedHeaders.map((header) => header.toLowerCase());
  for (let index = 0; index < rows.length; index += 1) {
    const normalized = rows[index].map((cell) => cleanText(cell).toLowerCase());
    if (wanted.every((header) => normalized.includes(header))) return index;
  }
  return -1;
}

function rowsToObjects(rows, headerIndex) {
  const headers = rows[headerIndex].map(
    (cell, index) => cleanText(cell) || `column_${index + 1}`,
  );

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cleanText(cell) !== ""))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      return record;
    });
}

function normalizeLoadRows(rows) {
  return rows.map((row) => ({
    orderNumber: toInteger(row.Order),
    loads: toNumber(row.Loads) ?? 0,
    fromPlant: toInteger(row["From Plant"]),
    toPlant: toInteger(row["To Plant"]),
  }));
}

function normalizeMaterialKey(rawMaterial) {
  const value = cleanText(rawMaterial).toUpperCase();
  if (value === "CEMENT" || value === "TYPE V CEMENT") return "cement";
  if (value === "FLYASH") return "flyash";
  if (value === "PLC CEMENT") return "plc";
  if (value === "LC3 CEMENT") return "lc3";
  return null;
}

function hasMaterialSlotData(slot) {
  if (!slot) return false;
  return [slot.loads, slot.onHand, slot.diff, slot.requiredLoads].some(
    (value) => value !== null,
  );
}

function materialRowsForDisplay(materials) {
  return MATERIAL_KEYS.filter((key) => hasMaterialSlotData(materials?.[key])).map((key) => ({
    key,
    label: MATERIAL_LABELS[key],
    ...materials[key],
  }));
}

function getPlantRiskStatus(plant) {
  const rows = materialRowsForDisplay(plant.materials);
  const cementDiff = plant.materials?.cement?.diff;
  const flyashDiff = plant.materials?.flyash?.diff;

  return {
    hasRisk: rows.some((row) => row.diff !== null && row.diff < 0),
    cementRisk: cementDiff !== null && cementDiff !== undefined && cementDiff < 0,
    flyashRisk: flyashDiff !== null && flyashDiff !== undefined && flyashDiff < 0,
  };
}

function formatRiskFlags(riskStatus) {
  const flags = [];
  if (riskStatus.cementRisk) flags.push("C");
  if (riskStatus.flyashRisk) flags.push("F");
  return flags;
}

function compareMaterialPriority(left, right) {
  const diffGap = (left.diff ?? Number.POSITIVE_INFINITY) - (right.diff ?? Number.POSITIVE_INFINITY);
  if (diffGap !== 0) return diffGap;
  return (right.requiredLoads ?? 0) - (left.requiredLoads ?? 0);
}

function buildPlantDecision(plant) {
  const rows = materialRowsForDisplay(plant.materials);
  const urgentRows = rows
    .filter((row) => row.diff !== null && row.diff < 0)
    .sort(compareMaterialPriority);

  if (urgentRows.length > 0) {
    const row = urgentRows[0];
    const materialLabel = MATERIAL_USAGE_LABELS[row.key] ?? row.label;
    return {
      plantId: plant.id,
      plant,
      mode: "act_now",
      severity: row.diff <= -1 || (row.requiredLoads ?? 0) > 0 ? "critical" : "attention",
      materialKey: row.key,
      materialLabel,
      actionLabel: `Protect ${materialLabel} at Plant ${plant.id}`,
      reason: `Diff ${formatDiff(row.diff)} and required loads ${formatNumber(row.requiredLoads, 2)}`,
      support: `On hand ${formatNumber(row.onHand, 2)} | current loads ${formatNumber(row.loads, 2)}`,
      byTime: cleanText(row.time) || getPlantStartTime(plant),
      score: Math.abs(row.diff ?? 0) * 100 + (row.requiredLoads ?? 0) * 10,
    };
  }

  const watchRows = rows
    .filter((row) => row.diff !== null && row.diff >= 0 && row.diff <= 2)
    .sort(compareMaterialPriority);

  if (watchRows.length > 0) {
    const row = watchRows[0];
    const materialLabel = MATERIAL_USAGE_LABELS[row.key] ?? row.label;
    return {
      plantId: plant.id,
      plant,
      mode: "watch",
      severity: row.diff <= 0.75 ? "tight" : "watch",
      materialKey: row.key,
      materialLabel,
      actionLabel: `Watch ${materialLabel} at Plant ${plant.id}`,
      reason: `Diff ${formatDiff(row.diff)} with on hand ${formatNumber(row.onHand, 2)}`,
      support: `Stay ahead of start time ${cleanText(row.time) || getPlantStartTime(plant)}`,
      byTime: cleanText(row.time) || getPlantStartTime(plant),
      score: (2 - (row.diff ?? 0)) * 50 + (row.requiredLoads ?? 0) * 10,
    };
  }

  return null;
}

function hasAnyMaterialData(materials) {
  return MATERIAL_KEYS.some((key) => hasMaterialSlotData(materials?.[key]));
}

function sumNullable(currentValue, nextValue) {
  if (nextValue === null) return currentValue;
  if (currentValue === null) return nextValue;
  return currentValue + nextValue;
}

function buildMaterialMap(materialBuffer) {
  if (!materialBuffer) return new Map();
  const materialWorkbook = XLSX.read(materialBuffer, { type: "array" });
  const materialRows = getSheetRows(materialWorkbook, materialWorkbook.SheetNames[0], 0);
  const materialHeaderIndex = findHeaderRow(materialRows, [
    "plant",
    "raw material",
    "loads",
    "on hand",
    "diff",
    "required loads",
  ]);

  if (materialHeaderIndex < 0) {
    throw new Error("Could not find the material requirements header row.");
  }

  const materialObjects = rowsToObjects(materialRows, materialHeaderIndex);
  const byPlant = new Map();

  materialObjects.forEach((row) => {
    const plantId = toInteger(row.plant);
    const materialKey = normalizeMaterialKey(row["raw material"]);
    if (!Number.isInteger(plantId) || !materialKey) return;

    if (!byPlant.has(plantId)) byPlant.set(plantId, emptyMaterialSummary());
    const plantMaterials = byPlant.get(plantId);
    const previousSlot = plantMaterials[materialKey] ?? emptyMaterialSlot();

    plantMaterials[materialKey] = {
      loads: sumNullable(previousSlot.loads, toNumber(row.loads)),
      onHand: sumNullable(previousSlot.onHand, toNumber(row["on hand"])),
      diff: sumNullable(previousSlot.diff, toNumber(row.diff)),
      requiredLoads: sumNullable(previousSlot.requiredLoads, toNumber(row["required loads"])),
      time: cleanText(row.time) || previousSlot.time || "",
    };
  });

  return byPlant;
}

function buildYardageMap(shippedBuffer, loadBuffer) {
  if (!shippedBuffer) return new Map();

  const shippedWorkbook = XLSX.read(shippedBuffer, { type: "array" });
  const shippedRows = getSheetRows(shippedWorkbook, SHIPPED_SHEET, 0);
  const shippedHeaderIndex = findHeaderRow(shippedRows, ["Order #", "Plant", "Order Qty"]);
  if (shippedHeaderIndex < 0) throw new Error("Could not find the yardage source header row.");

  const shippedObjects = rowsToObjects(shippedRows, shippedHeaderIndex);
  const orderLookup = new Map();
  const totals = new Map();

  shippedObjects.forEach((row) => {
    const orderNumber = toInteger(row["Order #"]);
    const plantId = toInteger(row["Plant"]);
    const orderQty = toNumber(row["Order Qty"]) ?? 0;
    if (!Number.isInteger(plantId)) return;

    if (Number.isInteger(orderNumber) && !orderLookup.has(orderNumber)) {
      orderLookup.set(orderNumber, orderQty);
    }

    totals.set(plantId, (totals.get(plantId) ?? 0) + orderQty);
  });

  if (loadBuffer) {
    const loadWorkbook = XLSX.read(loadBuffer, { type: "array" });
    const loadRows = getSheetRows(loadWorkbook, LOAD_SHEET, 0);
    const loadHeaderIndex = findHeaderRow(loadRows, ["Order", "Loads", "From Plant", "To Plant"]);
    if (loadHeaderIndex >= 0) {
      const loadObjects = rowsToObjects(loadRows, loadHeaderIndex);
      const normalizedLoads = normalizeLoadRows(loadObjects);

      normalizedLoads.forEach((row) => {
        const totalQty = Number.isInteger(row.orderNumber)
          ? orderLookup.get(row.orderNumber) ?? null
          : null;
        const remaining = totalQty === null ? null : totalQty - row.loads * 10;
        if (remaining === null) return;
        if (!Number.isInteger(row.fromPlant) || !Number.isInteger(row.toPlant)) return;
        if ((totals.get(row.fromPlant) ?? 0) - remaining < 0) return;

        totals.set(row.fromPlant, (totals.get(row.fromPlant) ?? 0) - remaining);
        totals.set(row.toPlant, (totals.get(row.toPlant) ?? 0) + remaining);
      });
    }
  }

  return totals;
}

function buildCockpitData({
  shippedBuffer,
  loadBuffer,
  materialBuffer,
  shippedName,
  loadName,
  materialName,
}) {
  if (!materialBuffer) throw new Error("Upload the material requirements file first.");

  const materialByPlant = buildMaterialMap(materialBuffer);
  const yardageByPlant = buildYardageMap(shippedBuffer, loadBuffer);

  const plants = Array.from({ length: MAX_PLANT_ID }, (_, index) => {
    const id = index + 1;
    const materials = materialByPlant.get(id) ?? emptyMaterialSummary();
    const yardage = yardageByPlant.get(id) ?? null;
    const regionMeta = getPlantRegionMeta({ id });
    return {
      id,
      active: hasAnyMaterialData(materials) || yardage !== null,
      yardage,
      ...regionMeta,
      materials,
    };
  });

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      files: {
        yardage: shippedName ?? "none",
        adjustments: loadName ?? "none",
        material: materialName ?? "none",
      },
    },
    plants,
    summary: {
      activePlants: plants.filter((plant) => plant.active).length,
      totalYardage: plants.reduce((sum, plant) => sum + (plant.yardage ?? 0), 0),
    },
  };
}

function formatNumber(value, maximumFractionDigits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits });
}

function formatDiff(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  if (value < 0) return `(${formatNumber(Math.abs(value), 2)})`;
  return formatNumber(value, 2);
}

function decodeBase64(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function readDesktopSource(desktopApi, filePath, required) {
  try {
    const record = await desktopApi.readWorkbookFile(filePath);
    if (!record?.base64) {
      if (required) {
        throw new Error(`The desktop bridge returned no data for ${filePath}.`);
      }

      return {
        buffer: null,
        fileName: "none",
        filePath,
      };
    }

    return {
      buffer: decodeBase64(record.base64),
      fileName: record.fileName,
      filePath: record.filePath,
    };
  } catch (error) {
    if (!required) {
      return {
        buffer: null,
        fileName: "none",
        filePath,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown desktop file error.";
    throw new Error(`Could not read ${filePath}: ${message}`);
  }
}

function createSourceBridge(desktopApi) {
  if (desktopApi?.readWorkbookFile) {
    return {
      mode: "desktop",
      readWorkbookFile: (_sourceKey, filePath) => desktopApi.readWorkbookFile(filePath),
    };
  }

  return {
    mode: "web",
    readWorkbookFile: async (sourceKey) => {
      const response = await fetch(`/api/source-files/${sourceKey}`);
      const payload = await response.json().catch(() => null);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(payload?.error || `Could not load source file: ${sourceKey}`);
      }

      return payload;
    },
  };
}

async function readSource(sourceBridge, sourceKey, required) {
  const filePath = SOURCE_FILES[sourceKey];
  return readDesktopSource(
    {
      readWorkbookFile: () => sourceBridge.readWorkbookFile(sourceKey, filePath),
    },
    filePath,
    required,
  );
}

function formatClockLabel(value) {
  const text = cleanText(value);
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text || "-";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function parseClockMinutes(value) {
  const text = cleanText(value);
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getPlantStartTime(plant) {
  const times = MATERIAL_KEYS.map((key) => cleanText(plant.materials?.[key]?.time))
    .filter(Boolean)
    .map((time) => ({
      label: formatClockLabel(time),
      minutes: parseClockMinutes(time),
    }))
    .filter((time) => time.minutes !== Number.MAX_SAFE_INTEGER)
    .sort((left, right) => left.minutes - right.minutes);

  return times[0]?.label ?? "-";
}

function buildAggDriverRows(aggBuffer) {
  if (!aggBuffer) return DEMO_DRIVERS;

  const workbook = XLSX.read(aggBuffer, { type: "array" });
  const rows = getSheetRows(workbook, "Trucks", 0);
  const headerIndex = findHeaderRow(rows, [
    "Start",
    "Driver",
    "Name",
    "Assign Tr",
    "Loc.",
    "Truck Location Description",
  ]);

  if (headerIndex < 0) {
    return DEMO_DRIVERS;
  }

  const records = rowsToObjects(rows, headerIndex)
    .map((row, index) => ({
      id: `agg_${index + 1}`,
      name: cleanText(row.Name) || `driver_${cleanText(row.Driver) || index + 1}`,
      status: `${formatClockLabel(row.Start)} ${cleanText(row.Type) || "truck"}`.trim(),
      location:
        cleanText(row["Truck Location Description"]) ||
        cleanText(row["Loc."]) ||
        "unassigned",
      sortStartMinutes: parseClockMinutes(row.Start),
      assignedTruck: cleanText(row["Assign Tr"]) || cleanText(row["Temp Tr"]),
      driverCode: cleanText(row.Driver),
    }))
    .filter((row) => row.name || row.location || row.assignedTruck)
    .sort((left, right) => left.sortStartMinutes - right.sortStartMinutes)
    .map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      location: row.location,
      assignedTruck: row.assignedTruck,
      driverCode: row.driverCode,
    }));

  return records.length > 0 ? records : DEMO_DRIVERS;
}

function Metric({ label, value }) {
  return (
    <div className="border border-white/15 bg-white/[0.02] px-3 py-2">
      <div className="text-[11px] text-white/55">{label}</div>
      <div className="mt-1 text-[14px] font-medium text-white">{value}</div>
    </div>
  );
}

function CliButton({ children, onClick, disabled = false, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`border px-3 py-2 text-[11px] font-medium transition disabled:opacity-40 ${
        active
          ? "border-white/40 bg-white/[0.1] text-white"
          : "border-white/15 bg-white/[0.03] text-white/90 hover:bg-white/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}

function CliSection({ title, children, right }) {
  return (
    <section className="border border-white/15 bg-black p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

function MaterialSnapshot({ materials }) {
  const rows = materialRowsForDisplay(materials);

  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-white/25 p-4 text-sm text-white">
        No material requirements loaded.
      </div>
    );
  }

  return (
    <div className="overflow-auto border border-white/25">
      <table className="min-w-full text-sm">
        <thead className="border-b border-white/25 text-left text-[11px] uppercase tracking-[0.18em] text-white">
          <tr>
            <th className="px-3 py-3 font-medium">material</th>
            <th className="px-3 py-3 font-medium text-right">on hand</th>
            <th className="px-3 py-3 font-medium text-right">loads</th>
            <th className="px-3 py-3 font-medium text-right">diff</th>
            <th className="px-3 py-3 font-medium text-right">req</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-white/15 text-white">
              <td className="px-3 py-3 font-medium">{row.label}</td>
              <td className="px-3 py-3 text-right">{formatNumber(row.onHand, 2)}</td>
              <td className="px-3 py-3 text-right">{formatNumber(row.loads, 2)}</td>
              <td className="px-3 py-3 text-right">{formatDiff(row.diff)}</td>
              <td className="px-3 py-3 text-right">{formatNumber(row.requiredLoads, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DecisionCard({ item, selected, onSelect }) {
  const toneClass =
    item.severity === "critical"
      ? "border-rose-500/50 bg-rose-500/10"
      : item.mode === "act_now"
        ? "border-amber-400/40 bg-amber-400/10"
        : "border-sky-400/35 bg-sky-400/10";
  const badgeLabel =
    item.mode === "act_now"
      ? item.severity === "critical"
        ? "Act now"
        : "Attention"
      : item.severity === "tight"
        ? "Tight"
        : "Watch";

  return (
    <button
      type="button"
      onClick={() => onSelect(item.plantId)}
      className={`border p-4 text-left transition ${
        selected ? "border-white bg-white/[0.05]" : "border-white/15 bg-white/[0.02] hover:border-white/35"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-white">Plant {item.plantId}</div>
        <div className={`border px-2 py-1 text-[11px] font-semibold text-white ${toneClass}`}>
          {badgeLabel}
        </div>
      </div>
      <div className="mt-2 text-[15px] font-semibold text-white">{item.actionLabel}</div>
      <div className="mt-2 text-sm text-white/80">{item.reason}</div>
      <div className="mt-1 text-[12px] text-white/55">{item.support}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-white/60">
        <div>{formatRegionLabel(item.plant.region)}</div>
        <div>yardage {formatNumber(item.plant.yardage, 1)}</div>
        <div>by {item.byTime}</div>
      </div>
    </button>
  );
}

function DecisionQueueSection({ title, items, selectedPlantId, onSelectPlant, emptyLabel }) {
  return (
    <CliSection
      title={title}
      right={<div className="text-sm text-white/60">{items.length} plants</div>}
    >
      {items.length === 0 ? (
        <div className="border border-dashed border-white/25 p-4 text-sm text-white">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((item) => (
            <DecisionCard
              key={`${item.mode}_${item.plantId}_${item.materialKey}`}
              item={item}
              selected={selectedPlantId === item.plantId}
              onSelect={onSelectPlant}
            />
          ))}
        </div>
      )}
    </CliSection>
  );
}

function PlantTile({ plant, selected, onClick }) {
  const cement = plant.materials?.cement ?? emptyMaterialSlot();
  const flyash = plant.materials?.flyash ?? emptyMaterialSlot();
  const riskStatus = getPlantRiskStatus(plant);
  const riskFlags = formatRiskFlags(riskStatus);
  const startTime = getPlantStartTime(plant);
  const usageMaterials = materialRowsForDisplay(plant.materials);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-[336px] shrink-0 overflow-hidden border p-4 text-left transition ${
        selected
          ? "border-white bg-white/[0.04]"
          : "border-white/15 bg-white/[0.02] hover:border-white/35"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-white/50">Plant {plant.id}</div>
          <div className="mt-1 text-[11px] text-white/60">Start time {startTime}</div>
          <div className="mt-2 border border-white/10 bg-white/[0.02] px-2 py-2">
            <div className="text-[11px] text-white/50">Material usage</div>
            <div className="mt-1 space-y-1 text-[11px] text-white/70">
              {usageMaterials.length > 0 ? (
                usageMaterials.map((row) => (
                  <div key={row.key}>
                    {MATERIAL_USAGE_LABELS[row.key] ?? row.label}:{" "}
                    {formatNumber(MATERIAL_USAGE_PLACEHOLDERS[row.key] ?? 0, 2)}
                  </div>
                ))
              ) : (
                <div>-</div>
              )}
            </div>
          </div>
          {riskFlags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {riskFlags.map((flag) => (
                <span
                  key={flag}
                  className="inline-flex min-w-6 items-center justify-center border border-rose-500/50 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300"
                >
                  {flag}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-emerald-300/80">stable</div>
          )}
        </div>

        <div className="text-right">
          <div className="text-[11px] text-white/50">Yardage</div>
          <div className="mt-1 text-3xl font-semibold leading-none text-white">
            {formatNumber(plant.yardage, 1)}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
        <div className="grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-2 text-sm text-white">
          <div className="font-semibold text-white/75">C</div>
          <div className="text-white/60">on hand</div>
          <div>{formatNumber(cement.onHand, 2)}</div>
          <div className={riskStatus.cementRisk ? "font-semibold text-rose-300" : "text-white/70"}>
            req {formatNumber(cement.requiredLoads, 2)}
          </div>
        </div>
        <div className="grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-2 text-sm text-white">
          <div className="font-semibold text-white/75">F</div>
          <div className="text-white/60">on hand</div>
          <div>{formatNumber(flyash.onHand, 2)}</div>
          <div className={riskStatus.flyashRisk ? "font-semibold text-rose-300" : "text-white/70"}>
            req {formatNumber(flyash.requiredLoads, 2)}
          </div>
        </div>
        {(riskStatus.cementRisk || riskStatus.flyashRisk) && (
          <div className="pt-1 text-[11px] text-rose-300">
            negative diff on {riskFlags.join(" / ")}
          </div>
        )}
        {!riskStatus.cementRisk && !riskStatus.flyashRisk && (
          <div className="pt-1 text-[11px] text-white/50">
            no cement or flyash shortage flagged
          </div>
        )}
      </div>
    </button>
  );
}

function PlantRibbon({
  filteredPlants,
  selectedPlant,
  setSelectedPlantId,
  activeOnly,
  setActiveOnly,
  search,
  setSearch,
  selectedRegion,
  setSelectedRegion,
}) {
  const plantStripRef = useRef(null);
  const [plantStripMetrics, setPlantStripMetrics] = useState({
    scrollLeft: 0,
    maxScrollLeft: 0,
  });

  function syncPlantStripMetrics() {
    const strip = plantStripRef.current;
    if (!strip) return;
    setPlantStripMetrics({
      scrollLeft: strip.scrollLeft,
      maxScrollLeft: Math.max(0, strip.scrollWidth - strip.clientWidth),
    });
  }

  function scrollPlantStripBy(direction) {
    const strip = plantStripRef.current;
    if (!strip) return;
    const travel = Math.max(280, Math.round(strip.clientWidth * 0.72));
    strip.scrollBy({ left: direction * travel, behavior: "smooth" });
  }

  useEffect(() => {
    syncPlantStripMetrics();
  }, [filteredPlants.length]);

  useEffect(() => {
    const strip = plantStripRef.current;
    if (!strip) return undefined;
    const handleScroll = () => syncPlantStripMetrics();
    const handleResize = () => syncPlantStripMetrics();
    strip.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      strip.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [filteredPlants.length]);

  const canScrollPlantPrev = plantStripMetrics.scrollLeft > 0;
  const canScrollPlantNext =
    plantStripMetrics.scrollLeft < plantStripMetrics.maxScrollLeft - 1;

  return (
    <CliSection
      title="All plants"
      right={
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
            <div>{filteredPlants.length} shown</div>
            {selectedPlant ? <div>selected {selectedPlant.id}</div> : null}
            <CliButton onClick={() => scrollPlantStripBy(-1)} disabled={!canScrollPlantPrev}>
              Prev
            </CliButton>
            <CliButton onClick={() => scrollPlantStripBy(1)} disabled={!canScrollPlantNext}>
              Next
            </CliButton>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-sm text-white/85">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(event) => setActiveOnly(event.target.checked)}
              />
              <span>Active plants only</span>
            </label>
            <label className="flex min-w-[220px] items-center gap-2 border border-white/15 px-3 py-2 text-sm text-white/85">
              <span className="text-white/55">Search plant ID</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Plant id"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </label>
            <label className="flex items-center gap-2 border border-white/15 px-3 py-2 text-sm text-white/85">
              <span className="text-white/55">Area</span>
              <select
                value={selectedRegion}
                onChange={(event) => setSelectedRegion(event.target.value)}
                className="bg-black text-sm text-white outline-none"
              >
                <option value="all">All areas</option>
                {REGION_ORDER.map((region) => (
                  <option key={region} value={region}>
                    {formatRegionLabel(region)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      }
    >
      <div ref={plantStripRef} className="overflow-x-auto overflow-y-hidden pb-1">
        <div className="flex min-w-max gap-3 pr-3">
          {filteredPlants.map((plant) => (
            <PlantTile
              key={plant.id}
              plant={plant}
              selected={selectedPlant?.id === plant.id}
              onClick={() =>
                setSelectedPlantId((current) => (current === plant.id ? null : plant.id))
              }
            />
          ))}
        </div>
      </div>
    </CliSection>
  );
}

function DriverLogList({ logs, emptyLabel, showPlant = true }) {
  if (logs.length === 0) {
    return (
      <div className="border border-dashed border-white/25 p-4 text-sm text-white">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((entry) => (
        <div key={entry.id} className="border border-white/25 p-3 text-sm text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">
              {showPlant ? `plant ${entry.plantId} :: ` : ""}
              {entry.driver || "-"}
            </div>
            <div className="text-[11px] opacity-70">{entry.savedAt}</div>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <div className="break-words">location {entry.location || "-"}</div>
            <div className="break-words">truck {entry.truckNumber || "-"}</div>
            <div className="break-words">driver {entry.driver || "-"}</div>
            <div className="break-words">source {entry.source || "-"}</div>
            <div className="break-words">inv {entry.invCode || "-"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function hasDriverLogDraftContent(draft) {
  return ["location", "truckNumber", "driver", "source", "invCode"].some(
    (field) => cleanText(draft?.[field]) !== "",
  );
}

function uniqueCleanValues(values) {
  return Array.from(
    new Set(values.map((value) => cleanText(value)).filter((value) => value !== "")),
  );
}

function DriverLogTextField({ label, value, onChange, listId, options = [] }) {
  return (
    <label className="grid gap-2 text-sm text-white">
      <span className="text-[11px] uppercase tracking-[0.18em] opacity-70">{label}</span>
      <input
        type="text"
        value={value}
        list={options.length > 0 ? listId : undefined}
        onChange={onChange}
        className="border border-white/25 bg-black px-3 py-2 text-sm text-white outline-none"
      />
      {options.length > 0 ? (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}

function DriverLogForm({
  draft,
  onDraftChange,
  onSave,
  saveDisabled,
  driverOptions,
  saveLabel = "save_driver_log",
}) {
  return (
    <div className="grid gap-3">
      <div className="border border-white/25 px-3 py-3 text-sm text-white">
        plant {draft.plantId ?? "none_selected"}
      </div>
      <DriverLogTextField
        label="location"
        value={draft.location}
        listId={`driver-log-location-${draft.plantId ?? "none"}`}
        options={driverOptions.locations}
        onChange={(event) => onDraftChange("location", event.target.value)}
      />
      <DriverLogTextField
        label="truck number"
        value={draft.truckNumber}
        listId={`driver-log-truck-${draft.plantId ?? "none"}`}
        options={driverOptions.truckNumbers}
        onChange={(event) => onDraftChange("truckNumber", event.target.value)}
      />
      <DriverLogTextField
        label="driver"
        value={draft.driver}
        listId={`driver-log-driver-${draft.plantId ?? "none"}`}
        options={driverOptions.driverNames}
        onChange={(event) => onDraftChange("driver", event.target.value)}
      />
      <DriverLogTextField
        label="source"
        value={draft.source}
        onChange={(event) => onDraftChange("source", event.target.value)}
      />
      <DriverLogTextField
        label="inv code"
        value={draft.invCode}
        listId={`driver-log-code-${draft.plantId ?? "none"}`}
        options={driverOptions.invCodes}
        onChange={(event) => onDraftChange("invCode", event.target.value)}
      />
      <div className="pt-2">
        <CliButton onClick={onSave} disabled={saveDisabled}>
          {saveLabel}
        </CliButton>
      </div>
    </div>
  );
}

function PlantDetailsPanel({
  plant,
  driverLogs,
  driverLogDraft,
  driverOptions,
  onDraftChange,
  onSaveDriverLog,
  onOpenDriverLogPage,
  onClose,
}) {
  if (!plant) {
    return (
      <div className="self-start xl:sticky xl:top-6 xl:z-10">
        <CliSection title="Selected plant">
          <div className="space-y-3 text-sm text-white/75">
            <div className="border border-dashed border-white/25 p-4">
              Pick a plant from <span className="text-white">Act now</span>,{" "}
              <span className="text-white">Watch next</span>, or{" "}
              <span className="text-white">All plants</span> to open the decision detail.
            </div>
          </div>
        </CliSection>
      </div>
    );
  }

  const materialRows = materialRowsForDisplay(plant.materials);
  const negativeDiffCount = materialRows.filter((row) => row.diff !== null && row.diff < 0).length;
  const plantLogs = driverLogs.filter((entry) => Number(entry.plantId) === Number(plant.id));
  const detailDraft =
    driverLogDraft.plantId === plant.id ? driverLogDraft : createDriverLogDraft(plant.id);
  const saveDisabled = !hasDriverLogDraftContent(detailDraft);
  const decision = buildPlantDecision(plant);
  const riskFlags = formatRiskFlags(getPlantRiskStatus(plant));
  const areaLabel = formatRegionLabel(plant.region);
  const startTime = getPlantStartTime(plant);

  return (
    <div className="self-start xl:sticky xl:top-6 xl:z-10">
      <CliSection
        title={`Plant ${plant.id}`}
        right={
          <div className="flex items-center gap-2">
            <div className="border border-white/15 px-3 py-2 text-white/80">{areaLabel}</div>
            <div className="border border-white/15 px-3 py-2 text-white/80">
              Yardage {formatNumber(plant.yardage, 1)}
            </div>
            <CliButton onClick={() => onOpenDriverLogPage(plant)}>Log page</CliButton>
            <CliButton onClick={onClose}>Close</CliButton>
          </div>
        }
      >
        <div className="max-h-[calc(100vh-250px)] space-y-6 overflow-y-auto pr-1">
          <div className="border border-white/15 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[12px] font-medium text-white">Recommended action</div>
              <div className="text-[11px] text-white/55">decision summary</div>
            </div>
            {decision ? (
              <>
                <div className="mt-3 text-lg font-semibold text-white">{decision.actionLabel}</div>
                <div className="mt-2 text-sm text-white/80">{decision.reason}</div>
                <div className="mt-1 text-sm text-white/60">{decision.support}</div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-white/55">
                  <div>Area {areaLabel}</div>
                  <div>By {decision.byTime}</div>
                  <div>Risk {riskFlags.length > 0 ? riskFlags.join(" / ") : "stable"}</div>
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 text-lg font-semibold text-white">No immediate action</div>
                <div className="mt-2 text-sm text-white/70">
                  This plant is currently stable based on the loaded material numbers.
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-white/55">
                  <div>Area {areaLabel}</div>
                  <div>Start {startTime}</div>
                  <div>Keep watching material requirements</div>
                </div>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Area" value={areaLabel} />
            <Metric label="Start time" value={startTime} />
            <Metric label="Yardage" value={formatNumber(plant.yardage, 1)} />
            <Metric label="Materials shown" value={materialRows.length} />
            <Metric label="Negative diffs" value={negativeDiffCount} />
            <Metric label="Saved logs" value={plantLogs.length} />
          </div>

          <div>
            <div className="text-[12px] font-medium text-white/75">Materials</div>
            <div className="mt-3">
              <MaterialSnapshot materials={plant.materials} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="border border-white/15 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white">
                <div className="font-medium">Driver input</div>
                <div className="text-white/55">save here</div>
              </div>
              <DriverLogForm
                draft={detailDraft}
                driverOptions={driverOptions}
                onDraftChange={onDraftChange}
                onSave={onSaveDriverLog}
                saveDisabled={saveDisabled}
              />
            </div>

            <div className="border border-white/15 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white">
                <div className="font-medium">Saved logs</div>
                <div className="text-white/55">shared with log page</div>
              </div>
              <DriverLogList
                logs={plantLogs}
                showPlant={false}
                emptyLabel="No saved driver logs for this plant yet."
              />
            </div>
          </div>
        </div>
      </CliSection>
    </div>
  );
}

function PlantTotalsSection({ isOpen, onToggle, rows }) {
  const columns = [
    { key: "id", label: "plant" },
    { key: "yardage", label: "yardage", render: (row) => formatNumber(row.yardage, 1) },
    {
      key: "cementDiff",
      label: "cement diff",
      render: (row) => formatDiff(row.materials?.cement?.diff),
    },
    {
      key: "flyashDiff",
      label: "flyash diff",
      render: (row) => formatDiff(row.materials?.flyash?.diff),
    },
    { key: "plcDiff", label: "plc diff", render: (row) => formatDiff(row.materials?.plc?.diff) },
    { key: "lc3Diff", label: "lc3 diff", render: (row) => formatDiff(row.materials?.lc3?.diff) },
  ];

  return (
    <CliSection
      title="Material Requirements"
      right={<CliButton onClick={onToggle}>{isOpen ? "Hide" : "Show"}</CliButton>}
    >
      {isOpen ? (
        rows.length === 0 ? (
          <div className="border border-dashed border-white/25 p-4 text-sm text-white">
            No plants match the current filters.
          </div>
        ) : (
          <div className="overflow-auto border border-white/25">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/25 text-left text-[11px] uppercase tracking-[0.18em] text-white">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className="px-3 py-3 font-medium">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/15 text-white">
                    {columns.map((column) => (
                      <td key={column.key} className="px-3 py-3 align-top">
                        {column.render ? column.render(row) : row[column.key] ?? "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </CliSection>
  );
}

function MaterialUsageSection({ rows }) {
  const columns = [
    { key: "id", label: "plant" },
    {
      key: "region",
      label: "area",
      render: (row) => formatRegionLabel(row.region),
    },
    {
      key: "cementUsage",
      label: "cement",
      render: (row) =>
        hasMaterialSlotData(row.materials?.cement)
          ? formatNumber(MATERIAL_USAGE_PLACEHOLDERS.cement, 2)
          : "-",
    },
    {
      key: "flyashUsage",
      label: "fly-ash",
      render: (row) =>
        hasMaterialSlotData(row.materials?.flyash)
          ? formatNumber(MATERIAL_USAGE_PLACEHOLDERS.flyash, 2)
          : "-",
    },
    {
      key: "plcUsage",
      label: "plc",
      render: (row) =>
        hasMaterialSlotData(row.materials?.plc)
          ? formatNumber(MATERIAL_USAGE_PLACEHOLDERS.plc, 2)
          : "-",
    },
    {
      key: "lc3Usage",
      label: "lc3",
      render: (row) =>
        hasMaterialSlotData(row.materials?.lc3)
          ? formatNumber(MATERIAL_USAGE_PLACEHOLDERS.lc3, 2)
          : "-",
    },
  ];

  return (
    <CliSection title="Material Usage">
      {rows.length === 0 ? (
        <div className="border border-dashed border-white/25 p-4 text-sm text-white">
          No plants match the current filters.
        </div>
      ) : (
        <div className="overflow-auto border border-white/25">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/25 text-left text-[11px] uppercase tracking-[0.18em] text-white">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-3 font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-white/15 text-white">
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-3 align-top">
                      {column.render ? column.render(row) : row[column.key] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CliSection>
  );
}

function DriverStatusPanel({ isOpen, onToggle, drivers, variant = "sidebar" }) {
  const listClass =
    variant === "page"
      ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      : "max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto pr-1";
  const summaryClass =
    variant === "page"
      ? "border border-white/15 bg-white/[0.02] p-3 text-sm text-white/75 md:col-span-2 xl:col-span-3"
      : "border border-white/15 bg-white/[0.02] p-3 text-sm text-white/75";

  return (
    <CliSection
      title="Drivers"
      right={<CliButton onClick={onToggle}>{isOpen ? "Hide" : "Show"}</CliButton>}
    >
      {isOpen ? (
        <div className={listClass}>
          <div className={summaryClass}>
            {drivers.length} driver rows loaded
          </div>
          {drivers.map((driver) => {
            const truck = "assignedTruck" in driver ? driver.assignedTruck || "-" : "-";
            const code = "driverCode" in driver ? driver.driverCode || "" : "";

            return (
              <div key={driver.id} className="border border-white/15 bg-white/[0.02] p-3 text-sm text-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{driver.name}</div>
                  <div className="text-[11px] text-white/55">truck {truck}</div>
                </div>
                <div className="mt-1 text-white/75">{driver.location}</div>
                <div className="mt-1 text-[11px] text-white/50">
                  {driver.status}
                  {code ? ` - code ${code}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </CliSection>
  );
}

function DriverLogPage({
  plant,
  draft,
  driverOptions,
  onDraftChange,
  onSave,
  logs,
  onOpenPlant,
}) {
  const plantLogs = useMemo(
    () =>
      draft.plantId === null
        ? logs
        : logs.filter((entry) => Number(entry.plantId) === Number(draft.plantId)),
    [logs, draft.plantId],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <CliSection title="Driver log editor">
        <DriverLogForm
          draft={draft}
          driverOptions={driverOptions}
          onDraftChange={onDraftChange}
          onSave={onSave}
          saveDisabled={!hasDriverLogDraftContent(draft)}
        />
      </CliSection>

      <CliSection
        title={`Saved logs${draft.plantId === null ? "" : ` for plant ${draft.plantId}`}`}
        right={
          plant ? (
            <CliButton onClick={() => onOpenPlant(plant.id)}>Open plant {plant.id}</CliButton>
          ) : null
        }
      >
        <DriverLogList
          logs={plantLogs}
          emptyLabel={
            draft.plantId === null
              ? "Select a plant from the cockpit first."
              : "No saved logs for this plant yet."
          }
        />
      </CliSection>
    </div>
  );
}

export default function DispatchCockpitLive() {
  const [data, setData] = useState(DEMO_DATA);
  const [drivers, setDrivers] = useState(DEMO_DRIVERS);
  const [page, setPage] = useState("cockpit");
  const [activeOnly, setActiveOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [showPlantTotals, setShowPlantTotals] = useState(true);
  const [showDriverStatus, setShowDriverStatus] = useState(true);
  const [driverLogs, setDriverLogs] = useState(loadDriverLogs);
  const [driverLogDraft, setDriverLogDraft] = useState(() => createDriverLogDraft(null));
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const sourceBridge = useMemo(
    () => createSourceBridge(window.dispatchCockpitDesktop),
    [],
  );

  const filteredPlants = useMemo(() => {
    const query = search.trim();
    const exactPlantId = query === "" ? null : Number(query);
    return data.plants.filter((plant) => {
      if (activeOnly && !plant.active) return false;
      if (selectedRegion !== "all" && plant.region !== selectedRegion) return false;
      if (query && (!Number.isInteger(exactPlantId) || plant.id !== exactPlantId)) return false;
      return true;
    });
  }, [data, activeOnly, search, selectedRegion]);

  const selectedPlant = useMemo(() => {
    if (selectedPlantId === null) return null;
    return data.plants.find((plant) => plant.id === selectedPlantId) ?? null;
  }, [data, selectedPlantId]);

  const riskPlants = useMemo(
    () =>
      data.plants
        .map((plant) => ({
          id: plant.id,
          ...getPlantRiskStatus(plant),
        }))
        .filter((plant) => plant.hasRisk),
    [data],
  );
  const riskPlantCount = riskPlants.length;

  const actNowDecisions = useMemo(
    () =>
      filteredPlants
        .map((plant) => buildPlantDecision(plant))
        .filter((decision) => decision?.mode === "act_now")
        .sort((left, right) => right.score - left.score),
    [filteredPlants],
  );

  const watchDecisions = useMemo(
    () =>
      filteredPlants
        .map((plant) => buildPlantDecision(plant))
        .filter((decision) => decision?.mode === "watch")
        .sort((left, right) => right.score - left.score),
    [filteredPlants],
  );

  const driverOptions = useMemo(
    () => ({
      locations: uniqueCleanValues(drivers.map((driver) => driver.location)),
      truckNumbers: uniqueCleanValues(
        drivers.map((driver) => ("assignedTruck" in driver ? driver.assignedTruck : "")),
      ),
      driverNames: uniqueCleanValues(drivers.map((driver) => driver.name)),
      invCodes: uniqueCleanValues(
        drivers.map((driver) => ("driverCode" in driver ? driver.driverCode : "")),
      ),
    }),
    [drivers],
  );

  useEffect(() => {
    window.localStorage.setItem(DRIVER_LOG_STORAGE_KEY, JSON.stringify(driverLogs));
  }, [driverLogs]);

  const refreshFromDesktop = useCallback(async () => {
    try {
      setRunning(true);
      setError("");

      const [yardageSource, adjustmentsSource, materialSource, aggSource] = await Promise.all([
        readSource(sourceBridge, "yardage", false),
        readSource(sourceBridge, "adjustments", false),
        readSource(sourceBridge, "material", true),
        readSource(sourceBridge, "aggAssignments", false),
      ]);

      const nextData = buildCockpitData({
        shippedBuffer: yardageSource.buffer,
        loadBuffer: adjustmentsSource.buffer,
        materialBuffer: materialSource.buffer,
        shippedName: yardageSource.fileName,
        loadName: adjustmentsSource.fileName,
        materialName: materialSource.fileName,
      });

      setData(nextData);
      setDrivers(buildAggDriverRows(aggSource.buffer));
      setSelectedPlantId(null);
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "Could_not_build_cockpit_from_desktop_files.",
      );
    } finally {
      setRunning(false);
    }
  }, [sourceBridge]);

  useEffect(() => {
    void refreshFromDesktop();
  }, [refreshFromDesktop]);

  useEffect(() => {
    if (selectedPlantId === null) return;
    setDriverLogDraft((current) =>
      current.plantId === selectedPlantId ? current : createDriverLogDraft(selectedPlantId),
    );
  }, [selectedPlantId]);

  function openDriverLogForPlant(plant) {
    setDriverLogDraft((current) =>
      current.plantId === plant.id ? current : createDriverLogDraft(plant.id),
    );
    setPage("driver_logs");
  }

  function updateDriverLogDraft(field, value) {
    setDriverLogDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function saveDriverLog() {
    if (driverLogDraft.plantId === null || !hasDriverLogDraftContent(driverLogDraft)) return;

    const nextEntry = {
      id: `log_${Date.now()}`,
      plantId: driverLogDraft.plantId,
      location: cleanText(driverLogDraft.location),
      truckNumber: cleanText(driverLogDraft.truckNumber),
      driver: cleanText(driverLogDraft.driver),
      source: cleanText(driverLogDraft.source),
      invCode: cleanText(driverLogDraft.invCode),
      savedAt: new Date().toLocaleString(),
    };

    setDriverLogs((current) => [nextEntry, ...current]);
    setDriverLogDraft(createDriverLogDraft(driverLogDraft.plantId));
  }

  function openPlantFromLogPage(plantId) {
    setSelectedPlantId(plantId);
    setPage("cockpit");
  }

  const draftPlant =
    driverLogDraft.plantId === null
      ? null
      : data.plants.find((plant) => plant.id === driverLogDraft.plantId) ?? null;

  return (
    <main className="min-h-screen bg-black font-mono text-[13px] text-white">
      <div
        className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 p-4 md:p-6 xl:p-8"
        style={{ zoom: UI_SCALE }}
      >
        <div className="border border-white/15 bg-white/[0.02] px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-white">Dispatch cockpit</div>
              <div className="mt-1 text-sm text-white/55">
                Live materials, plant risk, and driver assignments
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
                <CliButton active={page === "cockpit"} onClick={() => setPage("cockpit")}>
                  Cockpit
                </CliButton>
                <CliButton
                  active={page === "plant_totals"}
                  onClick={() => {
                    setShowPlantTotals(true);
                    setPage("plant_totals");
                  }}
                >
                  Material Requirements
                </CliButton>
                <CliButton active={page === "material_usage"} onClick={() => setPage("material_usage")}>
                  Material Usage
                </CliButton>
                <CliButton active={page === "drivers"} onClick={() => setPage("drivers")}>
                  Drivers
                </CliButton>
                <CliButton active={page === "driver_logs"} onClick={() => setPage("driver_logs")}>
                  Driver logs
                </CliButton>
                <CliButton onClick={() => void refreshFromDesktop()} disabled={running}>
                  {running ? "Refreshing..." : "Refresh data"}
                </CliButton>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="border border-white/15 px-3 py-2 text-sm text-white/80">
                  <span className="text-white/50">Active plants </span>
                  <span className="font-semibold text-white">{data.summary.activePlants}</span>
                </div>
                <div className="border border-white/15 px-3 py-2 text-sm text-white/80">
                  <span className="text-white/50">Total yardage </span>
                  <span className="font-semibold text-white">
                    {formatNumber(data.summary.totalYardage, 1)}
                  </span>
                </div>
              </div>

              <div className="border border-white/15 px-3 py-2 text-sm text-white/80">
                <div>
                  <span className="text-white/50">Risk plants </span>
                  <span className="font-semibold text-white">{riskPlantCount}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {riskPlants.length > 0 ? (
                    riskPlants.map((plant) => (
                      <div
                        key={plant.id}
                        className="inline-flex items-center gap-1 border border-white/25 px-2 py-1 text-[12px]"
                      >
                        <span>{plant.id}</span>
                        {plant.cementRisk ? (
                          <span className="font-semibold text-rose-400">C</span>
                        ) : null}
                        {plant.flyashRisk ? (
                          <span className="font-semibold text-rose-400">F</span>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <span className="text-white/45">none</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="border border-white/15 px-3 py-2 text-sm text-white/65">
              Updated {new Date(data.meta?.generatedAt ?? Date.now()).toLocaleString()}
            </div>
            {selectedPlant ? (
              <div className="border border-white/15 px-3 py-2 text-sm text-white/65">
                Selected plant {selectedPlant.id}
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {page === "cockpit" ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <DecisionQueueSection
                title="Act now"
                items={actNowDecisions}
                selectedPlantId={selectedPlantId}
                onSelectPlant={setSelectedPlantId}
                emptyLabel="No plants currently need immediate action."
              />
              <DecisionQueueSection
                title="Watch next"
                items={watchDecisions}
                selectedPlantId={selectedPlantId}
                onSelectPlant={setSelectedPlantId}
                emptyLabel="No near-term watch items in the current filter."
              />
            </div>

            <PlantRibbon
              filteredPlants={filteredPlants}
              selectedPlant={selectedPlant}
              setSelectedPlantId={setSelectedPlantId}
              activeOnly={activeOnly}
              setActiveOnly={setActiveOnly}
              search={search}
              setSearch={setSearch}
              selectedRegion={selectedRegion}
              setSelectedRegion={setSelectedRegion}
            />
            <PlantDetailsPanel
              plant={selectedPlant}
              driverLogs={driverLogs}
              driverLogDraft={driverLogDraft}
              driverOptions={driverOptions}
              onDraftChange={updateDriverLogDraft}
              onSaveDriverLog={saveDriverLog}
              onClose={() => setSelectedPlantId(null)}
              onOpenDriverLogPage={openDriverLogForPlant}
            />
          </div>
        ) : page === "plant_totals" ? (
          <PlantTotalsSection
            isOpen={showPlantTotals}
            onToggle={() => setShowPlantTotals((current) => !current)}
            rows={filteredPlants}
          />
        ) : page === "material_usage" ? (
          <MaterialUsageSection rows={filteredPlants} />
        ) : page === "drivers" ? (
          <DriverStatusPanel
            isOpen={showDriverStatus}
            onToggle={() => setShowDriverStatus((current) => !current)}
            drivers={drivers}
            variant="page"
          />
        ) : (
          <DriverLogPage
            plant={draftPlant}
            draft={driverLogDraft}
            driverOptions={driverOptions}
            onDraftChange={updateDriverLogDraft}
            onSave={saveDriverLog}
            logs={driverLogs}
            onOpenPlant={openPlantFromLogPage}
          />
        )}
      </div>
    </main>
  );
}

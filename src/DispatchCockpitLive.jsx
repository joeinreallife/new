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

const LIVE_HEADER_USAGE = {
  cement: { used: 89, total: 189 },
  flyash: { used: 4, total: 10 },
};
const DELIVERED_YARDAGE = 10980;

const LIVE_DISPATCH_PLACEHOLDERS = {
  1: { inboundTrucks: 1, nextEtaMinutes: 22, coverageMinutes: 36, additionalTrucksNeeded: 0 },
  2: { inboundTrucks: 2, nextEtaMinutes: 14, coverageMinutes: 58, additionalTrucksNeeded: 0 },
  3: { inboundTrucks: 1, nextEtaMinutes: 19, coverageMinutes: 34, additionalTrucksNeeded: 0 },
  4: { inboundTrucks: 1, nextEtaMinutes: 17, coverageMinutes: 26, additionalTrucksNeeded: 0 },
  5: { inboundTrucks: 2, nextEtaMinutes: 16, coverageMinutes: 44, additionalTrucksNeeded: 0 },
  6: { inboundTrucks: 1, nextEtaMinutes: 26, coverageMinutes: 12, additionalTrucksNeeded: 2 },
};

const SOURCE_ALLOCATION_DATA = {
  cement: [
    { code: "MCC-07", allocation: 136, dayPicked: 44, nightPicked: 18 },
    { code: "MLB-27", allocation: 124, dayPicked: 39, nightPicked: 16 },
    { code: "CMX-21", allocation: 118, dayPicked: 37, nightPicked: 14 },
    { code: "CMX-12", allocation: 102, dayPicked: 31, nightPicked: 12 },
    { code: "CMX-5", allocation: 96, dayPicked: 28, nightPicked: 10 },
    { code: "CPC-89", allocation: 148, dayPicked: 46, nightPicked: 19 },
    { code: "CPC-25", allocation: 111, dayPicked: 34, nightPicked: 13 },
    { code: "LEHIGH-28", allocation: 132, dayPicked: 42, nightPicked: 17 },
    { code: "CPC-23", allocation: 108, dayPicked: 32, nightPicked: 12 },
    { code: "CPC-116", allocation: 126, dayPicked: 40, nightPicked: 15 },
    { code: "CPC-23-1L", allocation: 88, dayPicked: 24, nightPicked: 9 },
    { code: "CPC-89-1L", allocation: 92, dayPicked: 27, nightPicked: 11 },
    { code: "NATL-17", allocation: 116, dayPicked: 36, nightPicked: 14 },
    { code: "LEHIGH-80", allocation: 138, dayPicked: 45, nightPicked: 18 },
  ],
  flyash: [
    { code: "ECO-05", allocation: 84, dayPicked: 28, nightPicked: 9 },
    { code: "SRMG-38", allocation: 72, dayPicked: 24, nightPicked: 8 },
  ],
};
const CEMENT_SOURCE_CODE_LIST = SOURCE_ALLOCATION_DATA.cement.map((row) => row.code);
const DISPATCH_CEMENT_SOURCE_CODE_LIST = CEMENT_SOURCE_CODE_LIST.filter(
  (code) => !code.endsWith("-1L"),
);
const FLYASH_SOURCE_CODE_LIST = SOURCE_ALLOCATION_DATA.flyash.map((row) => row.code);
const DRIVER_LOG_SOURCE_OPTIONS = [
  ...DISPATCH_CEMENT_SOURCE_CODE_LIST,
  ...FLYASH_SOURCE_CODE_LIST,
];
const DRIVER_LOG_INV_CODE_OPTIONS = ["1", "2", "142"];
const CEMENT_SOURCE_CODES = new Set(CEMENT_SOURCE_CODE_LIST);
const FLYASH_SOURCE_CODES = new Set(FLYASH_SOURCE_CODE_LIST);
const DISPATCH_SOURCE_CODES = new Set(DRIVER_LOG_SOURCE_OPTIONS);
const SOURCE_CODE_NUMERIC_ALIASES = {
  4: "MCC-04",
  10: "CPC-10",
};
const SOURCE_ALLOCATION_RECORDS = [
  ...SOURCE_ALLOCATION_DATA.cement.map((row) => ({ ...row, materialKey: "cement" })),
  ...SOURCE_ALLOCATION_DATA.flyash.map((row) => ({ ...row, materialKey: "flyash" })),
];
const SOURCE_ALLOCATION_BY_CODE = new Map(
  SOURCE_ALLOCATION_RECORDS.map((row) => [row.code, row]),
);

const DRIVER_GROUP_ORDER = ["rialto", "off_site", "nevada"];
const DRIVER_GROUP_LABELS = {
  rialto: "Rialto",
  off_site: "Off-Site",
  nevada: "Nevada",
};
const DRIVER_SHIFT_ORDER = ["day", "night"];
const DRIVER_SHIFT_LABELS = {
  day: "Day shift",
  night: "Night shift",
};
const PLANT_SORT_OPTIONS = [
  { key: "plant_id", label: "Plant ID" },
  { key: "urgency", label: "Urgency" },
  { key: "start_time", label: "Start time" },
  { key: "area", label: "Area" },
];

const DISPATCH_NOTES = [
  {
    id: "warning-threshold-replenishment-trucks",
    title: "Assigned replenishment truck warning",
    body: "Trigger a warning when the number of assigned replenishment trucks reaches the warning threshold relative to on-hand inventory.",
  },
];

const UI_SCALE = 0.92;

const DEMO_DRIVERS = [
  { id: "d01", name: "driver_01", status: "available", location: "rialto_yard", shift: "day" },
  { id: "d02", name: "driver_02", status: "to_source", location: "lucerne_valley", shift: "day" },
  { id: "d03", name: "driver_03", status: "at_plant", location: "plant_02", shift: "day" },
  { id: "d04", name: "driver_04", status: "returning", location: "i-15_sb", shift: "day" },
  { id: "d05", name: "driver_05", status: "off_shift", location: "-", shift: "day" },
  { id: "d06", name: "driver_06", status: "available", location: "fontana_yard", shift: "day" },
  { id: "d07", name: "driver_07", status: "to_plant", location: "plant_05", shift: "day" },
  { id: "d08", name: "driver_08", status: "break", location: "barstow", shift: "day" },
];

const DRIVER_LOG_STORAGE_KEY = "dispatch-cockpit-driver-logs-v1";
const END_OF_SHIFT_NOTES_STORAGE_KEY = "dispatch-cockpit-end-of-shift-notes-v1";

function createDriverLogDraft(plantId = null, location = "") {
  return {
    plantId,
    location,
    truckNumber: "",
    driver: "",
    source: "",
    invCode: "",
  };
}

function extractSourceCodeNumber(code) {
  const match = cleanText(code).toUpperCase().match(/(\d+)(?!.*\d)/);
  return match ? String(Number(match[1])) : null;
}

function findSourceCodeByNumber(numberText, sourceCodes) {
  const normalizedNumber = cleanText(numberText);
  if (!normalizedNumber || !/^\d+$/.test(normalizedNumber)) return null;

  const numericKey = String(Number(normalizedNumber));
  return (
    sourceCodes.find((code) => extractSourceCodeNumber(code) === numericKey) ?? null
  );
}

function normalizeSourceCode(source, preferredMaterialKey = "cement") {
  const normalized = cleanText(source).toUpperCase();
  if (!normalized) return "";

  if (normalized.endsWith("-1L")) {
    const baseCode = normalized.replace(/-1L$/, "");
    if (DISPATCH_SOURCE_CODES.has(baseCode)) return baseCode;
  }

  if (DISPATCH_SOURCE_CODES.has(normalized)) return normalized;
  if (CEMENT_SOURCE_CODES.has(normalized)) return normalized.replace(/-1L$/, "");
  if (FLYASH_SOURCE_CODES.has(normalized)) return normalized;

  const compactMatch =
    DRIVER_LOG_SOURCE_OPTIONS.find(
      (code) => code.replace(/[^A-Z0-9]/g, "") === normalized.replace(/[^A-Z0-9]/g, ""),
    ) ?? null;
  if (compactMatch) return compactMatch;

  const numericAlias = SOURCE_CODE_NUMERIC_ALIASES[String(Number(normalized))];
  if (numericAlias) return numericAlias;

  const preferredCodes =
    preferredMaterialKey === "flyash" ? FLYASH_SOURCE_CODE_LIST : DISPATCH_CEMENT_SOURCE_CODE_LIST;

  return (
    findSourceCodeByNumber(normalized, preferredCodes) ??
    findSourceCodeByNumber(normalized, DRIVER_LOG_SOURCE_OPTIONS) ??
    normalized
  );
}

function normalizeStoredDriverLogEntry(entry) {
  return {
    ...entry,
    plantId: Number.isInteger(Number(entry?.plantId)) ? Number(entry.plantId) : null,
    location: cleanText(entry?.location),
    truckNumber: cleanText(entry?.truckNumber),
    driver: cleanText(entry?.driver),
    source: normalizeSourceCode(entry?.source),
    invCode: cleanText(entry?.invCode),
    savedAt: cleanText(entry?.savedAt),
    updatedAt: cleanText(entry?.updatedAt),
  };
}

function createDriverLogDraftFromEntry(entry) {
  return {
    plantId: Number.isInteger(Number(entry?.plantId)) ? Number(entry.plantId) : null,
    location: cleanText(entry?.location),
    truckNumber: cleanText(entry?.truckNumber),
    driver: cleanText(entry?.driver),
    source: normalizeSourceCode(entry?.source),
    invCode: cleanText(entry?.invCode),
  };
}

function loadDriverLogs() {
  try {
    const raw = window.localStorage.getItem(DRIVER_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeStoredDriverLogEntry) : [];
  } catch {
    return [];
  }
}

function loadEndOfShiftNotes() {
  try {
    const raw = window.localStorage.getItem(END_OF_SHIFT_NOTES_STORAGE_KEY);
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

function createEmptySourceRules() {
  return {
    loaded: false,
    sheetName: "none",
    byPlant: new Map(),
    bySource: new Map(),
  };
}

function parseSheetDateValue(sheetName) {
  const match = cleanText(sheetName).match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const value = new Date(year, month - 1, day).getTime();
  return Number.isFinite(value) ? value : null;
}

function pickLatestSourceRuleSheet(workbook) {
  return [...workbook.SheetNames].sort((left, right) => {
    const leftValue = parseSheetDateValue(left);
    const rightValue = parseSheetDateValue(right);

    if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
      return rightValue - leftValue;
    }

    if (leftValue !== null && rightValue === null) return -1;
    if (leftValue === null && rightValue !== null) return 1;
    return right.localeCompare(left);
  })[0];
}

function normalizeSourceSheetCode(label, materialKey) {
  const normalizedLabel = cleanText(label);
  const upper = normalizedLabel.toUpperCase();

  if (!upper) return "";

  if (materialKey === "flyash") {
    if (upper.includes("ECO")) return "ECO-05";
    if (upper.includes("SRMG")) return "SRMG-38";
  }

  const numericPrefix = upper.match(/^(\d{1,3})\b/);
  if (numericPrefix) {
    const numericKey = String(Number(numericPrefix[1]));
    const matchingKnownCode =
      DRIVER_LOG_SOURCE_OPTIONS.find((code) => extractSourceCodeNumber(code) === numericKey) ?? null;
    if (matchingKnownCode) return matchingKnownCode;

    if (upper.includes("MITSUBISHI")) return `MCC-${numericPrefix[1].padStart(2, "0")}`;
    if (upper.includes("CAL PORTLAND")) return `CPC-${numericPrefix[1].padStart(2, "0")}`;
    if (upper.includes("CEMEX")) return `CMX-${numericPrefix[1].padStart(2, "0")}`;
    if (upper.includes("NATIONAL")) return `NATL-${numericPrefix[1].padStart(2, "0")}`;
    if (upper.includes("TEHACHAPI")) return `LEHIGH-${numericPrefix[1].padStart(2, "0")}`;
  }

  return upper;
}

function parseSourceToPlantWorkbook(sourceRulesBuffer) {
  if (!sourceRulesBuffer) return createEmptySourceRules();

  const workbook = XLSX.read(sourceRulesBuffer, { type: "array" });
  const sheetName = pickLatestSourceRuleSheet(workbook);
  const rows = getSheetRows(workbook, sheetName, 0);
  const byPlant = new Map();
  const bySource = new Map();
  let materialKey = "cement";

  rows.forEach((row) => {
    const firstCell = cleanText(row[0]);
    const upper = firstCell.toUpperCase();

    if (!firstCell) return;
    if (upper.includes("FLY-ASH SOURCE TO PLANT")) {
      materialKey = "flyash";
      return;
    }
    if (upper.includes("CEMENT SOURCE TO PLANT")) {
      materialKey = "cement";
      return;
    }
    if (upper === "SOURCE:" || upper === "PLANT:") return;

    const plantIds = row
      .slice(2)
      .map((value) => toInteger(value))
      .filter((value) => Number.isInteger(value));

    if (plantIds.length === 0) return;

    const sourceCode = normalizeSourceSheetCode(firstCell, materialKey);
    if (!sourceCode) return;

    if (!bySource.has(sourceCode)) {
      bySource.set(sourceCode, {
        source: sourceCode,
        materialKey,
        plantIds: [],
        rawLabel: firstCell,
      });
    }

    const sourceEntry = bySource.get(sourceCode);
    sourceEntry.materialKey = materialKey;
    sourceEntry.rawLabel = firstCell;
    sourceEntry.plantIds = uniqueCleanValues(
      [...sourceEntry.plantIds.map(String), ...plantIds.map(String)],
    ).map((value) => Number(value));

    plantIds.forEach((plantId) => {
      if (!byPlant.has(plantId)) {
        byPlant.set(plantId, {
          cement: [],
          flyash: [],
        });
      }

      const plantEntry = byPlant.get(plantId);
      if (!plantEntry[materialKey].includes(sourceCode)) {
        plantEntry[materialKey].push(sourceCode);
      }
    });
  });

  return {
    loaded: byPlant.size > 0,
    sheetName,
    byPlant,
    bySource,
  };
}

function getFallbackSourceAllocationSnapshot(sourceCode, materialKey = "cement") {
  const numericKey = Number(extractSourceCodeNumber(sourceCode) || 0);
  const allocation = materialKey === "flyash" ? 72 + (numericKey % 4) * 8 : 96 + (numericKey % 6) * 10;
  const dayPicked = Math.floor(allocation * 0.32);
  const nightPicked = Math.floor(allocation * 0.14);
  return {
    code: sourceCode,
    materialKey,
    allocation,
    dayPicked,
    nightPicked,
    pickedUp: dayPicked + nightPicked,
    left: Math.max(0, allocation - dayPicked - nightPicked),
    isFallback: true,
  };
}

function getSourceAllocationSnapshot(sourceCode, materialKey = null) {
  const normalizedSource = normalizeSourceCode(sourceCode, materialKey || "cement");
  const known = SOURCE_ALLOCATION_BY_CODE.get(normalizedSource);
  if (known) {
    return {
      ...known,
      pickedUp: known.dayPicked + known.nightPicked,
      left: Math.max(0, known.allocation - known.dayPicked - known.nightPicked),
      isFallback: false,
    };
  }

  return getFallbackSourceAllocationSnapshot(normalizedSource, materialKey || getSourceMaterialKey(normalizedSource) || "cement");
}

function driverLogLocationForPlant(plant) {
  return plant ? `Plant ${plant.id}` : "";
}

function getLiveDispatchSnapshot(plant) {
  const fallback = {
    inboundTrucks: (plant.id % 3) + 1,
    nextEtaMinutes: 12 + (plant.id % 5) * 4,
    coverageMinutes: 20 + (plant.id % 4) * 8,
    additionalTrucksNeeded: plant.id % 6 === 0 ? 1 : 0,
  };

  const snapshot = LIVE_DISPATCH_PLACEHOLDERS[plant.id] ?? fallback;

  return {
    ...snapshot,
    nextEtaLabel: `${snapshot.nextEtaMinutes} min`,
    coverageLabel: `${snapshot.coverageMinutes} min`,
    inboundLabel: `${snapshot.inboundTrucks} truck${snapshot.inboundTrucks === 1 ? "" : "s"}`,
  };
}

function getDriverGroupKey(driver) {
  const location = cleanText(driver?.location).toLowerCase();

  if (location.includes("rialto")) return "rialto";
  if (
    location.includes("nevada") ||
    location.includes("vegas") ||
    location.includes("henderson")
  ) {
    return "nevada";
  }

  return "off_site";
}

function getDriverShiftKey(driver) {
  return driver?.shift === "night" ? "night" : "day";
}

function getPlantDriverGroupKey(plant) {
  const region = cleanText(plant?.region);
  if (region === "nevada") return "nevada";
  if (region === "inland empire") return "rialto";
  return "off_site";
}

function getPlantDriverGroupLabel(plant) {
  return DRIVER_GROUP_LABELS[getPlantDriverGroupKey(plant)] ?? "Off-Site";
}

function parsePlantSearchId(value) {
  const normalized = cleanText(value).toLowerCase().replace(/[_-]+/g, " ");
  if (!normalized) return null;

  const match = normalized.match(/^(?:plant|plt)?\s*0*(\d{1,3})$/);
  if (!match) return null;

  const plantId = Number(match[1]);
  return Number.isInteger(plantId) ? plantId : null;
}

function locationMatchesPlantId(location, plantId) {
  if (!Number.isInteger(plantId)) return false;

  const normalized = cleanText(location).toLowerCase().replace(/[_-]+/g, " ");
  return new RegExp(`\\bplant\\s*0*${plantId}\\b`).test(normalized);
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

function getPrimaryPlantMaterialKey(plant) {
  return materialRowsForDisplay(plant.materials)[0]?.key ?? "cement";
}

function getPrimaryPlantMaterialLabel(plant) {
  const materialKey = getPrimaryPlantMaterialKey(plant);
  return MATERIAL_USAGE_LABELS[materialKey] ?? "Cement";
}

function getPlaceholderSourceCode(plant) {
  const primaryMaterial = getPrimaryPlantMaterialKey(plant);
  const sourceCodes =
    primaryMaterial === "flyash" ? FLYASH_SOURCE_CODE_LIST : DISPATCH_CEMENT_SOURCE_CODE_LIST;

  if (sourceCodes.length === 0) return "-";

  return sourceCodes[(Math.max(plant.id, 1) - 1) % sourceCodes.length];
}

function getAllowedSourcesForPlantMaterial(sourceRules, plant, materialKey) {
  if (!plant) {
    return materialKey === "flyash" ? FLYASH_SOURCE_CODE_LIST : DISPATCH_CEMENT_SOURCE_CODE_LIST;
  }

  const ruleEntry = sourceRules?.byPlant?.get?.(plant.id) ?? null;
  if (ruleEntry?.[materialKey]?.length) return ruleEntry[materialKey];

  return materialKey === "flyash" ? FLYASH_SOURCE_CODE_LIST : DISPATCH_CEMENT_SOURCE_CODE_LIST;
}

function getAllowedSourceOptionsForPlant(sourceRules, plant, currentSource = "") {
  if (!plant) {
    return uniqueCleanValues(
      [...DRIVER_LOG_SOURCE_OPTIONS, normalizeSourceCode(currentSource)].filter(Boolean),
    );
  }

  const allowedSources = [];

  const hasCement = hasMaterialSlotData(plant.materials?.cement);
  const hasFlyash = hasMaterialSlotData(plant.materials?.flyash);

  if (hasCement || !hasFlyash) allowedSources.push(...getAllowedSourcesForPlantMaterial(sourceRules, plant, "cement"));
  if (hasFlyash) allowedSources.push(...getAllowedSourcesForPlantMaterial(sourceRules, plant, "flyash"));
  if (!hasCement && !hasFlyash) {
    allowedSources.push(...getAllowedSourcesForPlantMaterial(sourceRules, plant, "cement"));
    allowedSources.push(...getAllowedSourcesForPlantMaterial(sourceRules, plant, "flyash"));
  }

  const normalizedCurrent = normalizeSourceCode(currentSource, getPrimaryPlantMaterialKey(plant));
  const fallbackOptions = allowedSources.length > 0 ? allowedSources : DRIVER_LOG_SOURCE_OPTIONS;
  return uniqueCleanValues([...fallbackOptions, normalizedCurrent].filter(Boolean));
}

function getSourceMaterialKey(sourceCode) {
  const normalized = normalizeSourceCode(sourceCode);
  if (!normalized) return null;
  if (FLYASH_SOURCE_CODES.has(normalized)) return "flyash";
  if (CEMENT_SOURCE_CODES.has(normalized) || /^(MCC|MLB|CMX|CPC|NATL|LEHIGH)-/.test(normalized)) {
    return "cement";
  }
  return null;
}

function isSourceAllowedForPlant(sourceRules, plantId, sourceCode) {
  if (!sourceRules?.loaded) return true;

  const normalizedSource = normalizeSourceCode(sourceCode);
  const materialKey = getSourceMaterialKey(normalizedSource);
  const plantRules = sourceRules.byPlant.get(Number(plantId));

  if (!normalizedSource || !materialKey || !plantRules) return true;
  return plantRules[materialKey]?.includes(normalizedSource) ?? false;
}

function getPlantSourceLabel(plant, sourceRules = null) {
  const allowedSources = getAllowedSourceOptionsForPlant(sourceRules, plant);
  if (allowedSources.length > 0) return allowedSources[0];
  return getPlaceholderSourceCode(plant);
}

function buildSourceRecommendation(plant, materialKey, sourceRules) {
  if (!plant || !["cement", "flyash"].includes(materialKey)) {
    return {
      materialKey,
      bestSource: null,
      allowedSources: [],
      candidates: [],
      blocked: true,
      blockedReason: "No source recommendation available.",
      summaryLabel: "No source recommendation",
    };
  }

  const materialLabel = MATERIAL_USAGE_LABELS[materialKey] ?? materialKey;
  const allowedSources = getAllowedSourcesForPlantMaterial(sourceRules, plant, materialKey);
  const candidates = allowedSources
    .map((sourceCode) => getSourceAllocationSnapshot(sourceCode, materialKey))
    .sort((left, right) => {
      const leftAvailable = left.left > 0 ? 1 : 0;
      const rightAvailable = right.left > 0 ? 1 : 0;
      if (rightAvailable !== leftAvailable) return rightAvailable - leftAvailable;
      if (right.left !== left.left) return right.left - left.left;
      if (right.allocation !== left.allocation) return right.allocation - left.allocation;
      return left.code.localeCompare(right.code);
    });

  const bestSource = candidates[0] ?? null;
  if (allowedSources.length === 0) {
    return {
      materialKey,
      bestSource: null,
      allowedSources,
      candidates,
      blocked: true,
      blockedReason: `No allowed ${materialLabel.toLowerCase()} source is configured for plant ${plant.id}.`,
      summaryLabel: `No valid ${materialLabel.toLowerCase()} source`,
    };
  }

  if (!bestSource || bestSource.left <= 0) {
    return {
      materialKey,
      bestSource,
      allowedSources,
      candidates,
      blocked: true,
      blockedReason: `All allowed ${materialLabel.toLowerCase()} sources are out of allocation.`,
      summaryLabel: `No ${materialLabel.toLowerCase()} source left`,
    };
  }

  const alternate = candidates.find((candidate) => candidate.code !== bestSource.code && candidate.left > 0) ?? null;

  return {
    materialKey,
    bestSource,
    alternate,
    allowedSources,
    candidates,
    blocked: false,
    blockedReason: "",
    summaryLabel: `${bestSource.code} (${formatNumber(bestSource.left, 0)} left)`,
  };
}

function getMaterialLabelForLogSource(source, plant) {
  const normalizedSource = normalizeSourceCode(source, getPrimaryPlantMaterialKey(plant));
  if (FLYASH_SOURCE_CODES.has(normalizedSource)) return MATERIAL_USAGE_LABELS.flyash;
  if (CEMENT_SOURCE_CODES.has(normalizedSource)) return MATERIAL_USAGE_LABELS.cement;
  return getPrimaryPlantMaterialLabel(plant);
}

function buildInboundQueueRows(plant, drivers, driverLogs = [], sourceRules = null) {
  const liveDispatch = getLiveDispatchSnapshot(plant);
  const driverGroup = getPlantDriverGroupKey(plant);
  const primaryMaterialKey = getPrimaryPlantMaterialKey(plant);
  const sourceLabel = getPlantSourceLabel(plant, sourceRules);
  const materialLabel = getPrimaryPlantMaterialLabel(plant);
  const plantLogs = driverLogs.filter((entry) => Number(entry.plantId) === Number(plant.id));

  if (plantLogs.length > 0) {
    return plantLogs.map((entry, index) => ({
      id: entry.id,
      truck: entry.truckNumber || `TBD-${plant.id}-${index + 1}`,
      driver: entry.driver || "Unassigned",
      source: normalizeSourceCode(entry.source, primaryMaterialKey) || sourceLabel,
      eta: `${Math.max(8, liveDispatch.nextEtaMinutes - 4) + index * 7} min`,
      material: getMaterialLabelForLogSource(entry.source, plant),
    }));
  }

  const matchingDrivers = drivers.filter(
    (driver) => getDriverShiftKey(driver) === "day" && getDriverGroupKey(driver) === driverGroup,
  );
  const rowCount = Math.max(liveDispatch.inboundTrucks, 1);

  return Array.from({ length: rowCount }, (_, index) => {
    const driver = matchingDrivers[index] ?? null;
    return {
      id: `${plant.id}_inbound_${index + 1}`,
      truck: driver?.assignedTruck || `TBD-${plant.id}-${index + 1}`,
      driver: driver?.name || "Unassigned",
      source: sourceLabel,
      eta: `${liveDispatch.nextEtaMinutes + index * 8} min`,
      material: materialLabel,
    };
  });
}

function compareMaterialPriority(left, right) {
  const diffGap = (left.diff ?? Number.POSITIVE_INFINITY) - (right.diff ?? Number.POSITIVE_INFINITY);
  if (diffGap !== 0) return diffGap;
  return (right.requiredLoads ?? 0) - (left.requiredLoads ?? 0);
}

function comparePlantsForSort(left, right, sortKey, sourceRules = null) {
  if (sortKey === "urgency") {
    const leftDecision = buildPlantDecision(left, sourceRules);
    const rightDecision = buildPlantDecision(right, sourceRules);
    const scoreGap = (rightDecision?.score ?? -1) - (leftDecision?.score ?? -1);
    if (scoreGap !== 0) return scoreGap;
    return left.id - right.id;
  }

  if (sortKey === "start_time") {
    const timeGap = parseClockMinutes(getPlantStartTime(left)) - parseClockMinutes(getPlantStartTime(right));
    if (timeGap !== 0) return timeGap;
    return left.id - right.id;
  }

  if (sortKey === "area") {
    const areaGap = formatRegionLabel(left.region).localeCompare(formatRegionLabel(right.region));
    if (areaGap !== 0) return areaGap;
    return left.id - right.id;
  }

  return left.id - right.id;
}

function buildPlantDecision(plant, sourceRules = null) {
  const rows = materialRowsForDisplay(plant.materials);
  const liveDispatch = getLiveDispatchSnapshot(plant);
  const urgentRows = rows
    .filter((row) => row.diff !== null && row.diff < 0)
    .sort(compareMaterialPriority);

  if (urgentRows.length > 0) {
    const row = urgentRows[0];
    const materialLabel = MATERIAL_USAGE_LABELS[row.key] ?? row.label;
    const sourceRecommendation = buildSourceRecommendation(plant, row.key, sourceRules);
    const actionLabel = sourceRecommendation.bestSource && !sourceRecommendation.blocked
      ? `Send 1 ${materialLabel} truck from ${sourceRecommendation.bestSource.code} to Plant ${plant.id}`
      : `Send ${materialLabel} to Plant ${plant.id}`;
    const sourceReason = sourceRecommendation.bestSource && !sourceRecommendation.blocked
      ? `Best source ${sourceRecommendation.bestSource.code} | ${formatNumber(sourceRecommendation.bestSource.left, 0)} left | ${sourceRecommendation.allowedSources.length} valid sources`
      : sourceRecommendation.blockedReason;
    return {
      plantId: plant.id,
      plant,
      mode: "act_now",
      severity: row.diff <= -1 || (row.requiredLoads ?? 0) > 0 ? "critical" : "attention",
      materialKey: row.key,
      materialLabel,
      actionLabel,
      reason: `${sourceReason} | diff ${formatDiff(row.diff)} | req ${formatNumber(row.requiredLoads, 2)}`,
      support:
        liveDispatch.additionalTrucksNeeded > 0
          ? `Need ${liveDispatch.additionalTrucksNeeded} more ${materialLabel.toLowerCase()} trucks | next ETA ${liveDispatch.nextEtaLabel} | coverage ${liveDispatch.coverageLabel}${sourceRecommendation.alternate ? ` | backup ${sourceRecommendation.alternate.code}` : ""}`
          : `${liveDispatch.inboundLabel} inbound | next ETA ${liveDispatch.nextEtaLabel} | coverage ${liveDispatch.coverageLabel}${sourceRecommendation.alternate ? ` | backup ${sourceRecommendation.alternate.code}` : ""}`,
      byTime: cleanText(row.time) || getPlantStartTime(plant),
      score:
        Math.abs(row.diff ?? 0) * 100 +
        (row.requiredLoads ?? 0) * 10 +
        (sourceRecommendation.blocked ? 60 : 0) -
        (sourceRecommendation.bestSource?.left ?? 0) * 0.01,
      liveDispatch,
      sourceRecommendation,
    };
  }

  const watchRows = rows
    .filter((row) => row.diff !== null && row.diff >= 0 && row.diff <= 2)
    .sort(compareMaterialPriority);

  if (watchRows.length > 0) {
    const row = watchRows[0];
    const materialLabel = MATERIAL_USAGE_LABELS[row.key] ?? row.label;
    const sourceRecommendation = buildSourceRecommendation(plant, row.key, sourceRules);
    const actionLabel = sourceRecommendation.bestSource && !sourceRecommendation.blocked
      ? `Watch ${materialLabel} at Plant ${plant.id} | next source ${sourceRecommendation.bestSource.code}`
      : `Watch ${materialLabel} at Plant ${plant.id}`;
    const sourceReason = sourceRecommendation.bestSource && !sourceRecommendation.blocked
      ? `Next source ${sourceRecommendation.bestSource.code} | ${formatNumber(sourceRecommendation.bestSource.left, 0)} left`
      : sourceRecommendation.blockedReason;
    return {
      plantId: plant.id,
      plant,
      mode: "watch",
      severity: row.diff <= 0.75 ? "tight" : "watch",
      materialKey: row.key,
      materialLabel,
      actionLabel,
      reason: `${sourceReason} | diff ${formatDiff(row.diff)} | on hand ${formatNumber(row.onHand, 2)}`,
      support:
        liveDispatch.additionalTrucksNeeded > 0
          ? `Need ${liveDispatch.additionalTrucksNeeded} more ${materialLabel.toLowerCase()} trucks soon | next ETA ${liveDispatch.nextEtaLabel} | coverage ${liveDispatch.coverageLabel}${sourceRecommendation.alternate ? ` | backup ${sourceRecommendation.alternate.code}` : ""}`
          : `${liveDispatch.inboundLabel} inbound | next ETA ${liveDispatch.nextEtaLabel} | coverage ${liveDispatch.coverageLabel}${sourceRecommendation.alternate ? ` | backup ${sourceRecommendation.alternate.code}` : ""}`,
      byTime: cleanText(row.time) || getPlantStartTime(plant),
      score:
        (2 - (row.diff ?? 0)) * 50 +
        (row.requiredLoads ?? 0) * 10 +
        (sourceRecommendation.blocked ? 30 : 0) -
        (sourceRecommendation.bestSource?.left ?? 0) * 0.01,
      liveDispatch,
      sourceRecommendation,
    };
  }

  return null;
}

function buildDispatchExceptions(plants, driverLogs, sourceRules) {
  const exceptions = [];
  const logsByPlant = new Map();

  driverLogs.forEach((entry) => {
    const plantId = Number(entry.plantId);
    if (!Number.isInteger(plantId)) return;
    if (!logsByPlant.has(plantId)) logsByPlant.set(plantId, []);
    logsByPlant.get(plantId).push(entry);

    if (!cleanText(entry.source)) {
      exceptions.push({
        id: `missing_source_${entry.id}`,
        severity: "critical",
        title: `Plant ${plantId} log missing source`,
        detail: `Truck ${entry.truckNumber || "-"} / driver ${entry.driver || "-"} has no source assigned.`,
        plantId,
        logId: entry.id,
      });
    }

    if (!cleanText(entry.invCode)) {
      exceptions.push({
        id: `missing_inv_${entry.id}`,
        severity: "attention",
        title: `Plant ${plantId} log missing INV code`,
        detail: `Truck ${entry.truckNumber || "-"} / driver ${entry.driver || "-"} is missing an INV code.`,
        plantId,
        logId: entry.id,
      });
    }

    if (!cleanText(entry.truckNumber)) {
      exceptions.push({
        id: `missing_truck_${entry.id}`,
        severity: "attention",
        title: `Plant ${plantId} log missing truck`,
        detail: `Driver ${entry.driver || "-"} has no truck number on the saved log.`,
        plantId,
        logId: entry.id,
      });
    }

    if (!cleanText(entry.driver)) {
      exceptions.push({
        id: `missing_driver_${entry.id}`,
        severity: "attention",
        title: `Plant ${plantId} log missing driver`,
        detail: `Truck ${entry.truckNumber || "-"} has no driver name on the saved log.`,
        plantId,
        logId: entry.id,
      });
    }

    if (cleanText(entry.source) && !isSourceAllowedForPlant(sourceRules, plantId, entry.source)) {
      exceptions.push({
        id: `invalid_source_${entry.id}`,
        severity: "critical",
        title: `Plant ${plantId} has invalid source ${entry.source}`,
        detail: `Source ${entry.source} is not allowed for plant ${plantId} based on the source-to-plant sheet.`,
        plantId,
        logId: entry.id,
      });
    }
  });

  const truckGroups = new Map();
  const driverGroups = new Map();

  driverLogs.forEach((entry) => {
    const truck = cleanText(entry.truckNumber);
    const driver = cleanText(entry.driver).toLowerCase();
    if (truck) {
      if (!truckGroups.has(truck)) truckGroups.set(truck, []);
      truckGroups.get(truck).push(entry);
    }
    if (driver) {
      if (!driverGroups.has(driver)) driverGroups.set(driver, []);
      driverGroups.get(driver).push(entry);
    }
  });

  truckGroups.forEach((entries, truck) => {
    const plantIds = uniqueCleanValues(entries.map((entry) => String(entry.plantId)));
    if (entries.length > 1 && plantIds.length > 1) {
      exceptions.push({
        id: `duplicate_truck_${truck}`,
        severity: "attention",
        title: `Review duplicate truck ${truck}`,
        detail: `Truck ${truck} appears on multiple plant logs: ${plantIds.join(", ")}.`,
        plantId: Number(entries[0]?.plantId),
        logId: entries[0]?.id ?? null,
        relatedLogIds: entries.map((entry) => entry.id),
      });
    }
  });

  driverGroups.forEach((entries, driverKey) => {
    const plantIds = uniqueCleanValues(entries.map((entry) => String(entry.plantId)));
    const driverLabel = entries[0]?.driver || driverKey;
    if (entries.length > 1 && plantIds.length > 1) {
      exceptions.push({
        id: `duplicate_driver_${driverKey}`,
        severity: "attention",
        title: `Review duplicate driver ${driverLabel}`,
        detail: `${driverLabel} appears on multiple plant logs: ${plantIds.join(", ")}.`,
        plantId: Number(entries[0]?.plantId),
        logId: entries[0]?.id ?? null,
        relatedLogIds: entries.map((entry) => entry.id),
      });
    }
  });

  plants.forEach((plant) => {
    const riskStatus = getPlantRiskStatus(plant);
    const plantLogs = logsByPlant.get(plant.id) ?? [];

    if (riskStatus.hasRisk && plantLogs.length === 0) {
      exceptions.push({
        id: `risk_no_inbound_${plant.id}`,
        severity: "critical",
        title: `Plant ${plant.id} has risk with no inbound logged`,
        detail: `Plant ${plant.id} is currently short on ${formatRiskFlags(riskStatus).join(" / ")} and has no inbound dispatch log yet.`,
        plantId: plant.id,
      });
    }

    const urgentMaterialRow = materialRowsForDisplay(plant.materials)
      .filter((row) => row.diff !== null && row.diff < 0)
      .sort(compareMaterialPriority)[0] ?? null;

    if (urgentMaterialRow && ["cement", "flyash"].includes(urgentMaterialRow.key)) {
      const recommendation = buildSourceRecommendation(plant, urgentMaterialRow.key, sourceRules);
      if (recommendation.blocked) {
        exceptions.push({
          id: `source_blocked_${plant.id}_${urgentMaterialRow.key}`,
          severity: "critical",
          title: `Plant ${plant.id} has no valid ${MATERIAL_USAGE_LABELS[urgentMaterialRow.key].toLowerCase()} source`,
          detail: recommendation.blockedReason,
          plantId: plant.id,
        });
      }
    }
  });

  return exceptions.sort((left, right) => {
    const severityWeight = { critical: 0, attention: 1, info: 2 };
    const leftWeight = severityWeight[left.severity] ?? 3;
    const rightWeight = severityWeight[right.severity] ?? 3;
    if (leftWeight !== rightWeight) return leftWeight - rightWeight;
    if ((left.plantId ?? 9999) !== (right.plantId ?? 9999)) return (left.plantId ?? 9999) - (right.plantId ?? 9999);
    return left.title.localeCompare(right.title);
  });
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

function buildAggDriverRows(aggBuffer, { shift = "day", idPrefix = "agg", fallbackRows = [] } = {}) {
  if (!aggBuffer) return fallbackRows;

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
    return fallbackRows;
  }

  const records = rowsToObjects(rows, headerIndex)
    .map((row, index) => ({
      id: `${idPrefix}_${index + 1}`,
      name: cleanText(row.Name) || `driver_${cleanText(row.Driver) || index + 1}`,
      status: `${formatClockLabel(row.Start)} ${cleanText(row.Type) || "truck"}`.trim(),
      location:
        cleanText(row["Truck Location Description"]) ||
        cleanText(row["Loc."]) ||
        "unassigned",
      sortStartMinutes: parseClockMinutes(row.Start),
      assignedTruck: cleanText(row["Assign Tr"]) || cleanText(row["Temp Tr"]),
      driverCode: cleanText(row.Driver),
      shift,
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
      shift: row.shift,
    }));

  return records.length > 0 ? records : fallbackRows;
}

function Metric({ label, value }) {
  return (
    <div className="border border-white/15 bg-white/[0.02] px-3 py-2">
      <div className="text-[11px] text-white/72">{label}</div>
      <div className="mt-1 text-[14px] font-medium text-white">{value}</div>
    </div>
  );
}

function CliButton({ children, onClick, disabled = false, active = false, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`border px-3 py-2 text-[11px] font-medium transition disabled:opacity-40 ${
        active
          ? "border-white/40 bg-white/[0.1] text-white"
          : "border-white/15 bg-white/[0.03] text-white/90 hover:bg-white/[0.06]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function CliSection({ title, children, right, className = "", headerClassName = "" }) {
  return (
    <section className={`border border-white/15 bg-black p-4 ${className}`}>
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${headerClassName}`}>
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
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-white">
        <div className="border border-white/10 bg-white/[0.02] px-2 py-2">
          <div className="text-white/45">Inbound</div>
          <div className="mt-1 font-semibold">{item.liveDispatch.inboundLabel}</div>
        </div>
        <div className="border border-white/10 bg-white/[0.02] px-2 py-2">
          <div className="text-white/45">Next ETA</div>
          <div className="mt-1 font-semibold">{item.liveDispatch.nextEtaLabel}</div>
        </div>
        <div className="border border-white/10 bg-white/[0.02] px-2 py-2">
          <div className="text-white/45">Coverage</div>
          <div className="mt-1 font-semibold">{item.liveDispatch.coverageLabel}</div>
        </div>
      </div>
      {item.liveDispatch.additionalTrucksNeeded > 0 ? (
        <div className="mt-2 text-[11px] font-semibold text-amber-300">
          Need {item.liveDispatch.additionalTrucksNeeded} more truck
          {item.liveDispatch.additionalTrucksNeeded === 1 ? "" : "s"}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-white/60">
        <div>{formatRegionLabel(item.plant.region)}</div>
        <div>yardage {formatNumber(item.plant.yardage, 1)}</div>
        <div>by {item.byTime}</div>
      </div>
    </button>
  );
}

function DecisionQueueSection({
  title,
  items,
  selectedPlantId,
  onSelectPlant,
  emptyLabel,
  isOpen,
  onToggle,
}) {
  return (
    <CliSection
      title={title}
      right={
        <div className="flex items-center gap-3">
          <div className="text-sm text-white/60">{items.length} plants</div>
          <CliButton onClick={onToggle}>{isOpen ? "Hide" : "Show"}</CliButton>
        </div>
      }
    >
      {!isOpen ? null : items.length === 0 ? (
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

function DecisionsPage({
  actNowDecisions,
  watchDecisions,
  showActNow,
  setShowActNow,
  showWatchNext,
  setShowWatchNext,
  selectedPlantId,
  setSelectedPlantId,
  selectedPlant,
  drivers,
  driverLogs,
  sourceRules,
  onOpenDriverLogPage,
  onClosePlant,
}) {
  return (
    <div
      className={`grid gap-4 ${
        selectedPlant ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="grid gap-4 xl:grid-cols-2">
          <DecisionQueueSection
            title="Act now"
            items={actNowDecisions}
            selectedPlantId={selectedPlantId}
            onSelectPlant={setSelectedPlantId}
            emptyLabel="No plants currently need immediate action."
            isOpen={showActNow}
            onToggle={() => setShowActNow((current) => !current)}
          />
          <DecisionQueueSection
            title="Watch next"
            items={watchDecisions}
            selectedPlantId={selectedPlantId}
            onSelectPlant={setSelectedPlantId}
            emptyLabel="No near-term watch items in the current filter."
            isOpen={showWatchNext}
            onToggle={() => setShowWatchNext((current) => !current)}
          />
        </div>
      </div>

      {selectedPlant ? (
        <div className="min-w-0">
          <PlantDetailsPanel
            plant={selectedPlant}
            drivers={drivers}
            driverLogs={driverLogs}
            sourceRules={sourceRules}
            onClose={onClosePlant}
            onOpenDriverLogPage={onOpenDriverLogPage}
          />
        </div>
      ) : null}
    </div>
  );
}

function PlantTile({ plant, selected, onClick }) {
  const cement = plant.materials?.cement ?? emptyMaterialSlot();
  const flyash = plant.materials?.flyash ?? emptyMaterialSlot();
  const riskStatus = getPlantRiskStatus(plant);
  const riskFlags = formatRiskFlags(riskStatus);
  const startTime = getPlantStartTime(plant);
  const usageMaterials = materialRowsForDisplay(plant.materials);
  const liveDispatch = getLiveDispatchSnapshot(plant);

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
            <div className="text-[11px] text-white/50">Material usage [Live]</div>
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
          <div className="mt-2 border border-white/10 bg-white/[0.02] px-2 py-2">
            <div className="text-[11px] text-white/50">Inbound [Live]</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/70">
              <div>Trucks: {liveDispatch.inboundLabel}</div>
              <div>Next ETA: {liveDispatch.nextEtaLabel}</div>
              <div>Coverage: {liveDispatch.coverageLabel}</div>
            </div>
            {liveDispatch.additionalTrucksNeeded > 0 ? (
              <div className="mt-1 text-[11px] font-semibold text-amber-300">
                Need {liveDispatch.additionalTrucksNeeded} more trucks
              </div>
            ) : null}
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
  plantSort,
  setPlantSort,
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
      className="pt-3 pb-3"
      headerClassName="mb-3"
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
            <label className="flex items-center gap-2 border border-white/15 px-3 py-2 text-sm text-white/85">
              <span className="text-white/55">Sort</span>
              <select
                value={plantSort}
                onChange={(event) => setPlantSort(event.target.value)}
                className="bg-black text-sm text-white outline-none"
              >
                {PLANT_SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      }
    >
      <div ref={plantStripRef} className="overflow-x-auto overflow-y-hidden py-1">
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

function DriverLogList({
  logs,
  emptyLabel,
  showPlant = true,
  sourceRules = null,
  editingLogId = null,
  editingDraft = null,
  driverOptions = null,
  onEditLog = null,
  onEditingDraftChange = null,
  onSaveEdit = null,
  onCancelEdit = null,
}) {
  if (logs.length === 0) {
    return (
      <div className="border border-dashed border-white/25 p-4 text-sm text-white">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((entry) => {
        const isEditing = editingLogId === entry.id;

        return (
          <div key={entry.id} className="border border-white/25 p-3 text-sm text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">
                {showPlant ? `plant ${entry.plantId} :: ` : ""}
                {entry.driver || "-"}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onEditLog ? (
                  isEditing ? (
                    <>
                      <CliButton onClick={onCancelEdit}>Cancel</CliButton>
                      <CliButton
                        onClick={onSaveEdit}
                        disabled={!editingDraft || !hasDriverLogDraftContent(editingDraft)}
                      >
                        Save changes
                      </CliButton>
                    </>
                  ) : (
                    <CliButton onClick={() => onEditLog(entry)}>Edit</CliButton>
                  )
                ) : null}
                <div className="text-[11px] opacity-70">
                  {entry.updatedAt ? `updated ${entry.updatedAt}` : entry.savedAt}
                </div>
              </div>
            </div>

            {isEditing && editingDraft && driverOptions ? (
              <div className="mt-3 border border-white/15 bg-white/[0.02] p-3">
                <DriverLogForm
                  draft={editingDraft}
                  driverOptions={driverOptions}
                  onDraftChange={onEditingDraftChange}
                  onSave={onSaveEdit}
                  saveDisabled={!hasDriverLogDraftContent(editingDraft)}
                  saveLabel="save_changes"
                />
              </div>
            ) : (
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                <div className="break-words">location {entry.location || "-"}</div>
                <div className="break-words">truck {entry.truckNumber || "-"}</div>
                <div className="break-words">driver {entry.driver || "-"}</div>
                <div className="break-words">source {entry.source || "-"}</div>
                <div className="break-words">inv {entry.invCode || "-"}</div>
              </div>
            )}
            {!isEditing && !isSourceAllowedForPlant(sourceRules, entry.plantId, entry.source) ? (
              <div className="mt-3 text-[11px] font-medium text-amber-300">
                Source {entry.source || "-"} is not allowed for plant {entry.plantId}.
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function hasDriverLogDraftContent(draft) {
  return ["truckNumber", "driver", "source", "invCode"].some(
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

function DriverLogSelectField({ label, value, onChange, options = [] }) {
  return (
    <label className="grid gap-2 text-sm text-white">
      <span className="text-[11px] uppercase tracking-[0.18em] opacity-70">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="border border-white/25 bg-black px-3 py-2 text-sm text-white outline-none"
      >
        <option value="">select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
  lockLocation = false,
}) {
  return (
    <div className="grid gap-3">
      <div className="border border-white/25 px-3 py-3 text-sm text-white">
        plant {draft.plantId ?? "none_selected"}
      </div>
      {lockLocation ? (
        <div className="border border-white/25 px-3 py-3 text-sm text-white">
          <div className="text-[11px] uppercase tracking-[0.18em] opacity-70">location</div>
          <div className="mt-2 font-medium">{draft.location || "-"}</div>
        </div>
      ) : (
        <DriverLogTextField
          label="location"
          value={draft.location}
          listId={`driver-log-location-${draft.plantId ?? "none"}`}
          options={driverOptions.locations}
          onChange={(event) => onDraftChange("location", event.target.value)}
        />
      )}
      <DriverLogSelectField
        label="truck number"
        value={draft.truckNumber}
        options={driverOptions.truckNumbers}
        onChange={(event) => onDraftChange("truckNumber", event.target.value)}
      />
      <DriverLogSelectField
        label="driver"
        value={draft.driver}
        options={driverOptions.driverNames}
        onChange={(event) => onDraftChange("driver", event.target.value)}
      />
      <DriverLogSelectField
        label="source"
        value={draft.source}
        options={driverOptions.sources}
        onChange={(event) => onDraftChange("source", event.target.value)}
      />
      <DriverLogSelectField
        label="inv code"
        value={draft.invCode}
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

function PlantDetailsPanel({ plant, drivers, driverLogs, sourceRules, onOpenDriverLogPage, onClose }) {
  if (!plant) return null;

  const materialRows = materialRowsForDisplay(plant.materials);
  const negativeDiffCount = materialRows.filter((row) => row.diff !== null && row.diff < 0).length;
  const decision = buildPlantDecision(plant, sourceRules);
  const riskFlags = formatRiskFlags(getPlantRiskStatus(plant));
  const areaLabel = formatRegionLabel(plant.region);
  const startTime = getPlantStartTime(plant);
  const liveDispatch = getLiveDispatchSnapshot(plant);
  const inboundQueueRows = buildInboundQueueRows(plant, drivers, driverLogs, sourceRules);
  const inboundCountLabel = `${inboundQueueRows.length} truck${inboundQueueRows.length === 1 ? "" : "s"}`;
  const nextInboundEta = inboundQueueRows[0]?.eta ?? liveDispatch.nextEtaLabel;
  const suggestedDriverGroup = getPlantDriverGroupLabel(plant);

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
            <CliButton onClick={() => onOpenDriverLogPage(plant)}>View drivers</CliButton>
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
                {decision.sourceRecommendation ? (
                  <div className="mt-3 grid gap-3 border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric
                      label="Recommended source"
                      value={decision.sourceRecommendation.bestSource?.code ?? "Blocked"}
                    />
                    <Metric
                      label="Allocation left"
                      value={
                        decision.sourceRecommendation.bestSource
                          ? formatNumber(decision.sourceRecommendation.bestSource.left, 0)
                          : "-"
                      }
                    />
                    <Metric
                      label="Backup source"
                      value={decision.sourceRecommendation.alternate?.code ?? "-"}
                    />
                    <Metric
                      label="Valid sources"
                      value={decision.sourceRecommendation.allowedSources.length}
                    />
                  </div>
                ) : null}
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

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Metric label="Area" value={areaLabel} />
            <Metric label="Start time" value={startTime} />
            <Metric label="Yardage" value={formatNumber(plant.yardage, 1)} />
            <Metric label="Next ETA" value={nextInboundEta} />
            <Metric label="Inbound trucks" value={inboundCountLabel} />
            <Metric label="Materials shown" value={materialRows.length} />
            <Metric label="Negative diffs" value={negativeDiffCount} />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[12px] font-medium text-white/75">Inbound queue</div>
              <div className="text-[11px] text-white/50">Dispatch pool {suggestedDriverGroup}</div>
            </div>
            <div className="mt-3 overflow-auto border border-white/15">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/15 text-left text-[11px] uppercase tracking-[0.14em] text-white/50">
                  <tr>
                    <th className="px-3 py-3 font-medium">truck</th>
                    <th className="px-3 py-3 font-medium">driver</th>
                    <th className="px-3 py-3 font-medium">source</th>
                    <th className="px-3 py-3 font-medium">eta</th>
                    <th className="px-3 py-3 font-medium">material</th>
                  </tr>
                </thead>
                <tbody>
                  {inboundQueueRows.map((row) => (
                    <tr key={row.id} className="border-t border-white/10 text-white/80">
                      <td className="px-3 py-3">{row.truck}</td>
                      <td className="px-3 py-3">{row.driver}</td>
                      <td className="px-3 py-3">{row.source}</td>
                      <td className="px-3 py-3">{row.eta}</td>
                      <td className="px-3 py-3">{row.material}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-[12px] font-medium text-white/75">Materials</div>
            <div className="mt-3">
              <MaterialSnapshot materials={plant.materials} />
            </div>
          </div>
        </div>
      </CliSection>
    </div>
  );
}

function MainPageDriverLogPanel({
  plant,
  driverLogs,
  driverLogDraft,
  driverOptions,
  sourceRules,
  onDraftChange,
  onSaveDriverLog,
}) {
  if (!plant) return null;

  const plantLogs = driverLogs.filter((entry) => Number(entry.plantId) === Number(plant.id));
  const location = driverLogLocationForPlant(plant);
  const detailDraft =
    driverLogDraft.plantId === plant.id
      ? { ...driverLogDraft, location }
      : createDriverLogDraft(plant.id, location);
  const detailDriverOptions = {
    ...driverOptions,
    sources: getAllowedSourceOptionsForPlant(sourceRules, plant, detailDraft.source),
  };
  const saveDisabled = !hasDriverLogDraftContent(detailDraft);

  return (
    <div className="self-start xl:sticky xl:top-6 xl:z-10">
      <CliSection
        title={`Driver log :: Plant ${plant.id}`}
        right={<div className="text-sm text-white/60">{plantLogs.length} saved</div>}
      >
        <div className="max-h-[calc(100vh-250px)] space-y-4 overflow-y-auto pr-1">
          <div className="border border-white/15 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white">
              <div className="font-medium">New log entry</div>
              <div className="text-white/55">{location}</div>
            </div>
            <DriverLogForm
              draft={detailDraft}
              driverOptions={detailDriverOptions}
              onDraftChange={onDraftChange}
              onSave={onSaveDriverLog}
              saveDisabled={saveDisabled}
              lockLocation
            />
          </div>

          <div className="border border-white/15 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white">
              <div className="font-medium">Saved logs</div>
              <div className="text-white/55">for plant {plant.id}</div>
            </div>
            <DriverLogList
              logs={plantLogs}
              showPlant={false}
              sourceRules={sourceRules}
              emptyLabel="No saved driver logs for this plant yet."
            />
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

function buildSourceAllocationRows(rows) {
  return rows.map((row) => {
    const pickedUp = row.dayPicked + row.nightPicked;
    return {
      ...row,
      pickedUp,
      left: Math.max(0, row.allocation - pickedUp),
    };
  });
}

function SourceAllocationTable({ title, rows }) {
  const computedRows = useMemo(() => buildSourceAllocationRows(rows), [rows]);
  const totals = useMemo(
    () =>
      computedRows.reduce(
        (sum, row) => ({
          allocation: sum.allocation + row.allocation,
          dayPicked: sum.dayPicked + row.dayPicked,
          nightPicked: sum.nightPicked + row.nightPicked,
          pickedUp: sum.pickedUp + row.pickedUp,
          left: sum.left + row.left,
        }),
        { allocation: 0, dayPicked: 0, nightPicked: 0, pickedUp: 0, left: 0 },
      ),
    [computedRows],
  );

  return (
    <CliSection
      title={title}
      right={<div className="text-sm text-white/60">{computedRows.length} sources</div>}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Allocation" value={formatNumber(totals.allocation, 0)} />
        <Metric label="Day picked" value={formatNumber(totals.dayPicked, 0)} />
        <Metric label="Night picked" value={formatNumber(totals.nightPicked, 0)} />
        <Metric label="Picked up" value={formatNumber(totals.pickedUp, 0)} />
        <Metric label="Left" value={formatNumber(totals.left, 0)} />
      </div>

      <div className="overflow-auto border border-white/25">
        <table className="min-w-full text-sm">
          <thead className="border-b border-white/25 text-left text-[11px] uppercase tracking-[0.18em] text-white">
            <tr>
              <th className="px-3 py-3 font-medium">source</th>
              <th className="px-3 py-3 font-medium text-right">allocation</th>
              <th className="px-3 py-3 font-medium text-right">day</th>
              <th className="px-3 py-3 font-medium text-right">night</th>
              <th className="px-3 py-3 font-medium text-right">picked up</th>
              <th className="px-3 py-3 font-medium text-right">left</th>
            </tr>
          </thead>
          <tbody>
            {computedRows.map((row) => (
              <tr key={row.code} className="border-t border-white/15 text-white">
                <td className="px-3 py-3 font-medium">{row.code}</td>
                <td className="px-3 py-3 text-right">{formatNumber(row.allocation, 0)}</td>
                <td className="px-3 py-3 text-right">{formatNumber(row.dayPicked, 0)}</td>
                <td className="px-3 py-3 text-right">{formatNumber(row.nightPicked, 0)}</td>
                <td className="px-3 py-3 text-right">{formatNumber(row.pickedUp, 0)}</td>
                <td className="px-3 py-3 text-right font-semibold text-white">
                  {formatNumber(row.left, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CliSection>
  );
}

function SourceAllocationsPage() {
  return (
    <div className="grid gap-4">
      <SourceAllocationTable title="Cement sources" rows={SOURCE_ALLOCATION_DATA.cement} />
      <SourceAllocationTable title="Fly-ash sources" rows={SOURCE_ALLOCATION_DATA.flyash} />
    </div>
  );
}

function DriverStatusCard({ driver, selected, onSelect }) {
  const truck = "assignedTruck" in driver ? driver.assignedTruck || "-" : "-";
  const code = "driverCode" in driver ? driver.driverCode || "" : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(driver)}
      className={`w-full border p-3 text-left text-sm text-white transition ${
        selected
          ? "border-white/40 bg-white/[0.08]"
          : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold">{driver.name}</div>
        <div className="text-[11px] text-white/55">truck {truck}</div>
      </div>
      <div className="mt-1 text-white/75">{driver.location}</div>
      <div className="mt-1 text-[11px] text-white/50">
        {driver.status}
        {code ? ` - code ${code}` : ""}
      </div>
    </button>
  );
}

function DriverGroupSection({ title, drivers, isOpen, onToggle, selectedDriverId, onSelectDriver }) {
  return (
    <div className="border border-white/15 bg-white/[0.02] p-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-[11px] text-white/50">{drivers.length} drivers</div>
        </div>
        <div className="text-lg font-semibold text-white">{isOpen ? "-" : "+"}</div>
      </button>

      {isOpen ? (
        <div className="mt-3 space-y-3">
          {drivers.length > 0 ? (
            drivers.map((driver) => (
              <DriverStatusCard
                key={driver.id}
                driver={driver}
                selected={selectedDriverId === driver.id}
                onSelect={onSelectDriver}
              />
            ))
          ) : (
            <div className="border border-dashed border-white/20 p-3 text-sm text-white/55">
              No drivers in this group.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DriversBoard({
  drivers,
  plants,
  logs,
  selectedDriverId,
  onSelectDriver,
  driverSearch,
  setDriverSearch,
  focusPlant,
  preferredGroupKey,
}) {
  const [openGroups, setOpenGroups] = useState({
    day_rialto: false,
    day_off_site: false,
    day_nevada: false,
    night_rialto: false,
    night_off_site: false,
    night_nevada: false,
  });

  const numericQuery = cleanText(driverSearch);
  const numericExactQuery =
    numericQuery && /^\d+$/.test(numericQuery) ? String(Number(numericQuery)) : null;
  const searchedPlantId = parsePlantSearchId(driverSearch);

  const driverPlantHistory = useMemo(() => {
    const byDriver = new Map();

    logs.forEach((entry) => {
      const driverKey = cleanText(entry.driver).toLowerCase();
      const plantId = Number(entry.plantId);
      if (!driverKey || !Number.isInteger(plantId)) return;

      if (!byDriver.has(driverKey)) byDriver.set(driverKey, new Set());
      byDriver.get(driverKey).add(plantId);
    });

    return byDriver;
  }, [logs]);

  const searchedPlant = useMemo(() => {
    if (searchedPlantId === null) return null;
    return plants.find((plant) => plant.id === searchedPlantId) ?? null;
  }, [plants, searchedPlantId]);

  const filteredDrivers = useMemo(() => {
    const query = cleanText(driverSearch).toLowerCase();
    if (!query) return drivers;

    return drivers.filter((driver) => {
      const truck = "assignedTruck" in driver ? driver.assignedTruck || "" : "";
      const code = "driverCode" in driver ? driver.driverCode || "" : "";
      const driverKey = cleanText(driver.name).toLowerCase();
      const hasPlantHistory = searchedPlantId !== null && driverPlantHistory.get(driverKey)?.has(searchedPlantId);
      const hasLivePlantMatch = locationMatchesPlantId(driver.location, searchedPlantId);

      if (numericExactQuery) {
        const exactNumericMatch = [truck, code].some((value) => {
          const digits = cleanText(value).replace(/\D+/g, "");
          return digits ? String(Number(digits)) === numericExactQuery : false;
        });

        return exactNumericMatch || hasPlantHistory || hasLivePlantMatch;
      }

      const textMatch = [driver.name, driver.location, driver.status, truck, code].some((value) =>
        cleanText(value).toLowerCase().includes(query),
      );

      return textMatch || hasPlantHistory || hasLivePlantMatch;
    });
  }, [driverPlantHistory, driverSearch, drivers, numericExactQuery, searchedPlantId]);

  const groupedDrivers = useMemo(() => {
    const groups = {
      day: {
        rialto: [],
        off_site: [],
        nevada: [],
      },
      night: {
        rialto: [],
        off_site: [],
        nevada: [],
      },
    };

    filteredDrivers.forEach((driver) => {
      const shiftKey = getDriverShiftKey(driver);
      const groupKey = getDriverGroupKey(driver);
      groups[shiftKey][groupKey].push(driver);
    });

    return groups;
  }, [filteredDrivers]);

  useEffect(() => {
    if (!cleanText(driverSearch)) return;

    setOpenGroups((current) => {
      let changed = false;
      const next = { ...current };

      DRIVER_SHIFT_ORDER.forEach((shiftKey) => {
        DRIVER_GROUP_ORDER.forEach((groupKey) => {
          const stateKey = `${shiftKey}_${groupKey}`;
          const shouldOpen = groupedDrivers[shiftKey][groupKey].length > 0;
          if (next[stateKey] !== shouldOpen) {
            next[stateKey] = shouldOpen;
            changed = true;
          }
        });
      });

      return changed ? next : current;
    });
  }, [driverSearch, groupedDrivers]);

  useEffect(() => {
    if (!preferredGroupKey) return;
    const stateKey = `day_${preferredGroupKey}`;
    setOpenGroups((current) => ({
      ...current,
      [stateKey]: true,
    }));
  }, [preferredGroupKey]);

  function toggleGroup(shiftKey, groupKey) {
    const stateKey = `${shiftKey}_${groupKey}`;
    setOpenGroups((current) => ({
      ...current,
      [stateKey]: !current[stateKey],
    }));
  }

  return (
    <CliSection
      title="Drivers"
      right={
        <div className="flex flex-wrap items-center gap-3">
          {focusPlant ? (
            <div className="text-[11px] text-white/50">
              Plant {focusPlant.id} {"->"} {getPlantDriverGroupLabel(focusPlant)}
            </div>
          ) : null}
          {searchedPlant && !focusPlant ? (
            <div className="text-[11px] text-white/50">
              Plant {searchedPlant.id} {"->"} {getPlantDriverGroupLabel(searchedPlant)}
            </div>
          ) : null}
          <label className="flex min-w-[240px] items-center gap-2 border border-white/15 px-3 py-2 text-sm text-white/85">
            <span className="text-white/55">Search drivers</span>
            <input
              type="text"
              value={driverSearch}
              onChange={(event) => setDriverSearch(event.target.value)}
              placeholder="driver, truck, location, plant"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </label>
        </div>
      }
    >
      <div className="grid gap-5">
        {DRIVER_SHIFT_ORDER.map((shiftKey) => {
          const shiftDrivers = groupedDrivers[shiftKey];
          const shiftCount = DRIVER_GROUP_ORDER.reduce(
            (sum, groupKey) => sum + shiftDrivers[groupKey].length,
            0,
          );

          return (
            <div key={shiftKey} className="border border-white/15 bg-white/[0.02] p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-white">{DRIVER_SHIFT_LABELS[shiftKey]}</div>
                <div className="text-[11px] text-white/50">{shiftCount} drivers</div>
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                {DRIVER_GROUP_ORDER.map((groupKey) => {
                  const stateKey = `${shiftKey}_${groupKey}`;
                  return (
                    <DriverGroupSection
                      key={stateKey}
                      title={DRIVER_GROUP_LABELS[groupKey]}
                      drivers={shiftDrivers[groupKey]}
                      isOpen={openGroups[stateKey]}
                      onToggle={() => toggleGroup(shiftKey, groupKey)}
                      selectedDriverId={selectedDriverId}
                      onSelectDriver={onSelectDriver}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </CliSection>
  );
}

function DriverLogPage({
  plants,
  plant,
  draft,
  logs,
  onOpenPlant,
  selectedDriver,
  driverOptions,
  sourceRules,
  onUpdateLog,
  editRequest = null,
}) {
  const [editingLogId, setEditingLogId] = useState(null);
  const [editingDraft, setEditingDraft] = useState(() => createDriverLogDraft(null));

  const driverLogs = useMemo(() => {
    if (selectedDriver) {
      const selectedName = cleanText(selectedDriver.name).toLowerCase();
      return logs.filter((entry) => cleanText(entry.driver).toLowerCase() === selectedName);
    }

    if (draft.plantId !== null) {
      return logs.filter((entry) => Number(entry.plantId) === Number(draft.plantId));
    }

    return [];
  }, [logs, draft.plantId, selectedDriver]);

  useEffect(() => {
    setEditingLogId(null);
    setEditingDraft(createDriverLogDraft(null));
  }, [selectedDriver?.id, draft.plantId]);

  useEffect(() => {
    if (editingLogId === null) return;

    const currentEntry = logs.find((entry) => entry.id === editingLogId);
    if (!currentEntry) {
      setEditingLogId(null);
      setEditingDraft(createDriverLogDraft(null));
    }
  }, [logs, editingLogId]);

  useEffect(() => {
    if (!editRequest?.logId) return;

    const currentEntry = logs.find((entry) => entry.id === editRequest.logId);
    if (!currentEntry) return;

    setEditingLogId(currentEntry.id);
    setEditingDraft(createDriverLogDraftFromEntry(currentEntry));
  }, [editRequest, logs]);

  function beginEditLog(entry) {
    setEditingLogId(entry.id);
    setEditingDraft(createDriverLogDraftFromEntry(entry));
  }

  function updateEditingDraft(field, value) {
    setEditingDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function cancelEditLog() {
    setEditingLogId(null);
    setEditingDraft(createDriverLogDraft(null));
  }

  function saveEditedLog() {
    if (editingLogId === null || !hasDriverLogDraftContent(editingDraft)) return;
    onUpdateLog(editingLogId, editingDraft);
    setEditingLogId(null);
    setEditingDraft(createDriverLogDraft(null));
  }

  const editingPlant =
    plants.find((item) => item.id === editingDraft.plantId) ??
    plant ??
    null;
  const editingDriverOptions = {
    ...driverOptions,
    sources: getAllowedSourceOptionsForPlant(sourceRules, editingPlant, editingDraft.source),
  };

  const title = selectedDriver
    ? `Driver log :: ${selectedDriver.name}`
    : draft.plantId === null
      ? "Driver log"
      : `Driver log :: Plant ${draft.plantId}`;

  return (
    <CliSection
      title={title}
      right={
        !selectedDriver && plant ? (
          <CliButton onClick={() => onOpenPlant(plant.id)}>Open plant {plant.id}</CliButton>
        ) : null
      }
    >
      <DriverLogList
        logs={driverLogs}
        emptyLabel={
          selectedDriver
            ? "No saved logs for this driver yet."
            : draft.plantId === null
              ? "Select a driver on the left."
              : "No saved logs for this plant yet."
        }
        sourceRules={sourceRules}
        editingLogId={editingLogId}
        editingDraft={editingDraft}
        driverOptions={editingDriverOptions}
        onEditLog={beginEditLog}
        onEditingDraftChange={updateEditingDraft}
        onSaveEdit={saveEditedLog}
        onCancelEdit={cancelEditLog}
      />
    </CliSection>
  );
}

function DriversPage({
  drivers,
  plants,
  plant,
  draft,
  logs,
  driverOptions,
  sourceRules,
  onOpenPlant,
  onUpdateLog,
  editRequest = null,
}) {
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [driverSearch, setDriverSearch] = useState("");

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId],
  );

  const searchedPlant = useMemo(() => {
    const searchedPlantId = parsePlantSearchId(driverSearch);
    if (searchedPlantId === null) return null;
    return plants.find((item) => item.id === searchedPlantId) ?? null;
  }, [driverSearch, plants]);

  const focusPlant = plant ?? searchedPlant;
  const preferredGroupKey = focusPlant ? getPlantDriverGroupKey(focusPlant) : null;
  const logDraft = !selectedDriver && !plant && searchedPlant
    ? { ...draft, plantId: searchedPlant.id, location: driverLogLocationForPlant(searchedPlant) }
    : draft;

  useEffect(() => {
    setSelectedDriverId(null);
  }, [plant?.id]);

  useEffect(() => {
    if (!cleanText(driverSearch)) return;
    setSelectedDriverId(null);
  }, [driverSearch]);

  useEffect(() => {
    if (!editRequest?.logId) return;
    setSelectedDriverId(null);
  }, [editRequest]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <DriversBoard
        drivers={drivers}
        plants={plants}
        logs={logs}
        selectedDriverId={selectedDriverId}
        onSelectDriver={(driver) => setSelectedDriverId(driver.id)}
        driverSearch={driverSearch}
        setDriverSearch={setDriverSearch}
        focusPlant={focusPlant}
        preferredGroupKey={preferredGroupKey}
      />
      <DriverLogPage
        plants={plants}
        plant={focusPlant}
        draft={logDraft}
        logs={logs}
        onOpenPlant={onOpenPlant}
        selectedDriver={selectedDriver}
        driverOptions={driverOptions}
        sourceRules={sourceRules}
        onUpdateLog={onUpdateLog}
        editRequest={editRequest}
      />
    </div>
  );
}

function NotesPage() {
  return (
    <div className="grid gap-4">
      <CliSection
        title="Notes"
        right={<div className="text-sm text-white/60">{DISPATCH_NOTES.length} items</div>}
      >
        <div className="space-y-3">
          {DISPATCH_NOTES.map((note, index) => (
            <div key={note.id} className="border border-white/15 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  note {index + 1}
                </div>
                <div className="text-[11px] text-white/40">{note.id}</div>
              </div>
              <div className="mt-2 text-base font-semibold text-white">{note.title}</div>
              <div className="mt-2 text-sm leading-6 text-white/75">{note.body}</div>
            </div>
          ))}
        </div>
      </CliSection>
    </div>
  );
}

function ExceptionsList({
  items,
  emptyLabel = "No open exceptions.",
  onOpenPlant = null,
  onEditLog = null,
}) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-white/25 p-4 text-sm text-white">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={`border p-4 text-sm ${
            item.severity === "critical"
              ? "border-rose-500/35 bg-rose-500/10 text-rose-100"
              : "border-amber-400/35 bg-amber-400/10 text-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">{item.title}</div>
            <div className="flex flex-wrap items-center gap-2">
              {onEditLog && item.logId ? (
                <CliButton onClick={() => onEditLog(item.logId)}>
                  {item.relatedLogIds?.length > 1 ? "Review logs" : "Edit log"}
                </CliButton>
              ) : null}
              {onOpenPlant && Number.isInteger(item.plantId) ? (
                <CliButton onClick={() => onOpenPlant(item.plantId)}>Open plant</CliButton>
              ) : null}
              <div className="text-[11px] uppercase tracking-[0.16em] opacity-75">{item.severity}</div>
            </div>
          </div>
          <div className="mt-2 leading-6 opacity-90">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

function ExceptionsPage({ exceptions, onOpenPlant, onEditLog }) {
  const criticalCount = exceptions.filter((item) => item.severity === "critical").length;
  const attentionCount = exceptions.filter((item) => item.severity === "attention").length;

  return (
    <div className="grid gap-4">
      <CliSection title="Exceptions" right={<div className="text-sm text-white/60">{exceptions.length} open</div>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Open exceptions" value={exceptions.length} />
          <Metric label="Critical" value={criticalCount} />
          <Metric label="Attention" value={attentionCount} />
        </div>
      </CliSection>

      <CliSection title="Dispatch Exceptions">
        <ExceptionsList items={exceptions} onOpenPlant={onOpenPlant} onEditLog={onEditLog} />
      </CliSection>
    </div>
  );
}

function EndOfShiftSummaryPage({ data, drivers, driverLogs, exceptions, onOpenPlant, onEditLog }) {
  const [shiftNotes, setShiftNotes] = useState(() => loadEndOfShiftNotes());

  const shiftCounts = useMemo(
    () => ({
      day: drivers.filter((driver) => getDriverShiftKey(driver) === "day").length,
      night: drivers.filter((driver) => getDriverShiftKey(driver) === "night").length,
    }),
    [drivers],
  );

  const uniqueLoggedDrivers = useMemo(
    () => new Set(driverLogs.map((entry) => cleanText(entry.driver)).filter(Boolean)).size,
    [driverLogs],
  );

  const uniqueLoggedTrucks = useMemo(
    () => new Set(driverLogs.map((entry) => cleanText(entry.truckNumber)).filter(Boolean)).size,
    [driverLogs],
  );

  const plantsServedCount = useMemo(
    () => new Set(driverLogs.map((entry) => Number(entry.plantId)).filter(Number.isInteger)).size,
    [driverLogs],
  );

  const topPlantActivity = useMemo(() => {
    const counts = new Map();
    driverLogs.forEach((entry) => {
      const plantId = Number(entry.plantId);
      if (!Number.isInteger(plantId)) return;
      counts.set(plantId, (counts.get(plantId) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([plantId, count]) => ({
        plantId,
        count,
        plant: data.plants.find((item) => item.id === plantId) ?? null,
      }))
      .sort((left, right) => right.count - left.count || left.plantId - right.plantId)
      .slice(0, 6);
  }, [data.plants, driverLogs]);

  const currentRiskPlants = useMemo(
    () =>
      data.plants
        .filter((plant) => getPlantRiskStatus(plant).hasRisk)
        .map((plant) => ({
          id: plant.id,
          flags: formatRiskFlags(getPlantRiskStatus(plant)).join(" / ") || "risk",
        }))
        .slice(0, 8),
    [data.plants],
  );

  const topLoggedSources = useMemo(() => {
    const counts = new Map();
    driverLogs.forEach((entry) => {
      const source = normalizeSourceCode(entry.source);
      if (!source) return;
      counts.set(source, (counts.get(source) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source))
      .slice(0, 6);
  }, [driverLogs]);

  const cementAllocationTotals = useMemo(
    () =>
      SOURCE_ALLOCATION_DATA.cement.reduce(
        (sum, row) => ({
          allocation: sum.allocation + row.allocation,
          dayPicked: sum.dayPicked + row.dayPicked,
          nightPicked: sum.nightPicked + row.nightPicked,
          pickedUp: sum.pickedUp + row.dayPicked + row.nightPicked,
          left: sum.left + (row.allocation - row.dayPicked - row.nightPicked),
        }),
        { allocation: 0, dayPicked: 0, nightPicked: 0, pickedUp: 0, left: 0 },
      ),
    [],
  );

  const flyashAllocationTotals = useMemo(
    () =>
      SOURCE_ALLOCATION_DATA.flyash.reduce(
        (sum, row) => ({
          allocation: sum.allocation + row.allocation,
          dayPicked: sum.dayPicked + row.dayPicked,
          nightPicked: sum.nightPicked + row.nightPicked,
          pickedUp: sum.pickedUp + row.dayPicked + row.nightPicked,
          left: sum.left + (row.allocation - row.dayPicked - row.nightPicked),
        }),
        { allocation: 0, dayPicked: 0, nightPicked: 0, pickedUp: 0, left: 0 },
      ),
    [],
  );

  useEffect(() => {
    window.localStorage.setItem(END_OF_SHIFT_NOTES_STORAGE_KEY, shiftNotes);
  }, [shiftNotes]);

  return (
    <div className="grid gap-4">
      <CliSection
        title="End of Shift Summary"
        right={
          <div className="text-sm text-white/60">
            updated {new Date(data.meta?.generatedAt ?? Date.now()).toLocaleString()}
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Metric label="Active plants" value={data.summary.activePlants} />
          <Metric label="Total yardage" value={formatNumber(data.summary.totalYardage, 1)} />
          <Metric label="Delivered" value={formatNumber(DELIVERED_YARDAGE, 0)} />
          <Metric label="Saved dispatch logs" value={driverLogs.length} />
          <Metric label="Plants served" value={plantsServedCount} />
          <Metric label="Open risk plants" value={currentRiskPlants.length} />
          <Metric label="Open exceptions" value={exceptions.length} />
        </div>
      </CliSection>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <CliSection title="Dispatch Activity">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Day shift drivers" value={shiftCounts.day} />
            <Metric label="Night shift drivers" value={shiftCounts.night} />
            <Metric label="Drivers" value={uniqueLoggedDrivers} />
            <Metric label="Trucks" value={uniqueLoggedTrucks} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="border border-white/15 bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                Material usage [live]
              </div>
              <div className="mt-3 space-y-2 text-sm text-white/80">
                <div>
                  Cement <span className="font-semibold text-white">{LIVE_HEADER_USAGE.cement.used} / {LIVE_HEADER_USAGE.cement.total}</span>
                </div>
                <div>
                  Fly-ash <span className="font-semibold text-white">{LIVE_HEADER_USAGE.flyash.used} / {LIVE_HEADER_USAGE.flyash.total}</span>
                </div>
              </div>
            </div>

            <div className="border border-white/15 bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                Top logged sources
              </div>
              <div className="mt-3 space-y-2 text-sm text-white/80">
                {topLoggedSources.length > 0 ? (
                  topLoggedSources.map((item) => (
                    <div key={item.source} className="flex items-center justify-between gap-3">
                      <span>{item.source}</span>
                      <span className="font-semibold text-white">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-white/55">No source activity logged yet.</div>
                )}
              </div>
            </div>
          </div>
        </CliSection>

        <CliSection title="Material Pickup Summary">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-white/15 bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white">Cement</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Metric label="Allocation" value={formatNumber(cementAllocationTotals.allocation, 0)} />
                <Metric label="Picked up" value={formatNumber(cementAllocationTotals.pickedUp, 0)} />
                <Metric label="Day loads" value={formatNumber(cementAllocationTotals.dayPicked, 0)} />
                <Metric label="Night loads" value={formatNumber(cementAllocationTotals.nightPicked, 0)} />
              </div>
            </div>

            <div className="border border-white/15 bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white">Fly-ash</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Metric label="Allocation" value={formatNumber(flyashAllocationTotals.allocation, 0)} />
                <Metric label="Picked up" value={formatNumber(flyashAllocationTotals.pickedUp, 0)} />
                <Metric label="Day loads" value={formatNumber(flyashAllocationTotals.dayPicked, 0)} />
                <Metric label="Night loads" value={formatNumber(flyashAllocationTotals.nightPicked, 0)} />
              </div>
            </div>
          </div>
        </CliSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CliSection title="Top Plant Activity" right={<div className="text-sm text-white/60">{topPlantActivity.length} plants</div>}>
          {topPlantActivity.length > 0 ? (
            <div className="space-y-3">
              {topPlantActivity.map((item) => (
                <div key={item.plantId} className="flex items-center justify-between gap-3 border border-white/15 bg-white/[0.02] p-3 text-sm text-white">
                  <div>
                    <div className="font-semibold">Plant {item.plantId}</div>
                    <div className="mt-1 text-white/55">
                      {item.plant ? `${formatRegionLabel(item.plant.region)} • yardage ${formatNumber(item.plant.yardage, 1)}` : "No plant summary available"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-white/50">logged loads</div>
                    <div className="text-lg font-semibold text-white">{item.count}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-white/25 p-4 text-sm text-white">
              No plant activity logged yet.
            </div>
          )}
        </CliSection>

        <CliSection title="Current Plant Highlights" right={<div className="text-sm text-white/60">{currentRiskPlants.length} at risk</div>}>
          <div className="grid gap-3">
            <div className="border border-white/15 bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Open risk plants</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {currentRiskPlants.length > 0 ? (
                  currentRiskPlants.map((item) => (
                    <div key={item.id} className="border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                      Plant {item.id} <span className="text-rose-300">({item.flags})</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/55">No current plant shortages flagged.</div>
                )}
              </div>
            </div>

            <div className="border border-white/15 bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">NOTES:</div>
              <textarea
                value={shiftNotes}
                onChange={(event) => setShiftNotes(event.target.value)}
                className="mt-3 min-h-[150px] w-full resize-y border border-white/15 bg-black px-3 py-3 text-sm leading-6 text-white outline-none"
              />
            </div>
          </div>
        </CliSection>
      </div>

      <CliSection title="Exceptions Snapshot" right={<div className="text-sm text-white/60">top {Math.min(5, exceptions.length)}</div>}>
        <ExceptionsList
          items={exceptions.slice(0, 5)}
          emptyLabel="No open exceptions to hand off."
          onOpenPlant={onOpenPlant}
          onEditLog={onEditLog}
        />
      </CliSection>
    </div>
  );
}

export default function DispatchCockpitLive() {
  const [data, setData] = useState(DEMO_DATA);
  const [drivers, setDrivers] = useState(DEMO_DRIVERS);
  const [sourceRules, setSourceRules] = useState(() => createEmptySourceRules());
  const [page, setPage] = useState("cockpit");
  const [activeOnly, setActiveOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [plantSort, setPlantSort] = useState("plant_id");
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [showActNow, setShowActNow] = useState(true);
  const [showWatchNext, setShowWatchNext] = useState(true);
  const [showPlantTotals, setShowPlantTotals] = useState(true);
  const [driverLogs, setDriverLogs] = useState(loadDriverLogs);
  const [driverLogDraft, setDriverLogDraft] = useState(() => createDriverLogDraft(null));
  const [driverLogEditRequest, setDriverLogEditRequest] = useState(null);
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

  const sortedPlants = useMemo(
    () => [...filteredPlants].sort((left, right) => comparePlantsForSort(left, right, plantSort, sourceRules)),
    [filteredPlants, plantSort, sourceRules],
  );

  const selectedPlant = useMemo(() => {
    if (selectedPlantId === null) return null;
    return data.plants.find((plant) => plant.id === selectedPlantId) ?? null;
  }, [data, selectedPlantId]);

  const actNowDecisions = useMemo(
    () =>
      filteredPlants
        .map((plant) => buildPlantDecision(plant, sourceRules))
        .filter((decision) => decision?.mode === "act_now")
        .sort((left, right) => right.score - left.score),
    [filteredPlants, sourceRules],
  );
  const hasActNow = actNowDecisions.length > 0;

  const watchDecisions = useMemo(
    () =>
      filteredPlants
        .map((plant) => buildPlantDecision(plant, sourceRules))
        .filter((decision) => decision?.mode === "watch")
        .sort((left, right) => right.score - left.score),
    [filteredPlants, sourceRules],
  );

  const dispatchExceptions = useMemo(
    () => buildDispatchExceptions(data.plants, driverLogs, sourceRules),
    [data.plants, driverLogs, sourceRules],
  );

  const driverOptions = useMemo(
    () => ({
      locations: uniqueCleanValues(drivers.map((driver) => driver.location)),
      truckNumbers: uniqueCleanValues(
        drivers.map((driver) => ("assignedTruck" in driver ? driver.assignedTruck : "")),
      ),
      driverNames: uniqueCleanValues(drivers.map((driver) => driver.name)),
      sources: DRIVER_LOG_SOURCE_OPTIONS,
      invCodes: DRIVER_LOG_INV_CODE_OPTIONS,
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

      const [
        yardageSource,
        adjustmentsSource,
        materialSource,
        aggSource,
        nightAggSource,
        sourceToPlantSource,
      ] = await Promise.all([
        readSource(sourceBridge, "yardage", false),
        readSource(sourceBridge, "adjustments", false),
        readSource(sourceBridge, "material", true),
        readSource(sourceBridge, "aggAssignments", false),
        readSource(sourceBridge, "nightAssignments", false),
        readSource(sourceBridge, "sourceToPlant", false),
      ]);

      const nextData = buildCockpitData({
        shippedBuffer: yardageSource.buffer,
        loadBuffer: adjustmentsSource.buffer,
        materialBuffer: materialSource.buffer,
        shippedName: yardageSource.fileName,
        loadName: adjustmentsSource.fileName,
        materialName: materialSource.fileName,
      });

      const dayDrivers = buildAggDriverRows(aggSource.buffer, {
        shift: "day",
        idPrefix: "agg_day",
        fallbackRows: DEMO_DRIVERS,
      });
      const nightDrivers = buildAggDriverRows(nightAggSource.buffer, {
        shift: "night",
        idPrefix: "agg_night",
        fallbackRows: [],
      });
      const nextSourceRules = parseSourceToPlantWorkbook(sourceToPlantSource.buffer);

      setData(nextData);
      setDrivers([...dayDrivers, ...nightDrivers]);
      setSourceRules(nextSourceRules);
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
    if (page !== "cockpit" || selectedPlantId === null) return;
    const nextPlant = data.plants.find((plant) => plant.id === selectedPlantId) ?? null;
    const nextLocation = driverLogLocationForPlant(nextPlant);
    setDriverLogDraft((current) =>
      current.plantId === selectedPlantId
        ? { ...current, location: nextLocation }
        : createDriverLogDraft(selectedPlantId, nextLocation),
    );
  }, [page, selectedPlantId, data]);

  function openDriverLogForPlant(plant) {
    setDriverLogEditRequest(null);
    const nextLocation = driverLogLocationForPlant(plant);
    setDriverLogDraft((current) =>
      current.plantId === plant.id
        ? { ...current, location: nextLocation }
        : createDriverLogDraft(plant.id, nextLocation),
    );
    setPage("drivers");
  }

  function updateDriverLogDraft(field, value) {
    setDriverLogDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function getPlantMaterialKeyForLog(plantId) {
    const plant = data.plants.find((item) => item.id === plantId) ?? null;
    return plant ? getPrimaryPlantMaterialKey(plant) : "cement";
  }

  function saveDriverLog() {
    if (driverLogDraft.plantId === null || !hasDriverLogDraftContent(driverLogDraft)) return;

    const nextEntry = {
      id: `log_${Date.now()}`,
      plantId: driverLogDraft.plantId,
      location: cleanText(driverLogDraft.location),
      truckNumber: cleanText(driverLogDraft.truckNumber),
      driver: cleanText(driverLogDraft.driver),
      source: normalizeSourceCode(driverLogDraft.source, getPlantMaterialKeyForLog(driverLogDraft.plantId)),
      invCode: cleanText(driverLogDraft.invCode),
      savedAt: new Date().toLocaleString(),
    };

    setDriverLogs((current) => [nextEntry, ...current]);
    setDriverLogDraft(createDriverLogDraft(driverLogDraft.plantId, driverLogDraft.location));
  }

  function updateSavedDriverLog(entryId, nextDraft) {
    setDriverLogs((current) =>
      current.map((entry) =>
        entry.id !== entryId
          ? entry
          : {
              ...entry,
              plantId: nextDraft.plantId,
              location: cleanText(nextDraft.location),
              truckNumber: cleanText(nextDraft.truckNumber),
              driver: cleanText(nextDraft.driver),
              source: normalizeSourceCode(nextDraft.source, getPlantMaterialKeyForLog(nextDraft.plantId)),
              invCode: cleanText(nextDraft.invCode),
              updatedAt: new Date().toLocaleString(),
            },
      ),
    );
  }

  function openPlantFromLogPage(plantId) {
    setDriverLogEditRequest(null);
    setSelectedPlantId(plantId);
    setPage("cockpit");
  }

  function openDriverLogEdit(logId) {
    const targetEntry = driverLogs.find((entry) => entry.id === logId);
    if (!targetEntry) return;

    const plantId = Number(targetEntry.plantId);
    const plant = data.plants.find((item) => item.id === plantId) ?? null;
    const location = plant ? driverLogLocationForPlant(plant) : cleanText(targetEntry.location) || `Plant ${plantId}`;

    setDriverLogDraft(createDriverLogDraft(plantId, location));
    setDriverLogEditRequest({
      logId,
      requestedAt: Date.now(),
    });
    setPage("drivers");
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
              <div className="text-base font-semibold text-white">Robertson&apos;s Transport</div>
              <div className="mt-1 text-sm text-white/55">
                Powder train dispatch
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <CliButton active={page === "cockpit"} onClick={() => setPage("cockpit")}>
                  MAIN
                </CliButton>
                <CliButton
                  active={page === "decisions"}
                  onClick={() => setPage("decisions")}
                  className={
                    hasActNow && page !== "decisions"
                      ? "animate-pulse border-rose-400/60 bg-rose-500/15 text-rose-100 hover:bg-rose-500/20"
                      : ""
                  }
                >
                  Act Now / Watch Next{hasActNow ? ` (${actNowDecisions.length})` : ""}
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
                <CliButton
                  active={page === "source_allocations"}
                  onClick={() => setPage("source_allocations")}
                >
                  Source Allocations
                </CliButton>
                <CliButton active={page === "exceptions"} onClick={() => setPage("exceptions")}>
                  Exceptions{dispatchExceptions.length > 0 ? ` (${dispatchExceptions.length})` : ""}
                </CliButton>
                <CliButton active={page === "shift_summary"} onClick={() => setPage("shift_summary")}>
                  End of Shift
                </CliButton>
                <CliButton
                  active={page === "drivers"}
                  onClick={() => {
                    setDriverLogEditRequest(null);
                    setDriverLogDraft(createDriverLogDraft(null));
                    setPage("drivers");
                  }}
                >
                  Drivers
                </CliButton>
                <CliButton onClick={() => void refreshFromDesktop()} disabled={running}>
                  {running ? "Refreshing..." : "Refresh data"}
                </CliButton>
                <CliButton active={page === "notes"} onClick={() => setPage("notes")}>
                  Notes
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
                  <div className="mt-1">
                    <span className="text-white/50">Delivered </span>
                    <span className="font-semibold text-white">
                      {formatNumber(DELIVERED_YARDAGE, 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-white/15 px-3 py-2 text-sm text-white/80">
                <div>
                  <span className="text-white/50">Material Usage [Live]</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-white/50">Cement </span>
                    <span className="font-semibold text-white">
                      {LIVE_HEADER_USAGE.cement.used} / {LIVE_HEADER_USAGE.cement.total}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/50">Fly-ash </span>
                    <span className="font-semibold text-white">
                      {LIVE_HEADER_USAGE.flyash.used} / {LIVE_HEADER_USAGE.flyash.total}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="border border-white/15 px-3 py-2 text-sm text-white/65">
              Updated {new Date(data.meta?.generatedAt ?? Date.now()).toLocaleString()}
            </div>
          </div>
        </div>

        {error ? (
          <div className="border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {page === "cockpit" ? (
          <div className="flex flex-col gap-3">
            <PlantRibbon
              filteredPlants={sortedPlants}
              selectedPlant={selectedPlant}
              setSelectedPlantId={setSelectedPlantId}
              activeOnly={activeOnly}
              setActiveOnly={setActiveOnly}
              search={search}
              setSearch={setSearch}
              selectedRegion={selectedRegion}
              setSelectedRegion={setSelectedRegion}
              plantSort={plantSort}
              setPlantSort={setPlantSort}
            />
            {selectedPlant ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
                <PlantDetailsPanel
                  plant={selectedPlant}
                  drivers={drivers}
                  driverLogs={driverLogs}
                  sourceRules={sourceRules}
                  onClose={() => setSelectedPlantId(null)}
                  onOpenDriverLogPage={openDriverLogForPlant}
                />
                <MainPageDriverLogPanel
                  plant={selectedPlant}
                  driverLogs={driverLogs}
                  driverLogDraft={driverLogDraft}
                  driverOptions={driverOptions}
                  sourceRules={sourceRules}
                  onDraftChange={updateDriverLogDraft}
                  onSaveDriverLog={saveDriverLog}
                />
              </div>
            ) : null}
          </div>
        ) : page === "decisions" ? (
          <DecisionsPage
            actNowDecisions={actNowDecisions}
            watchDecisions={watchDecisions}
            showActNow={showActNow}
            setShowActNow={setShowActNow}
            showWatchNext={showWatchNext}
            setShowWatchNext={setShowWatchNext}
            selectedPlantId={selectedPlantId}
            setSelectedPlantId={setSelectedPlantId}
            selectedPlant={selectedPlant}
            drivers={drivers}
            driverLogs={driverLogs}
            sourceRules={sourceRules}
            onOpenDriverLogPage={openDriverLogForPlant}
            onClosePlant={() => setSelectedPlantId(null)}
          />
        ) : page === "plant_totals" ? (
          <PlantTotalsSection
            isOpen={showPlantTotals}
            onToggle={() => setShowPlantTotals((current) => !current)}
            rows={sortedPlants}
          />
        ) : page === "material_usage" ? (
          <MaterialUsageSection rows={sortedPlants} />
        ) : page === "source_allocations" ? (
          <SourceAllocationsPage />
        ) : page === "exceptions" ? (
          <ExceptionsPage
            exceptions={dispatchExceptions}
            onOpenPlant={openPlantFromLogPage}
            onEditLog={openDriverLogEdit}
          />
        ) : page === "shift_summary" ? (
          <EndOfShiftSummaryPage
            data={data}
            drivers={drivers}
            driverLogs={driverLogs}
            exceptions={dispatchExceptions}
            onOpenPlant={openPlantFromLogPage}
            onEditLog={openDriverLogEdit}
          />
        ) : page === "drivers" ? (
          <DriversPage
            drivers={drivers}
            plants={data.plants}
            plant={draftPlant}
            draft={driverLogDraft}
            logs={driverLogs}
            driverOptions={driverOptions}
            sourceRules={sourceRules}
            onOpenPlant={openPlantFromLogPage}
            onUpdateLog={updateSavedDriverLog}
            editRequest={driverLogEditRequest}
          />
        ) : page === "notes" ? (
          <NotesPage />
        ) : null
        }
      </div>
    </main>
  );
}

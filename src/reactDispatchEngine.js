const SHIP_SHEET = "ShippedOrderSummary";
const LOAD_SHEET_INDEX = 0;
const EARLY_DROP_COLUMNS = new Set([
  "Cust #",
  "Cust Name",
  "Del Addr",
  "City",
  "Descr",
  "Delivered Qty",
  "Ld/Sz",
  "Date",
  "avg_load_size",
]);
const YARD_LANES = [
  { key: "E-main", label: "Lane E", plantIds: [1, 2, 3, 4, 5, 6, 7] },
  { key: "N-main", label: "Lane N", plantIds: [8, 9, 10, 11, 12, 13, 14] },
  { key: "W-main", label: "Lane W", plantIds: [15, 16, 17, 18, 19, 20, 21, 54] },
  { key: "AF-main", label: "Lane AF", plantIds: [22, 23, 24, 25, 26, 27, 28, 71, 72, 73, 74, 75] },
  { key: "AO-main", label: "Lane AO", plantIds: [29, 30, 31, 32, 33, 34, 35] },
  { key: "E-upper", label: "Lane E Upper", plantIds: [36, 37, 38, 39, 40, 41, 42] },
  { key: "N-upper", label: "Lane N Upper", plantIds: [43, 44, 45, 46, 47, 48, 49] },
];
const EMPTY_VALUE = "";

let xlsxModulePromise;

export const PLANT_CELL_MAPPING = createPlantCellMapping();

export async function buildDispatchCockpitFromUploads({ shippedFile, loadFile }) {
  if (!shippedFile) {
    throw new Error("Upload 1.xlsx first so the cockpit can build the yard board.");
  }

  const XLSX = await loadXlsx();
  const shippedWorkbook = await readWorkbookFile(XLSX, shippedFile);
  const shippedRows = readObjectRows(XLSX, shippedWorkbook, SHIP_SHEET, { range: 2 });

  let loadRows = [];
  if (loadFile) {
    const loadWorkbook = await readWorkbookFile(XLSX, loadFile);
    loadRows = readObjectRows(XLSX, loadWorkbook, LOAD_SHEET_INDEX);
  }

  return buildDispatchCockpitFromRecords({
    shippedRows,
    loadRows,
    sourceLabel: [shippedFile.name, loadFile?.name].filter(Boolean).join(" + "),
  });
}

export function buildDispatchCockpitFromRecords({
  shippedRows,
  loadRows = [],
  sourceLabel = "Workbook snapshot",
}) {
  const normalizedShippedRows = shippedRows.map(normalizeRecordKeys);
  const normalizedLoadRows = loadRows.map(normalizeRecordKeys);
  const mappedPlantIds = Object.keys(PLANT_CELL_MAPPING)
    .map((value) => Number(value))
    .sort(comparePlantByCell);
  const orderTotals = new Map();
  const openingTotals = new Map(mappedPlantIds.map((plantId) => [plantId, 0]));
  const plantsById = new Map();
  const earlyOrders = [];

  mappedPlantIds.forEach((plantId) => {
    plantsById.set(plantId, {
      id: plantId,
      mappedCell: PLANT_CELL_MAPPING[plantId],
      openingYardage: 0,
      currentYardage: 0,
      inboundYardage: 0,
      outboundYardage: 0,
      earlyOrders: [],
      transfers: [],
      flags: [],
      spotlightTone: "idle",
      netChange: 0,
      earlyOrderCount: 0,
      flagCount: 0,
      movementCount: 0,
    });
  });

  normalizedShippedRows.forEach((row) => {
    const orderNumber = toInteger(row["Order #"]);
    const plantId = toInteger(row.Plant);
    const orderQty = toNumber(row["Order Qty"]);
    const startTime = parseTimeParts(row["Start Time"]);

    if (orderNumber !== null && Number.isFinite(orderQty)) {
      orderTotals.set(orderNumber, orderQty);
    }

    if (plantId !== null && openingTotals.has(plantId) && Number.isFinite(orderQty)) {
      openingTotals.set(plantId, (openingTotals.get(plantId) ?? 0) + orderQty);
    }

    if (!startTime || startTime.hour >= 5 || !Number.isFinite(orderQty) || orderQty <= 90) {
      return;
    }

    const filteredRow = {};
    Object.entries(row).forEach(([key, value]) => {
      if (EARLY_DROP_COLUMNS.has(key)) {
        return;
      }
      filteredRow[key] = key === "Start Time" ? formatTimeParts(startTime) : value;
    });

    if (orderNumber !== null) {
      filteredRow["Order #"] = orderNumber;
    }
    if (plantId !== null) {
      filteredRow.Plant = plantId;
    }
    filteredRow["Order Qty"] = orderQty;

    earlyOrders.push(filteredRow);

    if (plantId !== null && plantsById.has(plantId)) {
      plantsById.get(plantId).earlyOrders.push({
        orderNumber,
        orderQty,
        startTime: formatTimeParts(startTime),
        mixCode: stringifyValue(row["Mix #"]),
        truck: stringifyValue(row.Truck),
        status: stringifyValue(row.Status),
      });
    }
  });

  openingTotals.forEach((yardage, plantId) => {
    const plant = plantsById.get(plantId);
    if (!plant) {
      return;
    }
    plant.openingYardage = roundTo(yardage, 2);
    plant.currentYardage = roundTo(yardage, 2);
  });

  const duplicateCounts = new Map();
  normalizedLoadRows.forEach((row) => {
    const orderNumber = toInteger(row.Order);
    if (orderNumber === null) {
      return;
    }
    duplicateCounts.set(orderNumber, (duplicateCounts.get(orderNumber) ?? 0) + 1);
  });

  const duplicateOrders = new Set(
    Array.from(duplicateCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([orderNumber]) => orderNumber),
  );

  const referenceMoves = [];
  const negativeFlags = [];

  normalizedLoadRows.forEach((row, rowIndex) => {
    const orderNumber = toInteger(row.Order);
    const loads = toInteger(row.Loads) ?? 0;
    const fromPlant = toInteger(row["From Plant"]);
    const toPlant = toInteger(row["To Plant"]);

    if (!PLANT_CELL_MAPPING[fromPlant] || !PLANT_CELL_MAPPING[toPlant]) {
      return;
    }

    const totalQty = orderNumber !== null ? orderTotals.get(orderNumber) ?? 0 : 0;
    const loadsTimesTen = loads * 10;
    const remaining = roundTo(totalQty - loadsTimesTen, 4);
    const fromPlantState = plantsById.get(fromPlant);
    const toPlantState = plantsById.get(toPlant);

    if (!fromPlantState || !toPlantState) {
      return;
    }

    referenceMoves.push({
      Order: orderNumber ?? EMPTY_VALUE,
      TotalQty: totalQty,
      FromPlant: fromPlant,
      ToPlant: toPlant,
      "Loads x10": loadsTimesTen,
      Remaining: remaining,
    });

    if (orderNumber !== null && duplicateOrders.has(orderNumber)) {
      const flag = {
        Order: orderNumber,
        FromPlant: fromPlant,
        ToPlant: toPlant,
        AttemptedMove: remaining,
        CurrentYardage: fromPlantState.currentYardage,
        Reason: "Duplicate",
      };
      negativeFlags.push(flag);
      attachFlag(plantsById, flag);
      return;
    }

    if (fromPlantState.currentYardage - remaining < 0) {
      const flag = {
        Order: orderNumber ?? EMPTY_VALUE,
        FromPlant: fromPlant,
        ToPlant: toPlant,
        AttemptedMove: remaining,
        CurrentYardage: fromPlantState.currentYardage,
        Reason: "InsufficientYardage",
      };
      negativeFlags.push(flag);
      attachFlag(plantsById, flag);
      return;
    }

    fromPlantState.currentYardage = roundTo(fromPlantState.currentYardage - remaining, 2);
    toPlantState.currentYardage = roundTo(toPlantState.currentYardage + remaining, 2);
    fromPlantState.outboundYardage = roundTo(fromPlantState.outboundYardage + remaining, 2);
    toPlantState.inboundYardage = roundTo(toPlantState.inboundYardage + remaining, 2);

    fromPlantState.transfers.push({
      id: `move-${rowIndex + 1}-from`,
      orderNumber,
      counterpartPlant: toPlant,
      direction: "outbound",
      yardage: remaining,
      loads,
    });
    toPlantState.transfers.push({
      id: `move-${rowIndex + 1}-to`,
      orderNumber,
      counterpartPlant: fromPlant,
      direction: "inbound",
      yardage: remaining,
      loads,
    });
  });

  const plants = mappedPlantIds
    .map((plantId) => {
      const plant = plantsById.get(plantId);
      const netChange = roundTo(plant.currentYardage - plant.openingYardage, 2);
      const nextPlant = {
        ...plant,
        earlyOrders: [...plant.earlyOrders].sort(compareOrdersByQty),
        transfers: [...plant.transfers].sort(compareTransfersBySize),
        flags: [...plant.flags],
        netChange,
        earlyOrderCount: plant.earlyOrders.length,
        flagCount: plant.flags.length,
        movementCount: plant.transfers.length,
      };
      nextPlant.spotlightTone = resolvePlantTone(nextPlant);
      return nextPlant;
    })
    .sort(comparePlantByCell);

  const yardBoard = YARD_LANES.map((lane) => ({
    ...lane,
    plants: lane.plantIds.map((plantId) => plants.find((plant) => plant.id === plantId)).filter(Boolean),
  })).filter((lane) => lane.plants.length > 0);

  const totalOpeningYardage = plants.reduce((sum, plant) => sum + plant.openingYardage, 0);
  const totalCurrentYardage = plants.reduce((sum, plant) => sum + plant.currentYardage, 0);

  return {
    sourceLabel,
    builtAt: formatTimestamp(new Date()),
    plants,
    yardBoard,
    earlyOrders,
    referenceMoves,
    negativeFlags,
    earlyOrderColumns: collectColumns(earlyOrders),
    referenceMoveColumns: ["Order", "TotalQty", "FromPlant", "ToPlant", "Loads x10", "Remaining"],
    negativeFlagColumns: ["Order", "FromPlant", "ToPlant", "AttemptedMove", "CurrentYardage", "Reason"],
    summary: {
      totalOpeningYardage: roundTo(totalOpeningYardage, 2),
      totalCurrentYardage: roundTo(totalCurrentYardage, 2),
      appliedTransferCount: referenceMoves.length - negativeFlags.length,
      flaggedMoveCount: negativeFlags.length,
      earlyOrderCount: earlyOrders.length,
      activePlantCount: plants.filter((plant) => plant.openingYardage > 0 || plant.currentYardage > 0).length,
      shippedOrderCount: normalizedShippedRows.length,
    },
  };
}

async function readWorkbookFile(XLSX, file) {
  const arrayBuffer = await file.arrayBuffer();
  return XLSX.read(arrayBuffer, { type: "array", cellDates: true });
}

function readObjectRows(XLSX, workbook, sheetReference, options = {}) {
  const worksheet = resolveWorksheet(workbook, sheetReference);
  return XLSX.utils
    .sheet_to_json(worksheet, {
      defval: EMPTY_VALUE,
      blankrows: false,
      ...options,
    })
    .map(normalizeRecordKeys);
}

function resolveWorksheet(workbook, sheetReference) {
  if (typeof sheetReference === "number") {
    const sheetName = workbook.SheetNames[sheetReference];
    if (!sheetName) {
      throw new Error(`Sheet index ${sheetReference} was not found in the workbook.`);
    }
    return workbook.Sheets[sheetName];
  }

  const worksheet = workbook.Sheets[sheetReference];
  if (!worksheet) {
    throw new Error(`Sheet "${sheetReference}" was not found in the workbook.`);
  }
  return worksheet;
}

async function loadXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx");
  }
  return xlsxModulePromise;
}

function attachFlag(plantsById, flag) {
  const fromPlant = plantsById.get(flag.FromPlant);
  if (fromPlant) {
    fromPlant.flags.push({ ...flag, role: "origin" });
  }

  const toPlant = plantsById.get(flag.ToPlant);
  if (toPlant) {
    toPlant.flags.push({ ...flag, role: "destination" });
  }
}

function collectColumns(rows) {
  const seen = new Set();
  const columns = [];

  rows.forEach((row) => {
    Object.keys(row).forEach((column) => {
      if (seen.has(column)) {
        return;
      }
      seen.add(column);
      columns.push(column);
    });
  });

  return columns;
}

function normalizeRecordKeys(record) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [String(key).trim(), value]),
  );
}

function createPlantCellMapping() {
  const mapping = {};
  const cols1 = ["E", "N", "W", "AF", "AO"];
  const starts1 = [1, 8, 15, 22, 29];
  const rows1 = [5, 15, 25, 35, 45, 55, 65];

  cols1.forEach((column, index) => {
    rows1.forEach((rowNumber, rowIndex) => {
      mapping[starts1[index] + rowIndex] = `${column}${rowNumber}`;
    });
  });

  const cols2 = ["E", "N"];
  const starts2 = [36, 43];
  const rows2 = [76, 86, 96, 106, 116, 126, 136];

  cols2.forEach((column, index) => {
    rows2.forEach((rowNumber, rowIndex) => {
      mapping[starts2[index] + rowIndex] = `${column}${rowNumber}`;
    });
  });

  mapping[54] = "W86";

  rows2.slice(0, 5).forEach((rowNumber, rowIndex) => {
    mapping[71 + rowIndex] = `AF${rowNumber}`;
  });

  return mapping;
}

function parseTimeParts(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { hour: value.getHours(), minute: value.getMinutes() };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = value > 1 ? value % 1 : value;
    if (normalized >= 0 && normalized < 1) {
      const totalMinutes = Math.round(normalized * 24 * 60);
      return {
        hour: Math.floor(totalMinutes / 60) % 24,
        minute: totalMinutes % 60,
      };
    }
  }

  const text = String(value ?? EMPTY_VALUE).trim();
  if (!text) {
    return null;
  }

  const twelveHourMatch = text.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
  if (twelveHourMatch) {
    let hour = Number(twelveHourMatch[1]);
    const minute = Number(twelveHourMatch[2] ?? "0");
    const meridiem = twelveHourMatch[3].toUpperCase();

    if (meridiem === "PM" && hour !== 12) {
      hour += 12;
    }
    if (meridiem === "AM" && hour === 12) {
      hour = 0;
    }

    return { hour, minute };
  }

  const twentyFourHourMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFourHourMatch) {
    return {
      hour: Number(twentyFourHourMatch[1]),
      minute: Number(twentyFourHourMatch[2]),
    };
  }

  const parsedDate = new Date(text);
  if (!Number.isNaN(parsedDate.getTime())) {
    return { hour: parsedDate.getHours(), minute: parsedDate.getMinutes() };
  }

  return null;
}

function formatTimeParts(timeParts) {
  if (!timeParts) {
    return "n/a";
  }

  const hour = String(timeParts.hour).padStart(2, "0");
  const minute = String(timeParts.minute).padStart(2, "0");
  return `${hour}:${minute}`;
}

function toInteger(value) {
  const number = toNumber(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  const text = String(value ?? EMPTY_VALUE).trim();
  if (!text) {
    return NaN;
  }

  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function stringifyValue(value) {
  if (value === null || value === undefined || value === EMPTY_VALUE) {
    return "n/a";
  }
  return String(value);
}

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatTimestamp(date) {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolvePlantTone(plant) {
  if (plant.flagCount > 0) {
    return "critical";
  }
  if (plant.movementCount > 0) {
    return "active";
  }
  if (plant.currentYardage > 0 || plant.openingYardage > 0) {
    return "steady";
  }
  return "idle";
}

function comparePlantByCell(left, right) {
  return cellSortWeight(PLANT_CELL_MAPPING[left.id ?? left] || EMPTY_VALUE)
    - cellSortWeight(PLANT_CELL_MAPPING[right.id ?? right] || EMPTY_VALUE);
}

function compareOrdersByQty(left, right) {
  return (right.orderQty ?? 0) - (left.orderQty ?? 0);
}

function compareTransfersBySize(left, right) {
  return Math.abs(right.yardage ?? 0) - Math.abs(left.yardage ?? 0);
}

function cellSortWeight(cellRef) {
  const match = String(cellRef).match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  let columnIndex = 0;
  match[1].split("").forEach((char) => {
    columnIndex = columnIndex * 26 + char.charCodeAt(0) - 64;
  });

  return Number(match[2]) * 1000 + columnIndex;
}

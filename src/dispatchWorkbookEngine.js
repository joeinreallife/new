import * as XLSX from "xlsx";

const SHIP_SHEET = "ShippedOrderSummary";
const TARGET_SHEET = "YARDS";
const EARLY_SHEET = "EarlyOrders";
const REF_SHEET = "LoadScheduleRef";
const FLAG_SHEET = "NegativeFlags";
const MATERIAL_SHEET = "MaterialUsageSummary";

const DROP_COLUMNS = [
  "Cust #",
  "Cust Name",
  "Del Addr",
  "City",
  "Descr",
  "Delivered Qty",
  "Ld/Sz",
  "Date",
  "avg_load_size",
];

const MATERIAL_USAGE_COLUMNS = [
  "Code",
  "Material",
  "Ticket Quantity",
  "Ticket Yards",
  "Unit of Measure",
  "Mix Unit of Measure",
  "Plant",
  "Plant Name",
  "formatted_time",
  "tkt_time",
];

const MATERIALS_TO_KEEP = ["CEMENT", "FLYASH", "TYPE V CEMENT", "PLC CEMENT"];

export const PLANT_CELL_MAP = buildPlantCellMap();

function buildPlantCellMap() {
  const mapping = {};
  const cols1 = ["E", "N", "W", "AF", "AO"];
  const starts1 = [1, 8, 15, 22, 29];
  const rows1 = [5, 15, 25, 35, 45, 55, 65];

  cols1.forEach((column, columnIndex) => {
    rows1.forEach((row, rowIndex) => {
      mapping[starts1[columnIndex] + rowIndex] = `${column}${row}`;
    });
  });

  const cols2 = ["E", "N"];
  const starts2 = [36, 43];
  const rows2 = [76, 86, 96, 106, 116, 126, 136];

  cols2.forEach((column, columnIndex) => {
    rows2.forEach((row, rowIndex) => {
      mapping[starts2[columnIndex] + rowIndex] = `${column}${row}`;
    });
  });

  mapping[54] = "W86";
  [71, 72, 73, 74, 75].forEach((plantId, index) => {
    mapping[plantId] = `AF${rows2[index]}`;
  });

  return mapping;
}

function normText(value) {
  return String(value ?? "").trim();
}

function cleanNumeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function toInt(value) {
  const number = cleanNumeric(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function parseStartTimeMinutes(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value < 1) {
      return Math.round(value * 24 * 60);
    }
    return value;
  }

  const text = normText(value).toUpperCase();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function formatTimeLabel(value) {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1) {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return normText(value);
}

function titleCase(value) {
  return normText(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function rowsFromSheet(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });
}

function workbookFromBuffer(buffer) {
  return XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    raw: false,
  });
}

function firstSheetName(workbook) {
  return workbook.SheetNames[0];
}

function isNonEmptyRow(row) {
  return Array.isArray(row) && row.some((value) => value !== null && value !== "");
}

function cellSortWeight(cellRef) {
  const match = String(cellRef || "").match(/^([A-Z]+)(\d+)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;

  const letters = match[1].toUpperCase();
  const row = Number(match[2]);
  let column = 0;

  letters.split("").forEach((char) => {
    column = column * 26 + char.charCodeAt(0) - 64;
  });

  return row * 1000 + column;
}

function makeShippedOrderRecord(headerIndexByName, row) {
  const get = (label) => row[headerIndexByName.get(label)] ?? null;

  return {
    orderNumber: normText(get("Order #")),
    customerId: normText(get("Cust #")),
    customerName: normText(get("Cust Name")),
    deliveryAddress: normText(get("Del Addr")),
    city: normText(get("City")),
    mixCode: normText(get("Mix #")),
    description: normText(get("Descr")),
    plantId: toInt(get("Plant")),
    truck: normText(get("Truck")),
    rate: cleanNumeric(get("Rate")),
    startTime: formatTimeLabel(get("Start Time")),
    startMinutes: parseStartTimeMinutes(get("Start Time")),
    travelTime: cleanNumeric(get("Travel Time")),
    orderQty: cleanNumeric(get("Order Qty")) ?? 0,
    deliveredQty: cleanNumeric(get("Delivered Qty")),
    loadSize: cleanNumeric(get("Ld/Sz")),
    status: normText(get("Status")),
    salesmanId: normText(get("Salesman #")),
    date: normText(get("Date")),
    avgLoadSize: cleanNumeric(get("avg_load_size")),
    raw: Object.fromEntries(
      [...headerIndexByName.entries()].map(([label, index]) => [label, row[index] ?? null]),
    ),
  };
}

function parseShippedOrders(buffer) {
  const workbook = workbookFromBuffer(buffer);
  const sheetName = workbook.SheetNames.includes(SHIP_SHEET) ? SHIP_SHEET : firstSheetName(workbook);
  const rows = rowsFromSheet(workbook.Sheets[sheetName]);
  const headers = rows[2] || [];
  const headerIndexByName = new Map(headers.map((header, index) => [header, index]));
  const dataRows = rows.slice(3).filter(isNonEmptyRow);
  const shippedOrders = dataRows.map((row) => makeShippedOrderRecord(headerIndexByName, row));

  return {
    workbook,
    sheetName,
    sourceRowCount: shippedOrders.length,
    shippedOrders,
    headers,
  };
}

function buildEarlyOrders(shippedOrders) {
  const rows = shippedOrders
    .filter((row) => row.startMinutes !== null && row.startMinutes < 5 * 60)
    .filter((row) => (cleanNumeric(row.orderQty) ?? 0) > 90)
    .map((row) => {
      const trimmed = {};

      Object.entries(row.raw).forEach(([key, value]) => {
        if (!DROP_COLUMNS.includes(key)) {
          trimmed[key] = value;
        }
      });

      return trimmed;
    });

  const columns = rows.length
    ? Object.keys(rows[0])
    : [
        "Order #",
        "Mix #",
        "Plant",
        "Truck",
        "Rate",
        "Start Time",
        "Travel Time",
        "Order Qty",
        "Status",
        "Salesman #",
      ];

  return {
    columns,
    rows,
  };
}

function buildOrderQuantityBook(shippedOrders) {
  const totals = new Map();

  shippedOrders.forEach((row) => {
    const orderId = toInt(row.orderNumber);
    if (!Number.isFinite(orderId)) return;
    totals.set(orderId, (totals.get(orderId) || 0) + (cleanNumeric(row.orderQty) ?? 0));
  });

  return totals;
}

function buildPlantTotals(shippedOrders) {
  const totals = new Map();

  for (let plantId = 1; plantId <= 75; plantId += 1) {
    totals.set(plantId, 0);
  }

  shippedOrders.forEach((row) => {
    if (!Number.isFinite(row.plantId)) return;
    totals.set(row.plantId, (totals.get(row.plantId) || 0) + (cleanNumeric(row.orderQty) ?? 0));
  });

  return totals;
}

function parseLoadSchedule(buffer) {
  if (!buffer) {
    return {
      workbook: null,
      sheetName: null,
      rows: [],
      duplicateOrders: new Set(),
    };
  }

  const workbook = workbookFromBuffer(buffer);
  const sheetName = firstSheetName(workbook);
  const rows = rowsFromSheet(workbook.Sheets[sheetName]);
  const headers = rows[0] || [];
  const headerIndexByName = new Map(headers.map((header, index) => [header, index]));

  const records = rows.slice(1).filter(isNonEmptyRow).map((row) => {
    const get = (label) => row[headerIndexByName.get(label)] ?? null;

    return {
      order: toInt(get("Order")),
      plant: toInt(get("Plant")),
      loads: cleanNumeric(get("Loads")) ?? 0,
      fromPlant: toInt(get("From Plant")),
      toPlant: toInt(get("To Plant")),
    };
  });

  const counts = new Map();
  records.forEach((row) => {
    if (!Number.isFinite(row.order)) return;
    counts.set(row.order, (counts.get(row.order) || 0) + 1);
  });

  const duplicateOrders = new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([order]) => order),
  );

  return {
    workbook,
    sheetName,
    rows: records,
    duplicateOrders,
  };
}

function parseYardsTemplate(buffer) {
  if (!buffer) {
    return {
      workbook: null,
      sheet: null,
      sheetName: null,
      baselineByPlant: new Map(),
    };
  }

  const workbook = workbookFromBuffer(buffer);
  if (!workbook.SheetNames.includes(TARGET_SHEET)) {
    throw new Error(`Template workbook is missing the ${TARGET_SHEET} sheet.`);
  }

  const sheet = workbook.Sheets[TARGET_SHEET];
  const baselineByPlant = new Map();

  Object.entries(PLANT_CELL_MAP).forEach(([plantKey, cellRef]) => {
    const plantId = Number(plantKey);
    const cell = sheet[cellRef];
    baselineByPlant.set(plantId, cleanNumeric(cell?.v) ?? 0);
  });

  return {
    workbook,
    sheet,
    sheetName: TARGET_SHEET,
    baselineByPlant,
  };
}

function parseMaterialUsage(buffer) {
  if (!buffer) {
    return {
      workbook: null,
      sheetName: null,
      rows: [],
      summaryRows: [],
    };
  }

  const workbook = workbookFromBuffer(buffer);
  const sheetName = firstSheetName(workbook);
  const rows = rowsFromSheet(workbook.Sheets[sheetName]).slice(1);
  const records = rows
    .map((row) => Object.fromEntries(MATERIAL_USAGE_COLUMNS.map((column, index) => [column, row[index] ?? null])))
    .filter((row) => normText(row.Material))
    .filter((row) => normText(row.Material).toUpperCase() !== "DESCRIPTION")
    .map((row) => ({
      plant: normText(row.Plant),
      plantName: titleCase(row["Plant Name"]),
      material: normText(row.Material).toUpperCase(),
      ticketQuantity: cleanNumeric(row["Ticket Quantity"]) ?? 0,
    }))
    .filter((row) => MATERIALS_TO_KEEP.some((material) => row.material.includes(material)));

  const summaryByKey = new Map();
  records.forEach((row) => {
    const plantLabel = [row.plant, row.plantName].filter(Boolean).join(". ");
    const key = `${plantLabel}|${row.material}`;
    const current = summaryByKey.get(key) || {
      plantLabel,
      material: row.material,
      ticketQuantity: 0,
    };

    current.ticketQuantity += row.ticketQuantity;
    summaryByKey.set(key, current);
  });

  const summaryRows = [...summaryByKey.values()]
    .map((row) => ({
      plantLabel: row.plantLabel,
      material: row.material,
      ticketQuantity: Number(row.ticketQuantity.toFixed(4)),
      totalLoads: Number((row.ticketQuantity / 57000).toFixed(4)),
    }))
    .sort((left, right) => {
      if (left.plantLabel === right.plantLabel) {
        return left.material.localeCompare(right.material);
      }
      return left.plantLabel.localeCompare(right.plantLabel);
    });

  return {
    workbook,
    sheetName,
    rows: records,
    summaryRows,
  };
}

function processTransfers(loadSchedule, orderQuantities, plantTotals) {
  const adjustedTotals = new Map(plantTotals);
  const referenceRows = [];
  const flags = [];
  const moves = [];

  loadSchedule.rows.forEach((row, index) => {
    const order = row.order;
    const totalQty = orderQuantities.get(order) || 0;
    const loadsTimesTen = Number(((cleanNumeric(row.loads) ?? 0) * 10).toFixed(4));
    const remaining = Number((totalQty - loadsTimesTen).toFixed(4));
    const currentFrom = adjustedTotals.get(row.fromPlant) || 0;
    const currentTo = adjustedTotals.get(row.toPlant) || 0;
    const mappingFrom = PLANT_CELL_MAP[row.fromPlant];
    const mappingTo = PLANT_CELL_MAP[row.toPlant];

    if (!mappingFrom || !mappingTo) {
      return;
    }

    const reference = {
      sequence: index + 1,
      order,
      totalQty,
      fromPlant: row.fromPlant,
      toPlant: row.toPlant,
      loadsTimesTen,
      remaining,
    };
    referenceRows.push(reference);

    if (loadSchedule.duplicateOrders.has(order)) {
      const flag = {
        order,
        fromPlant: row.fromPlant,
        toPlant: row.toPlant,
        attemptedMove: remaining,
        currentYardage: currentFrom,
        reason: "Duplicate",
      };

      flags.push(flag);
      moves.push({
        ...reference,
        status: "flagged",
        reason: "Duplicate",
        fromBefore: currentFrom,
        toBefore: currentTo,
        fromAfter: currentFrom,
        toAfter: currentTo,
      });
      return;
    }

    if (currentFrom - remaining < 0) {
      const flag = {
        order,
        fromPlant: row.fromPlant,
        toPlant: row.toPlant,
        attemptedMove: remaining,
        currentYardage: currentFrom,
        reason: "InsufficientYardage",
      };

      flags.push(flag);
      moves.push({
        ...reference,
        status: "flagged",
        reason: "InsufficientYardage",
        fromBefore: currentFrom,
        toBefore: currentTo,
        fromAfter: currentFrom,
        toAfter: currentTo,
      });
      return;
    }

    const fromAfter = Number((currentFrom - remaining).toFixed(4));
    const toAfter = Number((currentTo + remaining).toFixed(4));

    adjustedTotals.set(row.fromPlant, fromAfter);
    adjustedTotals.set(row.toPlant, toAfter);

    moves.push({
      ...reference,
      status: "applied",
      reason: null,
      fromBefore: currentFrom,
      toBefore: currentTo,
      fromAfter,
      toAfter,
    });
  });

  return {
    adjustedTotals,
    referenceRows,
    flags,
    moves,
  };
}

function buildPlantRows(plantTotals, adjustedTotals, templateBaselineByPlant) {
  return [...plantTotals.entries()]
    .filter(([plantId]) => Boolean(PLANT_CELL_MAP[plantId]))
    .map(([plantId, computedYards]) => {
      const baseYards = Number(computedYards.toFixed(2));
      const finalYards = Number((adjustedTotals.get(plantId) || 0).toFixed(2));
      const transferDelta = Number((finalYards - baseYards).toFixed(2));
      const templateYards = templateBaselineByPlant.get(plantId) || 0;
      return {
        plantId,
        cell: PLANT_CELL_MAP[plantId],
        baseYards,
        finalYards,
        transferDelta,
        templateYards,
        computedYards: baseYards,
        scheduledYards: finalYards,
        moveDelta: transferDelta,
        templateDelta: Number((finalYards - templateYards).toFixed(2)),
      };
    })
    .sort((left, right) => cellSortWeight(left.cell) - cellSortWeight(right.cell));
}

function buildMetrics(shippedOrders, earlyOrders, moves, flags, materialSummary, plantRows) {
  const totalOrderedYards = shippedOrders.reduce((sum, row) => sum + (cleanNumeric(row.orderQty) ?? 0), 0);
  const totalTransferredYards = moves
    .filter((row) => row.status === "applied")
    .reduce((sum, row) => sum + row.remaining, 0);
  const activePlants = plantRows.filter((row) => row.scheduledYards > 0).length;
  const watchedPlants = plantRows.filter(
    (row) => row.scheduledYards > 0 && Math.abs(row.moveDelta) > 0,
  ).length;

  return {
    totalOrders: shippedOrders.length,
    totalOrderedYards: Number(totalOrderedYards.toFixed(2)),
    earlyOrders: earlyOrders.rows.length,
    plannedMoves: moves.length,
    appliedMoves: moves.filter((row) => row.status === "applied").length,
    flaggedMoves: flags.length,
    duplicateFlags: flags.filter((row) => row.reason === "Duplicate").length,
    insufficientFlags: flags.filter((row) => row.reason === "InsufficientYardage").length,
    totalTransferredYards: Number(totalTransferredYards.toFixed(2)),
    activePlants,
    adjustedPlants: watchedPlants,
    materialSignals: materialSummary.length,
  };
}

function replaceSheet(workbook, sheetName, worksheet, desiredIndex) {
  if (workbook.SheetNames.includes(sheetName)) {
    workbook.SheetNames = workbook.SheetNames.filter((name) => name !== sheetName);
  }

  workbook.Sheets[sheetName] = worksheet;

  if (desiredIndex === undefined || desiredIndex === null) {
    workbook.SheetNames.push(sheetName);
    return;
  }

  const boundedIndex = Math.max(0, Math.min(desiredIndex, workbook.SheetNames.length));
  workbook.SheetNames.splice(boundedIndex, 0, sheetName);
}

function sheetFromObjects(rows, explicitColumns) {
  const columns = explicitColumns || (rows.length ? Object.keys(rows[0]) : []);
  const body = [columns, ...rows.map((row) => columns.map((column) => row[column] ?? null))];
  const worksheet = XLSX.utils.aoa_to_sheet(body);

  worksheet["!cols"] = columns.map((column) => ({ wch: Math.max(String(column).length + 2, 14) }));
  return worksheet;
}

function cloneArrayBuffer(source) {
  if (source instanceof ArrayBuffer) {
    return source.slice(0);
  }

  if (ArrayBuffer.isView(source)) {
    return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  }

  throw new Error("Expected workbook data as ArrayBuffer or TypedArray.");
}

export function createDispatchCockpitModel({
  shippedOrdersBuffer,
  loadScheduleBuffer,
  yardTemplateBuffer,
  materialUsageBuffer,
  fileLabels = {},
}) {
  if (!shippedOrdersBuffer) {
    throw new Error("A shipped orders workbook is required.");
  }

  const shipped = parseShippedOrders(shippedOrdersBuffer);
  const loadSchedule = parseLoadSchedule(loadScheduleBuffer);
  const template = parseYardsTemplate(yardTemplateBuffer);
  const materialUsage = parseMaterialUsage(materialUsageBuffer);

  const earlyOrders = buildEarlyOrders(shipped.shippedOrders);
  const orderQuantities = buildOrderQuantityBook(shipped.shippedOrders);
  const plantTotals = buildPlantTotals(shipped.shippedOrders);
  const transferPlan = processTransfers(loadSchedule, orderQuantities, plantTotals);
  const plantRows = buildPlantRows(
    plantTotals,
    transferPlan.adjustedTotals,
    template.baselineByPlant,
  );

  return {
    generatedAt: new Date().toISOString(),
    files: {
      shippedOrders: fileLabels.shippedOrders || null,
      loadSchedule: fileLabels.loadSchedule || null,
      yardTemplate: fileLabels.yardTemplate || null,
      materialUsage: fileLabels.materialUsage || null,
    },
    meta: {
      shippedSheet: shipped.sheetName,
      loadSheet: loadSchedule.sheetName,
      templateSheet: template.sheetName,
      materialSheet: materialUsage.sheetName,
      shippedRows: shipped.sourceRowCount,
      loadRows: loadSchedule.rows.length,
      materialRows: materialUsage.rows.length,
    },
    earlyOrders,
    plantRows,
    moves: transferPlan.moves,
    flags: transferPlan.flags,
    loadScheduleReference: transferPlan.referenceRows,
    materialSummary: materialUsage.summaryRows,
    metrics: buildMetrics(
      shipped.shippedOrders,
      earlyOrders,
      transferPlan.moves,
      transferPlan.flags,
      materialUsage.summaryRows,
      plantRows,
    ),
    exportSeed: {
      templateBuffer: yardTemplateBuffer ? cloneArrayBuffer(yardTemplateBuffer) : null,
      earlyOrders,
      plantRows,
      loadScheduleReference: transferPlan.referenceRows,
      flags: transferPlan.flags,
      materialSummary: materialUsage.summaryRows,
    },
  };
}

export function buildDispatchWorkbookExport(model) {
  const workbook = model?.exportSeed?.templateBuffer
    ? workbookFromBuffer(model.exportSeed.templateBuffer)
    : XLSX.utils.book_new();
  const targetSheet = model?.exportSeed?.templateBuffer
    ? workbook.Sheets[TARGET_SHEET]
    : XLSX.utils.aoa_to_sheet([["Generated from shipped orders and load schedule"]]);

  if (!targetSheet) {
    throw new Error(`Template workbook is missing the ${TARGET_SHEET} sheet.`);
  }

  model.exportSeed.plantRows.forEach((row) => {
    const cellRef = PLANT_CELL_MAP[row.plantId];
    if (!cellRef) return;
    targetSheet[cellRef] = {
      ...(targetSheet[cellRef] || {}),
      t: "n",
      v: row.scheduledYards,
      w: String(row.scheduledYards),
    };
  });

  if (!workbook.SheetNames.includes(TARGET_SHEET)) {
    XLSX.utils.book_append_sheet(workbook, targetSheet, TARGET_SHEET);
  }

  const earlySheet = sheetFromObjects(model.exportSeed.earlyOrders.rows, model.exportSeed.earlyOrders.columns);
  replaceSheet(workbook, EARLY_SHEET, earlySheet, 0);

  const refSheet = sheetFromObjects(model.exportSeed.loadScheduleReference, [
    "sequence",
    "order",
    "totalQty",
    "fromPlant",
    "toPlant",
    "loadsTimesTen",
    "remaining",
  ]);
  replaceSheet(workbook, REF_SHEET, refSheet, 1);

  const flagSheet = sheetFromObjects(model.exportSeed.flags, [
    "order",
    "fromPlant",
    "toPlant",
    "attemptedMove",
    "currentYardage",
    "reason",
  ]);
  replaceSheet(workbook, FLAG_SHEET, flagSheet, 2);

  if (model.exportSeed.materialSummary.length) {
    const materialSheet = sheetFromObjects(model.exportSeed.materialSummary, [
      "plantLabel",
      "material",
      "ticketQuantity",
      "totalLoads",
    ]);
    replaceSheet(workbook, MATERIAL_SHEET, materialSheet);
  }

  return {
    fileName: `dispatch-cockpit-${new Date().toISOString().slice(0, 10)}.xlsx`,
    workbook,
    buffer: XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
  };
}

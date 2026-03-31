import { useEffect, useState } from "react";

import { PlantRibbon } from "./PlantRibbon.jsx";

const CSV_FILES = {
  plantYards: "C:/Users/destr/Downloads/imager/7/plant_yards.csv",
  earlyOrders: "C:/Users/destr/Downloads/imager/7/early_orders.csv",
};
const REFRESH_INTERVAL_MS = 5000;
const PLANT_CELL_MAPPING = createPlantCellMapping();
const BASE_PLANTS = Array.from({ length: 75 }, (_, index) => {
  const id = index + 1;
  const mappedCell = PLANT_CELL_MAPPING[id] ?? null;

  return {
    id,
    name: `Plant ${id}`,
    yards: 0,
    earlyOrderCount: 0,
    queuedYards: 0,
    nextStartTime: "none",
    leadMix: "n/a",
    mappedCell,
    lane: extractLane(mappedCell),
    statusLabel: "clear",
  };
});

export default function PlantRibbonPage() {
  const [plants, setPlants] = useState(BASE_PLANTS);
  const [selectedPlantId, setSelectedPlantId] = useState(BASE_PLANTS[0]?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    async function refreshPlantsFromCsv() {
      const desktopApi = window.dispatchCockpitDesktop;
      if (!desktopApi?.readWorkbookFile) {
        return;
      }

      try {
        const [plantYardsResult, earlyOrdersResult] = await Promise.allSettled([
          desktopApi.readWorkbookFile(CSV_FILES.plantYards),
          desktopApi.readWorkbookFile(CSV_FILES.earlyOrders),
        ]);

        if (cancelled) {
          return;
        }

        const plantYardRows =
          plantYardsResult.status === "fulfilled" && plantYardsResult.value?.base64
            ? parseCsvText(decodeBase64ToText(plantYardsResult.value.base64))
            : [];
        const earlyOrderRows =
          earlyOrdersResult.status === "fulfilled" && earlyOrdersResult.value?.base64
            ? parseCsvText(decodeBase64ToText(earlyOrdersResult.value.base64))
            : [];

        setPlants(buildPlantTiles(plantYardRows, earlyOrderRows));
      } catch (error) {
        console.error("Unable to refresh plant ribbon from CSV files.", error);
      }
    }

    void refreshPlantsFromCsv();
    intervalId = window.setInterval(() => {
      void refreshPlantsFromCsv();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    if (!plants.some((plant) => plant.id === selectedPlantId)) {
      setSelectedPlantId(plants[0]?.id ?? null);
    }
  }, [plants, selectedPlantId]);

  const selectedPlant = plants.find((plant) => plant.id === selectedPlantId) ?? null;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <PlantRibbon
        filteredPlants={plants}
        selectedPlant={selectedPlant}
        setSelectedPlantId={setSelectedPlantId}
        PlantTile={PlantTile}
      />
    </div>
  );
}

function PlantTile({ plant, selected, onClick }) {
  const detailCardClass = selected
    ? "border-white/10 bg-white/10"
    : "border-slate-200 bg-slate-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-[240px] shrink-0 snap-start rounded-2xl border p-4 text-left shadow-sm transition ${
        selected
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
              selected ? "text-slate-300" : "text-slate-500"
            }`}
          >
            plant
          </div>
          <div className="mt-1 text-2xl font-semibold">{plant.id}</div>
          <div
            className={`mt-1 text-sm font-medium ${
              selected ? "text-slate-200" : "text-slate-600"
            }`}
          >
            {plant.name}
          </div>
        </div>

        <div
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            selected ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600"
          }`}
        >
          {plant.statusLabel}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <TileMetric
          label="yards"
          value={formatNumber(plant.yards)}
          selected={selected}
          className={detailCardClass}
        />
        <TileMetric
          label="early orders"
          value={formatNumber(plant.earlyOrderCount)}
          selected={selected}
          className={detailCardClass}
        />
        <TileMetric
          label="next start"
          value={plant.nextStartTime}
          selected={selected}
          className={detailCardClass}
        />
        <TileMetric
          label="queued yd"
          value={formatNumber(plant.queuedYards)}
          selected={selected}
          className={detailCardClass}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <TileMetric
          label="cell"
          value={plant.mappedCell ?? "not mapped"}
          selected={selected}
          className={detailCardClass}
        />
        <TileMetric
          label="mix"
          value={plant.leadMix}
          selected={selected}
          className={detailCardClass}
        />
      </div>
    </button>
  );
}

function TileMetric({ label, value, selected, className }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 ${className}`}>
      <div
        className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
          selected ? "text-slate-300" : "text-slate-500"
        }`}
      >
        {label}
      </div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function buildPlantTiles(plantYardRows, earlyOrderRows) {
  const yardageByPlant = new Map();
  const plantNameById = new Map();
  const earlyOrdersByPlant = new Map();

  plantYardRows.forEach((row) => {
    const plantId = toInteger(
      row.Plant ?? row["Plant #"] ?? row.plant ?? row.plant_id ?? row.plantId,
    );
    if (plantId === null) {
      return;
    }

    const yardage =
      toNumber(
        row["Total Yardage"] ??
          row.Yards ??
          row.Yardage ??
          row.total_yardage ??
          row.totalYardage,
      ) ?? 0;
    const plantName = extractPlantName(row);

    yardageByPlant.set(plantId, yardage);
    if (plantName && !plantNameById.has(plantId)) {
      plantNameById.set(plantId, plantName);
    }
  });

  earlyOrderRows.forEach((row) => {
    const plantId = toInteger(
      row.Plant ?? row["Plant #"] ?? row.plant ?? row.plant_id ?? row.plantId,
    );
    if (plantId === null) {
      return;
    }

    const plantOrders = earlyOrdersByPlant.get(plantId) ?? [];
    const plantName = extractPlantName(row);
    if (plantName && !plantNameById.has(plantId)) {
      plantNameById.set(plantId, plantName);
    }

    plantOrders.push({
      orderNumber: normalizeText(row["Order #"] ?? row.order ?? row.order_number),
      mix: normalizeText(row["Mix #"] ?? row.Mix ?? row.mix ?? row.mix_code) || "n/a",
      startTime: formatTimeLabel(row["Start Time"] ?? row.start_time ?? row.startTime),
      startMinutes: parseTimeToMinutes(row["Start Time"] ?? row.start_time ?? row.startTime),
      orderQty: toNumber(row["Order Qty"] ?? row.order_qty ?? row.orderQty) ?? 0,
    });

    earlyOrdersByPlant.set(plantId, plantOrders);
  });

  return BASE_PLANTS.map((plant) => {
    const orders = [...(earlyOrdersByPlant.get(plant.id) ?? [])].sort(compareEarlyOrders);
    const queuedYards = orders.reduce((sum, order) => sum + order.orderQty, 0);

    return {
      ...plant,
      name: plantNameById.get(plant.id) ?? plant.name,
      yards: yardageByPlant.has(plant.id) ? yardageByPlant.get(plant.id) : plant.yards,
      earlyOrderCount: orders.length,
      queuedYards,
      nextStartTime: orders[0]?.startTime ?? "none",
      leadMix: orders[0]?.mix ?? "n/a",
      statusLabel: orders.length > 0 ? `${orders.length} early` : "clear",
    };
  });
}

function compareEarlyOrders(left, right) {
  const leftMinutes = left.startMinutes ?? Number.MAX_SAFE_INTEGER;
  const rightMinutes = right.startMinutes ?? Number.MAX_SAFE_INTEGER;

  if (leftMinutes !== rightMinutes) {
    return leftMinutes - rightMinutes;
  }

  return right.orderQty - left.orderQty;
}

function extractPlantName(row) {
  const candidates = [
    row["Plant Name"],
    row.plant_name,
    row.plantName,
    row.Name,
    row.name,
  ];

  for (const candidate of candidates) {
    const value = normalizeText(candidate);
    if (value) {
      return value;
    }
  }

  return "";
}

function parseCsvText(text) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  const [headerRow = [], ...bodyRows] = rows.filter((row) =>
    row.some((value) => normalizeText(value) !== ""),
  );
  const headers = headerRow.map((header) => stripBom(normalizeText(header)));

  return bodyRows.map((row) =>
    Object.fromEntries(headers.map((header, columnIndex) => [header, normalizeText(row[columnIndex])])),
  );
}

function decodeBase64ToText(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder("utf-8").decode(bytes);
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

function extractLane(cellRef) {
  const match = String(cellRef ?? "").match(/^[A-Z]+/);
  return match ? match[0] : null;
}

function parseTimeToMinutes(value) {
  const text = normalizeText(value);
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function formatTimeLabel(value) {
  const text = normalizeText(value);
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return text || "none";
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}

function toInteger(value) {
  const number = toNumber(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function toNumber(value) {
  const text = normalizeText(value).replace(/,/g, "");
  if (!text) {
    return null;
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }

  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

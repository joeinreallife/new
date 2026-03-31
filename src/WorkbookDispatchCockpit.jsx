import { startTransition, useEffect, useState } from "react";
import { formatRegionLabel, getPlantRegionMeta, REGION_ORDER } from "./dispatchMetadata.js";
import {
  buildDispatchWorkbookExport,
  createDispatchCockpitModel,
} from "./dispatchWorkbookEngine.js";
import { PlantRibbon } from "./PlantRibbon.jsx";

const DEFAULT_DESKTOP_FILES = {
  shippedOrders: "C:/Users/destr/Downloads/imager/7/1.xlsx",
  loadSchedule: "C:/Users/destr/Downloads/imager/7/2.xlsx",
};

const EMPTY_SLOTS = {
  shippedOrders: { buffer: null, fileName: null, filePath: DEFAULT_DESKTOP_FILES.shippedOrders },
  loadSchedule: { buffer: null, fileName: null, filePath: DEFAULT_DESKTOP_FILES.loadSchedule },
};

function fmt(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtSigned(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const number = Number(value);
  const body = fmt(number, digits);
  return number > 0 ? `+${body}` : body;
}

function decodeBase64(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function encodeBase64(buffer) {
  let binary = "";
  new Uint8Array(buffer).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function downloadWorkbook(buffer, fileName) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Panel({ title, children, className = "" }) {
  return (
    <section className={`rounded-[20px] border border-white/15 bg-white/5 ${className}`}>
      <div className="border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-white/55">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StatusRow({ label, value, active }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-black px-3 py-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</div>
        <div className="mt-1 truncate text-sm text-white/82">{value}</div>
      </div>
      <div
        className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
          active ? "border-white/30 text-white" : "border-white/10 text-white/35"
        }`}
      >
        {active ? "live" : "waiting"}
      </div>
    </div>
  );
}

function StatBlock({ label, value }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-black px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function YardPlantTile({ plant, selected, onClick }) {
  const deltaTone =
    plant.transferDelta > 0
      ? "border-white/35 text-white"
      : plant.transferDelta < 0
        ? "border-white/20 text-white/78"
        : "border-white/10 text-white/55";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-[230px] shrink-0 snap-start rounded-[18px] border bg-black p-3 text-left transition ${
        selected
          ? "border-white text-white shadow-[0_0_0_1px_rgba(255,255,255,0.3)]"
          : "border-white/12 text-white/88 hover:border-white/35"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">plt {plant.id}</div>
          <div className="mt-2 text-base font-semibold">{plant.regionLabel}</div>
        </div>
        <div className={`rounded-full border px-2.5 py-1 text-[10px] ${deltaTone}`}>
          {fmtSigned(plant.transferDelta, 1)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-[12px] border border-white/10 bg-white/5 px-2.5 py-2">
          <div className="uppercase tracking-[0.16em] text-white/40">final</div>
          <div className="mt-1 font-semibold text-white">{fmt(plant.finalYards, 1)}</div>
        </div>
        <div className="rounded-[12px] border border-white/10 bg-white/5 px-2.5 py-2">
          <div className="uppercase tracking-[0.16em] text-white/40">base</div>
          <div className="mt-1 font-semibold text-white">{fmt(plant.baseYards, 1)}</div>
        </div>
      </div>
    </button>
  );
}

export default function WorkbookDispatchCockpit() {
  const [slots, setSlots] = useState(EMPTY_SLOTS);
  const [model, setModel] = useState(null);
  const [error, setError] = useState("");
  const [isComputing, setIsComputing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [didHydrateDefaults, setDidHydrateDefaults] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");

  const desktopApi = window.dispatchCockpitDesktop;

  useEffect(() => {
    if (didHydrateDefaults) return;
    if (!desktopApi?.readWorkbookFile) return;

    setDidHydrateDefaults(true);
    let cancelled = false;

    async function hydrateDefaults() {
      const entries = await Promise.all(
        Object.entries(DEFAULT_DESKTOP_FILES).map(async ([slotKey, filePath]) => {
          try {
            const record = await desktopApi.readWorkbookFile(filePath);
            return [slotKey, record];
          } catch {
            return [slotKey, null];
          }
        }),
      );

      if (cancelled) return;

      setSlots((current) => {
        const next = { ...current };
        entries.forEach(([slotKey, record]) => {
          if (!record?.base64) return;
          next[slotKey] = {
            buffer: decodeBase64(record.base64),
            fileName: record.fileName,
            filePath: record.filePath,
          };
        });
        return next;
      });
    }

    void hydrateDefaults();

    return () => {
      cancelled = true;
    };
  }, [desktopApi, didHydrateDefaults]);

  useEffect(() => {
    if (!slots.shippedOrders.buffer) {
      setModel(null);
      setError("");
      setSelectedPlantId(null);
      return;
    }

    setIsComputing(true);
    setError("");

    startTransition(() => {
      try {
        const nextModel = createDispatchCockpitModel({
          shippedOrdersBuffer: slots.shippedOrders.buffer,
          loadScheduleBuffer: slots.loadSchedule.buffer,
          fileLabels: {
            shippedOrders: slots.shippedOrders.fileName,
            loadSchedule: slots.loadSchedule.fileName,
          },
        });
        setModel(nextModel);
      } catch (nextError) {
        setModel(null);
        setError(
          nextError instanceof Error ? nextError.message : "Unable to build dispatch cockpit.",
        );
      } finally {
        setIsComputing(false);
      }
    });
  }, [slots]);

  const plants = (model?.plantRows || []).map((row) => {
    const regionMeta = getPlantRegionMeta({ id: row.plantId });
    return {
      ...row,
      id: row.plantId,
      baseYards: row.baseYards ?? row.computedYards,
      finalYards: row.finalYards ?? row.scheduledYards,
      transferDelta: row.transferDelta ?? row.moveDelta,
      region: regionMeta.region,
      regionLabel: regionMeta.cluster
        ? `${formatRegionLabel(regionMeta.region)} / ${formatRegionLabel(regionMeta.cluster)}`
        : formatRegionLabel(regionMeta.region),
    };
  });

  const filteredPlants = plants.filter((plant) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = normalizedQuery
      ? `${plant.id} ${plant.regionLabel}`.toLowerCase().includes(normalizedQuery)
      : true;
    const matchesRegion = selectedRegion === "all" || plant.region === selectedRegion;
    return matchesQuery && matchesRegion;
  });

  const selectedPlant =
    filteredPlants.find((plant) => plant.id === selectedPlantId) ||
    plants.find((plant) => plant.id === selectedPlantId) ||
    null;

  useEffect(() => {
    if (!filteredPlants.length) {
      setSelectedPlantId(null);
      return;
    }

    if (!selectedPlantId || !filteredPlants.some((plant) => plant.id === selectedPlantId)) {
      setSelectedPlantId(filteredPlants[0].id);
    }
  }, [filteredPlants, selectedPlantId]);

  async function exportWorkbook() {
    if (!model) return;
    setIsExporting(true);

    try {
      const exportBundle = buildDispatchWorkbookExport(model);
      if (desktopApi?.saveWorkbookFile) {
        await desktopApi.saveWorkbookFile({
          suggestedFileName: exportBundle.fileName,
          base64: encodeBase64(exportBundle.buffer),
        });
      } else {
        downloadWorkbook(exportBundle.buffer, exportBundle.fileName);
      }
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-black p-4 text-white">
      <div className="mx-auto grid h-full max-w-[1680px] grid-rows-[auto_auto_minmax(0,1fr)] gap-4 overflow-hidden">
        <Panel title="dispatch_cockpit" className="shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-white/20 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-white/72">
                {isComputing ? "processing" : model ? "online" : "awaiting source"}
              </div>
              {error ? (
                <div className="rounded-full border border-white/12 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-white/55">
                  {error}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={exportWorkbook}
              disabled={!model || isExporting}
              className={`rounded-[14px] border px-3 py-2 text-sm uppercase tracking-[0.14em] ${
                model && !isExporting
                  ? "border-white/25 bg-white text-black"
                  : "border-white/10 bg-white/5 text-white/35"
              }`}
            >
              {isExporting ? "exporting" : "export"}
            </button>
          </div>
        </Panel>

        <div className="grid shrink-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Panel title="sources">
            <div className="grid gap-3">
              <StatusRow
                label="source_01"
                value={slots.shippedOrders.filePath}
                active={Boolean(slots.shippedOrders.buffer)}
              />
              <StatusRow
                label="source_02"
                value={slots.loadSchedule.filePath}
                active={Boolean(slots.loadSchedule.buffer)}
              />
            </div>
          </Panel>

          <Panel title="summary">
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <StatBlock label="ordered_yards" value={fmt(model?.metrics.totalOrderedYards || 0, 1)} />
                <StatBlock label="early_orders" value={fmt(model?.metrics.earlyOrders || 0)} />
                <StatBlock label="transfer_yards" value={fmt(model?.metrics.totalTransferredYards || 0, 1)} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="filter plants"
                  className="min-w-[220px] flex-1 rounded-[14px] border border-white/12 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-white/28 focus:border-white/30"
                />
                <button
                  type="button"
                  onClick={() => setSelectedRegion("all")}
                  className={`rounded-[14px] border px-3 py-2 text-sm uppercase tracking-[0.12em] ${
                    selectedRegion === "all"
                      ? "border-white bg-white text-black"
                      : "border-white/12 bg-white/5 text-white/72"
                  }`}
                >
                  all
                </button>
                {REGION_ORDER.map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => setSelectedRegion(region)}
                    className={`rounded-[14px] border px-3 py-2 text-sm uppercase tracking-[0.12em] ${
                      selectedRegion === region
                        ? "border-white bg-white text-black"
                        : "border-white/12 bg-white/5 text-white/72"
                    }`}
                  >
                    {formatRegionLabel(region)}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="plants" className="min-h-0 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            {model ? (
              <>
                <PlantRibbon
                  filteredPlants={filteredPlants}
                  selectedPlant={selectedPlant}
                  setSelectedPlantId={setSelectedPlantId}
                  PlantTile={YardPlantTile}
                />

                {selectedPlant ? (
                  <div className="grid shrink-0 gap-3 md:grid-cols-4">
                    <StatBlock label="selected" value={`plt ${selectedPlant.id}`} />
                    <StatBlock label="region" value={selectedPlant.regionLabel} />
                    <StatBlock label="final" value={fmt(selectedPlant.finalYards, 1)} />
                    <StatBlock label="delta" value={fmtSigned(selectedPlant.transferDelta, 1)} />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-[16px] border border-white/10 bg-black px-4 py-6 text-sm text-white/45">
                waiting for source_01
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

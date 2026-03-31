import { useEffect, useState } from "react";

import { PlantRibbon } from "./PlantRibbon.jsx";
import { buildDispatchCockpitFromUploads } from "./reactDispatchEngine.js";

const FILE_FIELDS = [
  {
    key: "shippedFile",
    shortLabel: "1.xlsx",
    title: "Shipped order summary",
    detail: "Required. Reads ShippedOrderSummary and builds opening plant yardage plus early-order alerts.",
    required: true,
  },
  {
    key: "loadFile",
    shortLabel: "2.xlsx",
    title: "Load schedule",
    detail: "Optional. Applies plant-to-plant transfers and generates duplicate or insufficient-yardage flags.",
    required: false,
  },
];

export default function ReactDispatchCockpit() {
  const [files, setFiles] = useState({
    shippedFile: null,
    loadFile: null,
  });
  const [cockpitData, setCockpitData] = useState(null);
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function rebuildCockpit() {
      if (!files.shippedFile) {
        setCockpitData(null);
        setErrorText("");
        setIsProcessing(false);
        return;
      }

      setIsProcessing(true);
      setErrorText("");

      try {
        const nextCockpitData = await buildDispatchCockpitFromUploads(files);
        if (cancelled) {
          return;
        }
        setCockpitData(nextCockpitData);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setCockpitData(null);
        setErrorText(error instanceof Error ? error.message : "Unable to build the dispatch cockpit.");
      } finally {
        if (!cancelled) {
          setIsProcessing(false);
        }
      }
    }

    void rebuildCockpit();

    return () => {
      cancelled = true;
    };
  }, [files]);

  useEffect(() => {
    if (!cockpitData?.plants?.length) {
      setSelectedPlantId(null);
      return;
    }

    if (!cockpitData.plants.some((plant) => plant.id === selectedPlantId)) {
      setSelectedPlantId(cockpitData.plants[0].id);
    }
  }, [cockpitData, selectedPlantId]);

  const plants = cockpitData?.plants ?? [];
  const selectedPlant =
    plants.find((plant) => plant.id === selectedPlantId) ?? plants[0] ?? null;

  const summaryCards = cockpitData
    ? [
        { label: "opening yards", value: formatNumber(cockpitData.summary.totalOpeningYardage) },
        { label: "live yards", value: formatNumber(cockpitData.summary.totalCurrentYardage) },
        { label: "applied transfers", value: formatNumber(cockpitData.summary.appliedTransferCount) },
        { label: "flagged moves", value: formatNumber(cockpitData.summary.flaggedMoveCount) },
        { label: "early orders", value: formatNumber(cockpitData.summary.earlyOrderCount) },
        { label: "shipped rows", value: formatNumber(cockpitData.summary.shippedOrderCount) },
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1760px] flex-col px-4 py-5 lg:px-6">
        <header className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                Dispatch cockpit
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-[0.01em] text-slate-950 lg:text-[2.3rem]">
                React view of the workbook dispatch flow
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                This dashboard stays scoped to the two workbook inputs you approved. It reads
                <span className="font-medium text-slate-700"> 1.xlsx </span>
                for shipped orders and optionally
                <span className="font-medium text-slate-700"> 2.xlsx </span>
                for transfers, then renders the YARDS board, EarlyOrders table, LoadScheduleRef,
                and NegativeFlags as a live React cockpit.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusPill
                tone={cockpitData ? "online" : "waiting"}
                label={cockpitData ? "workbook snapshot" : "awaiting source"}
                detail={
                  isProcessing
                    ? "processing workbooks"
                    : cockpitData?.builtAt ?? "upload 1.xlsx to begin"
                }
              />
              {cockpitData && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {cockpitData.sourceLabel}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="mt-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Intake
              </div>
              <div className="mt-1 text-xl font-semibold text-slate-900">Workbook inputs</div>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                The cockpit does not depend on a local template or demo data. Everything on screen is
                derived directly from the uploaded workbooks.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              xlsx only
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {FILE_FIELDS.map((field) => (
              <UploadCard
                key={field.key}
                {...field}
                file={files[field.key]}
                onFileSelected={(file) =>
                  setFiles((current) => ({
                    ...current,
                    [field.key]: file,
                  }))
                }
              />
            ))}
          </div>

          {errorText && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorText}
            </div>
          )}
        </section>

        {!cockpitData ? (
          <section className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-5 py-10 text-center shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Waiting
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-900">Upload 1.xlsx to build the board</div>
            <p className="mt-3 text-sm text-slate-600">
              Once the shipped order summary is loaded, the cockpit will calculate plant yardage,
              early orders, and any load-schedule adjustments from 2.xlsx.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Summary
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">Operational readout</div>
                </div>
                {isProcessing && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-amber-700">
                    processing
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {summaryCards.map((card) => (
                  <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {card.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-4">
              <PlantRibbon
                filteredPlants={plants}
                selectedPlant={selectedPlant}
                setSelectedPlantId={setSelectedPlantId}
                PlantTile={PlantTile}
              />
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.9fr)]">
              <YardBoard
                lanes={cockpitData.yardBoard}
                selectedPlantId={selectedPlant?.id ?? null}
                setSelectedPlantId={setSelectedPlantId}
              />
              <PlantDetailPanel plant={selectedPlant} />
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-3">
              <DataTable
                title="EarlyOrders"
                subtitle="Orders starting before 05:00 with quantity above 90."
                columns={cockpitData.earlyOrderColumns}
                rows={cockpitData.earlyOrders}
                emptyText="No early orders crossed the threshold."
              />
              <DataTable
                title="LoadScheduleRef"
                subtitle="Rows that passed the plant-cell mapping and were evaluated against current yardage."
                columns={cockpitData.referenceMoveColumns}
                rows={cockpitData.referenceMoves}
                emptyText="No mapped load schedule rows were processed."
              />
              <DataTable
                title="NegativeFlags"
                subtitle="Duplicate orders and insufficient-yardage checks produced from 2.xlsx."
                columns={cockpitData.negativeFlagColumns}
                rows={cockpitData.negativeFlags}
                emptyText="No duplicate or insufficient-yardage flags were generated."
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function UploadCard({ shortLabel, title, detail, required, file, onFileSelected }) {
  return (
    <label className="group flex cursor-pointer flex-col rounded-[24px] border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {shortLabel}
          </div>
          <div className="mt-1 text-base font-semibold text-slate-900">{title}</div>
        </div>
        <div
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            required ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"
          }`}
        >
          {required ? "required" : "optional"}
        </div>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>

      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-600 transition group-hover:border-slate-400">
        <div className="font-medium text-slate-700">{file ? file.name : "Choose workbook"}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
          .xlsx .xls .xlsm
        </div>
      </div>

      <input
        type="file"
        accept=".xlsx,.xls,.xlsm"
        className="sr-only"
        onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function StatusPill({ tone, label, detail }) {
  const toneClass =
    tone === "online"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</div>
      <div className="mt-1 text-sm font-medium">{detail}</div>
    </div>
  );
}

function PlantTile({ plant, selected, onClick }) {
  const toneMap = {
    critical: "border-rose-200 bg-rose-50",
    active: "border-amber-200 bg-amber-50",
    steady: "border-emerald-200 bg-emerald-50",
    idle: "border-slate-200 bg-slate-50",
  };

  return (
    <button
      onClick={onClick}
      className={`w-[230px] shrink-0 snap-start rounded-[22px] border p-4 text-left shadow-sm transition ${
        selected
          ? "border-slate-900 bg-slate-900 text-white"
          : toneMap[plant.spotlightTone] || "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
              selected ? "text-slate-300" : "text-slate-500"
            }`}
          >
            PLT {plant.id}
          </div>
          <div className="mt-1 text-lg font-semibold">{plant.mappedCell}</div>
        </div>
        <div
          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            selected ? "bg-white/10 text-slate-200" : "bg-white/70 text-slate-600"
          }`}
        >
          yard
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <StatMini label="current" value={formatNumber(plant.currentYardage)} selected={selected} />
        <StatMini label="net" value={formatSignedNumber(plant.netChange)} selected={selected} />
        <StatMini label="early" value={formatNumber(plant.earlyOrderCount)} selected={selected} />
        <StatMini label="flags" value={formatNumber(plant.flagCount)} selected={selected} />
      </div>
    </button>
  );
}

function StatMini({ label, value, selected }) {
  return (
    <div className={`rounded-2xl px-3 py-3 ${selected ? "bg-white/10" : "bg-white/80"}`}>
      <div
        className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
          selected ? "text-slate-300" : "text-slate-500"
        }`}
      >
        {label}
      </div>
      <div className={`mt-1 text-base font-semibold ${selected ? "text-white" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}

function YardBoard({ lanes, selectedPlantId, setSelectedPlantId }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            YARDS
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900">Mapped plant lanes</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          mirrors the plant-to-cell mapping in the Python flow
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="flex min-w-max items-start gap-4">
          {lanes.map((lane) => (
            <div
              key={lane.key}
              className="w-[220px] rounded-[24px] border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {lane.label}
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-900">
                    {lane.plants.length} plants
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {lane.plants.map((plant) => (
                  <button
                    key={plant.id}
                    onClick={() => setSelectedPlantId(plant.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedPlantId === plant.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div
                          className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                            selectedPlantId === plant.id ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          PLT {plant.id}
                        </div>
                        <div className="mt-1 text-sm font-semibold">{plant.mappedCell}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className={selectedPlantId === plant.id ? "text-slate-300" : "text-slate-500"}>
                        current
                      </span>
                      <span className="font-semibold">{formatNumber(plant.currentYardage)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                      <span className={selectedPlantId === plant.id ? "text-slate-300" : "text-slate-500"}>
                        delta
                      </span>
                      <span className="font-semibold">{formatSignedNumber(plant.netChange)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlantDetailPanel({ plant }) {
  if (!plant) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Plant detail
        </div>
        <div className="mt-3 text-lg font-semibold text-slate-900">No plant selected</div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Plant detail
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">PLT {plant.id}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {plant.mappedCell}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailStat label="Opening yards" value={formatNumber(plant.openingYardage)} />
        <DetailStat label="Current yards" value={formatNumber(plant.currentYardage)} />
        <DetailStat label="Inbound" value={formatNumber(plant.inboundYardage)} />
        <DetailStat label="Outbound" value={formatNumber(plant.outboundYardage)} />
      </div>

      <div className="mt-5 grid gap-4">
        <StackList
          title="Early orders"
          emptyText="No early-order alerts for this plant."
          items={plant.earlyOrders.slice(0, 5).map((order) => ({
            key: `${order.orderNumber}-${order.startTime}`,
            title: `Order ${order.orderNumber ?? "n/a"}`,
            meta: `${formatNumber(order.orderQty)} yd`,
            note: `${order.startTime} | mix ${order.mixCode} | truck ${order.truck}`,
          }))}
        />

        <StackList
          title="Transfers"
          emptyText="No applied transfers touched this plant."
          items={plant.transfers.slice(0, 5).map((transfer) => ({
            key: transfer.id,
            title: `${transfer.direction} with plt ${transfer.counterpartPlant}`,
            meta: `${formatSignedNumber(
              transfer.direction === "outbound" ? -transfer.yardage : transfer.yardage,
            )} yd`,
            note: `order ${transfer.orderNumber ?? "n/a"} | loads ${transfer.loads}`,
          }))}
        />

        <StackList
          title="Flags"
          emptyText="No duplicate or insufficient-yardage flags here."
          items={plant.flags.slice(0, 5).map((flag, index) => ({
            key: `${flag.Order}-${flag.Reason}-${index}`,
            title: `${flag.Reason} on order ${flag.Order}`,
            meta: `from ${flag.FromPlant} to ${flag.ToPlant}`,
            note: `attempt ${formatSignedNumber(flag.AttemptedMove)} yd | current ${formatNumber(flag.CurrentYardage)} yd`,
          }))}
        />
      </div>
    </div>
  );
}

function DetailStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function StackList({ title, items, emptyText }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
            {emptyText}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.key} className="rounded-2xl border border-white bg-white px-3 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                <div className="text-sm font-medium text-slate-600">{item.meta}</div>
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{item.note}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DataTable({ title, subtitle, columns, rows, emptyText }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Table
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{title}</div>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {rows.length} rows
        </div>
      </div>

      <div className="mt-4 overflow-auto rounded-[24px] border border-slate-200">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">{emptyText}</div>
        ) : (
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={createRowKey(row, rowIndex)} className="odd:bg-white even:bg-slate-50/55">
                  {columns.map((column) => (
                    <td key={column} className="border-b border-slate-100 px-4 py-3 align-top text-slate-700">
                      {formatCell(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function createRowKey(row, index) {
  return `${row.Order ?? row["Order #"] ?? row.id ?? index}-${index}`;
}

function formatCell(value) {
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  if (value === null || value === undefined || value === "") {
    return "n/a";
  }

  return String(value);
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatSignedNumber(value) {
  const number = Number(value ?? 0);
  if (number === 0) {
    return "0";
  }
  return `${number > 0 ? "+" : ""}${formatNumber(number)}`;
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Check,
  ClipboardList,
  Database,
  HelpCircle,
  Home,
  Layers,
  Menu,
  PackageCheck,
  RefreshCcw,
  Settings,
  Truck,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import "./PowderDispatchBoard.css";

const MATERIAL_ORDER = ["CEMENT", "PLC CEMENT", "TYPE V CEMENT", "FLYASH"];
const STATUS_RANK = { Critical: 0, Watch: 1, OK: 2 };
const EMPTY_LOAD_LOG = {
  driverName: "",
  employeeNumber: "",
  truckNumber: "",
  timeLeftYard: "",
  timeLoaded: "",
  sourceName: "",
  plantId: "",
};

function formatNumber(value, digits = 2) {
  const number = Number(value ?? 0);
  return number.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : digits,
    maximumFractionDigits: digits,
  });
}

function formatLoad(value) {
  return `${formatNumber(value)} Loads`;
}

function formatTime(value) {
  if (!value) return "--";
  if (/^\d{1,2}:\d{2}/.test(value)) return `Today ${value.slice(0, 5)}`;
  return value;
}

function titleCase(value) {
  if (!value) return "--";
  if (value.toUpperCase() === "PLC CEMENT") return "PLC Cement";
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Flyash", "Flyash");
}

function plantLabel(plantId, plantName) {
  const cleanName = plantName?.replace(new RegExp(`^${plantId}\\s*`, "i"), "").trim();
  return cleanName ? `${plantId} ${titleCase(cleanName)}` : `${plantId}`;
}

function statusClass(status) {
  return String(status || "OK").toLowerCase();
}

function worstStatus(rows) {
  return rows.reduce((current, row) => {
    const currentRank = STATUS_RANK[current] ?? 2;
    const nextRank = STATUS_RANK[row.materialStatus] ?? 2;
    return nextRank < currentRank ? row.materialStatus : current;
  }, "OK");
}

function firstNeed(rows) {
  return rows
    .map((row) => row.firstNeedTime)
    .filter(Boolean)
    .sort()[0] ?? "--";
}

function buildPlants(needs, allPlants = [], includeAllPlants = false) {
  const grouped = new Map();

  needs.forEach((row) => {
    const plantId = Number(row.plantId);
    if (!grouped.has(plantId)) {
      grouped.set(plantId, {
        plantId,
        plantName: row.plantName,
        coverage: [],
      });
    }
    grouped.get(plantId).coverage.push(row);
  });

  if (includeAllPlants) {
    allPlants.forEach((plant) => {
      const plantId = Number(plant.plantId);
      if (!grouped.has(plantId)) {
        grouped.set(plantId, {
          plantId,
          plantName: plant.plantName,
          region: plant.region,
          coverage: [],
        });
      }
    });
  }

  return Array.from(grouped.values())
    .map((plant) => {
      const cementRows = plant.coverage.filter((row) =>
        String(row.materialDescription).toUpperCase().includes("CEMENT"),
      );
      const flyash = plant.coverage.find((row) =>
        String(row.materialDescription).toUpperCase().includes("FLYASH"),
      );
      const cement =
        cementRows.find((row) => String(row.materialDescription).toUpperCase() === "CEMENT") ??
        cementRows[0];
      const netPosition = plant.coverage.length
        ? Math.min(...plant.coverage.map((row) => Number(row.lowestDiff ?? 0)))
        : 0;
      const status = plant.coverage.length ? worstStatus(plant.coverage) : "OK";

      return {
        ...plant,
        displayName: plantLabel(plant.plantId, plant.plantName),
        region: plant.region ?? inferRegion(plant.plantName),
        status,
        firstNeedTime: firstNeed(plant.coverage),
        cementOnHand: cement?.onHandLoads ?? 0,
        flyashOnHand: flyash?.onHandLoads ?? 0,
        netPosition,
        projectedNeed: plant.coverage.reduce(
          (sum, row) => sum + Number(row.projectedNeedLoads ?? 0),
          0,
        ),
      };
    })
    .sort((a, b) => {
      if (includeAllPlants) {
        return a.plantId - b.plantId;
      }

      const statusDelta = (STATUS_RANK[a.status] ?? 2) - (STATUS_RANK[b.status] ?? 2);
      if (statusDelta) return statusDelta;
      return a.firstNeedTime.localeCompare(b.firstNeedTime) || a.netPosition - b.netPosition;
    });
}

function inferRegion(name) {
  const text = String(name || "").toLowerCase();
  if (text.includes("rialto") || text.includes("corona") || text.includes("murrieta")) {
    return "Inland Empire";
  }
  if (text.includes("gardena")) return "Los Angeles";
  if (text.includes("ridgecrest")) return "High Desert";
  return "Dispatch Region";
}

function byMaterialOrder(a, b) {
  const aIndex = MATERIAL_ORDER.indexOf(String(a.materialDescription).toUpperCase());
  const bIndex = MATERIAL_ORDER.indexOf(String(b.materialDescription).toUpperCase());
  return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
}

function TopMetric({ label, value, subValue }) {
  return (
    <div className="pdb-metric">
      <div className="pdb-metric-label">{label}</div>
      <div className="pdb-metric-value">
        {value}
        {subValue ? <span>{subValue}</span> : null}
      </div>
    </div>
  );
}

function Sidebar() {
  const icons = [Home, Truck, ClipboardList, Users, Layers, BarChart3, Settings];

  return (
    <aside className="pdb-sidebar">
      <button className="pdb-icon-button" aria-label="Menu">
        <Menu size={22} />
      </button>
      <div className="pdb-sidebar-icons">
        {icons.map((Icon, index) => (
          <button key={index} className="pdb-icon-button" aria-label={`Navigation ${index + 1}`}>
            <Icon size={19} />
          </button>
        ))}
      </div>
      <button className="pdb-icon-button pdb-sidebar-help" aria-label="Help">
        <HelpCircle size={18} />
      </button>
      <div className="pdb-user">
        <User size={22} />
        <span>Joe D.</span>
        <small>Dispatcher</small>
      </div>
    </aside>
  );
}

function Header({ summary, generatedAt, autoRefresh, onToggleAutoRefresh, onRefresh, onAction }) {
  return (
    <header className="pdb-header">
      <div className="pdb-title">POWDER DISPATCH BOARD</div>
      <TopMetric label="Drivers Available" value={summary.driversAvailable ?? 0} subValue="17%" />
      <TopMetric label="Critical Plants" value={summary.criticalPlants ?? 0} />
      <TopMetric
        label="Open Cement Loads Needed"
        value={formatNumber(summary.openCementLoadsNeeded ?? 0)}
        subValue="loads"
      />
      <TopMetric
        label="Open Flyash Loads Needed"
        value={formatNumber(summary.openFlyashLoadsNeeded ?? 0)}
        subValue="loads"
      />
      <TopMetric
        label="Last Updated"
        value={generatedAt ? new Date(generatedAt).toLocaleString() : "--"}
      />
      <button className="pdb-auto-refresh" onClick={onToggleAutoRefresh}>
        <span>Auto Refresh</span>
        <strong>{autoRefresh ? "ON" : "OFF"}</strong>
      </button>
      <div className="pdb-actions">
        <button onClick={onRefresh}>
          <RefreshCcw size={14} /> Refresh
        </button>
        <button onClick={() => onAction("Log load opened")}>
          <PackageCheck size={14} /> Log Load
        </button>
        <button onClick={() => onAction("Assign driver opened")}>
          <UserPlus size={14} /> Assign Driver
        </button>
        <button onClick={() => onAction("Marked current load as loaded")}>
          <ClipboardList size={14} /> Mark Loaded
        </button>
        <button onClick={() => onAction("Marked current load as delivered")}>
          <Check size={14} /> Mark Delivered
        </button>
      </div>
    </header>
  );
}

function PlantTile({ plant, selected, onSelect }) {
  return (
    <button
      className={`pdb-plant-card pdb-status-${statusClass(plant.status)} ${
        selected ? "is-selected" : ""
      }`}
      onClick={() => onSelect(plant.plantId)}
    >
      <div className="pdb-plant-card-top">
        <div>
          <strong>{plant.displayName}</strong>
          <span>{plant.region}</span>
        </div>
        <em>{plant.status.toUpperCase()}</em>
      </div>
      <dl>
        <div>
          <dt>Cement on hand</dt>
          <dd>{formatLoad(plant.cementOnHand)}</dd>
        </div>
        <div>
          <dt>Flyash on hand</dt>
          <dd>{formatLoad(plant.flyashOnHand)}</dd>
        </div>
        <div>
          <dt>Net Position</dt>
          <dd>{formatLoad(plant.netPosition)}</dd>
        </div>
        <div>
          <dt>First Need</dt>
          <dd>{formatTime(plant.firstNeedTime)}</dd>
        </div>
      </dl>
    </button>
  );
}

function PlantCarousel({
  plants,
  selectedPlantId,
  onSelect,
  showAllPlants,
  onToggleAllPlants,
  needsCount,
  allPlantsCount,
}) {
  const stripRef = useRef(null);

  const scroll = (direction) => {
    const strip = stripRef.current;
    if (!strip) return;

    const step = Math.max(strip.clientWidth * 0.8, 220);
    strip.scrollLeft += direction * step;
  };

  useEffect(() => {
    if (stripRef.current) {
      stripRef.current.scrollLeft = 0;
    }
  }, [showAllPlants]);

  return (
    <section className="pdb-carousel-shell">
      <div className="pdb-carousel-toolbar">
        <span>
          {showAllPlants ? "ALL PLANTS" : "NEEDS FIRST"}
          <small>{plants.length} tiles</small>
        </span>
        <button type="button" onClick={onToggleAllPlants}>
          {showAllPlants ? `Needs first (${needsCount})` : `All plants (${allPlantsCount})`}
        </button>
      </div>
      <button
        type="button"
        className="pdb-carousel-arrow left"
        onClick={() => scroll(-1)}
        aria-label="Previous plants"
      >
        ‹
      </button>
      <div ref={stripRef} className="pdb-carousel">
        {plants.map((plant) => (
          <PlantTile
            key={plant.plantId}
            plant={plant}
            selected={Number(selectedPlantId) === Number(plant.plantId)}
            onSelect={onSelect}
          />
        ))}
      </div>
      <button
        type="button"
        className="pdb-carousel-arrow right"
        onClick={() => scroll(1)}
        aria-label="Next plants"
      >
        ›
      </button>
    </section>
  );
}

function DataTable({ columns, rows, empty = "No rows loaded." }) {
  return (
    <div className="pdb-table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={row.key ?? rowIndex}>
                {columns.map((column) => (
                  <td key={column.key} className={column.numeric ? "pdb-num" : ""}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatBox({ label, value, sub }) {
  return (
    <div className="pdb-stat-box">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function SelectedPlantMenu({ plant, drivers, tab, setTab, notes, onClose }) {
  if (!plant) return null;

  const coverage = [...(plant.coverage ?? [])].sort(byMaterialOrder);
  const orders = plant.shippedOrders ?? [];
  const trucksEnRouteRows = drivers.filter((driver) => Number(driver.assignedPlantId) === Number(plant.plantId));
  const plantStatus = worstStatus(coverage);
  const cement = coverage.find((row) => String(row.materialDescription).toUpperCase() === "CEMENT");
  const flyash = coverage.find((row) => String(row.materialDescription).toUpperCase() === "FLYASH");
  const netPosition = coverage.length
    ? Math.min(...coverage.map((row) => Number(row.lowestDiff ?? 0)))
    : 0;
  const firstNeedTime = firstNeed(coverage);
  const totalYards = orders.reduce((sum, order) => sum + Number(order.orderedQuantity ?? 0), 0);

  return (
    <section className="pdb-detail-menu">
      <div className="pdb-detail-head">
        <div>
          <h2>{plantLabel(plant.plantId, plant.plantName)}</h2>
          <span>{inferRegion(plant.plantName)}</span>
          <em className={`pdb-chip pdb-status-${statusClass(plantStatus)}`}>{plantStatus.toUpperCase()}</em>
        </div>
        <div className="pdb-detail-head-metrics">
          <span>First Need <strong>{formatTime(firstNeedTime)}</strong></span>
          <span>Net Position <strong>{formatLoad(netPosition)}</strong></span>
          <button className="pdb-close-detail" onClick={onClose} aria-label="Close plant detail menu">
            <X size={12} /> Close
          </button>
        </div>
      </div>

      <nav className="pdb-tabs" aria-label="Plant detail tabs">
        {["Overview", "Orders", "Inventory", "Trucks En Route", "Batch Load", "Notes"].map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {tab === "Overview" ? (
        <>
          <div className="pdb-stat-grid">
            <StatBox label="Tomorrow's Work" value={formatNumber(totalYards)} sub="Total Yards" />
            <StatBox
              label="Active Batching"
              value={trucksEnRouteRows[0]?.status?.toUpperCase() ?? "NO LOAD"}
              sub={trucksEnRouteRows[0]?.eta ?? trucksEnRouteRows[0]?.loadTime ?? "--"}
            />
            <StatBox label="Cement on Hand" value={formatNumber(cement?.onHandLoads ?? 0)} sub="Loads" />
            <StatBox label="Flyash on Hand" value={formatNumber(flyash?.onHandLoads ?? 0)} sub="Loads" />
            <StatBox label="Net Position" value={formatNumber(netPosition)} sub="Loads" />
            <StatBox label="First Need" value={formatTime(firstNeedTime)} />
          </div>

          <div className="pdb-detail-grid">
            <Panel title="Material Coverage">
              <DataTable
                columns={[
                  { key: "materialDescription", label: "Material", render: (row) => titleCase(row.materialDescription) },
                  { key: "onHandLoads", label: "On Hand", numeric: true, render: (row) => formatNumber(row.onHandLoads) },
                  { key: "projectedNeedLoads", label: "Projected Need", numeric: true, render: (row) => formatNumber(row.projectedNeedLoads) },
                  { key: "lowestDiff", label: "Net Position", numeric: true, render: (row) => formatNumber(row.lowestDiff) },
                  { key: "requiredLoads", label: "Req Loads", numeric: true, render: (row) => formatNumber(row.requiredLoads) },
                  { key: "materialStatus", label: "Status", render: (row) => <span className={`pdb-status-text pdb-status-${statusClass(row.materialStatus)}`}>{row.materialStatus}</span> },
                ]}
                rows={coverage}
              />
            </Panel>

            <Panel title={`Trucks En Route (${trucksEnRouteRows.length})`}>
              <DataTable
                columns={[
                  { key: "truckNumber", label: "Truck #" },
                  { key: "driverName", label: "Driver" },
                  { key: "materialDescription", label: "Material", render: (row) => titleCase(row.materialDescription) },
                  { key: "assignedSource", label: "Source" },
                  { key: "currentLocation", label: "Location", render: (row) => row.currentLocation ?? "--" },
                  { key: "status", label: "Status" },
                  { key: "eta", label: "ETA", render: (row) => row.eta ?? row.loadTime ?? "--" },
                ]}
                rows={trucksEnRouteRows}
                empty="No powder trucks currently en route to this plant."
              />
            </Panel>

            <Panel title={`Tomorrow's Orders (${orders.length})`}>
              <DataTable
                columns={[
                  { key: "mixCode", label: "Mix Code", render: (row) => row.mixCode ?? "--" },
                  { key: "mixDescription", label: "Mix Description", render: (row) => row.mixDescription ?? "--" },
                  { key: "orderedQuantity", label: "Yards", numeric: true, render: (row) => formatNumber(row.orderedQuantity ?? 0, 0) },
                  { key: "startTime", label: "Start Time", render: (row) => row.startTime ?? "--" },
                  { key: "status", label: "Status", render: (row) => row.status ?? "--" },
                ]}
                rows={orders.slice(0, 8)}
              />
            </Panel>
          </div>
        </>
      ) : (
        <TabPanel tab={tab} coverage={coverage} orders={orders} trucksEnRouteRows={trucksEnRouteRows} notes={notes} />
      )}
    </section>
  );
}

function PlantDetailPlaceholder({ plant, onReopen }) {
  return (
    <section className="pdb-detail-placeholder">
      <div>
        <strong>{plant ? plantLabel(plant.plantId, plant.plantName) : "Plant detail"}</strong>
        <span>Closed</span>
      </div>
      <button type="button" onClick={onReopen}>
        Open
      </button>
    </section>
  );
}

function TabPanel({ tab, coverage, orders, trucksEnRouteRows, notes }) {
  if (tab === "Orders") {
    return (
      <Panel title="Orders">
        <DataTable
          columns={[
            { key: "orderNumber", label: "Order" },
            { key: "customerName", label: "Customer", render: (row) => row.customerName ?? "--" },
            { key: "mixCode", label: "Mix" },
            { key: "mixDescription", label: "Description" },
            { key: "orderedQuantity", label: "Qty", numeric: true, render: (row) => formatNumber(row.orderedQuantity ?? 0, 0) },
            { key: "startTime", label: "Start" },
            { key: "readyMixTruckCount", label: "RM Trucks", numeric: true, render: (row) => row.readyMixTruckCount ?? "--" },
          ]}
          rows={orders}
        />
      </Panel>
    );
  }

  if (tab === "Inventory") {
    return (
      <Panel title="Inventory">
        <DataTable
          columns={[
            { key: "materialDescription", label: "Material", render: (row) => titleCase(row.materialDescription) },
            { key: "onHandLoads", label: "On Hand", numeric: true, render: (row) => formatNumber(row.onHandLoads) },
            { key: "projectedNeedLoads", label: "Projected", numeric: true, render: (row) => formatNumber(row.projectedNeedLoads) },
            { key: "requiredLoads", label: "Required Loads", numeric: true, render: (row) => formatNumber(row.requiredLoads) },
            { key: "firstNeedTime", label: "First Need", render: (row) => formatTime(row.firstNeedTime) },
          ]}
          rows={coverage}
        />
      </Panel>
    );
  }

  if (tab === "Trucks En Route") {
    return (
      <Panel title="Trucks En Route">
        <DataTable
          columns={[
            { key: "truckNumber", label: "Truck #" },
            { key: "driverName", label: "Driver" },
            { key: "assignedSource", label: "Source" },
            { key: "materialDescription", label: "Material", render: (row) => titleCase(row.materialDescription) },
            { key: "status", label: "Status" },
            { key: "currentLocation", label: "Location", render: (row) => row.currentLocation ?? "--" },
            { key: "eta", label: "ETA", render: (row) => row.eta ?? row.loadTime ?? "--" },
          ]}
          rows={trucksEnRouteRows}
          empty="No trucks en route for this plant."
        />
      </Panel>
    );
  }

  if (tab === "Batch Load") {
    return (
      <Panel title="Batch Load">
        <DataTable
          columns={[
            { key: "mixerTruck", label: "Mixer / Truck" },
            { key: "loadedTime", label: "Loaded" },
            { key: "leftPlantTime", label: "Left Plant" },
            { key: "leftJobSiteTime", label: "Left Job Site" },
            { key: "returnedTime", label: "Returned" },
            { key: "yardsHauled", label: "Yards", numeric: true },
          ]}
          rows={[]}
          empty="No batch load data loaded yet."
        />
      </Panel>
    );
  }

  return (
    <Panel title="Dispatch Notes">
      <div className="pdb-notes">
        {notes.map((note, index) => (
          <p key={index}>{note}</p>
        ))}
      </div>
    </Panel>
  );
}

function Panel({ title, children }) {
  return (
    <section className="pdb-panel">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function LoadLogPanel({
  form,
  sourceOptions,
  plantOptions,
  onFormChange,
  onSubmit,
  onClear,
}) {
  return (
    <Panel title="Log Powder Load">
      <form className="pdb-load-form" onSubmit={onSubmit}>
        <label>
          <span>Name</span>
          <input
            value={form.driverName}
            onChange={(event) => onFormChange("driverName", event.target.value)}
            placeholder="Driver name"
          />
        </label>
        <label>
          <span>Emp #</span>
          <input
            value={form.employeeNumber}
            onChange={(event) => onFormChange("employeeNumber", event.target.value)}
            placeholder="Employee #"
          />
        </label>
        <label>
          <span>Truck #</span>
          <input
            value={form.truckNumber}
            onChange={(event) => onFormChange("truckNumber", event.target.value)}
            placeholder="Truck"
          />
        </label>
        <label>
          <span>Time Left Yard</span>
          <input
            value={form.timeLeftYard}
            onChange={(event) => onFormChange("timeLeftYard", event.target.value)}
            placeholder="HH:MM"
          />
        </label>
        <label>
          <span>Time Loaded</span>
          <input
            value={form.timeLoaded}
            onChange={(event) => onFormChange("timeLoaded", event.target.value)}
            placeholder="HH:MM"
          />
        </label>
        <label>
          <span>Source</span>
          <select
            value={form.sourceName}
            onChange={(event) => onFormChange("sourceName", event.target.value)}
          >
            <option value="">Select source</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Plant</span>
          <select
            value={form.plantId}
            onChange={(event) => onFormChange("plantId", event.target.value)}
          >
            <option value="">Select plant</option>
            {plantOptions.map((plant) => (
              <option key={plant.plantId} value={plant.plantId}>
                {plantLabel(plant.plantId, plant.plantName)}
              </option>
            ))}
          </select>
        </label>
        <div className="pdb-load-form-actions">
          <button type="submit">Log Load</button>
          <button type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      </form>
    </Panel>
  );
}

function LoadLogRows({ rows }) {
  return (
    <Panel title={`Recent Load Logs (${rows.length})`}>
      {rows.length === 0 ? (
        <div className="pdb-empty-load-log">No load logs entered this session.</div>
      ) : (
        <div className="pdb-load-log-list">
          {rows.map((row) => (
            <div key={row.id} className="pdb-load-log-row">
              <strong>{row.truckNumber || "--"}</strong>
              <span>{row.driverName || "--"}</span>
              <span>Emp {row.employeeNumber || "--"}</span>
              <span>{row.sourceName || "--"}</span>
              <span>{row.plantLabel || "--"}</span>
              <span>Left {row.timeLeftYard || "--"}</span>
              <span>Loaded {row.timeLoaded || "--"}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RightRail({
  board,
  loadLogForm,
  loadLogs,
  onLoadLogChange,
  onLoadLogSubmit,
  onClearLoadLog,
}) {
  const sourceOptions = Array.from(
    new Set((board.sourceAllocations ?? []).map((row) => row.sourceName).filter(Boolean)),
  );
  const plantOptions = board.allPlants?.length
    ? board.allPlants
    : Array.from(
        new Map(
          (board.needs ?? []).map((row) => [
            Number(row.plantId),
            { plantId: Number(row.plantId), plantName: row.plantName },
          ]),
        ).values(),
      );

  return (
    <aside className="pdb-right-rail">
      <LoadLogPanel
        form={loadLogForm}
        sourceOptions={sourceOptions}
        plantOptions={plantOptions}
        onFormChange={onLoadLogChange}
        onSubmit={onLoadLogSubmit}
        onClear={onClearLoadLog}
      />

      <LoadLogRows rows={loadLogs} />
    </aside>
  );
}

export default function PowderDispatchBoard() {
  const [payload, setPayload] = useState(null);
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [detailOpen, setDetailOpen] = useState(true);
  const [showAllPlants, setShowAllPlants] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadLogForm, setLoadLogForm] = useState(EMPTY_LOAD_LOG);
  const [loadLogs, setLoadLogs] = useState([]);
  const [notes, setNotes] = useState([
    "11.22 23:10 - Night Dispatcher",
    "Rialto short on cement. Getting 1 load from MCC.",
    "01:57 ETA.",
    "---",
    "11.22 22:45 - Night Dispatcher",
    "Flyash demand light early morning.",
  ]);

  const fetchBoard = async (plantId = selectedPlantId) => {
    setLoading(true);
    setError("");
    try {
      const query = plantId ? `?plantId=${encodeURIComponent(plantId)}` : "";
      const response = await fetch(`/api/dispatch-board${query}`, { cache: "no-store" });
      const nextPayload = await response.json();
      if (!response.ok || nextPayload.ok === false) {
        throw new Error(nextPayload.error || "Could not load dispatch data.");
      }
      setPayload(nextPayload);
      setSelectedPlantId(nextPayload.board?.selectedPlant?.plantId ?? plantId ?? null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load dispatch data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBoard(null);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => void fetchBoard(selectedPlantId), 60000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, selectedPlantId]);

  useEffect(() => {
    if (!selectedPlantId) return;

    setLoadLogForm((current) =>
      current.plantId ? current : { ...current, plantId: String(selectedPlantId) },
    );
  }, [selectedPlantId]);

  const board = payload?.board ?? {
    summary: {},
    needs: [],
    sourceAllocations: [],
    driverStatuses: [],
    drivers: [],
    allPlants: [],
    selectedPlant: null,
  };
  const plants = useMemo(
    () => buildPlants(board.needs ?? [], board.allPlants ?? [], showAllPlants),
    [board.needs, board.allPlants, showAllPlants],
  );
  const needsPlantCount = useMemo(
    () => new Set((board.needs ?? []).map((row) => Number(row.plantId))).size,
    [board.needs],
  );
  const allPlantsCount = board.allPlants?.length ?? needsPlantCount;
  const selectedPlantForDetail = useMemo(() => {
    const apiPlant = board.selectedPlant;
    if (!selectedPlantId || Number(apiPlant?.plantId) === Number(selectedPlantId)) {
      return apiPlant;
    }

    const tilePlant = plants.find((plant) => Number(plant.plantId) === Number(selectedPlantId));
    if (!tilePlant) return apiPlant;

    return {
      plantId: tilePlant.plantId,
      plantName: tilePlant.plantName,
      coverage: tilePlant.coverage ?? [],
      shippedOrders: [],
    };
  }, [board.selectedPlant, plants, selectedPlantId]);

  const handleSelectPlant = (plantId) => {
    setSelectedPlantId(plantId);
    setActiveTab("Overview");
    setDetailOpen(true);
    void fetchBoard(plantId);
  };

  const handleAction = (message) => {
    setNotes((current) => [
      `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${message}`,
      ...current,
    ]);
  };

  const handleLoadLogChange = (field, value) => {
    setLoadLogForm((current) => ({ ...current, [field]: value }));
  };

  const handleClearLoadLog = () => {
    setLoadLogForm({
      ...EMPTY_LOAD_LOG,
      plantId: selectedPlantId ? String(selectedPlantId) : "",
    });
  };

  const handleLoadLogSubmit = (event) => {
    event.preventDefault();

    const plant = (board.allPlants ?? []).find(
      (row) => Number(row.plantId) === Number(loadLogForm.plantId),
    );
    const plantName = plant
      ? plantLabel(plant.plantId, plant.plantName)
      : loadLogForm.plantId
        ? `Plant ${loadLogForm.plantId}`
        : "";
    const loggedAt = new Date();
    const nextLog = {
      id: loggedAt.getTime(),
      ...loadLogForm,
      plantLabel: plantName,
      loggedAt: loggedAt.toISOString(),
    };

    setLoadLogs((current) => [nextLog, ...current].slice(0, 8));
    setNotes((current) => [
      `${loggedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - Load logged: truck ${nextLog.truckNumber || "--"} ${nextLog.sourceName || "--"} to ${plantName || "--"}`,
      ...current,
    ]);
    setLoadLogForm({
      ...EMPTY_LOAD_LOG,
      plantId: loadLogForm.plantId,
      sourceName: loadLogForm.sourceName,
    });
  };

  return (
    <main className="pdb-shell">
      <Sidebar />
      <div className="pdb-main">
        <Header
          summary={board.summary ?? {}}
          generatedAt={payload?.generatedAt}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh((current) => !current)}
          onRefresh={() => void fetchBoard(selectedPlantId)}
          onAction={handleAction}
        />

        {error ? <div className="pdb-error">{error}</div> : null}
        {loading && !payload ? <div className="pdb-loading">Loading SQLite dispatch data...</div> : null}

        <PlantCarousel
          plants={plants}
          selectedPlantId={selectedPlantId}
          onSelect={handleSelectPlant}
          showAllPlants={showAllPlants}
          onToggleAllPlants={() => setShowAllPlants((current) => !current)}
          needsCount={needsPlantCount}
          allPlantsCount={allPlantsCount}
        />

        <div className={`pdb-content-grid ${detailOpen ? "" : "detail-closed"}`}>
          {detailOpen ? (
            <SelectedPlantMenu
              plant={selectedPlantForDetail}
              drivers={board.drivers ?? []}
              tab={activeTab}
              setTab={setActiveTab}
              notes={notes}
              onClose={() => setDetailOpen(false)}
            />
          ) : (
            <PlantDetailPlaceholder
              plant={selectedPlantForDetail}
              onReopen={() => setDetailOpen(true)}
            />
          )}
          <RightRail
            board={board}
            loadLogForm={loadLogForm}
            loadLogs={loadLogs}
            onLoadLogChange={handleLoadLogChange}
            onLoadLogSubmit={handleLoadLogSubmit}
            onClearLoadLog={handleClearLoadLog}
          />
        </div>

        <footer className="pdb-footer">
          <span><Database size={14} /> Database: powder_dispatch_mock.db</span>
          <span>{payload?.databasePath ?? "No database loaded"}</span>
          <strong>Connected</strong>
        </footer>
      </div>
    </main>
  );
}

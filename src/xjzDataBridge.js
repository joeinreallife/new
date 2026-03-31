const DEFAULT_DASHBOARD_API_URL = "http://127.0.0.1:8000/api/dashboard";

export const DASHBOARD_API_URL =
  import.meta.env.VITE_XJZ_DASHBOARD_URL || DEFAULT_DASHBOARD_API_URL;

const MATERIAL_KEY_BY_NAME = {
  CEMENT: "cement",
  "TYPE V CEMENT": "typeV",
  FLYASH: "flyAsh",
  "PLC CEMENT": "plc",
  "LC3 CEMENT": "lc3",
};

function text(value) {
  return String(value || "").trim();
}

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function emptyMaterial() {
  return { present: false };
}

function toCockpitMaterial(detail) {
  const firstRiskTime = text(detail?.first_risk_time);
  const earliestDemandTime = text(detail?.earliest_demand_time);

  return {
    present: true,
    onHand: toNumberOrNull(detail?.starting_on_hand_loads),
    diff: toNumberOrNull(detail?.minimum_diff_loads),
    requiredLoads: toNumberOrNull(detail?.max_required_loads ?? detail?.down_loads),
    time: firstRiskTime || earliestDemandTime || null,
    finalTons: toNumberOrNull(detail?.total_tons),
    finalLoads: toNumberOrNull(detail?.total_loads),
    pdfLoads: toNumberOrNull(detail?.total_loads),
    blockYards: toNumberOrNull(detail?.total_yards),
  };
}

function toCockpitPlant(plant, reportDate) {
  const materials = {
    cement: emptyMaterial(),
    typeV: emptyMaterial(),
    flyAsh: emptyMaterial(),
    plc: emptyMaterial(),
    lc3: emptyMaterial(),
  };

  (plant?.materials || []).forEach((detail) => {
    const materialKey = MATERIAL_KEY_BY_NAME[text(detail?.material).toUpperCase()];
    if (!materialKey) return;
    materials[materialKey] = toCockpitMaterial(detail);
  });

  const totalYards =
    toNumberOrNull(plant?.total_yards) ??
    Object.values(materials)
      .map((detail) => toNumberOrNull(detail?.blockYards))
      .filter((value) => value !== null)
      .reduce((largest, value) => Math.max(largest, value), 0);

  return {
    id: Number(plant?.plant_id),
    name: text(plant?.plant_name).toLowerCase(),
    reportDate: reportDate || "",
    maxBlockYards: totalYards,
    materials,
  };
}

function orderKey(row) {
  return [row.ord, row.plantId, row.startTime].map((value) => text(value)).join("|");
}

function shipmentToOrder(row, reportDate) {
  return {
    ord: text(row?.order_number),
    custId: "",
    customer: text(row?.customer_name),
    address: "",
    city: text(row?.city),
    mix: "",
    description: text(row?.description),
    plantId: Number(row?.plant_id),
    truck: text(row?.truck_id),
    rate: null,
    startTime: text(row?.start_time),
    travelTime: toNumberOrNull(row?.travel_time_minutes),
    orderQty: toNumberOrNull(row?.order_qty_yards),
    deliveredQty: null,
    loadSize: null,
    status: text(row?.status_label),
    salesmanId: "",
    date: reportDate || "",
    avgLoadSize: null,
  };
}

function largePourToOrder(row, reportDate) {
  return {
    ord: text(row?.order_number),
    custId: "",
    customer: text(row?.customer_name),
    address: "",
    city: text(row?.city),
    mix: "",
    description: text(row?.description),
    plantId: Number(row?.plant_id),
    truck: "",
    rate: null,
    startTime: text(row?.start_time),
    travelTime: null,
    orderQty: toNumberOrNull(row?.order_qty_yards),
    deliveredQty: null,
    loadSize: null,
    status: row?.is_early_pour ? "early" : "scheduled",
    salesmanId: "",
    date: reportDate || "",
    avgLoadSize: null,
  };
}

function buildOrdersData(dashboard, reportDate) {
  const ordersByKey = new Map();

  (dashboard?.plants || []).forEach((plant) => {
    (plant?.shipments || []).forEach((row) => {
      const order = shipmentToOrder({ ...row, plant_id: plant?.plant_id }, reportDate);
      if (!order.ord || !Number.isFinite(Number(order.plantId))) return;
      ordersByKey.set(orderKey(order), order);
    });
  });

  (dashboard?.boards?.large_pours || []).forEach((row) => {
    const order = largePourToOrder(row, reportDate);
    if (!order.ord || !Number.isFinite(Number(order.plantId))) return;
    const key = orderKey(order);
    if (!ordersByKey.has(key)) ordersByKey.set(key, order);
  });

  return [...ordersByKey.values()];
}

function buildAssignmentsData(sourceRows) {
  const rowsByDriver = new Map();

  sourceRows.forEach((row) => {
    const driver = text(row?.truck_id || row?.order_number);
    if (!driver || rowsByDriver.has(driver)) return;

    rowsByDriver.set(driver, {
      start: text(row?.start_time),
      driver,
      name: "",
      tempTruck: text(row?.truck_id),
      assignTruck: text(row?.truck_id),
      type: "",
      locationCode: text(row?.plant_id),
      location: text(row?.plant_name),
    });
  });

  return [...rowsByDriver.values()];
}

function buildInitialLogs(sourceRows) {
  return sourceRows.reduce((logs, row) => {
    const plantId = Number(row?.plant_id);
    if (!Number.isFinite(plantId)) return logs;

    if (!logs[plantId]) logs[plantId] = [];

    logs[plantId].push({
      truck: text(row?.truck_id),
      driver: text(row?.truck_id || row?.order_number),
      name: text(row?.customer_name),
      location: text(row?.city || row?.delivery_address || row?.plant_name),
      invCode: text(row?.mix_code),
      silo: "",
      time: text(row?.eta_time || row?.start_time),
    });

    return logs;
  }, {});
}

function buildDataStatus(dashboard, reportDate) {
  const validationMessage = text(dashboard?.metadata?.date_validation_message);
  const sourceName = text(dashboard?.metadata?.inputs?.material_source_name);
  const labelDate = reportDate ? ` ${reportDate}` : "";

  if (validationMessage) {
    return {
      tone: "sample",
      label: `xjz sample${labelDate}`,
      detail: validationMessage,
      sourceName,
    };
  }

  return {
    tone: "live",
    label: `xjz api${labelDate}`,
    detail: sourceName ? `material source ${sourceName}` : null,
    sourceName,
  };
}

export function bridgeDashboardToCockpitData(dashboard) {
  const reportDate =
    text(dashboard?.metadata?.schedule_date) || text(dashboard?.metadata?.material_report_date);
  const logSourceRows =
    (dashboard?.driver_log && dashboard.driver_log.length
      ? dashboard.driver_log
      : dashboard?.boards?.driver_eta) || [];

  return {
    plantsData: (dashboard?.plants || []).map((plant) => toCockpitPlant(plant, reportDate)),
    ordersData: buildOrdersData(dashboard, reportDate),
    assignmentData: buildAssignmentsData(logSourceRows),
    sourceAllocationsData: [],
    initialLogs: buildInitialLogs(logSourceRows),
    dataStatus: buildDataStatus(dashboard, reportDate),
  };
}

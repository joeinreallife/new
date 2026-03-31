export const REGION_ORDER = [
  "high desert",
  "nevada",
  "inland empire",
  "san diego",
  "orange county",
  "los angeles",
];

const LOW_DESERT_CLUSTER = "low desert";

const PLANT_REGION_METADATA = {
  1: { region: "inland empire" },
  2: { region: "inland empire" },
  3: { region: "inland empire" },
  4: { region: "inland empire" },
  5: { region: "los angeles" },
  6: { region: "inland empire", cluster: LOW_DESERT_CLUSTER },
  7: { region: "inland empire", cluster: LOW_DESERT_CLUSTER },
  8: { region: "inland empire" },
  9: { region: "inland empire" },
  10: { region: "los angeles" },
  11: { region: "inland empire", cluster: LOW_DESERT_CLUSTER },
  13: { region: "los angeles" },
  14: { region: "los angeles" },
  15: { region: "los angeles" },
  16: { region: "orange county" },
  17: { region: "orange county" },
  18: { region: "orange county" },
  19: { region: "high desert" },
  20: { region: "orange county" },
  21: { region: "orange county" },
  22: { region: "los angeles" },
  23: { region: "los angeles" },
  24: { region: "inland empire" },
  25: { region: "los angeles" },
  26: { region: "inland empire", cluster: LOW_DESERT_CLUSTER },
  27: { region: "inland empire" },
  28: { region: "san diego" },
  29: { region: "san diego" },
  30: { region: "inland empire" },
  31: { region: "high desert" },
  32: { region: "san diego" },
  33: { region: "san diego" },
  34: { region: "high desert" },
  35: { region: "high desert" },
  36: { region: "san diego" },
  37: { region: "inland empire", cluster: LOW_DESERT_CLUSTER },
  38: { region: "high desert" },
  39: { region: "high desert" },
  42: { region: "high desert" },
  45: { region: "high desert" },
  46: { region: "high desert" },
  47: { region: "los angeles" },
  48: { region: "inland empire", cluster: LOW_DESERT_CLUSTER },
  49: { region: "los angeles" },
  54: { region: "inland empire" },
  71: { region: "nevada" },
  72: { region: "nevada" },
  73: { region: "nevada" },
  74: { region: "nevada" },
  75: { region: "nevada" },
  76: { region: "high desert" },
};

function normText(value) {
  return String(value || "").trim().toLowerCase();
}

function titleCase(text) {
  return String(text || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRegionLabel(region) {
  return titleCase(region);
}

export function getPlantRegionMeta(plant) {
  const metadata = PLANT_REGION_METADATA[Number(plant?.id)] || {};
  return {
    region: metadata.region || "inland empire",
    cluster: metadata.cluster || null,
  };
}

export function buildDriverAliasBook(assignments = []) {
  const aliasByDriver = new Map();
  const aliasByName = new Map();
  let aliasCount = 0;

  assignments.forEach((item) => {
    const driverKey = normText(item?.driver);
    const nameKey = normText(item?.name);
    const existingAlias =
      (driverKey && aliasByDriver.get(driverKey)) ||
      (nameKey && aliasByName.get(nameKey)) ||
      null;

    const alias = existingAlias || `Driver ${aliasCount + 1}`;
    if (!existingAlias) aliasCount += 1;

    if (driverKey && !aliasByDriver.has(driverKey)) aliasByDriver.set(driverKey, alias);
    if (nameKey && !aliasByName.has(nameKey)) aliasByName.set(nameKey, alias);
  });

  return {
    get(driverValue, nameValue) {
      const driverKey = normText(driverValue);
      const nameKey = normText(nameValue);
      return aliasByDriver.get(driverKey) || aliasByName.get(nameKey) || null;
    },
    labelForAssignment(item) {
      return (
        this.get(item?.driver, item?.name) ||
        titleCase(item?.name || item?.driver || "") ||
        "-"
      );
    },
    labelForRegion(region, cluster = null) {
      return cluster ? `${formatRegionLabel(region)} - ${formatRegionLabel(cluster)}` : formatRegionLabel(region);
    },
  };
}

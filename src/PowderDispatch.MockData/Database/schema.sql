PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ReportSnapshots (
    SnapshotId INTEGER PRIMARY KEY AUTOINCREMENT,
    ReportType TEXT NOT NULL,
    BusinessDate TEXT NOT NULL,
    PulledAt TEXT NOT NULL,
    SourceFileName TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Plants (
    PlantId INTEGER PRIMARY KEY,
    PlantName TEXT NOT NULL UNIQUE,
    Region TEXT NULL
);

CREATE TABLE IF NOT EXISTS Materials (
    MaterialId INTEGER PRIMARY KEY AUTOINCREMENT,
    MaterialCode TEXT NULL,
    MaterialDescription TEXT NOT NULL UNIQUE,
    MaterialGroup TEXT NOT NULL CHECK (MaterialGroup IN ('Powder', 'RockSand', 'Other'))
);

CREATE TABLE IF NOT EXISTS ShippedOrders (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    SnapshotId INTEGER NOT NULL,
    OrderNumber TEXT NOT NULL,
    CustomerNumber TEXT NULL,
    CustomerName TEXT NULL,
    DeliveryAddress TEXT NULL,
    City TEXT NULL,
    MixCode TEXT NULL,
    MixDescription TEXT NULL,
    PlantId INTEGER NOT NULL,
    ReadyMixTruckCount INTEGER NULL,
    Rate REAL NULL,
    StartTime TEXT NULL,
    TravelMinutes INTEGER NULL,
    OrderedQuantity REAL NULL,
    DeliveredQuantity REAL NULL,
    LoadSize REAL NULL,
    Status TEXT NULL,
    Salesperson TEXT NULL,
    OrderDate TEXT NULL,
    FOREIGN KEY (SnapshotId) REFERENCES ReportSnapshots(SnapshotId),
    FOREIGN KEY (PlantId) REFERENCES Plants(PlantId)
);

CREATE TABLE IF NOT EXISTS MaterialRequirements (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    SnapshotId INTEGER NOT NULL,
    PlantId INTEGER NOT NULL,
    MaterialCode TEXT NULL,
    MaterialDescription TEXT NOT NULL,
    MaterialGroup TEXT NOT NULL CHECK (MaterialGroup IN ('Powder', 'RockSand', 'Other')),
    Yards REAL NULL,
    Quantity REAL NULL,
    UnitOfMeasure TEXT NULL,
    Total REAL NULL,
    Loads REAL NULL,
    OnHand REAL NULL,
    RequirementTime TEXT NULL,
    Diff REAL NULL,
    RequiredLoads REAL NULL,
    BusinessDate TEXT NOT NULL,
    FOREIGN KEY (SnapshotId) REFERENCES ReportSnapshots(SnapshotId),
    FOREIGN KEY (PlantId) REFERENCES Plants(PlantId)
);

CREATE TABLE IF NOT EXISTS MaterialUsage (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    SnapshotId INTEGER NULL,
    PlantId INTEGER NOT NULL,
    MaterialDescription TEXT NOT NULL,
    MaterialGroup TEXT NOT NULL CHECK (MaterialGroup IN ('Powder', 'RockSand', 'Other')),
    UsedQuantity REAL NULL,
    UsedLoads REAL NULL,
    UsageTime TEXT NULL,
    BusinessDate TEXT NOT NULL,
    FOREIGN KEY (SnapshotId) REFERENCES ReportSnapshots(SnapshotId),
    FOREIGN KEY (PlantId) REFERENCES Plants(PlantId)
);

CREATE TABLE IF NOT EXISTS TransportDrivers (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    TruckNumber TEXT NOT NULL,
    DriverName TEXT NOT NULL,
    ShiftStart TEXT NULL,
    Status TEXT NOT NULL,
    CurrentLocation TEXT NULL,
    AssignedSource TEXT NULL,
    AssignedPlantId INTEGER NULL,
    MaterialDescription TEXT NULL,
    LoadTime TEXT NULL,
    ETA TEXT NULL,
    AvailableNow INTEGER NOT NULL DEFAULT 0 CHECK (AvailableNow IN (0, 1)),
    FOREIGN KEY (AssignedPlantId) REFERENCES Plants(PlantId)
);

CREATE TABLE IF NOT EXISTS SourceAllocations (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    SourceName TEXT NOT NULL,
    MaterialDescription TEXT NOT NULL,
    MaterialGroup TEXT NOT NULL CHECK (MaterialGroup IN ('Powder', 'RockSand', 'Other')),
    AllocatedLoads REAL NOT NULL,
    UsedLoads REAL NOT NULL,
    RemainingLoads REAL NOT NULL,
    BusinessDate TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS PowderLoads (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    TruckNumber TEXT NOT NULL,
    DriverName TEXT NOT NULL,
    SourceName TEXT NOT NULL,
    PlantId INTEGER NOT NULL,
    MaterialDescription TEXT NOT NULL,
    Status TEXT NOT NULL,
    LoadTime TEXT NULL,
    ETA TEXT NULL,
    DeliveredTime TEXT NULL,
    BusinessDate TEXT NOT NULL,
    FOREIGN KEY (PlantId) REFERENCES Plants(PlantId)
);

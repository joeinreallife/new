# Dispatch Cockpit

Dispatch cockpit for the materials board workstream.

## Powder Dispatch Mock Database

`src/PowderDispatch.MockData` is a local C#/.NET console importer that builds a SQLite mock database for Powder Dispatch UI prototyping. It is intentionally small: it creates the schema, imports cleaned seed CSVs, inserts source/driver mock data, creates dashboard-friendly SQL views, and prints a data-check board.

This is not the production app, not a polished UI, and not scheduling optimization. It is a clean local data layer for prototyping.

### Create The Database

```powershell
dotnet run --project src\PowderDispatch.MockData\PowderDispatch.MockData.csproj
```

The command recreates:

```text
data\powder_dispatch_mock.db
```

It also prints a smoke test like:

```text
POWDER DISPATCH BOARD DATA CHECK

Dashboard:
Drivers available: 18
Critical plants: 4
Open cement loads needed: 12
Open flyash loads needed: 3
```

### Input Files

Seed CSVs live in `data`:

- `data\material_requirements_seed.csv`
- `data\shipped_orders_seed.csv`

The material requirement rows are sampled and normalized from the Material Requirements PDF at `C:\Users\destr\Downloads\imager\7\test1.pdf`. The shipped order rows are cleaned seed rows from the rendered Shipped Order Summary PDF at `C:\Users\destr\Downloads\imager\7\test.pdf`; direct text extraction from that report interleaves adjacent visual columns, so the prototype uses a manually cleaned CSV for now.

Source allocation and driver availability are mock operational data:

- `src\PowderDispatch.MockData\Database\seed_source_allocations.sql`
- `src\PowderDispatch.MockData\Database\seed_drivers.sql`

### Tables

The schema is in `src\PowderDispatch.MockData\Database\schema.sql` and creates:

- `ReportSnapshots`
- `Plants`
- `Materials`
- `ShippedOrders`
- `MaterialRequirements`
- `MaterialUsage`
- `TransportDrivers`
- `SourceAllocations`
- `PowderLoads`

Plant IDs use the report plant number, so dispatcher-facing rows stay readable, for example `24 RIALTO`.

### Dashboard Views

Views are in `src\PowderDispatch.MockData\Database\views.sql`:

- `PowderMaterialRequirements`
- `PlantPowderCoverage`
- `PlantFirstNeed`
- `SourceAllocationSummary`
- `DriverAvailabilitySummary`
- `DashboardSummary`

Example ad hoc queries:

```sql
SELECT * FROM DashboardSummary;

SELECT
    PlantId,
    PlantName,
    MaterialDescription,
    OnHandLoads,
    LowestDiff,
    FirstNeedTime,
    MaterialStatus
FROM PlantFirstNeed
WHERE MaterialStatus IN ('Critical', 'Watch');

SELECT * FROM SourceAllocationSummary;
```

### Material Group Rules

The importer classifies material descriptions with simple business rules:

- `Powder`: `CEMENT`, `PLC CEMENT`, `TYPE V CEMENT`, `FLYASH`
- `RockSand`: descriptions containing `SAND` or `AGG`
- `Other`: everything else

Rate and ready-mix truck count are stored on shipped orders, but they do not drive the powder dashboard.

### Later Production Connection

When the company SQL database is available, keep these same table/view concepts and replace the CSV importers with SQL-backed extract/load steps:

- Load report snapshots from report runs or source system timestamps.
- Map plant numbers and material codes from the real master data tables.
- Populate `MaterialRequirements` from projected demand.
- Populate `MaterialUsage` from same-day actual material usage.
- Populate `PowderLoads`, `TransportDrivers`, and `SourceAllocations` from dispatch/load assignment systems.

The UI can continue reading the dashboard views while the backing source changes from CSV/seed data to production SQL.

## Powder Dispatch Board UI

The active prototype UI is the React/Vite black-and-white cockpit in:

- `src\PowderDispatchBoard.jsx`
- `src\PowderDispatchBoard.css`

The browser server in `server.mjs` serves the built React app on port `8787` and exposes `/api/dispatch-board`. That API shells out to `src\PowderDispatch.Board` to read the SQLite mock database and return JSON.

Run the mock database importer first if the database does not exist:

```powershell
dotnet run --project src\PowderDispatch.MockData\PowderDispatch.MockData.csproj
```

Then install packages and start the browser board:

```powershell
npm install
npm run web:start
```

Open:

```text
http://127.0.0.1:8787/
```

The main board shows:

- summary counts from `DashboardSummary`
- needs-first material coverage from `PlantFirstNeed`
- sliding plant tiles
- selected plant material coverage and shipped orders
- trucks en route for the selected plant
- a placeholder `Batch Load` tab for future mixer load events
- a load logging panel

By default it reads:

```text
data\powder_dispatch_mock.db
```

To point it at another SQLite file, set:

```powershell
$env:POWDER_DISPATCH_DB = "C:\path\to\another.db"
```

`src\PowderDispatch.Board` can also run directly as a small ASP.NET Core board/API for debugging:

```powershell
dotnet run --project src\PowderDispatch.Board\PowderDispatch.Board.csproj --urls http://127.0.0.1:5098
```

## Current Stack

- React + Vite
- Electron shell for desktop use
- C#/.NET
- SQLite mock database

## Run

```powershell
npm install
npm run web:start
```

For Vite dev only:

```powershell
npm run dev
```

## Data Inputs

- `src/shippedOrders.generated.js` is generated from the shipped order summary workbook
- `src/aggTruckAssignments.generated.js` is generated from the agg truck assignment workbook
- legacy Python generators remain at the repo root and are intentionally not modified by this app

## Import Sample Files

```powershell
npm run import:orders
npm run import:assignments
```

Both scripts accept an optional input path argument if the workbook location changes.

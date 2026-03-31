# Dispatch Cockpit

Dispatch cockpit for the materials board workstream.

## Current Stack

- React + Vite
- Tailwind CSS
- Electron shell for desktop use
- Local generated sample data for shipped orders and truck assignments

## Run

```powershell
npm install
npm run desktop:dev
```

For a browser-only session:

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

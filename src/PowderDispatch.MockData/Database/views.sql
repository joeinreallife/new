DROP VIEW IF EXISTS DashboardSummary;
DROP VIEW IF EXISTS DriverAvailabilitySummary;
DROP VIEW IF EXISTS SourceAllocationSummary;
DROP VIEW IF EXISTS PlantFirstNeed;
DROP VIEW IF EXISTS PlantPowderCoverage;
DROP VIEW IF EXISTS PowderMaterialRequirements;

CREATE VIEW PowderMaterialRequirements AS
SELECT
    Id,
    SnapshotId,
    PlantId,
    MaterialCode,
    MaterialDescription,
    MaterialGroup,
    Yards,
    Quantity,
    UnitOfMeasure,
    Total,
    Loads,
    OnHand,
    RequirementTime,
    Diff,
    RequiredLoads,
    BusinessDate
FROM MaterialRequirements
WHERE MaterialGroup = 'Powder';

CREATE VIEW PlantPowderCoverage AS
WITH grouped AS (
    SELECT
        pmr.PlantId,
        p.PlantName,
        pmr.MaterialDescription,
        MAX(COALESCE(pmr.OnHand, 0)) AS OnHandLoads,
        MAX(COALESCE(pmr.Loads, 0)) AS ProjectedNeedLoads,
        MAX(COALESCE(pmr.RequiredLoads, 0)) AS RequiredLoads,
        MIN(COALESCE(pmr.Diff, 0)) AS LowestDiff,
        MIN(CASE
            WHEN COALESCE(pmr.Diff, 0) <= 1 OR COALESCE(pmr.RequiredLoads, 0) > 0 THEN pmr.RequirementTime
            ELSE NULL
        END) AS FirstPressureTime,
        MIN(pmr.RequirementTime) AS FirstRequirementTime
    FROM PowderMaterialRequirements pmr
    INNER JOIN Plants p ON p.PlantId = pmr.PlantId
    GROUP BY pmr.PlantId, p.PlantName, pmr.MaterialDescription
)
SELECT
    PlantId,
    PlantName,
    MaterialDescription,
    OnHandLoads,
    ProjectedNeedLoads,
    RequiredLoads,
    LowestDiff,
    COALESCE(FirstPressureTime, FirstRequirementTime) AS FirstNeedTime,
    CASE
        WHEN LowestDiff < 0 OR RequiredLoads > 0 THEN 'Critical'
        WHEN LowestDiff <= 1 THEN 'Watch'
        ELSE 'OK'
    END AS MaterialStatus
FROM grouped;

CREATE VIEW PlantFirstNeed AS
SELECT
    PlantId,
    PlantName,
    MaterialDescription,
    OnHandLoads,
    ProjectedNeedLoads,
    RequiredLoads,
    LowestDiff,
    FirstNeedTime,
    MaterialStatus
FROM PlantPowderCoverage
ORDER BY
    CASE MaterialStatus
        WHEN 'Critical' THEN 0
        WHEN 'Watch' THEN 1
        ELSE 2
    END,
    FirstNeedTime,
    LowestDiff;

CREATE VIEW SourceAllocationSummary AS
SELECT
    SourceName,
    MaterialDescription,
    MaterialGroup,
    AllocatedLoads,
    UsedLoads,
    RemainingLoads,
    BusinessDate
FROM SourceAllocations
ORDER BY SourceName, MaterialDescription;

CREATE VIEW DriverAvailabilitySummary AS
WITH statuses(Status) AS (
    VALUES ('Available'), ('Assigned'), ('Loading'), ('On Road'), ('Unavailable')
)
SELECT
    s.Status,
    COUNT(d.Id) AS DriverCount
FROM statuses s
LEFT JOIN TransportDrivers d ON d.Status = s.Status
GROUP BY s.Status
ORDER BY
    CASE s.Status
        WHEN 'Available' THEN 0
        WHEN 'Assigned' THEN 1
        WHEN 'Loading' THEN 2
        WHEN 'On Road' THEN 3
        ELSE 4
    END;

CREATE VIEW DashboardSummary AS
WITH coverage_needs AS (
    SELECT
        PlantId,
        MaterialDescription,
        MaterialStatus,
        CASE
            WHEN RequiredLoads > 0 THEN RequiredLoads
            WHEN LowestDiff < 0 THEN
                CAST((-LowestDiff) AS INTEGER) +
                CASE WHEN (-LowestDiff) > CAST((-LowestDiff) AS INTEGER) THEN 1 ELSE 0 END
            ELSE 0
        END AS LoadsNeeded
    FROM PlantPowderCoverage
)
SELECT
    (SELECT COUNT(*) FROM TransportDrivers WHERE AvailableNow = 1) AS DriversAvailable,
    (SELECT COUNT(DISTINCT PlantId) FROM coverage_needs WHERE MaterialStatus = 'Critical') AS CriticalPlants,
    COALESCE((
        SELECT SUM(LoadsNeeded)
        FROM coverage_needs
        WHERE UPPER(MaterialDescription) LIKE '%CEMENT%'
    ), 0) AS OpenCementLoadsNeeded,
    COALESCE((
        SELECT SUM(LoadsNeeded)
        FROM coverage_needs
        WHERE UPPER(MaterialDescription) = 'FLYASH'
    ), 0) AS OpenFlyashLoadsNeeded;

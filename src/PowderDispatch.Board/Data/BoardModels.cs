namespace PowderDispatch.Board.Data;

internal sealed record BoardViewModel(
    DashboardSummary Summary,
    IReadOnlyList<PlantCoverageRow> Needs,
    IReadOnlyList<PlantListRow> AllPlants,
    IReadOnlyList<SourceAllocationRow> SourceAllocations,
    IReadOnlyList<DriverStatusRow> DriverStatuses,
    IReadOnlyList<DriverRow> Drivers,
    PlantDetail SelectedPlant);

internal sealed record DashboardSummary(
    int DriversAvailable,
    int CriticalPlants,
    double OpenCementLoadsNeeded,
    double OpenFlyashLoadsNeeded);

internal sealed record PlantCoverageRow(
    int PlantId,
    string PlantName,
    string MaterialDescription,
    double OnHandLoads,
    double ProjectedNeedLoads,
    double RequiredLoads,
    double LowestDiff,
    string? FirstNeedTime,
    string MaterialStatus);

internal sealed record PlantListRow(
    int PlantId,
    string PlantName,
    string? Region);

internal sealed record SourceAllocationRow(
    string SourceName,
    string MaterialDescription,
    double AllocatedLoads,
    double UsedLoads,
    double RemainingLoads);

internal sealed record DriverStatusRow(string Status, int DriverCount);

internal sealed record DriverRow(
    string TruckNumber,
    string DriverName,
    string Status,
    string? CurrentLocation,
    string? AssignedSource,
    int? AssignedPlantId,
    string? AssignedPlantName,
    string? MaterialDescription,
    string? LoadTime,
    string? Eta,
    bool AvailableNow);

internal sealed record PlantOrderRow(
    string OrderNumber,
    string? CustomerName,
    string? City,
    string? MixCode,
    string? MixDescription,
    double? OrderedQuantity,
    string? StartTime,
    int? ReadyMixTruckCount,
    string? Status);

internal sealed record PlantDetail(
    int PlantId,
    string PlantName,
    IReadOnlyList<PlantCoverageRow> Coverage,
    IReadOnlyList<PlantOrderRow> ShippedOrders);

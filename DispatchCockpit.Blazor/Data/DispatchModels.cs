namespace DispatchCockpit.Blazor.Data;

public sealed class MaterialSlot
{
    public required string Key { get; init; }

    public required string Label { get; init; }

    public double? Loads { get; set; }

    public double? OnHand { get; set; }

    public double? Diff { get; set; }

    public double? RequiredLoads { get; set; }

    public string Time { get; set; } = string.Empty;

    public double? UsageLive { get; set; }
}

public sealed class PlantRecord
{
    public int Id { get; init; }

    public required string Region { get; init; }

    public bool Active { get; set; }

    public double? Yardage { get; set; }

    public Dictionary<string, MaterialSlot> Materials { get; init; } = new(StringComparer.OrdinalIgnoreCase);

    public int InboundTrucks { get; set; }

    public int NextEtaMinutes { get; set; }

    public int CoverageMinutes { get; set; }

    public int AdditionalTrucksNeeded { get; set; }
}

public sealed class DriverRecord
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public required string Status { get; set; }

    public required string Location { get; set; }

    public required string Shift { get; set; }

    public string AssignedTruck { get; set; } = string.Empty;

    public string DriverCode { get; set; } = string.Empty;
}

public sealed class DriverLogEntry
{
    public required string Id { get; init; }

    public int PlantId { get; set; }

    public string Location { get; set; } = string.Empty;

    public string TruckNumber { get; set; } = string.Empty;

    public string Driver { get; set; } = string.Empty;

    public string Source { get; set; } = string.Empty;

    public string InvCode { get; set; } = string.Empty;

    public string SavedAt { get; set; } = string.Empty;

    public string UpdatedAt { get; set; } = string.Empty;
}

public sealed class DriverLogDraft
{
    public int? PlantId { get; set; }

    public string Location { get; set; } = string.Empty;

    public string TruckNumber { get; set; } = string.Empty;

    public string Driver { get; set; } = string.Empty;

    public string Source { get; set; } = string.Empty;

    public string InvCode { get; set; } = string.Empty;
}

public sealed class SourceAllocationRecord
{
    public required string MaterialKey { get; init; }

    public required string Code { get; init; }

    public int Allocation { get; set; }

    public int DayPicked { get; set; }

    public int NightPicked { get; set; }

    public int PickedUp => DayPicked + NightPicked;

    public int Left => Math.Max(0, Allocation - PickedUp);
}

public sealed class SourceRecommendation
{
    public required string MaterialKey { get; init; }

    public string? BestSource { get; init; }

    public string? BackupSource { get; init; }

    public int AllocationLeft { get; init; }

    public int ValidSourceCount { get; init; }

    public bool Blocked { get; init; }

    public string Reason { get; init; } = string.Empty;
}

public sealed class DecisionItem
{
    public int PlantId { get; init; }

    public required string Mode { get; init; }

    public required string Severity { get; init; }

    public required string MaterialKey { get; init; }

    public required string MaterialLabel { get; init; }

    public required string ActionLabel { get; init; }

    public required string Reason { get; init; }

    public required string Support { get; init; }

    public required string ByTime { get; init; }

    public double Score { get; init; }

    public required SourceRecommendation SourceRecommendation { get; init; }
}

public sealed class DispatchExceptionItem
{
    public required string Id { get; init; }

    public required string Severity { get; init; }

    public required string Title { get; init; }

    public required string Detail { get; init; }

    public int? PlantId { get; init; }

    public string? LogId { get; init; }

    public List<string> RelatedLogIds { get; init; } = [];
}

public sealed class InboundQueueItem
{
    public required string Id { get; init; }

    public required string Truck { get; init; }

    public required string Driver { get; init; }

    public required string Source { get; init; }

    public required string Eta { get; init; }

    public required string Material { get; init; }
}

namespace PowderDispatch.MockData.Models;

internal sealed class MaterialRequirement
{
    public long SnapshotId { get; init; }
    public int PlantNumber { get; init; }
    public string PlantName { get; init; } = string.Empty;
    public string? MaterialCode { get; init; }
    public string MaterialDescription { get; init; } = string.Empty;
    public double? Yards { get; init; }
    public double? Quantity { get; init; }
    public string? UnitOfMeasure { get; init; }
    public double? Total { get; init; }
    public double? Loads { get; init; }
    public double? OnHand { get; init; }
    public string? RequirementTime { get; init; }
    public double? Diff { get; init; }
    public double? RequiredLoads { get; init; }
    public string BusinessDate { get; init; } = string.Empty;
}

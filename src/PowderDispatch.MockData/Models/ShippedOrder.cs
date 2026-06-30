namespace PowderDispatch.MockData.Models;

internal sealed class ShippedOrder
{
    public long SnapshotId { get; init; }
    public string OrderNumber { get; init; } = string.Empty;
    public string? CustomerNumber { get; init; }
    public string? CustomerName { get; init; }
    public string? DeliveryAddress { get; init; }
    public string? City { get; init; }
    public string? MixCode { get; init; }
    public string? MixDescription { get; init; }
    public int PlantNumber { get; init; }
    public string? PlantName { get; init; }
    public int? ReadyMixTruckCount { get; init; }
    public double? Rate { get; init; }
    public string? StartTime { get; init; }
    public int? TravelMinutes { get; init; }
    public double? OrderedQuantity { get; init; }
    public double? DeliveredQuantity { get; init; }
    public double? LoadSize { get; init; }
    public string? Status { get; init; }
    public string? Salesperson { get; init; }
    public string? OrderDate { get; init; }
}

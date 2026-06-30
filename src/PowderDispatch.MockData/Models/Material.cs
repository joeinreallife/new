namespace PowderDispatch.MockData.Models;

internal sealed class Material
{
    public long MaterialId { get; init; }
    public string? MaterialCode { get; init; }
    public string MaterialDescription { get; init; } = string.Empty;
    public string MaterialGroup { get; init; } = string.Empty;
}

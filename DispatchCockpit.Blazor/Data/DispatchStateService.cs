using System.Globalization;

namespace DispatchCockpit.Blazor.Data;

public sealed class DispatchStateService
{
    private static readonly IReadOnlyList<string> MaterialKeys = ["cement", "flyash", "plc", "lc3"];

    private static readonly Dictionary<string, string> MaterialLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["cement"] = "Cement",
        ["flyash"] = "Fly-ash",
        ["plc"] = "PLC",
        ["lc3"] = "LC3",
    };

    private static readonly Dictionary<string, string> DriverGroupLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["rialto"] = "Rialto",
        ["off_site"] = "Off-Site",
        ["nevada"] = "Nevada",
    };

    private static readonly Dictionary<string, string[]> SourceRules = new()
    {
        ["cement:1"] = ["MCC-07", "MLB-27", "CPC-89"],
        ["cement:2"] = ["CMX-21", "CMX-12", "LEHIGH-28"],
        ["cement:3"] = ["CMX-12", "CPC-25", "NATL-17"],
        ["cement:4"] = ["CPC-89", "LEHIGH-80", "MCC-07"],
        ["cement:5"] = ["CPC-23", "LEHIGH-28", "CPC-116"],
        ["cement:6"] = ["MCC-07", "CMX-21", "LEHIGH-80"],
        ["flyash:2"] = ["ECO-05", "SRMG-38"],
        ["flyash:3"] = ["ECO-05", "SRMG-38"],
        ["flyash:4"] = ["ECO-05"],
        ["flyash:5"] = ["SRMG-38"],
        ["flyash:6"] = ["ECO-05", "SRMG-38"],
    };

    public event Action? Changed;

    public List<PlantRecord> Plants { get; } = BuildPlants();

    public List<DriverRecord> Drivers { get; } = BuildDrivers();

    public List<DriverLogEntry> DriverLogs { get; } = BuildDriverLogs();

    public List<SourceAllocationRecord> SourceAllocations { get; } = BuildSourceAllocations();

    public string ShiftNotes { get; private set; } = string.Empty;

    public int ActivePlantCount => Plants.Count(static plant => plant.Active);

    public double TotalYardage => Plants.Sum(static plant => plant.Yardage ?? 0);

    public int DeliveredYardage => 10980;

    public (int Used, int Total) CementUsageHeader => (89, 189);

    public (int Used, int Total) FlyAshUsageHeader => (4, 10);

    public IReadOnlyList<string> DriverNames => Drivers.Select(static driver => driver.Name).Distinct(StringComparer.OrdinalIgnoreCase).Order().ToList();

    public IReadOnlyList<string> TruckNumbers => Drivers.Select(static driver => driver.AssignedTruck).Where(static value => !string.IsNullOrWhiteSpace(value)).Distinct(StringComparer.OrdinalIgnoreCase).Order().ToList();

    public IReadOnlyList<string> InvCodes => ["1", "2", "142"];

    public IReadOnlyList<string> Regions => ["all", "inland empire", "nevada", "high desert", "los angeles", "orange county", "san diego"];

    public IEnumerable<PlantRecord> GetPlants(bool activeOnly, string search, string region, string sortKey)
    {
        IEnumerable<PlantRecord> query = Plants;

        if (activeOnly)
        {
            query = query.Where(static plant => plant.Active);
        }

        var normalizedSearch = Clean(search);
        if (!string.IsNullOrWhiteSpace(normalizedSearch) && int.TryParse(normalizedSearch, out var plantId))
        {
            query = query.Where(plant => plant.Id == plantId);
        }

        if (!string.IsNullOrWhiteSpace(region) && !string.Equals(region, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(plant => string.Equals(plant.Region, region, StringComparison.OrdinalIgnoreCase));
        }

        return sortKey switch
        {
            "urgency" => query.OrderByDescending(plant => BuildDecision(plant)?.Score ?? -1).ThenBy(plant => plant.Id),
            "start_time" => query.OrderBy(plant => ParseClockMinutes(GetPlantStartTime(plant))).ThenBy(plant => plant.Id),
            "area" => query.OrderBy(plant => FormatRegionLabel(plant.Region)).ThenBy(plant => plant.Id),
            _ => query.OrderBy(plant => plant.Id),
        };
    }

    public PlantRecord? GetPlant(int? plantId) => plantId is null ? null : Plants.FirstOrDefault(plant => plant.Id == plantId.Value);

    public IReadOnlyList<DecisionItem> GetActNowDecisions(IEnumerable<PlantRecord> plants) =>
        plants.Select(BuildDecision).Where(decision => decision?.Mode == "act_now").Cast<DecisionItem>().OrderByDescending(decision => decision.Score).ToList();

    public IReadOnlyList<DecisionItem> GetWatchDecisions(IEnumerable<PlantRecord> plants) =>
        plants.Select(BuildDecision).Where(decision => decision?.Mode == "watch").Cast<DecisionItem>().OrderByDescending(decision => decision.Score).ToList();

    public DecisionItem? BuildDecision(PlantRecord plant)
    {
        var materialRows = GetDisplayMaterials(plant).ToList();
        var urgentRow = materialRows
            .Where(slot => slot.Diff is < 0)
            .OrderBy(slot => slot.Diff ?? double.MaxValue)
            .ThenByDescending(slot => slot.RequiredLoads ?? 0)
            .FirstOrDefault();

        if (urgentRow is not null)
        {
            var recommendation = RecommendSource(plant, urgentRow.Key);
            return new DecisionItem
            {
                PlantId = plant.Id,
                Mode = "act_now",
                Severity = urgentRow.Diff is <= -1 ? "critical" : "attention",
                MaterialKey = urgentRow.Key,
                MaterialLabel = urgentRow.Label,
                ActionLabel = recommendation.Blocked
                    ? $"Send {urgentRow.Label} to Plant {plant.Id}"
                    : $"Send 1 {urgentRow.Label} truck from {recommendation.BestSource} to Plant {plant.Id}",
                Reason = recommendation.Blocked
                    ? recommendation.Reason
                    : $"Best source {recommendation.BestSource} | {recommendation.AllocationLeft} left | diff {FormatDiff(urgentRow.Diff)}",
                Support = plant.AdditionalTrucksNeeded > 0
                    ? $"Need {plant.AdditionalTrucksNeeded} more trucks | next ETA {plant.NextEtaMinutes} min | coverage {plant.CoverageMinutes} min"
                    : $"{plant.InboundTrucks} inbound | next ETA {plant.NextEtaMinutes} min | coverage {plant.CoverageMinutes} min",
                ByTime = string.IsNullOrWhiteSpace(urgentRow.Time) ? GetPlantStartTime(plant) : urgentRow.Time,
                Score = Math.Abs(urgentRow.Diff ?? 0) * 100 + (urgentRow.RequiredLoads ?? 0) * 10 + (recommendation.Blocked ? 50 : 0),
                SourceRecommendation = recommendation,
            };
        }

        var watchRow = materialRows
            .Where(slot => slot.Diff is >= 0 and <= 2)
            .OrderBy(slot => slot.Diff ?? double.MaxValue)
            .FirstOrDefault();

        if (watchRow is null)
        {
            return null;
        }

        var watchRecommendation = RecommendSource(plant, watchRow.Key);
        return new DecisionItem
        {
            PlantId = plant.Id,
            Mode = "watch",
            Severity = watchRow.Diff is <= 0.75 ? "tight" : "watch",
            MaterialKey = watchRow.Key,
            MaterialLabel = watchRow.Label,
            ActionLabel = watchRecommendation.Blocked
                ? $"Watch {watchRow.Label} at Plant {plant.Id}"
                : $"Watch {watchRow.Label} at Plant {plant.Id} | next source {watchRecommendation.BestSource}",
            Reason = watchRecommendation.Blocked
                ? watchRecommendation.Reason
                : $"Next source {watchRecommendation.BestSource} | {watchRecommendation.AllocationLeft} left | diff {FormatDiff(watchRow.Diff)}",
            Support = $"{plant.InboundTrucks} inbound | next ETA {plant.NextEtaMinutes} min | coverage {plant.CoverageMinutes} min",
            ByTime = string.IsNullOrWhiteSpace(watchRow.Time) ? GetPlantStartTime(plant) : watchRow.Time,
            Score = (2 - (watchRow.Diff ?? 0)) * 50 + (watchRecommendation.Blocked ? 30 : 0),
            SourceRecommendation = watchRecommendation,
        };
    }

    public IEnumerable<DispatchExceptionItem> GetExceptions()
    {
        var items = new List<DispatchExceptionItem>();

        foreach (var log in DriverLogs)
        {
            if (string.IsNullOrWhiteSpace(log.Source))
            {
                items.Add(new DispatchExceptionItem
                {
                    Id = $"missing-source-{log.Id}",
                    Severity = "critical",
                    Title = $"Plant {log.PlantId} log missing source",
                    Detail = $"Truck {EmptyFallback(log.TruckNumber)} / driver {EmptyFallback(log.Driver)} has no source assigned.",
                    PlantId = log.PlantId,
                    LogId = log.Id,
                });
            }

            if (string.IsNullOrWhiteSpace(log.InvCode))
            {
                items.Add(new DispatchExceptionItem
                {
                    Id = $"missing-inv-{log.Id}",
                    Severity = "attention",
                    Title = $"Plant {log.PlantId} log missing INV code",
                    Detail = $"Truck {EmptyFallback(log.TruckNumber)} / driver {EmptyFallback(log.Driver)} is missing an INV code.",
                    PlantId = log.PlantId,
                    LogId = log.Id,
                });
            }

            if (string.IsNullOrWhiteSpace(log.TruckNumber))
            {
                items.Add(new DispatchExceptionItem
                {
                    Id = $"missing-truck-{log.Id}",
                    Severity = "attention",
                    Title = $"Plant {log.PlantId} log missing truck",
                    Detail = $"Driver {EmptyFallback(log.Driver)} has no truck number on the saved log.",
                    PlantId = log.PlantId,
                    LogId = log.Id,
                });
            }

            if (string.IsNullOrWhiteSpace(log.Driver))
            {
                items.Add(new DispatchExceptionItem
                {
                    Id = $"missing-driver-{log.Id}",
                    Severity = "attention",
                    Title = $"Plant {log.PlantId} log missing driver",
                    Detail = $"Truck {EmptyFallback(log.TruckNumber)} has no driver name on the saved log.",
                    PlantId = log.PlantId,
                    LogId = log.Id,
                });
            }

            if (!string.IsNullOrWhiteSpace(log.Source) && !IsSourceAllowed(log.PlantId, log.Source))
            {
                items.Add(new DispatchExceptionItem
                {
                    Id = $"invalid-source-{log.Id}",
                    Severity = "critical",
                    Title = $"Plant {log.PlantId} has invalid source {log.Source}",
                    Detail = $"Source {log.Source} is not allowed for plant {log.PlantId} based on the source-to-plant matrix.",
                    PlantId = log.PlantId,
                    LogId = log.Id,
                });
            }
        }

        foreach (var plant in Plants)
        {
            var hasRisk = GetRiskFlags(plant).Any();
            var hasInbound = DriverLogs.Any(log => log.PlantId == plant.Id);
            if (hasRisk && !hasInbound)
            {
                items.Add(new DispatchExceptionItem
                {
                    Id = $"risk-no-inbound-{plant.Id}",
                    Severity = "critical",
                    Title = $"Plant {plant.Id} has risk with no inbound logged",
                    Detail = $"Plant {plant.Id} is short on {string.Join(" / ", GetRiskFlags(plant))} and has no inbound dispatch log yet.",
                    PlantId = plant.Id,
                });
            }

            var urgent = GetDisplayMaterials(plant).FirstOrDefault(slot => slot.Diff is < 0 && (slot.Key == "cement" || slot.Key == "flyash"));
            if (urgent is not null && RecommendSource(plant, urgent.Key).Blocked)
            {
                items.Add(new DispatchExceptionItem
                {
                    Id = $"no-source-{plant.Id}-{urgent.Key}",
                    Severity = "critical",
                    Title = $"Plant {plant.Id} has no valid {urgent.Label.ToLowerInvariant()} source",
                    Detail = RecommendSource(plant, urgent.Key).Reason,
                    PlantId = plant.Id,
                });
            }
        }

        foreach (var duplicateTruck in DriverLogs.Where(log => !string.IsNullOrWhiteSpace(log.TruckNumber)).GroupBy(log => log.TruckNumber, StringComparer.OrdinalIgnoreCase))
        {
            var plantIds = duplicateTruck.Select(log => log.PlantId).Distinct().ToList();
            if (duplicateTruck.Count() > 1 && plantIds.Count > 1)
            {
                items.Add(new DispatchExceptionItem
                {
                    Id = $"duplicate-truck-{duplicateTruck.Key}",
                    Severity = "attention",
                    Title = $"Review duplicate truck {duplicateTruck.Key}",
                    Detail = $"Truck {duplicateTruck.Key} appears on multiple plant logs: {string.Join(", ", plantIds)}.",
                    PlantId = duplicateTruck.First().PlantId,
                    LogId = duplicateTruck.First().Id,
                    RelatedLogIds = duplicateTruck.Select(log => log.Id).ToList(),
                });
            }
        }

        foreach (var duplicateDriver in DriverLogs.Where(log => !string.IsNullOrWhiteSpace(log.Driver)).GroupBy(log => log.Driver, StringComparer.OrdinalIgnoreCase))
        {
            var plantIds = duplicateDriver.Select(log => log.PlantId).Distinct().ToList();
            if (duplicateDriver.Count() > 1 && plantIds.Count > 1)
            {
                items.Add(new DispatchExceptionItem
                {
                    Id = $"duplicate-driver-{duplicateDriver.Key}",
                    Severity = "attention",
                    Title = $"Review duplicate driver {duplicateDriver.Key}",
                    Detail = $"{duplicateDriver.Key} appears on multiple plant logs: {string.Join(", ", plantIds)}.",
                    PlantId = duplicateDriver.First().PlantId,
                    LogId = duplicateDriver.First().Id,
                    RelatedLogIds = duplicateDriver.Select(log => log.Id).ToList(),
                });
            }
        }

        return items
            .OrderBy(item => item.Severity switch { "critical" => 0, "attention" => 1, _ => 2 })
            .ThenBy(item => item.PlantId ?? int.MaxValue)
            .ThenBy(item => item.Title)
            .ToList();
    }

    public IEnumerable<InboundQueueItem> GetInboundQueue(PlantRecord plant)
    {
        var plantLogs = DriverLogs.Where(log => log.PlantId == plant.Id).ToList();
        if (plantLogs.Count > 0)
        {
            return plantLogs.Select((log, index) => new InboundQueueItem
            {
                Id = log.Id,
                Truck = EmptyFallback(log.TruckNumber),
                Driver = EmptyFallback(log.Driver),
                Source = EmptyFallback(log.Source),
                Eta = $"{Math.Max(8, plant.NextEtaMinutes - 4) + (index * 7)} min",
                Material = MaterialLabels[GetSourceMaterialKey(log.Source)],
            }).ToList();
        }

        var fallbackDrivers = Drivers.Where(driver => GetDriverShift(driver) == "day" && GetDriverGroup(driver) == GetPlantDriverGroup(plant)).Take(Math.Max(plant.InboundTrucks, 1)).ToList();
        return Enumerable.Range(0, Math.Max(plant.InboundTrucks, 1)).Select(index =>
        {
            var driver = index < fallbackDrivers.Count ? fallbackDrivers[index] : null;
            return new InboundQueueItem
            {
                Id = $"{plant.Id}-{index}",
                Truck = driver?.AssignedTruck ?? $"TBD-{plant.Id}-{index + 1}",
                Driver = driver?.Name ?? "Unassigned",
                Source = GetAllowedSources(plant, GetPrimaryMaterialKey(plant)).FirstOrDefault() ?? "-",
                Eta = $"{plant.NextEtaMinutes + (index * 8)} min",
                Material = MaterialLabels[GetPrimaryMaterialKey(plant)],
            };
        }).ToList();
    }

    public IEnumerable<string> GetAllowedSources(PlantRecord plant, string materialKey)
    {
        var key = $"{materialKey}:{plant.Id}";
        return SourceRules.TryGetValue(key, out var values) ? values : [];
    }

    public bool IsSourceAllowed(int plantId, string source)
    {
        var normalizedSource = Clean(source).ToUpperInvariant();
        var materialKey = GetSourceMaterialKey(source);
        var key = $"{materialKey}:{plantId}";
        return !SourceRules.TryGetValue(key, out var values) || values.Contains(normalizedSource, StringComparer.OrdinalIgnoreCase);
    }

    public IEnumerable<SourceAllocationRecord> GetSourceAllocations(string materialKey) =>
        SourceAllocations.Where(record => string.Equals(record.MaterialKey, materialKey, StringComparison.OrdinalIgnoreCase));

    public IEnumerable<DriverRecord> GetDrivers() => Drivers.OrderBy(driver => driver.Shift).ThenBy(driver => driver.Location).ThenBy(driver => driver.Name);

    public IEnumerable<DriverRecord> GetDrivers(string search)
    {
        var normalized = Clean(search).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return GetDrivers();
        }

        var plantSearch = ParsePlantId(normalized);
        return Drivers.Where(driver =>
            driver.Name.Contains(normalized, StringComparison.OrdinalIgnoreCase) ||
            driver.Location.Contains(normalized, StringComparison.OrdinalIgnoreCase) ||
            driver.AssignedTruck.Contains(normalized, StringComparison.OrdinalIgnoreCase) ||
            driver.DriverCode.Contains(normalized, StringComparison.OrdinalIgnoreCase) ||
            (plantSearch is not null && DriverLogs.Any(log => log.PlantId == plantSearch.Value && string.Equals(log.Driver, driver.Name, StringComparison.OrdinalIgnoreCase))));
    }

    public IEnumerable<DriverLogEntry> GetLogsForPlant(int plantId) => DriverLogs.Where(log => log.PlantId == plantId).OrderByDescending(log => ParseTimestamp(log.UpdatedAt, log.SavedAt));

    public IEnumerable<DriverLogEntry> GetLogsForDriver(string driverName) => DriverLogs.Where(log => string.Equals(log.Driver, driverName, StringComparison.OrdinalIgnoreCase)).OrderByDescending(log => ParseTimestamp(log.UpdatedAt, log.SavedAt));

    public DriverLogEntry? FindLog(string? logId) => string.IsNullOrWhiteSpace(logId) ? null : DriverLogs.FirstOrDefault(log => log.Id == logId);

    public void AddDriverLog(DriverLogDraft draft)
    {
        if (draft.PlantId is null || !HasContent(draft))
        {
            return;
        }

        DriverLogs.Insert(0, new DriverLogEntry
        {
            Id = $"log-{Guid.NewGuid():N}",
            PlantId = draft.PlantId.Value,
            Location = Clean(draft.Location),
            TruckNumber = Clean(draft.TruckNumber),
            Driver = Clean(draft.Driver),
            Source = NormalizeSource(Clean(draft.Source)),
            InvCode = Clean(draft.InvCode),
            SavedAt = DateTime.Now.ToString("g", CultureInfo.CurrentCulture),
        });

        NotifyChanged();
    }

    public void UpdateDriverLog(string logId, DriverLogDraft draft)
    {
        var target = FindLog(logId);
        if (target is null || draft.PlantId is null)
        {
            return;
        }

        target.PlantId = draft.PlantId.Value;
        target.Location = Clean(draft.Location);
        target.TruckNumber = Clean(draft.TruckNumber);
        target.Driver = Clean(draft.Driver);
        target.Source = NormalizeSource(Clean(draft.Source));
        target.InvCode = Clean(draft.InvCode);
        target.UpdatedAt = DateTime.Now.ToString("g", CultureInfo.CurrentCulture);

        NotifyChanged();
    }

    public void SetShiftNotes(string value)
    {
        ShiftNotes = value ?? string.Empty;
        NotifyChanged();
    }

    public DriverLogDraft CreateDraftForPlant(PlantRecord? plant)
    {
        return new DriverLogDraft
        {
            PlantId = plant?.Id,
            Location = plant is null ? string.Empty : $"Plant {plant.Id}",
        };
    }

    public DriverLogDraft CreateDraftFromLog(DriverLogEntry? entry)
    {
        if (entry is null)
        {
            return new DriverLogDraft();
        }

        return new DriverLogDraft
        {
            PlantId = entry.PlantId,
            Location = entry.Location,
            TruckNumber = entry.TruckNumber,
            Driver = entry.Driver,
            Source = entry.Source,
            InvCode = entry.InvCode,
        };
    }

    public string GetPlantStartTime(PlantRecord plant)
    {
        var times = plant.Materials.Values
            .Select(slot => slot.Time)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .OrderBy(ParseClockMinutes)
            .ToList();

        return times.FirstOrDefault() ?? "-";
    }

    public IEnumerable<string> GetRiskFlags(PlantRecord plant)
    {
        if (plant.Materials.TryGetValue("cement", out var cement) && cement.Diff is < 0)
        {
            yield return "C";
        }

        if (plant.Materials.TryGetValue("flyash", out var flyash) && flyash.Diff is < 0)
        {
            yield return "F";
        }
    }

    public IReadOnlyList<string> GetGroups() => ["rialto", "off_site", "nevada"];

    public string GetGroupLabel(string key) => DriverGroupLabels[key];

    public string GetDriverGroup(DriverRecord driver)
    {
        var location = Clean(driver.Location).ToLowerInvariant();
        if (location.Contains("rialto", StringComparison.Ordinal)) return "rialto";
        if (location.Contains("nevada", StringComparison.Ordinal) || location.Contains("vegas", StringComparison.Ordinal)) return "nevada";
        return "off_site";
    }

    public string GetPlantDriverGroup(PlantRecord plant) => plant.Region switch
    {
        "nevada" => "nevada",
        "inland empire" => "rialto",
        _ => "off_site",
    };

    public string GetDriverShift(DriverRecord driver) => string.Equals(driver.Shift, "night", StringComparison.OrdinalIgnoreCase) ? "night" : "day";

    public int UniqueLoggedDrivers => DriverLogs.Select(log => log.Driver).Where(value => !string.IsNullOrWhiteSpace(value)).Distinct(StringComparer.OrdinalIgnoreCase).Count();

    public int UniqueLoggedTrucks => DriverLogs.Select(log => log.TruckNumber).Where(value => !string.IsNullOrWhiteSpace(value)).Distinct(StringComparer.OrdinalIgnoreCase).Count();

    public int PlantsServedCount => DriverLogs.Select(log => log.PlantId).Distinct().Count();

    private void NotifyChanged() => Changed?.Invoke();

    private static string Clean(string? value) => string.Join(' ', (value ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

    private static string EmptyFallback(string? value) => string.IsNullOrWhiteSpace(value) ? "-" : value;

    private static bool HasContent(DriverLogDraft draft) =>
        !string.IsNullOrWhiteSpace(draft.TruckNumber) ||
        !string.IsNullOrWhiteSpace(draft.Driver) ||
        !string.IsNullOrWhiteSpace(draft.Source) ||
        !string.IsNullOrWhiteSpace(draft.InvCode);

    private static int? ParsePlantId(string value)
    {
        if (int.TryParse(value, out var plantId))
        {
            return plantId;
        }

        var normalized = value.Replace("plant", string.Empty, StringComparison.OrdinalIgnoreCase).Trim();
        return int.TryParse(normalized, out var parsed) ? parsed : null;
    }

    private static DateTime ParseTimestamp(string? preferred, string? fallback)
    {
        if (DateTime.TryParse(preferred, out var updated))
        {
            return updated;
        }

        return DateTime.TryParse(fallback, out var saved) ? saved : DateTime.MinValue;
    }

    private static int ParseClockMinutes(string value)
    {
        return TimeOnly.TryParse(value, out var time) ? (time.Hour * 60) + time.Minute : int.MaxValue;
    }

    private static IEnumerable<MaterialSlot> GetDisplayMaterials(PlantRecord plant) =>
        MaterialKeys
            .Select(key => plant.Materials.TryGetValue(key, out var slot) ? slot : null)
            .Where(slot => slot is not null && (slot.Diff.HasValue || slot.OnHand.HasValue || slot.Loads.HasValue || slot.RequiredLoads.HasValue))
            .Cast<MaterialSlot>();

    private SourceRecommendation RecommendSource(PlantRecord plant, string materialKey)
    {
        var allowed = GetAllowedSources(plant, materialKey).ToList();
        var candidates = SourceAllocations
            .Where(record => string.Equals(record.MaterialKey, materialKey, StringComparison.OrdinalIgnoreCase) && allowed.Contains(record.Code, StringComparer.OrdinalIgnoreCase))
            .OrderByDescending(record => record.Left)
            .ThenBy(record => record.Code)
            .ToList();

        if (allowed.Count == 0)
        {
            return new SourceRecommendation
            {
                MaterialKey = materialKey,
                Blocked = true,
                Reason = $"No valid {MaterialLabels[materialKey].ToLowerInvariant()} source is configured for plant {plant.Id}.",
                ValidSourceCount = 0,
            };
        }

        var best = candidates.FirstOrDefault();
        if (best is null || best.Left <= 0)
        {
            return new SourceRecommendation
            {
                MaterialKey = materialKey,
                Blocked = true,
                Reason = $"All allowed {MaterialLabels[materialKey].ToLowerInvariant()} sources are out of allocation.",
                ValidSourceCount = allowed.Count,
            };
        }

        var backup = candidates.Skip(1).FirstOrDefault(static record => record.Left > 0);
        return new SourceRecommendation
        {
            MaterialKey = materialKey,
            BestSource = best.Code,
            BackupSource = backup?.Code,
            AllocationLeft = best.Left,
            ValidSourceCount = allowed.Count,
            Blocked = false,
            Reason = $"Best source {best.Code} with {best.Left} left.",
        };
    }

    private string GetPrimaryMaterialKey(PlantRecord plant)
    {
        if (plant.Materials.TryGetValue("cement", out var cement) && (cement.Diff.HasValue || cement.OnHand.HasValue))
        {
            return "cement";
        }

        if (plant.Materials.TryGetValue("flyash", out var flyash) && (flyash.Diff.HasValue || flyash.OnHand.HasValue))
        {
            return "flyash";
        }

        return "cement";
    }

    private static string GetSourceMaterialKey(string source)
    {
        var normalized = Clean(source).ToUpperInvariant();
        return normalized.StartsWith("ECO-", StringComparison.Ordinal) || normalized.StartsWith("SRMG-", StringComparison.Ordinal)
            ? "flyash"
            : "cement";
    }

    private static string NormalizeSource(string source)
    {
        var normalized = Clean(source).ToUpperInvariant();
        return normalized switch
        {
            "7" => "MCC-07",
            _ => normalized,
        };
    }

    public string FormatRegionLabel(string region) => region switch
    {
        "inland empire" => "Inland Empire",
        "high desert" => "High Desert",
        "los angeles" => "Los Angeles",
        "orange county" => "Orange County",
        "san diego" => "San Diego",
        "nevada" => "Nevada",
        _ => region,
    };

    public static string FormatNumber(double? value, int maximumFractionDigits = 1) =>
        value is null ? "-" : value.Value.ToString($"N{maximumFractionDigits}", CultureInfo.CurrentCulture);

    public static string FormatDiff(double? value) =>
        value is null ? "-" : value < 0 ? $"({Math.Abs(value.Value):N2})" : value.Value.ToString("N2", CultureInfo.CurrentCulture);

    private static List<PlantRecord> BuildPlants()
    {
        return
        [
            CreatePlant(1, "inland empire", 279.5, 1, 22, 36, 0, new Dictionary<string, MaterialSlot>(StringComparer.OrdinalIgnoreCase)
            {
                ["cement"] = CreateSlot("cement", 4.86, 6.25, 1.39, 0, "11:33", 2.45),
            }),
            CreatePlant(2, "inland empire", 838, 2, 14, 58, 0, new Dictionary<string, MaterialSlot>(StringComparer.OrdinalIgnoreCase)
            {
                ["cement"] = CreateSlot("cement", 7.07, 8.5, 1.43, 0, "14:39", 2.85),
                ["flyash"] = CreateSlot("flyash", 0.06, 2.25, 2.19, 0, "12:09", 4.5),
            }),
            CreatePlant(3, "high desert", 390, 1, 19, 34, 0, new Dictionary<string, MaterialSlot>(StringComparer.OrdinalIgnoreCase)
            {
                ["cement"] = CreateSlot("cement", 4.23, 6, 1.77, 0, "10:03", 2.1),
                ["flyash"] = CreateSlot("flyash", 0.11, 1.5, 1.39, 0, "11:02", 3.8),
            }),
            CreatePlant(4, "orange county", 232, 1, 17, 26, 0, new Dictionary<string, MaterialSlot>(StringComparer.OrdinalIgnoreCase)
            {
                ["cement"] = CreateSlot("cement", 2.85, 10.5, 7.65, 0, "23:00", 1.95),
                ["flyash"] = CreateSlot("flyash", 0.09, 2, 1.91, 0, "11:27", 2.75),
            }),
            CreatePlant(5, "san diego", 381, 2, 16, 44, 0, new Dictionary<string, MaterialSlot>(StringComparer.OrdinalIgnoreCase)
            {
                ["cement"] = CreateSlot("cement", 2.93, 12, 9.07, 0, "11:01", 2.2),
                ["flyash"] = CreateSlot("flyash", 0.38, 3.5, 3.12, 0, "10:17", 2.4),
            }),
            CreatePlant(6, "nevada", 539, 1, 26, 12, 2, new Dictionary<string, MaterialSlot>(StringComparer.OrdinalIgnoreCase)
            {
                ["cement"] = CreateSlot("cement", 3.52, 3, -0.52, 1, "10:34", 3.15),
                ["flyash"] = CreateSlot("flyash", 0.01, 2.25, 2.24, 0, "08:23", 2.05),
            }),
        ];
    }

    private static List<DriverRecord> BuildDrivers()
    {
        return
        [
            CreateDriver("d01", "Abarami Williams", "available", "Rialto Yard", "day", "6444", "A01"),
            CreateDriver("d02", "Nicolas Ramos Garcia", "to source", "Rialto Yard", "day", "6468", "N21"),
            CreateDriver("d03", "Juan Tomas Gaspar", "at plant", "Plant 6", "day", "6467", "J17"),
            CreateDriver("d04", "Travis Perez", "returning", "Victorville", "day", "6391", "T12"),
            CreateDriver("d05", "Brian A. Cox", "available", "Nevada Yard", "day", "6346", "B09"),
            CreateDriver("d06", "Moses Howell", "available", "Rialto Yard", "day", "6480", "M18"),
            CreateDriver("d07", "Steven Mercado", "break", "Murrieta", "day", "6410", "S33"),
            CreateDriver("n01", "Isaiah Flores", "available", "Rialto Yard", "night", "6520", "I04"),
            CreateDriver("n02", "Eli Martinez", "available", "Nevada Yard", "night", "6525", "E11"),
            CreateDriver("n03", "Carlos Ruiz", "to source", "Palmdale", "night", "6530", "C06"),
        ];
    }

    private static List<DriverLogEntry> BuildDriverLogs()
    {
        return
        [
            CreateLog("log-a", 6, "Plant 6", "6444", "Abarami Williams", "MCC-07", "1", "4/2/2026 8:15 PM"),
            CreateLog("log-b", 6, "Plant 6", "6468", "Nicolas Ramos Garcia", "CMX-12", "2", "4/2/2026 8:28 PM"),
            CreateLog("log-c", 5, "Plant 5", "6467", "Juan Tomas Gaspar", "CPC-23", "142", "4/2/2026 8:40 PM"),
            CreateLog("log-d", 4, "Plant 4", "6391", "Travis Perez", "ECO-05", "1", "4/2/2026 8:55 PM"),
            CreateLog("log-e", 2, "Plant 2", "6346", "Brian A. Cox", "LEHIGH-28", "", "4/2/2026 9:05 PM"),
        ];
    }

    private static List<SourceAllocationRecord> BuildSourceAllocations()
    {
        return
        [
            CreateAllocation("cement", "MCC-07", 136, 44, 18),
            CreateAllocation("cement", "MLB-27", 124, 39, 16),
            CreateAllocation("cement", "CMX-21", 118, 37, 14),
            CreateAllocation("cement", "CMX-12", 102, 31, 12),
            CreateAllocation("cement", "CMX-5", 96, 28, 10),
            CreateAllocation("cement", "CPC-89", 148, 46, 19),
            CreateAllocation("cement", "CPC-25", 111, 34, 13),
            CreateAllocation("cement", "LEHIGH-28", 132, 42, 17),
            CreateAllocation("cement", "CPC-23", 108, 32, 12),
            CreateAllocation("cement", "CPC-116", 126, 40, 15),
            CreateAllocation("cement", "NATL-17", 116, 36, 14),
            CreateAllocation("cement", "LEHIGH-80", 138, 45, 18),
            CreateAllocation("flyash", "ECO-05", 84, 28, 9),
            CreateAllocation("flyash", "SRMG-38", 72, 24, 8),
        ];
    }

    private static SourceAllocationRecord CreateAllocation(string materialKey, string code, int allocation, int dayPicked, int nightPicked) =>
        new()
        {
            MaterialKey = materialKey,
            Code = code,
            Allocation = allocation,
            DayPicked = dayPicked,
            NightPicked = nightPicked,
        };

    private static DriverLogEntry CreateLog(string id, int plantId, string location, string truck, string driver, string source, string invCode, string savedAt) =>
        new()
        {
            Id = id,
            PlantId = plantId,
            Location = location,
            TruckNumber = truck,
            Driver = driver,
            Source = source,
            InvCode = invCode,
            SavedAt = savedAt,
        };

    private static DriverRecord CreateDriver(string id, string name, string status, string location, string shift, string truck, string code) =>
        new()
        {
            Id = id,
            Name = name,
            Status = status,
            Location = location,
            Shift = shift,
            AssignedTruck = truck,
            DriverCode = code,
        };

    private static PlantRecord CreatePlant(int id, string region, double yardage, int inboundTrucks, int nextEtaMinutes, int coverageMinutes, int additionalTrucksNeeded, Dictionary<string, MaterialSlot> materials) =>
        new()
        {
            Id = id,
            Region = region,
            Active = true,
            Yardage = yardage,
            Materials = materials,
            InboundTrucks = inboundTrucks,
            NextEtaMinutes = nextEtaMinutes,
            CoverageMinutes = coverageMinutes,
            AdditionalTrucksNeeded = additionalTrucksNeeded,
        };

    private static MaterialSlot CreateSlot(string key, double? loads, double? onHand, double? diff, double? requiredLoads, string time, double usageLive) =>
        new()
        {
            Key = key,
            Label = MaterialLabels[key],
            Loads = loads,
            OnHand = onHand,
            Diff = diff,
            RequiredLoads = requiredLoads,
            Time = time,
            UsageLive = usageLive,
        };
}

using System.Globalization;
using Microsoft.Data.Sqlite;
using PowderDispatch.MockData.Importers;

var repoRoot = FindRepoRoot();
var projectDir = Path.Combine(repoRoot, "src", "PowderDispatch.MockData");
var dataDir = Path.Combine(repoRoot, "data");
var databasePath = Path.Combine(dataDir, "powder_dispatch_mock.db");

Directory.CreateDirectory(dataDir);

if (File.Exists(databasePath))
{
    File.Delete(databasePath);
}

using var connection = new SqliteConnection($"Data Source={databasePath}");
connection.Open();

ExecuteSqlFile(connection, Path.Combine(projectDir, "Database", "schema.sql"));

var materialSnapshotId = InsertReportSnapshot(
    connection,
    reportType: "MaterialRequirements",
    businessDate: "2026-06-29",
    sourceFileName: @"C:\Users\destr\Downloads\imager\7\test1.pdf");

var materialRequirementCount = MaterialRequirementImporter.Import(
    connection,
    Path.Combine(dataDir, "material_requirements_seed.csv"),
    materialSnapshotId);

var shippedSnapshotId = InsertReportSnapshot(
    connection,
    reportType: "ShippedOrderSummary",
    businessDate: "2026-06-29",
    sourceFileName: @"C:\Users\destr\Downloads\imager\7\test.pdf");

var shippedOrderCount = ShippedOrderImporter.Import(
    connection,
    Path.Combine(dataDir, "shipped_orders_seed.csv"),
    shippedSnapshotId);

ExecuteSqlFile(connection, Path.Combine(projectDir, "Database", "seed_source_allocations.sql"));
ExecuteSqlFile(connection, Path.Combine(projectDir, "Database", "seed_drivers.sql"));
ExecuteSqlFile(connection, Path.Combine(projectDir, "Database", "views.sql"));

PrintDataCheck(connection, databasePath, materialRequirementCount, shippedOrderCount);

static string FindRepoRoot()
{
    var candidates = new[]
    {
        Directory.GetCurrentDirectory(),
        AppContext.BaseDirectory
    };

    foreach (var candidate in candidates)
    {
        var directory = new DirectoryInfo(candidate);

        while (directory is not null)
        {
            var schemaPath = Path.Combine(directory.FullName, "src", "PowderDispatch.MockData", "Database", "schema.sql");
            var dataPath = Path.Combine(directory.FullName, "data");

            if (File.Exists(schemaPath) && Directory.Exists(dataPath))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }
    }

    throw new DirectoryNotFoundException("Could not find the dispatch-cockpit repository root.");
}

static void ExecuteSqlFile(SqliteConnection connection, string path)
{
    using var command = connection.CreateCommand();
    command.CommandText = File.ReadAllText(path);
    command.ExecuteNonQuery();
}

static long InsertReportSnapshot(
    SqliteConnection connection,
    string reportType,
    string businessDate,
    string sourceFileName)
{
    using var command = connection.CreateCommand();
    command.CommandText = """
        INSERT INTO ReportSnapshots (ReportType, BusinessDate, PulledAt, SourceFileName)
        VALUES ($reportType, $businessDate, $pulledAt, $sourceFileName);
        SELECT last_insert_rowid();
        """;
    command.Parameters.AddWithValue("$reportType", reportType);
    command.Parameters.AddWithValue("$businessDate", businessDate);
    command.Parameters.AddWithValue("$pulledAt", DateTimeOffset.Now.ToString("O", CultureInfo.InvariantCulture));
    command.Parameters.AddWithValue("$sourceFileName", sourceFileName);

    return (long)command.ExecuteScalar()!;
}

static void PrintDataCheck(
    SqliteConnection connection,
    string databasePath,
    int materialRequirementCount,
    int shippedOrderCount)
{
    Console.WriteLine("POWDER DISPATCH BOARD DATA CHECK");
    Console.WriteLine();
    Console.WriteLine($"Database: {databasePath}");
    Console.WriteLine($"Imported material requirement rows: {materialRequirementCount}");
    Console.WriteLine($"Imported shipped order rows: {shippedOrderCount}");
    Console.WriteLine();

    using (var command = connection.CreateCommand())
    {
        command.CommandText = """
            SELECT
                DriversAvailable,
                CriticalPlants,
                OpenCementLoadsNeeded,
                OpenFlyashLoadsNeeded
            FROM DashboardSummary
            LIMIT 1;
            """;

        using var reader = command.ExecuteReader();
        if (reader.Read())
        {
            Console.WriteLine("Dashboard:");
            Console.WriteLine($"Drivers available: {FormatLoads(reader.GetDouble(0))}");
            Console.WriteLine($"Critical plants: {FormatLoads(reader.GetDouble(1))}");
            Console.WriteLine($"Open cement loads needed: {FormatLoads(reader.GetDouble(2))}");
            Console.WriteLine($"Open flyash loads needed: {FormatLoads(reader.GetDouble(3))}");
        }
    }

    Console.WriteLine();
    Console.WriteLine("Top plant needs:");

    using (var command = connection.CreateCommand())
    {
        command.CommandText = """
            SELECT
                PlantId,
                PlantName,
                MaterialDescription,
                OnHandLoads,
                LowestDiff,
                FirstNeedTime,
                MaterialStatus
            FROM PlantFirstNeed
            WHERE MaterialStatus IN ('Critical', 'Watch')
            ORDER BY
                CASE MaterialStatus
                    WHEN 'Critical' THEN 0
                    WHEN 'Watch' THEN 1
                    ELSE 2
                END,
                FirstNeedTime,
                LowestDiff
            LIMIT 8;
            """;

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var plantId = reader.GetInt32(0);
            var plantName = ToDisplayName(reader.GetString(1));
            var material = ToDisplayName(reader.GetString(2));
            var onHand = reader.GetDouble(3);
            var net = reader.GetDouble(4);
            var firstNeed = reader.IsDBNull(5) ? "n/a" : reader.GetString(5);
            var status = reader.GetString(6);

            Console.WriteLine($"{plantId} {plantName} | {material} | On hand {FormatLoads(onHand)} | Net {FormatSignedLoads(net)} | First need {firstNeed} | {status}");
        }
    }

    Console.WriteLine();
    Console.WriteLine("Source allocations:");

    using (var command = connection.CreateCommand())
    {
        command.CommandText = """
            SELECT SourceName, MaterialDescription, AllocatedLoads, UsedLoads, RemainingLoads
            FROM SourceAllocationSummary;
            """;

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            Console.WriteLine($"{reader.GetString(0)} | {ToDisplayName(reader.GetString(1))} | {FormatLoads(reader.GetDouble(2))} allocated | {FormatLoads(reader.GetDouble(3))} used | {FormatLoads(reader.GetDouble(4))} remaining");
        }
    }
}

static string FormatLoads(double value)
{
    return Math.Abs(value - Math.Round(value)) < 0.001
        ? Math.Round(value).ToString("0", CultureInfo.InvariantCulture)
        : value.ToString("0.##", CultureInfo.InvariantCulture);
}

static string FormatSignedLoads(double value)
{
    return value > 0
        ? FormatLoads(value)
        : value.ToString("0.##", CultureInfo.InvariantCulture);
}

static string ToDisplayName(string value)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        return value;
    }

    var textInfo = CultureInfo.InvariantCulture.TextInfo;
    return value.Equals("PLC CEMENT", StringComparison.OrdinalIgnoreCase)
        ? "PLC Cement"
        : textInfo.ToTitleCase(value.ToLowerInvariant());
}

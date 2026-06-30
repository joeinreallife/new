using Microsoft.Data.Sqlite;

namespace PowderDispatch.Board.Data;

internal sealed class DispatchRepository
{
    private readonly string _connectionString;

    public DispatchRepository(string databasePath)
    {
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Mode = SqliteOpenMode.ReadOnly
        }.ToString();
    }

    public BoardViewModel GetBoard(int? selectedPlantId)
    {
        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        var needs = GetNeeds(connection);
        var selectedId = selectedPlantId ?? needs.FirstOrDefault()?.PlantId ?? 0;

        return new BoardViewModel(
            GetSummary(connection),
            needs,
            GetAllPlants(connection),
            GetSourceAllocations(connection),
            GetDriverStatuses(connection),
            GetDrivers(connection),
            GetPlantDetail(connection, selectedId));
    }

    private static DashboardSummary GetSummary(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT DriversAvailable, CriticalPlants, OpenCementLoadsNeeded, OpenFlyashLoadsNeeded
            FROM DashboardSummary
            LIMIT 1;
            """;

        using var reader = command.ExecuteReader();
        return reader.Read()
            ? new DashboardSummary(reader.GetInt32(0), reader.GetInt32(1), reader.GetDouble(2), reader.GetDouble(3))
            : new DashboardSummary(0, 0, 0, 0);
    }

    private static IReadOnlyList<PlantCoverageRow> GetNeeds(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
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
            FROM PlantFirstNeed
            ORDER BY
                CASE MaterialStatus
                    WHEN 'Critical' THEN 0
                    WHEN 'Watch' THEN 1
                    ELSE 2
                END,
                FirstNeedTime,
                LowestDiff;
            """;

        return ReadCoverageRows(command);
    }

    private static IReadOnlyList<PlantListRow> GetAllPlants(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT PlantId, PlantName, Region
            FROM Plants
            ORDER BY PlantId;
            """;

        var rows = new List<PlantListRow>();
        using var reader = command.ExecuteReader();

        while (reader.Read())
        {
            rows.Add(new PlantListRow(
                reader.GetInt32(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2)));
        }

        return rows;
    }

    private static IReadOnlyList<PlantCoverageRow> GetPlantCoverage(SqliteConnection connection, int plantId)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
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
            WHERE PlantId = $plantId
            ORDER BY
                CASE MaterialStatus
                    WHEN 'Critical' THEN 0
                    WHEN 'Watch' THEN 1
                    ELSE 2
                END,
                MaterialDescription;
            """;
        command.Parameters.AddWithValue("$plantId", plantId);

        return ReadCoverageRows(command);
    }

    private static IReadOnlyList<PlantCoverageRow> ReadCoverageRows(SqliteCommand command)
    {
        var rows = new List<PlantCoverageRow>();

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            rows.Add(new PlantCoverageRow(
                reader.GetInt32(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetDouble(3),
                reader.GetDouble(4),
                reader.GetDouble(5),
                reader.GetDouble(6),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.GetString(8)));
        }

        return rows;
    }

    private static IReadOnlyList<SourceAllocationRow> GetSourceAllocations(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT SourceName, MaterialDescription, AllocatedLoads, UsedLoads, RemainingLoads
            FROM SourceAllocationSummary
            ORDER BY MaterialDescription, RemainingLoads, SourceName;
            """;

        var rows = new List<SourceAllocationRow>();
        using var reader = command.ExecuteReader();

        while (reader.Read())
        {
            rows.Add(new SourceAllocationRow(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetDouble(2),
                reader.GetDouble(3),
                reader.GetDouble(4)));
        }

        return rows;
    }

    private static IReadOnlyList<DriverStatusRow> GetDriverStatuses(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Status, DriverCount FROM DriverAvailabilitySummary;";

        var rows = new List<DriverStatusRow>();
        using var reader = command.ExecuteReader();

        while (reader.Read())
        {
            rows.Add(new DriverStatusRow(reader.GetString(0), reader.GetInt32(1)));
        }

        return rows;
    }

    private static IReadOnlyList<DriverRow> GetDrivers(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                d.TruckNumber,
                d.DriverName,
                d.Status,
                d.CurrentLocation,
                d.AssignedSource,
                d.AssignedPlantId,
                p.PlantName,
                d.MaterialDescription,
                d.LoadTime,
                d.ETA,
                d.AvailableNow
            FROM TransportDrivers d
            LEFT JOIN Plants p ON p.PlantId = d.AssignedPlantId
            ORDER BY
                CASE d.Status
                    WHEN 'Available' THEN 0
                    WHEN 'Assigned' THEN 1
                    WHEN 'Loading' THEN 2
                    WHEN 'On Road' THEN 3
                    ELSE 4
                END,
                d.TruckNumber;
            """;

        var rows = new List<DriverRow>();
        using var reader = command.ExecuteReader();

        while (reader.Read())
        {
            rows.Add(new DriverRow(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetInt32(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.IsDBNull(8) ? null : reader.GetString(8),
                reader.IsDBNull(9) ? null : reader.GetString(9),
                reader.GetInt32(10) == 1));
        }

        return rows;
    }

    private static PlantDetail GetPlantDetail(SqliteConnection connection, int plantId)
    {
        var coverage = GetPlantCoverage(connection, plantId);
        var plantName = coverage.FirstOrDefault()?.PlantName ?? GetPlantName(connection, plantId);
        var orders = GetOrders(connection, plantId);

        return new PlantDetail(plantId, plantName, coverage, orders);
    }

    private static string GetPlantName(SqliteConnection connection, int plantId)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT PlantName FROM Plants WHERE PlantId = $plantId;";
        command.Parameters.AddWithValue("$plantId", plantId);

        return command.ExecuteScalar() as string ?? $"Plant {plantId}";
    }

    private static IReadOnlyList<PlantOrderRow> GetOrders(SqliteConnection connection, int plantId)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                OrderNumber,
                CustomerName,
                City,
                MixCode,
                MixDescription,
                OrderedQuantity,
                StartTime,
                ReadyMixTruckCount,
                Status
            FROM ShippedOrders
            WHERE PlantId = $plantId
            ORDER BY StartTime, OrderedQuantity DESC, OrderNumber;
            """;
        command.Parameters.AddWithValue("$plantId", plantId);

        var rows = new List<PlantOrderRow>();
        using var reader = command.ExecuteReader();

        while (reader.Read())
        {
            rows.Add(new PlantOrderRow(
                reader.GetString(0),
                reader.IsDBNull(1) ? null : reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetDouble(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetInt32(7),
                reader.IsDBNull(8) ? null : reader.GetString(8)));
        }

        return rows;
    }
}

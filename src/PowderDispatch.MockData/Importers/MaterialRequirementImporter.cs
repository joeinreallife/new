using Microsoft.Data.Sqlite;
using PowderDispatch.MockData.Models;

namespace PowderDispatch.MockData.Importers;

internal static class MaterialRequirementImporter
{
    public static int Import(SqliteConnection connection, string csvPath, long snapshotId)
    {
        var count = 0;

        foreach (var row in ImportHelpers.ReadCsv(csvPath))
        {
            var requirement = new MaterialRequirement
            {
                SnapshotId = snapshotId,
                PlantNumber = ImportHelpers.RequiredInt(row, "PlantNumber"),
                PlantName = ImportHelpers.Required(row, "PlantName"),
                MaterialCode = ImportHelpers.Optional(row, "MaterialCode"),
                MaterialDescription = ImportHelpers.NormalizeMaterialDescription(ImportHelpers.Required(row, "MaterialDescription")),
                Yards = ImportHelpers.OptionalDouble(row, "Yards"),
                Quantity = ImportHelpers.OptionalDouble(row, "Quantity"),
                UnitOfMeasure = ImportHelpers.Optional(row, "UnitOfMeasure"),
                Total = ImportHelpers.OptionalDouble(row, "Total"),
                Loads = ImportHelpers.OptionalDouble(row, "Loads"),
                OnHand = ImportHelpers.OptionalDouble(row, "OnHand"),
                RequirementTime = ImportHelpers.Optional(row, "RequirementTime"),
                Diff = ImportHelpers.OptionalDouble(row, "Diff"),
                RequiredLoads = ImportHelpers.OptionalDouble(row, "RequiredLoads"),
                BusinessDate = ImportHelpers.Required(row, "BusinessDate")
            };

            var materialGroup = ImportHelpers.ClassifyMaterial(requirement.MaterialDescription);
            ImportHelpers.GetOrCreatePlant(connection, requirement.PlantNumber, requirement.PlantName);
            ImportHelpers.UpsertMaterial(connection, requirement.MaterialCode, requirement.MaterialDescription);

            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO MaterialRequirements (
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
                ) VALUES (
                    $snapshotId,
                    $plantId,
                    $materialCode,
                    $materialDescription,
                    $materialGroup,
                    $yards,
                    $quantity,
                    $unitOfMeasure,
                    $total,
                    $loads,
                    $onHand,
                    $requirementTime,
                    $diff,
                    $requiredLoads,
                    $businessDate
                );
                """;

            command.Parameters.AddWithValue("$snapshotId", requirement.SnapshotId);
            command.Parameters.AddWithValue("$plantId", requirement.PlantNumber);
            ImportHelpers.AddNullable(command, "$materialCode", requirement.MaterialCode);
            command.Parameters.AddWithValue("$materialDescription", requirement.MaterialDescription);
            command.Parameters.AddWithValue("$materialGroup", materialGroup);
            ImportHelpers.AddNullable(command, "$yards", requirement.Yards);
            ImportHelpers.AddNullable(command, "$quantity", requirement.Quantity);
            ImportHelpers.AddNullable(command, "$unitOfMeasure", requirement.UnitOfMeasure);
            ImportHelpers.AddNullable(command, "$total", requirement.Total);
            ImportHelpers.AddNullable(command, "$loads", requirement.Loads);
            ImportHelpers.AddNullable(command, "$onHand", requirement.OnHand);
            ImportHelpers.AddNullable(command, "$requirementTime", requirement.RequirementTime);
            ImportHelpers.AddNullable(command, "$diff", requirement.Diff);
            ImportHelpers.AddNullable(command, "$requiredLoads", requirement.RequiredLoads);
            command.Parameters.AddWithValue("$businessDate", requirement.BusinessDate);
            command.ExecuteNonQuery();

            count++;
        }

        return count;
    }
}

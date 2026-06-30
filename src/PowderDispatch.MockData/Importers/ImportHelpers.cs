using System.Globalization;
using Microsoft.Data.Sqlite;

namespace PowderDispatch.MockData.Importers;

internal static class ImportHelpers
{
    public static IEnumerable<Dictionary<string, string>> ReadCsv(string path)
    {
        using var reader = new StreamReader(path);
        var headerLine = reader.ReadLine();

        if (string.IsNullOrWhiteSpace(headerLine))
        {
            yield break;
        }

        var headers = ParseCsvLine(headerLine);

        while (!reader.EndOfStream)
        {
            var line = reader.ReadLine();
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var values = ParseCsvLine(line);
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            for (var i = 0; i < headers.Count; i++)
            {
                row[headers[i]] = i < values.Count ? values[i] : string.Empty;
            }

            yield return row;
        }
    }

    public static string Required(Dictionary<string, string> row, string key)
    {
        if (!row.TryGetValue(key, out var value) || string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidDataException($"CSV row is missing required column '{key}'.");
        }

        return value.Trim();
    }

    public static string? Optional(Dictionary<string, string> row, string key)
    {
        return row.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.Trim()
            : null;
    }

    public static int RequiredInt(Dictionary<string, string> row, string key)
    {
        var value = Required(row, key);
        return int.Parse(value, NumberStyles.Integer, CultureInfo.InvariantCulture);
    }

    public static int? OptionalInt(Dictionary<string, string> row, string key)
    {
        var value = Optional(row, key);
        return value is null ? null : int.Parse(value, NumberStyles.Integer, CultureInfo.InvariantCulture);
    }

    public static double? OptionalDouble(Dictionary<string, string> row, string key)
    {
        var value = Optional(row, key);
        if (value is null)
        {
            return null;
        }

        var cleaned = value.Replace(",", string.Empty, StringComparison.Ordinal);
        var isNegative = cleaned.StartsWith('(') && cleaned.EndsWith(')');

        if (isNegative)
        {
            cleaned = cleaned.Trim('(', ')');
        }

        var number = double.Parse(cleaned, NumberStyles.Float, CultureInfo.InvariantCulture);
        return isNegative ? -number : number;
    }

    public static long GetOrCreatePlant(SqliteConnection connection, int plantNumber, string? plantName)
    {
        var normalizedName = string.IsNullOrWhiteSpace(plantName)
            ? $"Plant {plantNumber}"
            : plantName.Trim();

        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO Plants (PlantId, PlantName)
            VALUES ($plantId, $plantName)
            ON CONFLICT(PlantId) DO UPDATE SET
                PlantName = excluded.PlantName
            WHERE excluded.PlantName NOT LIKE 'Plant %';
            """;
        command.Parameters.AddWithValue("$plantId", plantNumber);
        command.Parameters.AddWithValue("$plantName", normalizedName);
        command.ExecuteNonQuery();

        return plantNumber;
    }

    public static void UpsertMaterial(SqliteConnection connection, string? materialCode, string materialDescription)
    {
        var normalizedDescription = NormalizeMaterialDescription(materialDescription);
        var materialGroup = ClassifyMaterial(normalizedDescription);

        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO Materials (MaterialCode, MaterialDescription, MaterialGroup)
            VALUES ($materialCode, $materialDescription, $materialGroup)
            ON CONFLICT(MaterialDescription) DO UPDATE SET
                MaterialCode = COALESCE(Materials.MaterialCode, excluded.MaterialCode),
                MaterialGroup = excluded.MaterialGroup;
            """;
        command.Parameters.AddWithValue("$materialCode", (object?)materialCode ?? DBNull.Value);
        command.Parameters.AddWithValue("$materialDescription", normalizedDescription);
        command.Parameters.AddWithValue("$materialGroup", materialGroup);
        command.ExecuteNonQuery();
    }

    public static string NormalizeMaterialDescription(string materialDescription)
    {
        return materialDescription.Trim().ToUpperInvariant();
    }

    public static string ClassifyMaterial(string materialDescription)
    {
        var normalized = NormalizeMaterialDescription(materialDescription);

        // Business rule: powder dispatch focuses on cement-family materials and flyash.
        if (normalized is "CEMENT" or "PLC CEMENT" or "TYPE V CEMENT" or "FLYASH")
        {
            return "Powder";
        }

        // Business rule: rock/sand is useful context, but it does not drive the powder board.
        if (normalized.Contains("SAND", StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains("AGG", StringComparison.OrdinalIgnoreCase) ||
            normalized is "FINE AGG" or "3/8 AGG" or "1\" AGG" or "1-1/2\" AGG")
        {
            return "RockSand";
        }

        return "Other";
    }

    public static void AddNullable(SqliteCommand command, string name, object? value)
    {
        command.Parameters.AddWithValue(name, value ?? DBNull.Value);
    }

    private static List<string> ParseCsvLine(string line)
    {
        var values = new List<string>();
        var current = new List<char>();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var character = line[i];

            if (character == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Add('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (character == ',' && !inQuotes)
            {
                values.Add(new string(current.ToArray()));
                current.Clear();
            }
            else
            {
                current.Add(character);
            }
        }

        values.Add(new string(current.ToArray()));
        return values;
    }
}

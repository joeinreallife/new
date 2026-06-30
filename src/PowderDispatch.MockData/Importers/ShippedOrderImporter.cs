using Microsoft.Data.Sqlite;
using PowderDispatch.MockData.Models;

namespace PowderDispatch.MockData.Importers;

internal static class ShippedOrderImporter
{
    public static int Import(SqliteConnection connection, string csvPath, long snapshotId)
    {
        var count = 0;

        foreach (var row in ImportHelpers.ReadCsv(csvPath))
        {
            var order = new ShippedOrder
            {
                SnapshotId = snapshotId,
                OrderNumber = ImportHelpers.Required(row, "OrderNumber"),
                CustomerNumber = ImportHelpers.Optional(row, "CustomerNumber"),
                CustomerName = ImportHelpers.Optional(row, "CustomerName"),
                DeliveryAddress = ImportHelpers.Optional(row, "DeliveryAddress"),
                City = ImportHelpers.Optional(row, "City"),
                MixCode = ImportHelpers.Optional(row, "MixCode"),
                MixDescription = ImportHelpers.Optional(row, "MixDescription"),
                PlantNumber = ImportHelpers.RequiredInt(row, "PlantNumber"),
                PlantName = ImportHelpers.Optional(row, "PlantName"),
                ReadyMixTruckCount = ImportHelpers.OptionalInt(row, "ReadyMixTruckCount"),
                Rate = ImportHelpers.OptionalDouble(row, "Rate"),
                StartTime = ImportHelpers.Optional(row, "StartTime"),
                TravelMinutes = ImportHelpers.OptionalInt(row, "TravelMinutes"),
                OrderedQuantity = ImportHelpers.OptionalDouble(row, "OrderedQuantity"),
                DeliveredQuantity = ImportHelpers.OptionalDouble(row, "DeliveredQuantity"),
                LoadSize = ImportHelpers.OptionalDouble(row, "LoadSize"),
                Status = ImportHelpers.Optional(row, "Status"),
                Salesperson = ImportHelpers.Optional(row, "Salesperson"),
                OrderDate = ImportHelpers.Optional(row, "OrderDate")
            };

            ImportHelpers.GetOrCreatePlant(connection, order.PlantNumber, order.PlantName);

            using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO ShippedOrders (
                    SnapshotId,
                    OrderNumber,
                    CustomerNumber,
                    CustomerName,
                    DeliveryAddress,
                    City,
                    MixCode,
                    MixDescription,
                    PlantId,
                    ReadyMixTruckCount,
                    Rate,
                    StartTime,
                    TravelMinutes,
                    OrderedQuantity,
                    DeliveredQuantity,
                    LoadSize,
                    Status,
                    Salesperson,
                    OrderDate
                ) VALUES (
                    $snapshotId,
                    $orderNumber,
                    $customerNumber,
                    $customerName,
                    $deliveryAddress,
                    $city,
                    $mixCode,
                    $mixDescription,
                    $plantId,
                    $readyMixTruckCount,
                    $rate,
                    $startTime,
                    $travelMinutes,
                    $orderedQuantity,
                    $deliveredQuantity,
                    $loadSize,
                    $status,
                    $salesperson,
                    $orderDate
                );
                """;

            command.Parameters.AddWithValue("$snapshotId", order.SnapshotId);
            command.Parameters.AddWithValue("$orderNumber", order.OrderNumber);
            ImportHelpers.AddNullable(command, "$customerNumber", order.CustomerNumber);
            ImportHelpers.AddNullable(command, "$customerName", order.CustomerName);
            ImportHelpers.AddNullable(command, "$deliveryAddress", order.DeliveryAddress);
            ImportHelpers.AddNullable(command, "$city", order.City);
            ImportHelpers.AddNullable(command, "$mixCode", order.MixCode);
            ImportHelpers.AddNullable(command, "$mixDescription", order.MixDescription);
            command.Parameters.AddWithValue("$plantId", order.PlantNumber);
            ImportHelpers.AddNullable(command, "$readyMixTruckCount", order.ReadyMixTruckCount);
            ImportHelpers.AddNullable(command, "$rate", order.Rate);
            ImportHelpers.AddNullable(command, "$startTime", order.StartTime);
            ImportHelpers.AddNullable(command, "$travelMinutes", order.TravelMinutes);
            ImportHelpers.AddNullable(command, "$orderedQuantity", order.OrderedQuantity);
            ImportHelpers.AddNullable(command, "$deliveredQuantity", order.DeliveredQuantity);
            ImportHelpers.AddNullable(command, "$loadSize", order.LoadSize);
            ImportHelpers.AddNullable(command, "$status", order.Status);
            ImportHelpers.AddNullable(command, "$salesperson", order.Salesperson);
            ImportHelpers.AddNullable(command, "$orderDate", order.OrderDate);
            command.ExecuteNonQuery();

            count++;
        }

        return count;
    }
}

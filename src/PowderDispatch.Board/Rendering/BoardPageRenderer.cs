using System.Globalization;
using System.Net;
using System.Text;
using PowderDispatch.Board.Data;

namespace PowderDispatch.Board.Rendering;

internal static class BoardPageRenderer
{
    public static string Render(BoardViewModel board, string databasePath, DateTimeOffset refreshedAt)
    {
        var html = new StringBuilder();

        html.AppendLine("<!doctype html>");
        html.AppendLine("<html lang=\"en\">");
        html.AppendLine("<head>");
        html.AppendLine("<meta charset=\"utf-8\">");
        html.AppendLine("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">");
        html.AppendLine("<title>Powder Dispatch Board</title>");
        html.AppendLine("<link rel=\"icon\" href=\"data:,\">");
        html.AppendLine("<link rel=\"stylesheet\" href=\"/site.css\">");
        html.AppendLine("</head>");
        html.AppendLine("<body>");
        html.AppendLine("<header class=\"topline\">");
        html.AppendLine("<div>");
        html.AppendLine("<div class=\"screen-title\">POWDER DISPATCH BOARD</div>");
        html.AppendLine($"<div class=\"screen-subtitle\">DB: {Encode(databasePath)}</div>");
        html.AppendLine("</div>");
        html.AppendLine($"<a class=\"refresh\" href=\"/?plantId={board.SelectedPlant.PlantId}\">REFRESH</a>");
        html.AppendLine("</header>");

        html.AppendLine("<section class=\"summary-grid\" aria-label=\"Dashboard summary\">");
        SummaryCell(html, "DRIVERS AVAILABLE", FormatNumber(board.Summary.DriversAvailable), "ok");
        SummaryCell(html, "CRITICAL PLANTS", FormatNumber(board.Summary.CriticalPlants), board.Summary.CriticalPlants > 0 ? "critical" : "ok");
        SummaryCell(html, "OPEN CEMENT LOADS", FormatLoads(board.Summary.OpenCementLoadsNeeded), board.Summary.OpenCementLoadsNeeded > 0 ? "critical" : "ok");
        SummaryCell(html, "OPEN FLYASH LOADS", FormatLoads(board.Summary.OpenFlyashLoadsNeeded), board.Summary.OpenFlyashLoadsNeeded > 0 ? "watch" : "ok");
        SummaryCell(html, "LAST REFRESHED", refreshedAt.ToString("HH:mm:ss", CultureInfo.InvariantCulture), string.Empty);
        html.AppendLine("</section>");

        html.AppendLine("<main class=\"cockpit-grid\">");
        RenderNeeds(html, board.Needs, board.SelectedPlant.PlantId);
        RenderSideColumn(html, board);
        RenderPlantDetail(html, board.SelectedPlant);
        html.AppendLine("</main>");

        html.AppendLine("</body>");
        html.AppendLine("</html>");

        return html.ToString();
    }

    public static string RenderMissingDatabase(string databasePath)
    {
        return $"""
            <!doctype html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Powder Dispatch Board</title>
                <link rel="stylesheet" href="/site.css">
            </head>
            <body>
                <main class="missing-db">
                    <h1>POWDER DISPATCH BOARD</h1>
                    <p>SQLite database was not found.</p>
                    <pre>{Encode(databasePath)}</pre>
                    <p>Run the mock-data importer first:</p>
                    <pre>dotnet run --project src\PowderDispatch.MockData\PowderDispatch.MockData.csproj</pre>
                </main>
            </body>
            </html>
            """;
    }

    private static void SummaryCell(StringBuilder html, string label, string value, string statusClass)
    {
        html.AppendLine($"<div class=\"summary-cell {statusClass}\">");
        html.AppendLine($"<div class=\"summary-label\">{Encode(label)}</div>");
        html.AppendLine($"<div class=\"summary-value\">{Encode(value)}</div>");
        html.AppendLine("</div>");
    }

    private static void RenderNeeds(StringBuilder html, IReadOnlyList<PlantCoverageRow> needs, int selectedPlantId)
    {
        html.AppendLine("<section class=\"panel needs-panel\">");
        html.AppendLine("<div class=\"panel-header\"><span>NEEDS FIRST</span><span>SELECT PLANT</span></div>");
        html.AppendLine("<div class=\"table-wrap\">");
        html.AppendLine("<table>");
        html.AppendLine("<thead><tr><th>Plant</th><th>Material</th><th>On Hand</th><th>Net</th><th>First Need</th><th>Status</th></tr></thead>");
        html.AppendLine("<tbody>");

        foreach (var row in needs)
        {
            var selected = row.PlantId == selectedPlantId ? " selected" : string.Empty;
            html.AppendLine($"<tr class=\"status-{StatusClass(row.MaterialStatus)}{selected}\">");
            html.AppendLine($"<td><a href=\"/?plantId={row.PlantId}\">{row.PlantId} {Encode(ToTitle(row.PlantName))}</a></td>");
            html.AppendLine($"<td>{Encode(ToTitle(row.MaterialDescription))}</td>");
            html.AppendLine($"<td class=\"num\">{FormatLoads(row.OnHandLoads)}</td>");
            html.AppendLine($"<td class=\"num\">{FormatSignedLoads(row.LowestDiff)}</td>");
            html.AppendLine($"<td>{Encode(row.FirstNeedTime ?? "--")}</td>");
            html.AppendLine($"<td class=\"status-text\">{Encode(row.MaterialStatus)}</td>");
            html.AppendLine("</tr>");
        }

        html.AppendLine("</tbody>");
        html.AppendLine("</table>");
        html.AppendLine("</div>");
        html.AppendLine("</section>");
    }

    private static void RenderSideColumn(StringBuilder html, BoardViewModel board)
    {
        html.AppendLine("<aside class=\"side-stack\">");
        RenderSourceAllocations(html, board.SourceAllocations);
        RenderDriverStatus(html, board.DriverStatuses, board.Drivers);
        html.AppendLine("</aside>");
    }

    private static void RenderSourceAllocations(StringBuilder html, IReadOnlyList<SourceAllocationRow> rows)
    {
        html.AppendLine("<section class=\"panel\">");
        html.AppendLine("<div class=\"panel-header\"><span>SOURCE ALLOCATIONS</span><span>LOADS</span></div>");
        html.AppendLine("<table>");
        html.AppendLine("<thead><tr><th>Source</th><th>Material</th><th>Alloc</th><th>Used</th><th>Remain</th></tr></thead>");
        html.AppendLine("<tbody>");

        foreach (var row in rows)
        {
            html.AppendLine("<tr>");
            html.AppendLine($"<td>{Encode(row.SourceName)}</td>");
            html.AppendLine($"<td>{Encode(ToTitle(row.MaterialDescription))}</td>");
            html.AppendLine($"<td class=\"num\">{FormatLoads(row.AllocatedLoads)}</td>");
            html.AppendLine($"<td class=\"num\">{FormatLoads(row.UsedLoads)}</td>");
            html.AppendLine($"<td class=\"num\">{FormatLoads(row.RemainingLoads)}</td>");
            html.AppendLine("</tr>");
        }

        html.AppendLine("</tbody>");
        html.AppendLine("</table>");
        html.AppendLine("</section>");
    }

    private static void RenderDriverStatus(
        StringBuilder html,
        IReadOnlyList<DriverStatusRow> statuses,
        IReadOnlyList<DriverRow> drivers)
    {
        html.AppendLine("<section class=\"panel drivers-panel\">");
        html.AppendLine("<div class=\"panel-header\"><span>DRIVER STATUS</span><span>COUNT / LIST</span></div>");
        html.AppendLine("<div class=\"status-counts\">");

        foreach (var status in statuses)
        {
            html.AppendLine($"<div><span>{Encode(status.Status)}</span><strong>{status.DriverCount}</strong></div>");
        }

        html.AppendLine("</div>");
        html.AppendLine("<div class=\"driver-list\">");

        foreach (var driver in drivers)
        {
            var destination = driver.AssignedPlantName is null
                ? driver.CurrentLocation
                : $"{ToTitle(driver.AssignedPlantName)} / {driver.MaterialDescription}";

            html.AppendLine($"<div class=\"driver-row status-{StatusClass(driver.Status)}\">");
            html.AppendLine($"<span>{Encode(driver.TruckNumber)}</span>");
            html.AppendLine($"<span>{Encode(driver.DriverName)}</span>");
            html.AppendLine($"<span>{Encode(driver.Status)}</span>");
            html.AppendLine($"<span>{Encode(destination ?? "--")}</span>");
            html.AppendLine($"<span>{Encode(driver.Eta ?? driver.LoadTime ?? "--")}</span>");
            html.AppendLine("</div>");
        }

        html.AppendLine("</div>");
        html.AppendLine("</section>");
    }

    private static void RenderPlantDetail(StringBuilder html, PlantDetail plant)
    {
        html.AppendLine("<section class=\"panel detail-panel\">");
        html.AppendLine($"<div class=\"panel-header\"><span>SELECTED PLANT: {plant.PlantId} {Encode(ToTitle(plant.PlantName))}</span><span>DETAIL</span></div>");
        html.AppendLine("<div class=\"detail-grid\">");

        html.AppendLine("<div>");
        html.AppendLine("<div class=\"section-label\">MATERIAL COVERAGE</div>");
        html.AppendLine("<table>");
        html.AppendLine("<thead><tr><th>Material</th><th>On Hand</th><th>Projected</th><th>Req Loads</th><th>Net</th><th>First Need</th><th>Status</th></tr></thead>");
        html.AppendLine("<tbody>");

        foreach (var row in plant.Coverage)
        {
            html.AppendLine($"<tr class=\"status-{StatusClass(row.MaterialStatus)}\">");
            html.AppendLine($"<td>{Encode(ToTitle(row.MaterialDescription))}</td>");
            html.AppendLine($"<td class=\"num\">{FormatLoads(row.OnHandLoads)}</td>");
            html.AppendLine($"<td class=\"num\">{FormatLoads(row.ProjectedNeedLoads)}</td>");
            html.AppendLine($"<td class=\"num\">{FormatLoads(row.RequiredLoads)}</td>");
            html.AppendLine($"<td class=\"num\">{FormatSignedLoads(row.LowestDiff)}</td>");
            html.AppendLine($"<td>{Encode(row.FirstNeedTime ?? "--")}</td>");
            html.AppendLine($"<td class=\"status-text\">{Encode(row.MaterialStatus)}</td>");
            html.AppendLine("</tr>");
        }

        if (plant.Coverage.Count == 0)
        {
            html.AppendLine("<tr><td colspan=\"7\">No material coverage rows for selected plant.</td></tr>");
        }

        html.AppendLine("</tbody>");
        html.AppendLine("</table>");
        html.AppendLine("</div>");

        html.AppendLine("<div>");
        html.AppendLine("<div class=\"section-label\">RELATED SHIPPED ORDERS</div>");
        html.AppendLine("<table>");
        html.AppendLine("<thead><tr><th>Order</th><th>Customer</th><th>Mix</th><th>Description</th><th>Qty</th><th>Start</th><th>Trk</th></tr></thead>");
        html.AppendLine("<tbody>");

        foreach (var order in plant.ShippedOrders)
        {
            html.AppendLine("<tr>");
            html.AppendLine($"<td>{Encode(order.OrderNumber)}</td>");
            html.AppendLine($"<td>{Encode(order.CustomerName ?? "--")}</td>");
            html.AppendLine($"<td>{Encode(order.MixCode ?? "--")}</td>");
            html.AppendLine($"<td>{Encode(order.MixDescription ?? "--")}</td>");
            html.AppendLine($"<td class=\"num\">{FormatNullableLoads(order.OrderedQuantity)}</td>");
            html.AppendLine($"<td>{Encode(order.StartTime ?? "--")}</td>");
            html.AppendLine($"<td class=\"num\">{(order.ReadyMixTruckCount?.ToString(CultureInfo.InvariantCulture) ?? "--")}</td>");
            html.AppendLine("</tr>");
        }

        if (plant.ShippedOrders.Count == 0)
        {
            html.AppendLine("<tr><td colspan=\"7\">No shipped orders in the seed data for selected plant.</td></tr>");
        }

        html.AppendLine("</tbody>");
        html.AppendLine("</table>");
        html.AppendLine("</div>");
        html.AppendLine("</div>");
        html.AppendLine("</section>");
    }

    private static string StatusClass(string status)
    {
        return status.Replace(" ", "-", StringComparison.OrdinalIgnoreCase).ToLowerInvariant();
    }

    private static string Encode(string value)
    {
        return WebUtility.HtmlEncode(value);
    }

    private static string FormatNumber(int value)
    {
        return value.ToString("0", CultureInfo.InvariantCulture);
    }

    private static string FormatNullableLoads(double? value)
    {
        return value is null ? "--" : FormatLoads(value.Value);
    }

    private static string FormatLoads(double value)
    {
        return Math.Abs(value - Math.Round(value)) < 0.001
            ? Math.Round(value).ToString("0", CultureInfo.InvariantCulture)
            : value.ToString("0.##", CultureInfo.InvariantCulture);
    }

    private static string FormatSignedLoads(double value)
    {
        return value > 0
            ? FormatLoads(value)
            : value.ToString("0.##", CultureInfo.InvariantCulture);
    }

    private static string ToTitle(string value)
    {
        if (value.Equals("PLC CEMENT", StringComparison.OrdinalIgnoreCase))
        {
            return "PLC Cement";
        }

        return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(value.ToLowerInvariant());
    }
}

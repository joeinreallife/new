using PowderDispatch.Board.Data;
using PowderDispatch.Board.Rendering;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web)
{
    WriteIndented = false
};

app.UseStaticFiles();

if (args.Contains("--json", StringComparer.OrdinalIgnoreCase))
{
    var plantId = ParsePlantId(args);
    Console.WriteLine(JsonSerializer.Serialize(CreatePayload(plantId), jsonOptions));
    return;
}

app.MapGet("/api/board", (HttpRequest request) =>
{
    var selectedPlantId = int.TryParse(request.Query["plantId"], out var plantId)
        ? plantId
        : (int?)null;

    return Results.Json(CreatePayload(selectedPlantId), jsonOptions);
});

app.MapGet("/", (HttpRequest request) =>
{
    var databasePath = DatabasePathResolver.Resolve();

    if (!File.Exists(databasePath))
    {
        var missingHtml = BoardPageRenderer.RenderMissingDatabase(databasePath);
        return Results.Content(missingHtml, "text/html");
    }

    var selectedPlantId = int.TryParse(request.Query["plantId"], out var plantId)
        ? plantId
        : (int?)null;

    var repository = new DispatchRepository(databasePath);
    var board = repository.GetBoard(selectedPlantId);
    var html = BoardPageRenderer.Render(board, databasePath, DateTimeOffset.Now);

    return Results.Content(html, "text/html");
});

app.Run();

static object CreatePayload(int? selectedPlantId)
{
    var databasePath = DatabasePathResolver.Resolve();

    if (!File.Exists(databasePath))
    {
        return new
        {
            ok = false,
            databasePath,
            generatedAt = DateTimeOffset.Now,
            error = "SQLite database was not found."
        };
    }

    var repository = new DispatchRepository(databasePath);
    return new
    {
        ok = true,
        databasePath,
        generatedAt = DateTimeOffset.Now,
        board = repository.GetBoard(selectedPlantId)
    };
}

static int? ParsePlantId(string[] args)
{
    for (var index = 0; index < args.Length - 1; index++)
    {
        if (args[index].Equals("--plantId", StringComparison.OrdinalIgnoreCase) &&
            int.TryParse(args[index + 1], out var plantId))
        {
            return plantId;
        }
    }

    return null;
}

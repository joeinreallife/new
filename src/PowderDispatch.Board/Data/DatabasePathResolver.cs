namespace PowderDispatch.Board.Data;

internal static class DatabasePathResolver
{
    public static string Resolve()
    {
        var overridePath = Environment.GetEnvironmentVariable("POWDER_DISPATCH_DB");
        if (!string.IsNullOrWhiteSpace(overridePath))
        {
            return Path.GetFullPath(overridePath);
        }

        var directory = new DirectoryInfo(Directory.GetCurrentDirectory());

        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, "data", "powder_dispatch_mock.db");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        return Path.Combine(
            Directory.GetCurrentDirectory(),
            "data",
            "powder_dispatch_mock.db");
    }
}

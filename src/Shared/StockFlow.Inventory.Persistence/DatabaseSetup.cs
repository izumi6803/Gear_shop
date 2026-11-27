using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace StockFlow.Inventory.Persistence;

/// <summary>
/// Cấu hình DbContext theo provider. Mặc định SQL Server (production/docker),
/// đặt <c>Database:Provider=Sqlite</c> để chạy local/demo không cần cài SQL Server.
/// </summary>
public static class DatabaseSetup
{
    public const string SqliteProvider = "Sqlite";
    public const string SqlServerProvider = "SqlServer";

    public static IServiceCollection AddInventoryDatabase<TContext>(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionName)
        where TContext : DbContext
    {
        var provider = configuration["Database:Provider"] ?? SqlServerProvider;
        var connectionString = configuration.GetConnectionString(connectionName)
            ?? throw new InvalidOperationException($"Thiếu ConnectionStrings:{connectionName}.");

        services.AddDbContext<TContext>(options =>
        {
            if (provider.Equals(SqliteProvider, StringComparison.OrdinalIgnoreCase))
            {
                options.UseSqlite(connectionString);
                return;
            }

            options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure(3));
        });

        return services;
    }

    public static bool IsSqlite(this IConfiguration configuration) =>
        (configuration["Database:Provider"] ?? SqlServerProvider)
            .Equals(SqliteProvider, StringComparison.OrdinalIgnoreCase);
}

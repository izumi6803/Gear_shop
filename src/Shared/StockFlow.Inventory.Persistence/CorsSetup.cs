using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace StockFlow.Inventory.Persistence;

/// <summary>CORS: cho phép SPA (Vite dev server / nginx) gọi API từ origin khác.</summary>
public static class CorsSetup
{
    public const string PolicyName = "spa";

    public static IServiceCollection AddSpaCors(this IServiceCollection services, IConfiguration configuration)
    {
        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                      ?? ["http://localhost:5173", "http://localhost:4173"];

        services.AddCors(options => options.AddPolicy(PolicyName, policy => policy
            .WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod()));

        return services;
    }
}

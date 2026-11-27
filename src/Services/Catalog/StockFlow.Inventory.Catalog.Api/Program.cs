using StockFlow.Inventory.BuildingBlocks.Http;
using StockFlow.Inventory.BuildingBlocks.Security;
using StockFlow.Inventory.Catalog.Api.Data;
using StockFlow.Inventory.Catalog.Api.Endpoints;
using StockFlow.Inventory.Catalog.Api.Services;
using StockFlow.Inventory.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 12-factor: log ra stdout (container/CI không có quyền ghi Windows Event Log).
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(options => options.TimestampFormat = "HH:mm:ss ");

builder.Services.AddInventoryJwtAuthentication(builder.Configuration);
builder.Services.AddInventoryDatabase<CatalogDbContext>(builder.Configuration, "CatalogDb");
builder.Services.AddSpaCors(builder.Configuration);

builder.Services.AddScoped<StockService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DomainExceptionHandler>();

var app = builder.Build();

if (app.Configuration.GetValue("Database:AutoCreate", false))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
    await db.Database.EnsureCreatedAsync();
    await CatalogSeeder.SeedAsync(db);
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseExceptionHandler();
app.UseCors(CorsSetup.PolicyName);
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", async (CatalogDbContext db, CancellationToken ct) =>
{
    var canConnect = await db.Database.CanConnectAsync(ct);
    return canConnect
        ? Results.Ok(new
        {
            status = "healthy",
            service = "catalog-api",
            provider = db.Database.ProviderName,
            utc = DateTime.UtcNow
        })
        : Results.Problem("Không kết nối được database.", statusCode: StatusCodes.Status503ServiceUnavailable);
})
.WithTags("Health");

app.MapProductEndpoints();
app.MapStockEndpoints();
app.MapInternalEndpoints();

app.Run();

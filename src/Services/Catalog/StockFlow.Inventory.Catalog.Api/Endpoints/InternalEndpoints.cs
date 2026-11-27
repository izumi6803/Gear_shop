using StockFlow.Inventory.BuildingBlocks.Security;
using StockFlow.Inventory.Catalog.Api.Data;
using StockFlow.Inventory.Catalog.Api.Services;
using StockFlow.Inventory.Contracts.Catalog;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Catalog.Api.Endpoints;

/// <summary>
/// API nội bộ cho Ordering service. Không expose qua Ingress; bảo vệ bằng X-Internal-Key.
/// </summary>
public static class InternalEndpoints
{
    public static IEndpointRouteBuilder MapInternalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app
            .MapGroup("/internal")
            .AddEndpointFilter<InternalApiKeyFilter>()
            .WithTags("Internal")
            .ExcludeFromDescription();

        group.MapPost("/products/lookup", async (
            ProductLookupRequest request,
            CatalogDbContext db,
            CancellationToken ct) =>
        {
            var ids = request.Ids.Distinct().ToArray();
            var founded = await db.Products
                .AsNoTracking()
                .Where(p => ids.Contains(p.Id))
                .Select(p => new ProductLookupItem(p.Id, p.Code, p.Name, p.UnitPrice, p.IsActive))
                .ToListAsync(ct);

            var missing = ids.Except(founded.Select(p => p.Id)).ToList();
            return Results.Ok(new ProductLookupResponse(founded, missing));
        })
        .WithName("InternalLookupProducts")
        .Produces<ProductLookupResponse>();

        group.MapPost("/stocks/reserve", async (
            StockReserveRequest request,
            StockService stockService,
            CancellationToken ct) =>
        {
            var result = await stockService.ReserveAsync(request, ct);
            return result.Success ? Results.Ok(result) : Results.Conflict(result);
        })
        .WithName("InternalReserveStock")
        .Produces<StockReserveResult>();

        group.MapPost("/stocks/release", async (
            StockReserveRequest request,
            StockService stockService,
            CancellationToken ct) =>
        {
            await stockService.ReleaseAsync(request, ct);
            return Results.NoContent();
        })
        .WithName("InternalReleaseStock");

        group.MapPost("/stocks/issue", async (
            StockReserveRequest request,
            StockService stockService,
            CancellationToken ct) =>
        {
            await stockService.IssueAsync(request, ct);
            return Results.NoContent();
        })
        .WithName("InternalIssueStock");

        return app;
    }
}

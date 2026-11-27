using StockFlow.Inventory.Catalog.Api.Data;
using StockFlow.Inventory.Catalog.Api.Services;
using StockFlow.Inventory.Contracts;
using StockFlow.Inventory.Contracts.Catalog;
using StockFlow.Inventory.Contracts.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Catalog.Api.Endpoints;

public static class StockEndpoints
{
    public static IEndpointRouteBuilder MapStockEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/stocks").WithTags("Stocks");

        group.MapGet("", async (
            CatalogDbContext db,
            int? warehouseId,
            string? keyword,
            bool onlyAvailable = false,
            int page = 1,
            int pageSize = 50,
            CancellationToken ct = default) =>
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);

            var query = db.Stocks
                .AsNoTracking()
                .Include(s => s.Product)
                .Include(s => s.Warehouse)
                .AsQueryable();

            if (warehouseId is > 0)
            {
                query = query.Where(s => s.WarehouseId == warehouseId);
            }

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var k = keyword.Trim();
                query = query.Where(s => s.Product.Code.Contains(k) || s.Product.Name.Contains(k));
            }

            if (onlyAvailable)
            {
                query = query.Where(s => s.QuantityOnHand - s.QuantityReserved > 0);
            }

            var total = await query.CountAsync(ct);
            var entities = await query
                .OrderBy(s => s.Product.Code)
                .ThenBy(s => s.Warehouse.Code)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(ct);

            return Results.Ok(new PagedResult<StockDto>(
                entities.Select(Mapping.ToStockDto).ToList(),
                page,
                pageSize,
                total));
        })
        .WithName("GetStocks")
        .Produces<PagedResult<StockDto>>();

        group.MapPost("/adjust", async (StockAdjustRequest request, StockService stockService, CancellationToken ct) =>
        {
            var result = await stockService.AdjustAsync(request, ct);
            return result is null
                ? Results.NotFound(new ApiError("STOCK_NOT_FOUND", "Không tìm thấy dòng tồn kho tương ứng."))
                : Results.Ok(result);
        })
        .RequireAuthorization(new AuthorizeAttribute { Roles = Roles.AdminOrSales })
        .WithName("AdjustStock")
        .Produces<StockDto>()
        .Produces<ApiError>(StatusCodes.Status409Conflict);

        group.MapGet("/movements", async (
            CatalogDbContext db,
            int? productId,
            string? referenceNo,
            int take = 100,
            CancellationToken ct = default) =>
        {
            take = Math.Clamp(take, 1, 500);

            var query = db.StockMovements.AsNoTracking();
            if (productId is > 0)
            {
                query = query.Where(m => m.ProductId == productId);
            }

            if (!string.IsNullOrWhiteSpace(referenceNo))
            {
                var reference = referenceNo.Trim();
                query = query.Where(m => m.ReferenceNo == reference);
            }

            var items = await query
                .OrderByDescending(m => m.OccurredAt)
                .ThenByDescending(m => m.Id)
                .Take(take)
                .ToListAsync(ct);

            return Results.Ok(items.Select(Mapping.ToMovementDto).ToList());
        })
        .WithName("GetStockMovements")
        .RequireAuthorization()
        .Produces<List<StockMovementDto>>();

        return app;
    }
}

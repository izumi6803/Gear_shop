using StockFlow.Inventory.BuildingBlocks;
using StockFlow.Inventory.Catalog.Api.Data;
using StockFlow.Inventory.Catalog.Api.Domain;
using StockFlow.Inventory.Contracts.Catalog;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Catalog.Api.Services;

/// <summary>
/// Nghiệp vụ tồn kho: giữ / nhả / xuất / điều chỉnh. Mọi thay đổi đều sinh
/// một dòng STOCK_MOVEMENT để đối soát (append-only ledger).
/// </summary>
public sealed class StockService(CatalogDbContext db)
{
    private const int MaxConcurrencyAttempts = 3;

    public async Task<StockReserveResult> ReserveAsync(StockReserveRequest request, CancellationToken ct = default)
    {
        var items = Merge(request.Items);
        if (items.Count == 0)
        {
            return StockReserveResult.Ok();
        }

        // Idempotent: cùng OrderNo gọi lại (retry mạng, double-click) không giữ tồn 2 lần.
        var alreadyReserved = await db.StockMovements
            .AnyAsync(m => m.ReferenceNo == request.ReferenceNo && m.MovementType == MovementType.Reserve, ct);
        if (alreadyReserved)
        {
            return StockReserveResult.Ok();
        }

        for (var attempt = 1; attempt <= MaxConcurrencyAttempts; attempt++)
        {
            var stocks = await LoadStocksAsync(items, ct);
            var shortages = BuildShortages(items, stocks);
            if (shortages.Count > 0)
            {
                return StockReserveResult.Failed(shortages);
            }

            try
            {
                foreach (var item in items)
                {
                    var stock = stocks[(item.ProductId, item.WarehouseId)];
                    stock.Reserve(item.Quantity);
                    db.StockMovements.Add(NewMovement(item, MovementType.Reserve, item.Quantity, request.ReferenceNo));
                }

                await db.SaveChangesAsync(ct);
                return StockReserveResult.Ok();
            }
            catch (InsufficientStockException ex)
            {
                // Thua race với giao dịch khác: trả về đúng dòng thiếu để client báo khách.
                db.ChangeTracker.Clear();
                return StockReserveResult.Failed(
                    [new StockShortage(ex.ProductId, ex.WarehouseId, ex.Requested, ex.Available)]);
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxConcurrencyAttempts)
            {
                // Người khác vừa confirm cùng SKU: bỏ tracking và đọc lại tồn.
                db.ChangeTracker.Clear();
            }
        }

        throw new ConcurrencyConflictException(
            $"Tồn kho của đơn {request.ReferenceNo} vừa bị thay đổi bởi giao dịch khác, vui lòng thử lại.");
    }

    public async Task ReleaseAsync(StockReserveRequest request, CancellationToken ct = default)
    {
        var items = Merge(request.Items);
        var stocks = await LoadStocksAsync(items, ct);

        foreach (var item in items)
        {
            if (!stocks.TryGetValue((item.ProductId, item.WarehouseId), out var stock))
            {
                continue;
            }

            var quantity = Math.Min(item.Quantity, stock.QuantityReserved);
            if (quantity <= 0)
            {
                continue;
            }

            stock.Release(quantity);
            db.StockMovements.Add(NewMovement(item, MovementType.Release, -quantity, request.ReferenceNo));
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task IssueAsync(StockReserveRequest request, CancellationToken ct = default)
    {
        var items = Merge(request.Items);

        var alreadyIssued = await db.StockMovements
            .AnyAsync(m => m.ReferenceNo == request.ReferenceNo && m.MovementType == MovementType.Issue, ct);
        if (alreadyIssued)
        {
            return;
        }

        var stocks = await LoadStocksAsync(items, ct);

        foreach (var item in items)
        {
            if (!stocks.TryGetValue((item.ProductId, item.WarehouseId), out var stock))
            {
                continue;
            }

            var quantity = Math.Min(item.Quantity, stock.QuantityOnHand);
            if (quantity <= 0)
            {
                continue;
            }

            stock.Issue(quantity);
            db.StockMovements.Add(NewMovement(item, MovementType.Issue, -quantity, request.ReferenceNo));
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task<StockDto?> AdjustAsync(StockAdjustRequest request, CancellationToken ct = default)
    {
        var stock = await db.Stocks
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .FirstOrDefaultAsync(s => s.ProductId == request.ProductId && s.WarehouseId == request.WarehouseId, ct);

        if (stock is null)
        {
            return null;
        }

        stock.Adjust(request.QuantityDelta);

        db.StockMovements.Add(new StockMovement
        {
            ProductId = request.ProductId,
            WarehouseId = request.WarehouseId,
            MovementType = MovementType.Adjustment,
            Quantity = request.QuantityDelta,
            ReferenceType = "Manual",
            Note = request.Reason,
            CreatedBy = request.CreatedBy ?? "system"
        });

        await db.SaveChangesAsync(ct);
        return Mapping.ToStockDto(stock);
    }

    private async Task<Dictionary<(int ProductId, int WarehouseId), Stock>> LoadStocksAsync(
        IReadOnlyList<StockItem> items,
        CancellationToken ct)
    {
        var productIds = items.Select(i => i.ProductId).Distinct().ToArray();
        var warehouseIds = items.Select(i => i.WarehouseId).Distinct().ToArray();

        var stocks = await db.Stocks
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .Where(s => productIds.Contains(s.ProductId) && warehouseIds.Contains(s.WarehouseId))
            .ToListAsync(ct);

        return stocks.ToDictionary(s => (s.ProductId, s.WarehouseId));
    }

    private static List<StockShortage> BuildShortages(
        IReadOnlyList<StockItem> items,
        Dictionary<(int ProductId, int WarehouseId), Stock> stocks)
    {
        var shortages = new List<StockShortage>();

        foreach (var item in items)
        {
            if (!stocks.TryGetValue((item.ProductId, item.WarehouseId), out var stock))
            {
                shortages.Add(new StockShortage(item.ProductId, item.WarehouseId, item.Quantity, 0));
                continue;
            }

            if (stock.Available < item.Quantity)
            {
                shortages.Add(new StockShortage(item.ProductId, item.WarehouseId, item.Quantity, stock.Available));
            }
        }

        return shortages;
    }

    /// <summary>Gộp các dòng trùng (product, warehouse) và bỏ dòng số lượng &lt;= 0.</summary>
    private static List<StockItem> Merge(IReadOnlyList<StockItem> items) =>
        items
            .Where(i => i.Quantity > 0)
            .GroupBy(i => (i.ProductId, i.WarehouseId))
            .Select(g => new StockItem(g.Key.ProductId, g.Key.WarehouseId, g.Sum(x => x.Quantity)))
            .ToList();

    private static StockMovement NewMovement(StockItem item, MovementType type, int quantity, string referenceNo) =>
        new()
        {
            ProductId = item.ProductId,
            WarehouseId = item.WarehouseId,
            MovementType = type,
            Quantity = quantity,
            ReferenceType = "Order",
            ReferenceNo = referenceNo,
            CreatedBy = "ordering-api"
        };
}

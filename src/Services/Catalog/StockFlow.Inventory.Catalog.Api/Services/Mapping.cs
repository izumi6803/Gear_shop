using StockFlow.Inventory.Catalog.Api.Domain;
using StockFlow.Inventory.Contracts.Catalog;

namespace StockFlow.Inventory.Catalog.Api.Services;

/// <summary>Map entity → DTO. Giữ thủ công (không AutoMapper) cho rõ ràng, dễ debug.</summary>
public static class Mapping
{
    public static ProductDto ToProductDto(Product p) => new(
        p.Id,
        p.Code,
        p.Name,
        p.Category,
        p.Unit,
        p.UnitPrice,
        p.IsActive,
        p.ImageUrl);

    public static StockDto ToStockDto(Stock s) => new(
        s.ProductId,
        s.Product?.Code ?? string.Empty,
        s.Product?.Name ?? string.Empty,
        s.WarehouseId,
        s.Warehouse?.Code ?? string.Empty,
        s.Warehouse?.Name ?? string.Empty,
        s.QuantityOnHand,
        s.QuantityReserved);

    public static WarehouseDto ToWarehouseDto(Warehouse w) => new(w.Id, w.Code, w.Name, w.Location, w.IsActive);

    public static StockMovementDto ToMovementDto(StockMovement m) => new(
        m.Id,
        m.ProductId,
        m.WarehouseId,
        m.MovementType.ToString(),
        m.Quantity,
        m.ReferenceType,
        m.ReferenceNo,
        m.OccurredAt,
        m.Note);
}

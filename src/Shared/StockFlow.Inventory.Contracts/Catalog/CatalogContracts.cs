namespace StockFlow.Inventory.Contracts.Catalog;

/// <summary>Hàng hoá trả về cho Web / Desktop / Ordering.</summary>
public sealed record ProductDto(
    int Id,
    string Code,
    string Name,
    string Category,
    string Unit,
    decimal UnitPrice,
    bool IsActive,
    string? ImageUrl = null);

public sealed record ProductUpsertRequest(
    string Code,
    string Name,
    string Category,
    string Unit,
    decimal UnitPrice,
    bool IsActive = true,
    string? ImageUrl = null);

/// <summary>Tồn kho theo (sản phẩm, kho). Available = OnHand - Reserved.</summary>
public sealed record StockDto(
    int ProductId,
    string ProductCode,
    string ProductName,
    int WarehouseId,
    string WarehouseCode,
    string WarehouseName,
    int QuantityOnHand,
    int QuantityReserved)
{
    public int Available => QuantityOnHand - QuantityReserved;
}

public sealed record WarehouseDto(int Id, string Code, string Name, string Location, bool IsActive);

/// <summary>Điều chỉnh tồn kho thủ công (kiểm kê). QuantityDelta có thể âm.</summary>
public sealed record StockAdjustRequest(
    int ProductId,
    int WarehouseId,
    int QuantityDelta,
    string Reason,
    string? CreatedBy = null);

public sealed record StockMovementDto(
    long Id,
    int ProductId,
    int WarehouseId,
    string MovementType,
    int Quantity,
    string? ReferenceType,
    string? ReferenceNo,
    DateTime OccurredAt,
    string? Note);

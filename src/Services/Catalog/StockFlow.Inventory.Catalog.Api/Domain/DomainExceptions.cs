using StockFlow.Inventory.BuildingBlocks;

namespace StockFlow.Inventory.Catalog.Api.Domain;

/// <summary>Không đủ tồn khả dụng để giữ cho đơn hàng.</summary>
public sealed class InsufficientStockException : DomainException
{
    public InsufficientStockException(int productId, int warehouseId, int requested, int available)
        : base(
            "STOCK_INSUFFICIENT",
            $"Không đủ tồn kho: sản phẩm {productId} / kho {warehouseId} cần {requested}, còn {available}.")
    {
        ProductId = productId;
        WarehouseId = warehouseId;
        Requested = requested;
        Available = available;
    }

    public int ProductId { get; }

    public int WarehouseId { get; }

    public int Requested { get; }

    public int Available { get; }
}

/// <summary>Thao tác không hợp lệ trên tồn kho (ví dụ nhả nhiều hơn số đang giữ).</summary>
public sealed class InvalidStockOperationException : DomainException
{
    public InvalidStockOperationException(string message)
        : base("STOCK_OPERATION_INVALID", message)
    {
    }
}

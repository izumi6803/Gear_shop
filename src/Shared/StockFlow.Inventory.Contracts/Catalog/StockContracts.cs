namespace StockFlow.Inventory.Contracts.Catalog;

/// <summary>Một dòng cần giữ / xuất / nhả tồn kho.</summary>
public sealed record StockItem(int ProductId, int WarehouseId, int Quantity);

/// <summary>Yêu cầu giữ tồn khi Confirm đơn (referenceNo = OrderNo).</summary>
public sealed record StockReserveRequest(string ReferenceNo, IReadOnlyList<StockItem> Items);

/// <summary>Thiếu tồn cho một dòng.</summary>
public sealed record StockShortage(int ProductId, int WarehouseId, int Requested, int Available);

/// <summary>Kết quả giữ tồn: thành công hoặc danh sách dòng thiếu.</summary>
public sealed record StockReserveResult(bool Success, IReadOnlyList<StockShortage> Shortages)
{
    public static StockReserveResult Ok() => new(true, Array.Empty<StockShortage>());

    public static StockReserveResult Failed(IReadOnlyList<StockShortage> shortages) => new(false, shortages);
}

/// <summary>Tra cứu giá/tên hiện tại của sản phẩm (Ordering gọi khi tạo đơn).</summary>
public sealed record ProductLookupItem(int Id, string Code, string Name, decimal UnitPrice, bool IsActive);

public sealed record ProductLookupRequest(IReadOnlyList<int> Ids);

public sealed record ProductLookupResponse(IReadOnlyList<ProductLookupItem> Items, IReadOnlyList<int> MissingIds);

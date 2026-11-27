namespace StockFlow.Inventory.Ordering.Api.Domain;

/// <summary>order line — một dòng hàng của đơn.</summary>
public class OrderLine
{
    public int Id { get; set; }

    public int OrderId { get; set; }

    /// <summary>Tham chiếu logic sang Catalog (không FK xuyên service).</summary>
    public int ProductId { get; set; }

    /// <summary>Snapshot mã hàng tại thời điểm đặt — master đổi mã không ảnh hưởng đơn cũ.</summary>
    public string ProductCode { get; set; } = string.Empty;

    /// <summary>Snapshot tên hàng tại thời điểm đặt.</summary>
    public string ProductName { get; set; } = string.Empty;

    public int WarehouseId { get; set; }

    /// <summary>Snapshot đơn giá tại thời điểm đặt.</summary>
    public decimal UnitPrice { get; set; }

    public int Quantity { get; private set; }

    public decimal LineAmount { get; private set; }

    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    internal void SetQuantity(int quantity)
    {
        Quantity = quantity;
        LineAmount = UnitPrice * quantity;
    }

    internal void IncreaseQuantity(int quantity) => SetQuantity(Quantity + quantity);

    internal void Recalculate() => LineAmount = UnitPrice * Quantity;
}

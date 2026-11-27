namespace StockFlow.Inventory.Catalog.Api.Domain;

/// <summary>
/// stock — tồn kho theo cặp (sản phẩm, kho).
/// Quy ước: <see cref="QuantityOnHand"/> là số thực tế trong kho,
/// <see cref="QuantityReserved"/> là phần đã giữ cho đơn đã Confirm (chưa xuất).
/// </summary>
public class Stock
{
    public const int MaxQuantity = 10_000_000;

    public int Id { get; set; }

    public int ProductId { get; set; }

    public Product Product { get; set; } = null!;

    public int WarehouseId { get; set; }

    public Warehouse Warehouse { get; set; } = null!;

    public int QuantityOnHand { get; private set; }

    public int QuantityReserved { get; private set; }

    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    /// <summary>Tồn khả dụng để bán = thực tế - đã giữ.</summary>
    public int Available => QuantityOnHand - QuantityReserved;

    /// <summary>Nhập kho (Receipt).</summary>
    public void Receive(int quantity)
    {
        EnsurePositive(quantity);
        QuantityOnHand = checked(QuantityOnHand + quantity);
        Touch();
    }

    /// <summary>Điều chỉnh kiểm kê. delta âm = hao hụt.</summary>
    public void Adjust(int delta)
    {
        if (delta == 0)
        {
            return;
        }

        var next = QuantityOnHand + delta;
        if (next < 0)
        {
            throw new InvalidStockOperationException("Tồn kho không thể âm sau khi điều chỉnh.");
        }

        if (next < QuantityReserved)
        {
            throw new InvalidStockOperationException(
                $"Không thể điều chỉnh xuống dưới số đang giữ cho đơn hàng ({QuantityReserved}).");
        }

        QuantityOnHand = next;
        Touch();
    }

    /// <summary>Giữ tồn khi đơn chuyển sang Confirmed.</summary>
    public void Reserve(int quantity)
    {
        EnsurePositive(quantity);
        if (Available < quantity)
        {
            throw new InsufficientStockException(ProductId, WarehouseId, quantity, Available);
        }

        QuantityReserved += quantity;
        Touch();
    }

    /// <summary>Nhả tồn khi đơn bị huỷ.</summary>
    public void Release(int quantity)
    {
        EnsurePositive(quantity);
        if (QuantityReserved < quantity)
        {
            throw new InvalidStockOperationException(
                $"Không thể nhả {quantity} vì chỉ đang giữ {QuantityReserved}.");
        }

        QuantityReserved -= quantity;
        Touch();
    }

    /// <summary>Xuất kho thực tế khi đơn Shipped: trừ cả OnHand và phần đã giữ.</summary>
    public void Issue(int quantity)
    {
        EnsurePositive(quantity);
        if (QuantityOnHand < quantity)
        {
            throw new InvalidStockOperationException(
                $"Không thể xuất {quantity} vì tồn thực tế chỉ còn {QuantityOnHand}.");
        }

        QuantityOnHand -= quantity;
        QuantityReserved = Math.Max(0, QuantityReserved - quantity);
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static void EnsurePositive(int quantity)
    {
        if (quantity <= 0)
        {
            throw new InvalidStockOperationException($"Số lượng phải lớn hơn 0 (nhận được {quantity}).");
        }
    }
}

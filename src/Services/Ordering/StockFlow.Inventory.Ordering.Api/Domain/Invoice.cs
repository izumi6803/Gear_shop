namespace StockFlow.Inventory.Ordering.Api.Domain;

/// <summary>invoice — hóa đơn. Sinh tự động khi đơn chuyển Shipped; mỗi đơn tối đa 1 hóa đơn.</summary>
public class Invoice
{
    public int Id { get; set; }

    public string InvoiceNo { get; set; } = string.Empty;

    public int OrderId { get; set; }

    public Order Order { get; set; } = null!;

    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;

    public DateOnly DueDate { get; set; }

    public decimal Amount { get; set; }

    public decimal TaxAmount { get; set; }

    /// <summary>Phí vận chuyển, chép từ đơn tại thời điểm phát hành.</summary>
    public decimal ShippingFee { get; set; }

    public string Status { get; set; } = "Issued";

    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public decimal TotalAmount => Amount + TaxAmount + ShippingFee;
}

namespace StockFlow.Inventory.Ordering.Api.Domain;

/// <summary>
/// order — aggregate root của đơn hàng. Mọi thay đổi trạng thái đi qua
/// các method ở đây để bất biến nghiệp vụ luôn được giữ (có unit test).
/// </summary>
public class Order
{
    /// <summary>Thuế tiêu thụ Nhật Bản 10%.</summary>
    public const decimal TaxRate = 0.10m;

    public int Id { get; private set; }

    public string OrderNo { get; private set; } = string.Empty;

    public int CustomerId { get; private set; }

    public Customer Customer { get; private set; } = null!;

    public DateOnly OrderDate { get; private set; }

    public OrderStatus Status { get; private set; } = OrderStatus.Draft;

    public decimal SubTotal { get; private set; }

    public decimal TaxAmount { get; private set; }

    public decimal TotalAmount { get; private set; }

    /// <summary>Phí vận chuyển, tính lại mỗi lần tổng tiền thay đổi.</summary>
    public decimal ShippingFee { get; private set; }

    public string? Note { get; private set; }

    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public DateTime? ConfirmedAt { get; private set; }

    public DateTime? ShippedAt { get; private set; }

    public string CreatedBy { get; private set; } = "system";

    /// <summary>Trạng thái thanh toán. Storefront: khách trả tiền sau khi đơn đã giữ tồn.</summary>
    public OrderPaymentStatus PaymentStatus { get; private set; } = OrderPaymentStatus.Unpaid;

    public DateTime? PaidAt { get; private set; }

    /// <summary>"online" (thẻ) hoặc "cash" (tiền mặt/COD).</summary>
    public string PaymentMethod { get; private set; } = PaymentMethods.Online;

    public string? PaymentReference { get; private set; }

    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public List<OrderLine> Lines { get; private set; } = new();

    /// <summary>Đơn đã/đang giữ tồn kho hay chưa (dùng để quyết định có phải nhả tồn khi huỷ).</summary>
    public bool HoldsStock => Status is OrderStatus.Confirmed or OrderStatus.Shipped;

    private Order()
    {
    }

    public static Order Create(string orderNo, int customerId, DateOnly orderDate, string? note, string createdBy, string paymentMethod = PaymentMethods.Online)
    {
        if (string.IsNullOrWhiteSpace(orderNo))
        {
            throw new OrderValidationException("Số đơn hàng bắt buộc.");
        }

        if (customerId <= 0)
        {
            throw new OrderValidationException("Khách hàng bắt buộc.");
        }

        return new Order
        {
            OrderNo = orderNo.Trim().ToUpperInvariant(),
            CustomerId = customerId,
            OrderDate = orderDate,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            CreatedBy = string.IsNullOrWhiteSpace(createdBy) ? "system" : createdBy.Trim(),
            PaymentMethod = paymentMethod,
            Status = OrderStatus.Draft
        };
    }

    /// <summary>Thêm dòng hàng; nếu trùng (sản phẩm, kho) thì cộng dồn số lượng.</summary>
    public OrderLine AddLine(
        int productId,
        string productCode,
        string productName,
        int warehouseId,
        decimal unitPrice,
        int quantity)
    {
        EnsureDraft();
        if (quantity <= 0)
        {
            throw new OrderValidationException("Số lượng phải lớn hơn 0.");
        }

        if (unitPrice < 0)
        {
            throw new OrderValidationException("Đơn giá không được âm.");
        }

        if (warehouseId <= 0)
        {
            throw new OrderValidationException("Kho xuất hàng bắt buộc.");
        }

        var line = Lines.FirstOrDefault(l => l.ProductId == productId && l.WarehouseId == warehouseId);
        if (line is null)
        {
            line = new OrderLine
            {
                ProductId = productId,
                ProductCode = productCode,
                ProductName = productName,
                WarehouseId = warehouseId,
                UnitPrice = unitPrice
            };
            line.SetQuantity(quantity);
            Lines.Add(line);
        }
        else
        {
            line.IncreaseQuantity(quantity);
        }

        RecalculateTotals();
        return line;
    }

    public void RemoveLine(int productId, int warehouseId)
    {
        EnsureDraft();
        Lines.RemoveAll(l => l.ProductId == productId && l.WarehouseId == warehouseId);
        RecalculateTotals();
    }

    /// <summary>Kiểm tra điều kiện xác nhận mà không đổi trạng thái (để reserve tồn trước).</summary>
    public void EnsureCanConfirm()
    {
        if (Status != OrderStatus.Draft)
        {
            throw new OrderStateException($"Chỉ xác nhận được đơn ở trạng thái Draft (hiện tại {Status}).");
        }

        if (Lines.Count == 0)
        {
            throw new OrderStateException("Đơn hàng phải có ít nhất một dòng hàng mới xác nhận được.");
        }

        if (Lines.Any(l => l.Quantity <= 0))
        {
            throw new OrderStateException("Có dòng hàng với số lượng không hợp lệ.");
        }
    }

    public void Confirm()
    {
        EnsureCanConfirm();
        Status = OrderStatus.Confirmed;
        ConfirmedAt = DateTime.UtcNow;
    }

    public void MarkShipped()
    {
        if (Status != OrderStatus.Confirmed)
        {
            throw new OrderStateException($"Chỉ xuất kho được đơn đã xác nhận (hiện tại {Status}).");
        }

        // COD: giao hàng trước, thu tiền sau. Đơn online vẫn phải trả trước.
        if (PaymentStatus != OrderPaymentStatus.Paid && PaymentMethod != PaymentMethods.Cash)
        {
            throw new OrderStateException("Đơn online chưa thanh toán nên chưa thể xuất kho.");
        }

        Status = OrderStatus.Shipped;
        ShippedAt = DateTime.UtcNow;
    }

    /// <summary>Thanh toán online (thẻ) — đơn online phải trả trước khi giao.</summary>
    public void MarkPaid(string reference)
    {
        EnsureCollectable(allowShipped: false);

        if (PaymentMethod != PaymentMethods.Online)
        {
            throw new OrderStateException(
                "Đơn này thanh toán tiền mặt; nhân viên thu tiền khi giao hàng.");
        }

        ApplyPaid(reference);
    }

    /// <summary>
    /// Thu tiền mặt (COD hoặc trả sau). Cho phép cả đơn đã giao: COD bản chất là
    /// thu tiền lúc giao hàng, nên chặn ở Shipped sẽ khiến đơn không bao giờ thu được.
    /// </summary>
    public void MarkCashCollected(string reference)
    {
        EnsureCollectable(allowShipped: true);

        if (PaymentMethod != PaymentMethods.Cash)
        {
            throw new OrderStateException("Đơn này thanh toán online, không thu tiền mặt.");
        }

        ApplyPaid(reference);
    }

    private void EnsureCollectable(bool allowShipped)
    {
        if (Status == OrderStatus.Cancelled)
        {
            throw new OrderStateException("Đơn hàng đã bị huỷ.");
        }

        var collectable = Status == OrderStatus.Confirmed
            || (allowShipped && Status == OrderStatus.Shipped);

        if (!collectable)
        {
            throw new OrderStateException(
                allowShipped
                    ? $"Chỉ thu tiền được đơn đã xác nhận hoặc đã giao (hiện tại {Status})."
                    : $"Chỉ thanh toán được đơn đã xác nhận giữ tồn (hiện tại {Status}).");
        }

        if (PaymentStatus == OrderPaymentStatus.Paid)
        {
            throw new OrderStateException("Đơn hàng đã được thanh toán trước đó.");
        }
    }

    private void ApplyPaid(string reference)
    {
        PaymentStatus = OrderPaymentStatus.Paid;
        PaymentReference = reference;
        PaidAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        if (Status == OrderStatus.Shipped)
        {
            throw new OrderStateException("Không thể huỷ đơn đã xuất kho.");
        }

        if (Status == OrderStatus.Cancelled)
        {
            throw new OrderStateException("Đơn hàng đã bị huỷ trước đó.");
        }

        Status = OrderStatus.Cancelled;
    }

    public void RecalculateTotals()
    {
        foreach (var line in Lines)
        {
            line.Recalculate();
        }

        SubTotal = Lines.Sum(l => l.LineAmount);
        TaxAmount = Math.Round(SubTotal * TaxRate, 0, MidpointRounding.AwayFromZero);
        ShippingFee = ShippingPolicy.FeeFor(SubTotal);
        TotalAmount = SubTotal + TaxAmount + ShippingFee;
    }

    private void EnsureDraft()
    {
        if (Status != OrderStatus.Draft)
        {
            throw new OrderStateException(
                $"Chỉ sửa được đơn ở trạng thái Draft (hiện tại {Status}).");
        }
    }
}

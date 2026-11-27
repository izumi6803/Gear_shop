namespace StockFlow.Inventory.Ordering.Api.Domain;

/// <summary>Trạng thái thanh toán của đơn hàng (storefront).</summary>
public enum OrderPaymentStatus
{
    Unpaid = 0,
    Paid = 1,
    Refunded = 2,
}

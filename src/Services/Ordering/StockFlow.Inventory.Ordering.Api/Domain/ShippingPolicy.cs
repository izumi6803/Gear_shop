namespace StockFlow.Inventory.Ordering.Api.Domain;

/// <summary>
/// Chính sách phí vận chuyển. Một chỗ duy nhất để FE/BE không lệch nhau:
/// đơn từ 500 USD trở lên miễn phí, dưới mức đó thu phẳng 15 USD.
/// </summary>
public static class ShippingPolicy
{
    public const decimal FlatFee = 15m;

    public const decimal FreeThreshold = 500m;

    public static decimal FeeFor(decimal subTotal) => subTotal >= FreeThreshold ? 0m : FlatFee;
}

/// <summary>Phương thức thanh toán của đơn.</summary>
public static class PaymentMethods
{
    /// <summary>Trả online bằng thẻ ngay khi đặt hàng.</summary>
    public const string Online = "online";

    /// <summary>Trả tiền mặt khi nhận hàng (COD) hoặc trả sau với khách doanh nghiệp.</summary>
    public const string Cash = "cash";

    public static bool IsValid(string? value) =>
        value is not null && (value == Online || value == Cash);
}

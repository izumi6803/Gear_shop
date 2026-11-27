using StockFlow.Inventory.BuildingBlocks;

namespace StockFlow.Inventory.Ordering.Api.Domain;

public enum OrderStatus
{
    Draft,
    Confirmed,
    Shipped,
    Cancelled
}

public sealed class OrderNotFoundException : DomainException
{
    public OrderNotFoundException(int orderId)
        : base("ORDER_NOT_FOUND", $"Không tìm thấy đơn hàng {orderId}.", 404)
    {
    }
}

public sealed class CustomerNotFoundException : DomainException
{
    public CustomerNotFoundException(int customerId)
        : base("CUSTOMER_NOT_FOUND", $"Không tìm thấy khách hàng {customerId}.", 404)
    {
    }
}

/// <summary>Vi phạm bất biến nghiệp vụ của đơn hàng (sai trạng thái, thiếu dòng...).</summary>
public sealed class OrderStateException : DomainException
{
    public OrderStateException(string message)
        : base("ORDER_STATE_INVALID", message)
    {
    }
}

/// <summary>Dữ liệu đầu vào không hợp lệ (số lượng &lt;= 0, không có dòng...).</summary>
public sealed class OrderValidationException : DomainException
{
    public OrderValidationException(string message)
        : base("ORDER_INVALID", message, 400)
    {
    }
}

/// <summary>Không lấy được thông tin hàng hoá từ Catalog (không tồn tại / ngừng bán).</summary>
public sealed class ProductUnavailableException : DomainException
{
    public ProductUnavailableException(string message)
        : base("PRODUCT_UNAVAILABLE", message, 422)
    {
    }
}

/// <summary>Catalog từ chối giữ tồn: đơn giữ nguyên Draft, client báo lại khách.</summary>
public sealed class StockConflictException : DomainException
{
    public StockConflictException(string message)
        : base("STOCK_CONFLICT", message)
    {
    }
}

/// <summary>Không gọi được Catalog API (mạng, timeout, 5xx).</summary>
public sealed class CatalogUnavailableException : DomainException
{
    public CatalogUnavailableException(string message)
        : base("CATALOG_UNAVAILABLE", message, 502)
    {
    }
}

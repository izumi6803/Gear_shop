namespace StockFlow.Inventory.BuildingBlocks;

/// <summary>
/// Lỗi nghiệp vụ có chủ đích (không phải bug). Mang theo HTTP status + mã lỗi
/// để tầng API map thẳng ra response mà không cần if/else ở từng endpoint.
/// </summary>
public abstract class DomainException : Exception
{
    protected DomainException(string code, string message, int statusCode = 409)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
    }

    public string Code { get; }

    public int StatusCode { get; }
}

/// <summary>Xung đột dữ liệu do ghi đồng thời (optimistic concurrency).</summary>
public sealed class ConcurrencyConflictException : DomainException
{
    public ConcurrencyConflictException(string message)
        : base("CONCURRENCY_CONFLICT", message)
    {
    }
}

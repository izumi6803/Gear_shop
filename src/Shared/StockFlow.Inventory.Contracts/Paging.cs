namespace StockFlow.Inventory.Contracts;

/// <summary>Trang kết quả dùng chung cho mọi API danh sách.</summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

/// <summary>Lỗi chuẩn hoá trả về cho client (ngoài ProblemDetails của ASP.NET Core).</summary>
public sealed record ApiError(string Code, string Message, IReadOnlyDictionary<string, string>? Details = null);

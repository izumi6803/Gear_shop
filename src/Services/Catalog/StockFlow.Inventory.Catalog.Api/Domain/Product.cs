namespace StockFlow.Inventory.Catalog.Api.Domain;

/// <summary>product master — hàng hoá.</summary>
public class Product
{
    public int Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Category { get; set; } = "General";

    public string Unit { get; set; } = "pcs";

    /// <summary>Ảnh sản phẩm, đường dẫn tương đối với SPA (vd /products/p-1001.svg).</summary>
    public string? ImageUrl { get; set; }

    public decimal UnitPrice { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public List<Stock> Stocks { get; set; } = new();
}

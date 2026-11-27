namespace StockFlow.Inventory.Catalog.Api.Domain;

/// <summary>warehouse master — kho hàng.</summary>
public class Warehouse
{
    public int Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Location { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public List<Stock> Stocks { get; set; } = new();
}

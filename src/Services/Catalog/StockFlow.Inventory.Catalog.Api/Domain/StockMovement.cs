namespace StockFlow.Inventory.Catalog.Api.Domain;

public enum MovementType
{
    Receipt,
    Issue,
    Adjustment,
    Reserve,
    Release
}

/// <summary>stock movements — sổ cái kho, append-only (không sửa, không xoá).</summary>
public class StockMovement
{
    public long Id { get; set; }

    public int ProductId { get; set; }

    public int WarehouseId { get; set; }

    public MovementType MovementType { get; set; }

    /// <summary>Số lượng có dấu: dương = nhập/giữ, âm = xuất/nhả.</summary>
    public int Quantity { get; set; }

    public string? ReferenceType { get; set; }

    public string? ReferenceNo { get; set; }

    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

    public string? Note { get; set; }

    public string? CreatedBy { get; set; }
}

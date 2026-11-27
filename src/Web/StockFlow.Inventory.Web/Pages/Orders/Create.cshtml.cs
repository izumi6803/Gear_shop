using StockFlow.Inventory.Contracts.Catalog;
using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace StockFlow.Inventory.Web.Pages.Orders;

public class CreateModel(OrderingApiClient ordering, CatalogApiClient catalog, UserSession session)
    : SecurePageModel(session)
{
    [BindProperty]
    public int CustomerId { get; set; }

    [BindProperty]
    public DateOnly OrderDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);

    [BindProperty]
    public string? Note { get; set; }

    [BindProperty]
    public List<LineInput> Lines { get; set; } = new();

    public List<CustomerDto> Customers { get; private set; } = new();

    public List<ProductDto> Products { get; private set; } = new();

    public List<WarehouseDto> Warehouses { get; private set; } = new();

    public string? ErrorMessage { get; private set; }

    public int RowCount => Lines.Count == 0 ? 1 : Lines.Count;

    public sealed class LineInput
    {
        public int ProductId { get; set; }

        public int WarehouseId { get; set; }

        public int Quantity { get; set; } = 1;
    }

    public async Task<IActionResult> OnGetAsync(CancellationToken ct = default)
    {
        await LoadLookupsAsync(ct);
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct = default)
    {
        var lines = Lines
            .Where(l => l.ProductId > 0 && l.Quantity > 0)
            .Select(l => new CreateOrderLine(l.ProductId, l.WarehouseId, l.Quantity))
            .ToList();

        if (CustomerId <= 0)
        {
            ErrorMessage = "Vui lòng chọn khách hàng.";
        }
        else if (lines.Count == 0)
        {
            ErrorMessage = "Cần ít nhất một dòng hàng có số lượng > 0.";
        }

        if (ErrorMessage is not null)
        {
            await LoadLookupsAsync(ct);
            return Page();
        }

        try
        {
            var order = await ordering.CreateOrderAsync(new CreateOrderRequest(CustomerId, OrderDate, lines, Note), ct);
            TempData["Status"] = order is null
                ? "Đã tạo đơn hàng."
                : $"Đã tạo đơn {order.OrderNo} ({order.Status}) — {order.TotalAmount:N0} ¥.";

            return RedirectToPage("/Orders/Index");
        }
        catch (ApiException ex)
        {
            ErrorMessage = ex.Message;
            await LoadLookupsAsync(ct);
            return Page();
        }
    }

    private async Task LoadLookupsAsync(CancellationToken ct)
    {
        try
        {
            Customers = await ordering.GetCustomersAsync(ct) ?? new List<CustomerDto>();
            Products = (await catalog.GetProductsAsync(null, page: 1, pageSize: 100, ct))?.Items.ToList()
                       ?? new List<ProductDto>();
            Warehouses = await catalog.GetWarehousesAsync(ct) ?? new List<WarehouseDto>();

            if (Lines.Count == 0)
            {
                Lines.Add(new LineInput { WarehouseId = Warehouses.FirstOrDefault()?.Id ?? 0 });
            }
        }
        catch (ApiException ex)
        {
            ErrorMessage ??= ex.Message;
        }
    }
}

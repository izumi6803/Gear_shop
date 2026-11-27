using StockFlow.Inventory.Contracts.Catalog;
using StockFlow.Inventory.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace StockFlow.Inventory.Web.Pages.Products;

public class IndexModel(CatalogApiClient catalog, UserSession session) : SecurePageModel(session)
{
    [BindProperty(SupportsGet = true)]
    public string? Keyword { get; set; }

    public List<ProductDto> Products { get; private set; } = new();

    public List<StockDto> Stocks { get; private set; } = new();

    public List<WarehouseDto> Warehouses { get; private set; } = new();

    public string? ErrorMessage { get; private set; }

    public bool CanEdit => Session.IsAdmin;

    public async Task OnGetAsync(CancellationToken ct = default) => await LoadAsync(ct);

    public async Task<IActionResult> OnPostCreateAsync(
        string code,
        string name,
        string category,
        decimal unitPrice,
        CancellationToken ct = default)
    {
        try
        {
            var created = await catalog.CreateProductAsync(
                new ProductUpsertRequest(code, name, category, "pcs", unitPrice),
                ct);

            TempData["Status"] = created is null
                ? "Đã tạo sản phẩm."
                : $"Đã tạo sản phẩm {created.Code} — {created.Name}.";

            return RedirectToPage(new { Keyword });
        }
        catch (ApiException ex)
        {
            ErrorMessage = ex.Message;
            await LoadAsync(ct);
            return Page();
        }
    }

    private async Task LoadAsync(CancellationToken ct)
    {
        try
        {
            var products = await catalog.GetProductsAsync(Keyword, page: 1, pageSize: 100, ct);
            Products = products?.Items.ToList() ?? new List<ProductDto>();

            var stocks = await catalog.GetStocksAsync(keyword: Keyword, ct: ct);
            Stocks = stocks?.Items.ToList() ?? new List<StockDto>();

            Warehouses = await catalog.GetWarehousesAsync(ct) ?? new List<WarehouseDto>();
        }
        catch (ApiException ex)
        {
            ErrorMessage = ex.Message;
        }
    }
}

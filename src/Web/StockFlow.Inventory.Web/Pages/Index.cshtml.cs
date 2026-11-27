using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Web.Services;

namespace StockFlow.Inventory.Web.Pages;

public class IndexModel(OrderingApiClient ordering, CatalogApiClient catalog, UserSession session)
    : SecurePageModel(session)
{
    public int TotalOrders { get; private set; }

    public int TotalProducts { get; private set; }

    public int TotalInvoices { get; private set; }

    public List<OrderDto> RecentOrders { get; private set; } = new();

    public string? ErrorMessage { get; private set; }

    public async Task OnGetAsync(CancellationToken ct = default)
    {
        try
        {
            var orders = await ordering.GetOrdersAsync(null, page: 1, pageSize: 5, ct);
            TotalOrders = orders?.TotalCount ?? 0;
            RecentOrders = orders?.Items.ToList() ?? new List<OrderDto>();

            var products = await catalog.GetProductsAsync(null, page: 1, pageSize: 1, ct);
            TotalProducts = products?.TotalCount ?? 0;

            var invoices = await ordering.GetInvoicesAsync(ct);
            TotalInvoices = invoices?.Count ?? 0;
        }
        catch (ApiException ex)
        {
            ErrorMessage = ex.Message;
        }
    }
}

using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace StockFlow.Inventory.Web.Pages.Orders;

public class IndexModel(OrderingApiClient ordering, UserSession session) : SecurePageModel(session)
{
    [BindProperty(SupportsGet = true)]
    public string? Status { get; set; }

    public List<OrderDto> Orders { get; private set; } = new();

    public string? ErrorMessage { get; private set; }

    public bool CanSell => Session.CanSell;

    public async Task OnGetAsync(CancellationToken ct = default)
    {
        if (TempData["Error"] is string error)
        {
            ErrorMessage = error;
        }

        try
        {
            var orders = await ordering.GetOrdersAsync(Status, page: 1, pageSize: 100, ct);
            Orders = orders?.Items.ToList() ?? new List<OrderDto>();
        }
        catch (ApiException ex)
        {
            ErrorMessage = ex.Message;
        }
    }

    public Task<IActionResult> OnPostConfirmAsync(int id, string? status, CancellationToken ct = default) =>
        ExecuteAsync(id, status, "Đã xác nhận đơn", token => ordering.ConfirmAsync(id, token), ct);

    public Task<IActionResult> OnPostCancelAsync(int id, string? status, CancellationToken ct = default) =>
        ExecuteAsync(id, status, "Đã huỷ đơn", token => ordering.CancelAsync(id, token), ct);

    public Task<IActionResult> OnPostShipAsync(int id, string? status, CancellationToken ct = default) =>
        ExecuteAsync(id, status, "Đã xuất kho & tạo hoá đơn", token => ordering.ShipAsync(id, token), ct);

    private async Task<IActionResult> ExecuteAsync<T>(
        int id,
        string? status,
        string successPrefix,
        Func<CancellationToken, Task<T?>> action,
        CancellationToken ct)
    {
        if (!CanSell)
        {
            TempData["Error"] = "Bạn không có quyền thao tác nghiệp vụ (cần role Sales/Admin).";
            return RedirectToPage(new { Status = status });
        }

        try
        {
            var result = await action(ct);

            TempData["Status"] = result switch
            {
                OrderDto order => $"{successPrefix} {order.OrderNo} — trạng thái: {order.Status}.",
                ShipResult ship => $"{successPrefix} {ship.Invoice.InvoiceNo} ({ship.Invoice.Amount + ship.Invoice.TaxAmount:N0} ¥).",
                _ => $"{successPrefix} #{id}."
            };
        }
        catch (ApiException ex)
        {
            TempData["Error"] = ex.Message;
        }

        return RedirectToPage(new { Status = status });
    }
}

using Microsoft.AspNetCore.Mvc.RazorPages;

namespace StockFlow.Inventory.Web.Pages;

public class ErrorModel : PageModel
{
    public string? RequestId { get; private set; }

    public void OnGet(string? requestId = null) => RequestId = requestId;
}

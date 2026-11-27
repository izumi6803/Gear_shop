using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace StockFlow.Inventory.Web.Pages;

/// <summary>
/// Base cho mọi trang cần đăng nhập: chưa có token thì đá về /Login kèm returnUrl.
/// </summary>
public abstract class SecurePageModel(Services.UserSession session) : PageModel
{
    public Services.UserSession Session { get; } = session;

    public override async Task OnPageHandlerExecutionAsync(
        PageHandlerExecutingContext context,
        PageHandlerExecutionDelegate next)
    {
        if (!Session.IsAuthenticated)
        {
            context.Result = RedirectToPage("/Login", new { returnUrl = Request.Path + Request.QueryString });
            return;
        }

        await next();
    }
}

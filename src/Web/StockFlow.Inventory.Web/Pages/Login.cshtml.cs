using StockFlow.Inventory.Contracts.Security;
using StockFlow.Inventory.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace StockFlow.Inventory.Web.Pages;

public class LoginModel(OrderingApiClient ordering, UserSession session) : PageModel
{
    [BindProperty]
    public string Username { get; set; } = "sales";

    [BindProperty]
    public string Password { get; set; } = "Sales@123";

    [BindProperty]
    public string? ReturnUrl { get; set; }

    public string? ErrorMessage { get; private set; }

    public IActionResult OnGet(string? returnUrl = null)
    {
        ReturnUrl = returnUrl;

        if (session.IsAuthenticated)
        {
            return RedirectToPage("/Index");
        }

        return Page();
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(Username) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "Vui lòng nhập tài khoản và mật khẩu.";
            return Page();
        }

        try
        {
            var response = await ordering.LoginAsync(new LoginRequest(Username.Trim(), Password), ct);
            if (response is null)
            {
                ErrorMessage = "Đăng nhập thất bại.";
                return Page();
            }

            session.SignIn(response);

            return !string.IsNullOrEmpty(ReturnUrl) && Url.IsLocalUrl(ReturnUrl)
                ? LocalRedirect(ReturnUrl)
                : RedirectToPage("/Index");
        }
        catch (ApiException ex)
        {
            ErrorMessage = ex.Message;
            return Page();
        }
    }
}

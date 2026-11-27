using StockFlow.Inventory.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace StockFlow.Inventory.Web.Pages;

public class LogoutModel(UserSession session) : PageModel
{
    public IActionResult OnGet()
    {
        session.SignOut();
        return RedirectToPage("/Login");
    }

    public IActionResult OnPost()
    {
        session.SignOut();
        return RedirectToPage("/Login");
    }
}

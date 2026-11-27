using StockFlow.Inventory.Contracts.Security;

namespace StockFlow.Inventory.Web.Services;

/// <summary>
/// Giữ JWT của Ordering API trong Session (server-side cookie, không lộ token ra JS)
/// để mọi request từ Razor Pages gắn Bearer khi gọi API.
/// </summary>
public sealed class UserSession(IHttpContextAccessor httpContextAccessor)
{
    private const string TokenKey = "auth.token";
    private const string NameKey = "auth.name";
    private const string RoleKey = "auth.role";

    private ISession Session =>
        httpContextAccessor.HttpContext?.Session
        ?? throw new InvalidOperationException("Session chưa được kích hoạt (thiếu app.UseSession()).");

    public string? Token => Session.GetString(TokenKey);

    public bool IsAuthenticated => !string.IsNullOrEmpty(Token);

    public string DisplayName => Session.GetString(NameKey) ?? string.Empty;

    public string Role => Session.GetString(RoleKey) ?? string.Empty;

    public bool IsAdmin => string.Equals(Role, Roles.Admin, StringComparison.OrdinalIgnoreCase);

    public bool CanSell => IsAdmin || string.Equals(Role, Roles.Sales, StringComparison.OrdinalIgnoreCase);

    public void SignIn(LoginResponse response)
    {
        Session.SetString(TokenKey, response.AccessToken);
        Session.SetString(NameKey, response.DisplayName);
        Session.SetString(RoleKey, response.Role);
    }

    public void SignOut() => Session.Clear();
}

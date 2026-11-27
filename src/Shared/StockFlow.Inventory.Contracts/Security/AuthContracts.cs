namespace StockFlow.Inventory.Contracts.Security;

public sealed record LoginRequest(string Username, string Password);

public sealed record LoginResponse(string AccessToken, DateTimeOffset ExpiresAt, string DisplayName, string Role);

/// <summary>Tự đăng ký tài khoản mua hàng (storefront).</summary>
public sealed record RegisterRequest(
    string Username,
    string Password,
    string DisplayName,
    string? Email,
    string? Phone,
    string? Address);

/// <summary>Quên mật khẩu: nhận username hoặc email của khách hàng.</summary>
public sealed record ForgotPasswordRequest(string? UsernameOrEmail);

/// <summary>Phản hồi quên mật khẩu; ResetToken chỉ có ở chế độ demo (Auth:ExposeResetToken).</summary>
public sealed record ForgotPasswordResponse(string Message, string? ResetToken = null, DateTimeOffset? ExpiresAt = null);

/// <summary>Đặt lại mật khẩu bằng token đã phát.</summary>
public sealed record ResetPasswordRequest(string? Token, string? NewPassword);

/// <summary>Cấu hình JWT dùng chung giữa Ordering (phát hành) và Catalog (kiểm tra).</summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "stockflow.inventory";

    public string Audience { get; set; } = "stockflow.inventory.clients";

    /// <summary>Chỉ dùng cho môi trường dev; production lấy từ env `Jwt__Key` hoặc Key Vault.</summary>
    public string Key { get; set; } = "dev-only-signing-key-please-override-0123456789";

    public int ExpiresMinutes { get; set; } = 480;
}

public static class Roles
{
    /// <summary>Khách mua hàng trên storefront: chỉ xem sản phẩm, đặt và thanh toán đơn của mình.</summary>
    public const string Customer = "Customer";

    public const string Admin = "Admin";
    public const string Sales = "Sales";
    public const string Viewer = "Viewer";

    /// <summary>Nhân viên bán hàng: quản lý sản phẩm + xử lý đơn.</summary>
    public const string AdminOrSales = Admin + "," + Sales;

    public const string Staff = Admin + "," + Sales + "," + Viewer;

    public const string AnyRole = Admin + "," + Sales + "," + Viewer + "," + Customer;
}

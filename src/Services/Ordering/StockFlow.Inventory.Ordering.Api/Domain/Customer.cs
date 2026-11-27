namespace StockFlow.Inventory.Ordering.Api.Domain;

/// <summary>customer master — khách hàng.</summary>
public class Customer
{
    public int Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;


    public string? Email { get; set; }

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public List<Order> Orders { get; set; } = new();
}

/// <summary>user — tài khoản đăng nhập (Admin / Sales / Viewer / Customer).</summary>
public class AppUser
{
    public int Id { get; set; }

    public string Username { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Role { get; set; } = "Viewer";

    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Tăng mỗi khi quyền/khoá/mật khẩu thay đổi. Token mang giá trị này nên
    /// token phát hành trước đó bị vô hiệu ngay, không phải chờ hết hạn.
    /// </summary>
    public int TokenVersion { get; set; }

    /// <summary>Với role Customer: hồ sơ khách hàng tương ứng để gắn đơn hàng.</summary>
    public int? CustomerId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

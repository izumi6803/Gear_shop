namespace StockFlow.Inventory.Ordering.Api.Domain;

/// <summary>password reset token — mã đặt lại mật khẩu (chỉ lưu hash SHA-256 của token thô).</summary>
public class PasswordResetToken
{
    public int Id { get; set; }

    public int UserId { get; set; }

    /// <summary>SHA-256 hex của token thô; token thô chỉ trả về 1 lần cho người dùng.</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime ExpiresAt { get; set; }

    /// <summary>Null = chưa dùng; có giá trị = đã dùng hoặc đã bị vô hiệu hóa.</summary>
    public DateTime? UsedAt { get; set; }
}

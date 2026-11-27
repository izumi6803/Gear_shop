using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace StockFlow.Inventory.Persistence;

public static class RowVersionExtensions
{
    /// <summary>
    /// SQL Server: <c>rowversion</c> — concurrency token do DB tự tăng, chống lost-update.
    /// SQLite (demo local) không hỗ trợ rowversion → bỏ cột này thay vì giả lập sai.
    /// Ghi chú: trên SQLite, optimistic concurrency không được enforce (chấp nhận cho demo 1 người dùng).
    /// </summary>
    public static void ConfigureRowVersion(this EntityTypeBuilder builder, string propertyName, bool sqlServer)
    {
        if (sqlServer)
        {
            builder.Property(propertyName).IsRowVersion();
        }
        else
        {
            builder.Ignore(propertyName);
        }
    }
}

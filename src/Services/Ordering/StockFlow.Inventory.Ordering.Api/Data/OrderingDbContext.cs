using StockFlow.Inventory.Ordering.Api.Domain;
using StockFlow.Inventory.Persistence;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Ordering.Api.Data;

public class OrderingDbContext(DbContextOptions<OrderingDbContext> options) : DbContext(options)
{
    public DbSet<Customer> Customers => Set<Customer>();

    public DbSet<Order> Orders => Set<Order>();

    public DbSet<OrderLine> OrderLines => Set<OrderLine>();

    public DbSet<Invoice> Invoices => Set<Invoice>();

    public DbSet<AppUser> Users => Set<AppUser>();

    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // rowversion chỉ có trên SQL Server; SQLite (demo local) bỏ cột này.
        var sqlServer = Database.IsSqlServer();

        modelBuilder.Entity<Customer>(e =>
        {
            e.ToTable("CUSTOMER");
            e.HasKey(x => x.Id);
            e.Property(x => x.Code).HasMaxLength(16).IsRequired();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.Phone).HasMaxLength(32);
            e.Property(x => x.Address).HasMaxLength(300);
            e.ConfigureRowVersion(nameof(Customer.RowVersion), sqlServer);
            e.HasIndex(x => x.Code).IsUnique().HasDatabaseName("UQ_Customer_Code");
        });

        modelBuilder.Entity<Order>(e =>
        {
            e.ToTable("ORDER");
            e.HasKey(x => x.Id);
            e.Property(x => x.OrderNo).HasMaxLength(32).IsRequired();
            e.Property(x => x.OrderDate).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
            e.Property(x => x.SubTotal).HasColumnType("decimal(18,2)");
            e.Property(x => x.TaxAmount).HasColumnType("decimal(18,2)");
            e.Property(x => x.TotalAmount).HasColumnType("decimal(18,2)");
            e.Property(x => x.Note).HasMaxLength(500);
            e.Property(x => x.CreatedBy).HasMaxLength(64);
            e.Property(x => x.PaymentStatus).HasConversion<string>().HasMaxLength(16).IsRequired();
            e.Property(x => x.PaymentMethod).HasMaxLength(16).IsRequired();
            e.Property(x => x.ShippingFee).HasColumnType("decimal(18,2)");
            e.Property(x => x.PaymentReference).HasMaxLength(64);
            e.ConfigureRowVersion(nameof(Order.RowVersion), sqlServer);

            e.HasOne(x => x.Customer)
                .WithMany(c => c.Orders)
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasMany(x => x.Lines)
                .WithOne()
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => x.OrderNo).IsUnique().HasDatabaseName("UQ_Order_OrderNo");
            e.HasIndex(x => new { x.CustomerId, x.CreatedAt }).HasDatabaseName("IX_Order_Customer_CreatedAt");
            e.HasIndex(x => new { x.Status, x.OrderDate }).HasDatabaseName("IX_Order_Status_OrderDate");
        });

        modelBuilder.Entity<OrderLine>(e =>
        {
            e.ToTable("ORDER_LINE", t => t.HasCheckConstraint("CK_OrderLine_Quantity", "[Quantity] > 0"));
            e.HasKey(x => x.Id);
            e.Property(x => x.ProductCode).HasMaxLength(32).IsRequired();
            e.Property(x => x.ProductName).HasMaxLength(200).IsRequired();
            e.Property(x => x.UnitPrice).HasColumnType("decimal(18,2)");
            e.Property(x => x.LineAmount).HasColumnType("decimal(18,2)");
            e.ConfigureRowVersion(nameof(OrderLine.RowVersion), sqlServer);
            e.HasIndex(x => x.OrderId).HasDatabaseName("IX_OrderLine_OrderId");
            e.HasIndex(x => x.ProductId).HasDatabaseName("IX_OrderLine_ProductId");
        });

        modelBuilder.Entity<Invoice>(e =>
        {
            e.ToTable("INVOICE");
            e.HasKey(x => x.Id);
            e.Property(x => x.InvoiceNo).HasMaxLength(32).IsRequired();
            e.Property(x => x.Amount).HasColumnType("decimal(18,2)");
            e.Property(x => x.TaxAmount).HasColumnType("decimal(18,2)");
            e.Property(x => x.ShippingFee).HasColumnType("decimal(18,2)");
            e.Property(x => x.Status).HasMaxLength(16).IsRequired();
            e.ConfigureRowVersion(nameof(Invoice.RowVersion), sqlServer);
            e.Ignore(x => x.TotalAmount);

            e.HasOne(x => x.Order)
                .WithMany()
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(x => x.InvoiceNo).IsUnique().HasDatabaseName("UQ_Invoice_InvoiceNo");
            e.HasIndex(x => x.OrderId).IsUnique().HasDatabaseName("UQ_Invoice_OrderId");
        });

        modelBuilder.Entity<AppUser>(e =>
        {
            e.ToTable("APP_USER");
            e.HasKey(x => x.Id);
            e.Property(x => x.Username).HasMaxLength(64).IsRequired();
            e.Property(x => x.PasswordHash).HasMaxLength(256).IsRequired();
            e.Property(x => x.DisplayName).HasMaxLength(100).IsRequired();
            e.Property(x => x.Role).HasMaxLength(16).IsRequired();
            e.HasIndex(x => x.Username).IsUnique().HasDatabaseName("UQ_AppUser_Username");
            e.HasIndex(x => x.CustomerId).HasDatabaseName("IX_AppUser_CustomerId");
        });

        modelBuilder.Entity<PasswordResetToken>(e =>
        {
            e.ToTable("PASSWORD_RESET");
            e.HasKey(x => x.Id);
            e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.TokenHash).IsUnique().HasDatabaseName("UQ_PasswordReset_TokenHash");
            e.HasIndex(x => x.UserId).HasDatabaseName("IX_PasswordReset_UserId");
        });
    }
}

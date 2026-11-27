using StockFlow.Inventory.Catalog.Api.Domain;
using StockFlow.Inventory.Persistence;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Catalog.Api.Data;

public class CatalogDbContext(DbContextOptions<CatalogDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();

    public DbSet<Warehouse> Warehouses => Set<Warehouse>();

    public DbSet<Stock> Stocks => Set<Stock>();

    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // rowversion chỉ có trên SQL Server; SQLite (demo local) bỏ cột này.
        var sqlServer = Database.IsSqlServer();

        modelBuilder.Entity<Product>(e =>
        {
            e.ToTable("PRODUCT", t => t.HasCheckConstraint("CK_Product_UnitPrice", "[UnitPrice] >= 0"));
            e.HasKey(x => x.Id);
            e.Property(x => x.Code).HasMaxLength(32).IsRequired();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Category).HasMaxLength(64).IsRequired();
            e.Property(x => x.ImageUrl).HasMaxLength(300);
            e.Property(x => x.Unit).HasMaxLength(16).IsRequired();
            e.Property(x => x.UnitPrice).HasColumnType("decimal(18,2)");
            e.ConfigureRowVersion(nameof(Product.RowVersion), sqlServer);
            e.HasIndex(x => x.Code).IsUnique().HasDatabaseName("UQ_Product_Code");
        });

        modelBuilder.Entity<Warehouse>(e =>
        {
            e.ToTable("WAREHOUSE");
            e.HasKey(x => x.Id);
            e.Property(x => x.Code).HasMaxLength(16).IsRequired();
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.Location).HasMaxLength(200);
            e.HasIndex(x => x.Code).IsUnique().HasDatabaseName("UQ_Warehouse_Code");
        });

        modelBuilder.Entity<Stock>(e =>
        {
            e.ToTable("STOCK", t =>
            {
                t.HasCheckConstraint("CK_Stock_QuantityOnHand", "[QuantityOnHand] >= 0");
                t.HasCheckConstraint("CK_Stock_QuantityReserved", "[QuantityReserved] >= 0 AND [QuantityReserved] <= [QuantityOnHand]");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.QuantityOnHand).IsRequired();
            e.Property(x => x.QuantityReserved).IsRequired();
            e.ConfigureRowVersion(nameof(Stock.RowVersion), sqlServer);

            e.HasOne(x => x.Product)
                .WithMany(p => p.Stocks)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.Warehouse)
                .WithMany(w => w.Stocks)
                .HasForeignKey(x => x.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(x => new { x.ProductId, x.WarehouseId })
                .IsUnique()
                .HasDatabaseName("UQ_Stock_Product_Warehouse");
        });

        modelBuilder.Entity<StockMovement>(e =>
        {
            e.ToTable("STOCK_MOVEMENT");
            e.HasKey(x => x.Id);
            e.Property(x => x.MovementType).HasConversion<string>().HasMaxLength(16).IsRequired();
            e.Property(x => x.ReferenceType).HasMaxLength(32);
            e.Property(x => x.ReferenceNo).HasMaxLength(32);
            e.Property(x => x.Note).HasMaxLength(500);
            e.Property(x => x.CreatedBy).HasMaxLength(64);
            e.Property(x => x.OccurredAt).IsRequired();

            e.HasOne<Product>()
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne<Warehouse>()
                .WithMany()
                .HasForeignKey(x => x.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(x => new { x.ProductId, x.OccurredAt })
                .IsDescending(false, true)
                .HasDatabaseName("IX_Movement_Product_OccurredAt");

            e.HasIndex(x => x.ReferenceNo).HasDatabaseName("IX_Movement_ReferenceNo");
        });
    }
}

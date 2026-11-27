using StockFlow.Inventory.Catalog.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Catalog.Api.Data;

/// <summary>Demo seed data for dev/demo. Idempotent: only seeds when PRODUCT table is empty.</summary>
public static class CatalogSeeder
{
    public static async Task SeedAsync(CatalogDbContext db, CancellationToken ct = default)
    {
        if (await db.Products.AnyAsync(ct))
        {
            return;
        }

        var warehouses = new List<Warehouse>
        {
            new() { Code = "WH-SIN", Name = "Singapore DC", Location = "Jurong East, Singapore" },
            new() { Code = "WH-RTM", Name = "Rotterdam DC", Location = "Maasvlakte, Rotterdam" }
        };
        db.Warehouses.AddRange(warehouses);

        var products = new List<Product>
        {
            new() { Code = "P-1001", Name = "USB-C Cable 1m", Category = "Cable", UnitPrice = 12.00m, ImageUrl = "/products/photos/p-1001.jpg" },
            new() { Code = "P-1002", Name = "Wireless Mouse", Category = "Peripheral", UnitPrice = 35.00m, ImageUrl = "/products/photos/p-1002.jpg" },
            new() { Code = "P-1003", Name = "Mechanical Keyboard", Category = "Peripheral", UnitPrice = 128.00m, ImageUrl = "/products/photos/p-1003.jpg" },
            new() { Code = "P-2001", Name = "A4 Copy Paper 500 sheets", Category = "Office", UnitPrice = 6.50m, ImageUrl = "/products/photos/p-2001.jpg" },
            new() { Code = "P-2002", Name = "Toner Cartridge Black", Category = "Consumable", UnitPrice = 89.00m, ImageUrl = "/products/photos/p-2002.jpg" },
            new() { Code = "P-3001", Name = "24 inch Monitor", Category = "Display", UnitPrice = 248.00m, ImageUrl = "/products/photos/p-3001.jpg" },
            new() { Code = "P-3002", Name = "Laptop Stand Aluminium", Category = "Accessory", UnitPrice = 42.00m, ImageUrl = "/products/photos/p-3002.jpg" },
            new() { Code = "P-4001", Name = "Cat6 LAN Cable 2m", Category = "Cable", UnitPrice = 7.80m, ImageUrl = "/products/photos/p-4001.jpg" }
        };
        db.Products.AddRange(products);
        await db.SaveChangesAsync(ct);

        var initialQuantities = new[] { 500, 320, 150, 1_200, 80, 60, 220, 640 };
        var movements = new List<StockMovement>();

        for (var i = 0; i < products.Count; i++)
        {
            foreach (var warehouse in warehouses)
            {
                // Rotterdam keeps lower stock than Singapore so the shortage path is easy to demo.
                var quantity = warehouse.Code == "WH-SIN" ? initialQuantities[i] : initialQuantities[i] / 4;
                var stock = new Stock { ProductId = products[i].Id, WarehouseId = warehouse.Id };
                stock.Receive(quantity);
                db.Stocks.Add(stock);

                movements.Add(new StockMovement
                {
                    ProductId = products[i].Id,
                    WarehouseId = warehouse.Id,
                    MovementType = MovementType.Receipt,
                    Quantity = quantity,
                    ReferenceType = "Manual",
                    ReferenceNo = $"INIT-{warehouse.Code}",
                    Note = "Opening balance",
                    CreatedBy = "seeder"
                });
            }
        }

        db.StockMovements.AddRange(movements);
        await db.SaveChangesAsync(ct);
    }
}

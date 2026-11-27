using StockFlow.Inventory.BuildingBlocks.Security;
using StockFlow.Inventory.Contracts.Security;
using StockFlow.Inventory.Ordering.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Ordering.Api.Data;

/// <summary>Demo seed data for dev/demo: a few international customers + 3 role-based accounts.</summary>
public static class OrderingSeeder
{
    public static async Task SeedAsync(
        OrderingDbContext db,
        IConfiguration configuration,
        CancellationToken ct = default)
    {
        if (!await db.Customers.AnyAsync(ct))
        {
            db.Customers.AddRange(
                new Customer
                {
                    Code = "C-0001",
                    Name = "Northwind Traders",
                    Email = "purchasing@northwind.example",
                    Phone = "+31 10 123 4567",
                    Address = "Waalhaven 12, 3088 Rotterdam, Netherlands"
                },
                new Customer
                {
                    Code = "C-0002",
                    Name = "Contoso Retail Group",
                    Email = "orders@contoso.example",
                    Phone = "+65 6123 4567",
                    Address = "1 Raffles Place #20-01, Singapore 048616"
                },
                new Customer
                {
                    Code = "C-0003",
                    Name = "Fabrikam Industries",
                    Email = "supply@fabrikam.example",
                    Phone = "+1 512 555 0142",
                    Address = "400 Congress Ave, Austin, TX 78701, USA"
                });

            await db.SaveChangesAsync(ct);
        }

        var firstCustomerId = await db.Customers.OrderBy(c => c.Id).Select(c => (int?)c.Id).FirstOrDefaultAsync(ct);

        if (await db.Users.AnyAsync(ct))
        {
            return;
        }

        var adminPassword = configuration["Seed:AdminPassword"] ?? "Admin@123";
        var salesPassword = configuration["Seed:SalesPassword"] ?? "Sales@123";
        var viewerPassword = configuration["Seed:ViewerPassword"] ?? "Viewer@123";
        var customerPassword = configuration["Seed:CustomerPassword"] ?? "Customer@123";

        db.Users.AddRange(
            new AppUser
            {
                Username = "admin",
                PasswordHash = PasswordHasher.Hash(adminPassword),
                DisplayName = "System Administrator",
                Role = Roles.Admin
            },
            new AppUser
            {
                Username = "sales",
                PasswordHash = PasswordHasher.Hash(salesPassword),
                DisplayName = "Alex Morgan",
                Role = Roles.Sales
            },
            new AppUser
            {
                Username = "viewer",
                PasswordHash = PasswordHasher.Hash(viewerPassword),
                DisplayName = "Dana Whitfield",
                Role = Roles.Viewer
            },
            new AppUser
            {
                Username = "customer",
                PasswordHash = PasswordHasher.Hash(customerPassword),
                DisplayName = "Chloe Nguyen",
                Role = Roles.Customer,
                CustomerId = firstCustomerId
            });

        await db.SaveChangesAsync(ct);
    }
}

using StockFlow.Inventory.Catalog.Api.Data;
using StockFlow.Inventory.Ordering.Api.Data;
using Microsoft.EntityFrameworkCore;

// Sinh DDL từ EF model mà KHÔNG cần kết nối SQL Server.
// Mục đích: (1) verify model/config, (2) xuất schema tham chiếu cho tài liệu + DBA review.
var dummy = "Server=localhost;Database=StockFlowModelCheck;Trusted_Connection=True;TrustServerCertificate=True";

var catalogOptions = new DbContextOptionsBuilder<CatalogDbContext>().UseSqlServer(dummy).Options;
var orderingOptions = new DbContextOptionsBuilder<OrderingDbContext>().UseSqlServer(dummy).Options;

using (var catalog = new CatalogDbContext(catalogOptions))
{
    var script = catalog.Database.GenerateCreateScript();
    Directory.CreateDirectory("database/sqlserver");
    await File.WriteAllTextAsync("database/sqlserver/catalog-schema.sql", script);
    Console.WriteLine($"Catalog: {catalog.Model.GetEntityTypes().Count()} entity types → catalog-schema.sql ({script.Length} chars)");
}

using (var ordering = new OrderingDbContext(orderingOptions))
{
    var script = ordering.Database.GenerateCreateScript();
    Directory.CreateDirectory("database/sqlserver");
    await File.WriteAllTextAsync("database/sqlserver/ordering-schema.sql", script);
    Console.WriteLine($"Ordering: {ordering.Model.GetEntityTypes().Count()} entity types → ordering-schema.sql ({script.Length} chars)");
}

Console.WriteLine("OK");

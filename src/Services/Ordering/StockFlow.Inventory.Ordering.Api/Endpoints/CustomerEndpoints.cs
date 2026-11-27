using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Ordering.Api.Data;
using StockFlow.Inventory.Ordering.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Ordering.Api.Endpoints;

public static class CustomerEndpoints
{
    public static IEndpointRouteBuilder MapCustomerEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/customers").WithTags("Customers").RequireAuthorization();

        group.MapGet("", async (OrderingDbContext db, CancellationToken ct) =>
        {
            var customers = await db.Customers
                .AsNoTracking()
                .Where(c => c.IsActive)
                .OrderBy(c => c.Code)
                .ToListAsync(ct);

            return Results.Ok(customers.Select(Mapping.ToCustomerDto).ToList());
        })
        .WithName("GetCustomers")
        .Produces<List<CustomerDto>>();

        return app;
    }
}

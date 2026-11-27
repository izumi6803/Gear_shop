using StockFlow.Inventory.Contracts;
using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Ordering.Api.Data;
using StockFlow.Inventory.Ordering.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Ordering.Api.Endpoints;

public static class InvoiceEndpoints
{
    public static IEndpointRouteBuilder MapInvoiceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/invoices").WithTags("Invoices").RequireAuthorization();

        group.MapGet("", async (OrderingDbContext db, int take = 50, CancellationToken ct = default) =>
        {
            take = Math.Clamp(take, 1, 200);

            var invoices = await db.Invoices
                .AsNoTracking()
                .Include(i => i.Order)
                .OrderByDescending(i => i.IssuedAt)
                .Take(take)
                .ToListAsync(ct);

            return Results.Ok(invoices
                .Select(i => Mapping.ToInvoiceDto(i, i.Order.OrderNo))
                .ToList());
        })
        .WithName("GetInvoices")
        .Produces<List<InvoiceDto>>();

        group.MapGet("/{id:int}", async (int id, OrderingDbContext db, CancellationToken ct) =>
        {
            var invoice = await db.Invoices
                .AsNoTracking()
                .Include(i => i.Order)
                    .ThenInclude(o => o.Customer)
                .Include(i => i.Order)
                    .ThenInclude(o => o.Lines)
                .FirstOrDefaultAsync(i => i.Id == id, ct);

            if (invoice is null)
            {
                return Results.NotFound(new ApiError("INVOICE_NOT_FOUND", $"Không tìm thấy hoá đơn #{id}."));
            }

            return Results.Ok(Mapping.ToInvoiceDetailDto(invoice));
        })
        .WithName("GetInvoiceById")
        .Produces<InvoiceDetailDto>()
        .Produces<ApiError>(StatusCodes.Status404NotFound);

        return app;
    }
}

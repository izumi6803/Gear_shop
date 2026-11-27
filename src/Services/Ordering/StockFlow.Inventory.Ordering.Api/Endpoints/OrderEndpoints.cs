using StockFlow.Inventory.Contracts;
using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Contracts.Security;
using StockFlow.Inventory.Ordering.Api.Domain;
using StockFlow.Inventory.Ordering.Api.Services;
using Microsoft.AspNetCore.Authorization;

namespace StockFlow.Inventory.Ordering.Api.Endpoints;

public static class OrderEndpoints
{
    public static IEndpointRouteBuilder MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/orders").WithTags("Orders").RequireAuthorization();

        group.MapGet("", async (
            OrderService service,
            string? status,
            int? customerId,
            int page = 1,
            int pageSize = 20,
            CancellationToken ct = default) =>
        {
            OrderStatus? parsed = null;
            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!Enum.TryParse<OrderStatus>(status, ignoreCase: true, out var value))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["status"] = ["Trạng thái không hợp lệ (Draft|Confirmed|Shipped|Cancelled)."]
                    });
                }

                parsed = value;
            }

            return Results.Ok(await service.ListAsync(parsed, customerId, page, pageSize, ct));
        })
        .WithName("GetOrders")
        .Produces<PagedResult<OrderDto>>();

        group.MapGet("/{id:int}", async (int id, OrderService service, CancellationToken ct) =>
            Results.Ok(await service.GetAsync(id, ct)))
        .WithName("GetOrderById")
        .Produces<OrderDto>()
        .Produces<ApiError>(StatusCodes.Status404NotFound);

        group.MapPost("", async (
            CreateOrderRequest request,
            OrderService service,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            var createdBy = httpContext.User.Identity?.Name ?? "anonymous";
            var order = await service.CreateAsync(request, createdBy, ct);
            return Results.Created($"/api/orders/{order.Id}", order);
        })
        .RequireAuthorization(new AuthorizeAttribute { Roles = Roles.AdminOrSales })
        .WithName("CreateOrder")
        .Produces<OrderDto>(StatusCodes.Status201Created)
        .Produces<ApiError>(StatusCodes.Status422UnprocessableEntity);

        group.MapPost("/{id:int}/confirm", async (int id, OrderService service, CancellationToken ct) =>
            Results.Ok(await service.ConfirmAsync(id, ct)))
        .RequireAuthorization(new AuthorizeAttribute { Roles = Roles.AdminOrSales })
        .WithName("ConfirmOrder")
        .Produces<OrderDto>()
        .Produces<ApiError>(StatusCodes.Status409Conflict);

        group.MapPost("/{id:int}/cancel", async (int id, OrderService service, CancellationToken ct) =>
            Results.Ok(await service.CancelAsync(id, ct)))
        .RequireAuthorization(new AuthorizeAttribute { Roles = Roles.AdminOrSales })
        .WithName("CancelOrder")
        .Produces<OrderDto>()
        .Produces<ApiError>(StatusCodes.Status409Conflict);

        group.MapPost("/{id:int}/ship", async (int id, OrderService service, CancellationToken ct) =>
            Results.Ok(await service.ShipAsync(id, ct)))
        .RequireAuthorization(new AuthorizeAttribute { Roles = Roles.AdminOrSales })
        .WithName("ShipOrder")
        .Produces<ShipResult>()
        .Produces<ApiError>(StatusCodes.Status409Conflict);

        return app;
    }
}

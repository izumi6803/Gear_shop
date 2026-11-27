using System.Security.Claims;
using StockFlow.Inventory.Contracts;
using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Contracts.Security;
using StockFlow.Inventory.Ordering.Api.Services;

namespace StockFlow.Inventory.Ordering.Api.Endpoints;

public static class ShopEndpoints
{
    public static IEndpointRouteBuilder MapShopEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/shop").WithTags("Shop").RequireAuthorization();

        // Đơn của chính khách đang đăng nhập.
        group.MapGet("/orders", async (ClaimsPrincipal principal, ShopService shop, CancellationToken ct) =>
        {
            var orders = await shop.MyOrdersAsync(Username(principal), ct);
            return Results.Ok(orders);
        })
        .WithName("GetMyOrders")
        .Produces<List<OrderDto>>();

        // Đặt hàng từ giỏ: tạo đơn + giữ tồn.
        group.MapPost("/checkout", async (
            ShopCheckoutRequest request,
            ClaimsPrincipal principal,
            ShopService shop,
            CancellationToken ct) =>
        {
            var order = await shop.CheckoutAsync(Username(principal), request, ct);
            return Results.Ok(order);
        })
        .WithName("ShopCheckout")
        .Produces<OrderDto>()
        .Produces<ApiError>(StatusCodes.Status400BadRequest);

        // Thanh toán mô phỏng (không gọi cổng thật).
        group.MapPost("/orders/{id:int}/pay", async (
            int id,
            PayRequest request,
            ClaimsPrincipal principal,
            ShopService shop,
            CancellationToken ct) =>
        {
            var isStaff = principal.IsInRole(Roles.Admin) || principal.IsInRole(Roles.Sales);
            var order = await shop.PayAsync(Username(principal), isStaff, id, request, ct);
            return Results.Ok(order);
        })
        .WithName("ShopPay")
        .Produces<OrderDto>()
        .Produces<ApiError>(StatusCodes.Status400BadRequest);

        // Thu tiền mặt cho đơn COD (nhân viên).
        group.MapPost("/orders/{id:int}/collect-cash", async (
            int id,
            ClaimsPrincipal principal,
            ShopService shop,
            CancellationToken ct) =>
        {
            if (!principal.IsInRole(Roles.Admin) && !principal.IsInRole(Roles.Sales))
            {
                return Results.Forbid();
            }

            var order = await shop.CollectCashAsync(id, ct);
            return Results.Ok(order);
        })
        .WithName("ShopCollectCash")
        .Produces<OrderDto>()
        .Produces(StatusCodes.Status403Forbidden)
        .Produces<ApiError>(StatusCodes.Status400BadRequest);

        return app;
    }

    internal static string Username(ClaimsPrincipal principal) =>
        principal.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? principal.FindFirstValue("sub")
        ?? throw new InvalidOperationException("Token thiếu claim định danh người dùng.");
}
